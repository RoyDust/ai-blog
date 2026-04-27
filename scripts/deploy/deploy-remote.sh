#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${DEPLOY_PATH:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

clear_loopback_proxy_var() {
  local var_name="$1"
  local current_value="${!var_name:-}"

  if [[ -z "$current_value" ]]; then
    return
  fi

  if [[ "$current_value" =~ ^[a-zA-Z0-9+.-]+://(127\.0\.0\.1|localhost)(:[0-9]+)?(/.*)?$ ]] || [[ "$current_value" =~ ^(127\.0\.0\.1|localhost)(:[0-9]+)?$ ]]; then
    echo "Unsetting loopback proxy $var_name for docker build" >&2
    unset "$var_name"
  fi
}

if [[ -d "$APP_DIR/current" ]]; then
  APP_DIR="$APP_DIR/current"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in $APP_DIR" >&2
  exit 1
fi

set -a
source .env
set +a

required_env_vars=(
  "DATABASE_URL"
  "AUTH_SECRET"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
  "NEXT_PUBLIC_SITE_URL"
)

missing_env_vars=()
for var_name in "${required_env_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    missing_env_vars+=("$var_name")
  fi
done

if (( ${#missing_env_vars[@]} > 0 )); then
  printf 'Missing required env vars in %s: %s\n' "$APP_DIR/.env" "${missing_env_vars[*]}" >&2
  exit 1
fi

clear_loopback_proxy_var "HTTP_PROXY"
clear_loopback_proxy_var "HTTPS_PROXY"
clear_loopback_proxy_var "ALL_PROXY"
clear_loopback_proxy_var "http_proxy"
clear_loopback_proxy_var "https_proxy"
clear_loopback_proxy_var "all_proxy"
clear_loopback_proxy_var "npm_config_proxy"
clear_loopback_proxy_var "npm_config_https_proxy"
clear_loopback_proxy_var "NPM_CONFIG_PROXY"
clear_loopback_proxy_var "NPM_CONFIG_HTTPS_PROXY"

# Keep enough transient space for CI-uploaded image tarballs and Docker builds.
# These prune only dangling images / build cache, not tagged images or volumes.
docker builder prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true

if [[ -f my-next-app.tar.gz ]]; then
  echo "Loading prebuilt Docker image from release bundle" >&2
  gzip -dc my-next-app.tar.gz | docker load
  rm -f my-next-app.tar.gz
else
  # Fallback for manual deploys that do not upload a prebuilt image. Build before
  # touching the running container so a network/build failure does not turn a
  # deploy failure into an outage.
  docker compose -f "$COMPOSE_FILE" build app
fi

docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans

for attempt in {1..12}; do
  if docker compose -f "$COMPOSE_FILE" ps --status running | grep -q "app"; then
    break
  fi
  sleep 5
done

if compgen -G "prisma/migrations/*" > /dev/null; then
  docker compose -f "$COMPOSE_FILE" exec -T app pnpm prisma migrate deploy
else
  docker compose -f "$COMPOSE_FILE" exec -T app pnpm prisma db push
fi
docker image prune -f >/dev/null 2>&1 || true
