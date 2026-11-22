#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INVOKED_DIR="$(pwd)"
DEPLOY_ROOT="${DEPLOY_PATH:-$INVOKED_DIR}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

canonical_dir() {
  (cd "$1" && pwd -P)
}

to_host_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}

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

load_scalar_dotenv_vars() {
  local env_file="$1"
  shift
  local env_key env_val reader_pid
  exec 3< <(node "$(to_host_path "$SCRIPT_DIR/read-dotenv.cjs")" "$(to_host_path "$env_file")" "$@")
  reader_pid=$!
  while IFS= read -r -d '' -u 3 env_key && IFS= read -r -d '' -u 3 env_val; do
    export "$env_key=$env_val"
  done
  exec 3<&-
  wait "$reader_pid"
}

prune_old_image_tags() {
  local stale_tag
  while IFS= read -r -d '' stale_tag; do
    [[ -n "$stale_tag" ]] || continue
    docker image rm "$stale_tag" >/dev/null 2>&1 || true
  done < <(
    docker image ls --format '{{.Repository}}:{{.Tag}}' 'my-next-app:pre-*' 2>/dev/null |
      node "$(to_host_path "$SCRIPT_DIR/prune-artifacts.cjs")" --select-stale-tags 5 || true
  )
}

INVOKED_REAL="$(canonical_dir "$INVOKED_DIR")"
DEPLOY_ROOT_REAL="$(canonical_dir "$DEPLOY_ROOT")"

if [[ -n "${RELEASE_DIR:-}" ]]; then
  APP_DIR="$RELEASE_DIR"
elif [[ "$INVOKED_REAL" != "$DEPLOY_ROOT_REAL" ]]; then
  APP_DIR="$INVOKED_DIR"
elif [[ -d "$DEPLOY_ROOT/current" ]]; then
  APP_DIR="$DEPLOY_ROOT/current"
else
  APP_DIR="$DEPLOY_ROOT"
fi

cd "$APP_DIR"
APP_DIR_REAL="$(canonical_dir "$APP_DIR")"

if [[ ! -f .env ]]; then
  echo "Missing .env in $APP_DIR" >&2
  exit 1
fi
if [[ ! -L .env ]]; then
  chmod 600 .env 2>/dev/null || true
fi

load_scalar_dotenv_vars ".env" \
  NEXTAUTH_URL \
  NEXT_PUBLIC_SITE_URL \
  COMPOSE_PROJECT_NAME \
  HTTP_PROXY \
  HTTPS_PROXY \
  ALL_PROXY \
  http_proxy \
  https_proxy \
  all_proxy \
  npm_config_proxy \
  npm_config_https_proxy \
  NPM_CONFIG_PROXY \
  NPM_CONFIG_HTTPS_PROXY

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

if [[ -n "${PREBUILT_IMAGE_ID:-}" ]]; then
  [[ "$PREBUILT_IMAGE_ID" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid prebuilt image identity' >&2; exit 1; }
  actual_image=$(docker image inspect my-next-app:latest --format '{{.Id}}')
  [[ "$actual_image" == "$PREBUILT_IMAGE_ID" ]] || { echo 'Prebuilt image identity changed' >&2; exit 1; }
  echo 'Reusing previously validated image for release recovery'
elif [[ -f my-next-app.tar.gz ]]; then
  echo "Loading prebuilt Docker image from release bundle" >&2
  gzip -dc my-next-app.tar.gz | docker load
  rm -f my-next-app.tar.gz
else
  # Fallback for manual deploys that do not upload a prebuilt image. Build before
  # touching the running container so a network/build failure does not turn a
  # deploy failure into an outage.
  docker compose -f "$COMPOSE_FILE" build app
fi

# The candidate contains the same configuration policy consumed by /api/health/ready.
docker compose -f "$COMPOSE_FILE" run --rm --no-deps app node scripts/check-web-readiness.cjs

if [[ "${BACKUP_BEFORE_DEPLOY:-0}" == 1 ]]; then
  export DEPLOY_PATH="$DEPLOY_ROOT"
  if [[ -f scripts/deploy/backup-production.sh ]]; then
    bash scripts/deploy/backup-production.sh
  else
    bash "$SCRIPT_DIR/backup-production.sh"
  fi
fi

run_database_migrations() {
  if ! compgen -G "prisma/migrations/*/" > /dev/null; then
    echo "Missing Prisma migrations in prisma/migrations" >&2
    exit 1
  fi
  if [[ "${SKIP_DATABASE_MIGRATIONS:-0}" == "1" ]]; then
    echo "Skipping prisma migrate deploy (SKIP_DATABASE_MIGRATIONS=1); checking read-only migrate status"
    docker compose -f "$COMPOSE_FILE" run --rm --no-deps app pnpm prisma migrate status
    return
  fi
  docker compose -f "$COMPOSE_FILE" run --rm --no-deps app pnpm prisma migrate deploy
}

# Apply additive schema changes before starting the replacement app. New code
# may read new tables/columns immediately, while the old app tolerates them.
run_database_migrations

docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans

print_deployment_diagnostics() (
  # Diagnostic failures must never replace the failed health gate.
  set +e
  case "${1:-}" in
    'running healthy') echo 'app status: running; health: healthy' ;;
    'running starting') echo 'app status: running; health: starting' ;;
    'running unhealthy') echo 'app status: running; health: unhealthy' ;;
    'running '|'running') echo 'app status: running; health: unavailable' ;;
    'exited '*|'exited') echo 'app status: exited; health: unavailable' ;;
    'dead '*|'dead') echo 'app status: dead; health: unavailable' ;;
    'restarting '*|'restarting') echo 'app status: restarting; health: unavailable' ;;
    *) echo 'app status: unavailable; health: unavailable' ;;
  esac

  if ! command -v timeout >/dev/null 2>&1; then
    echo 'Recent logs unavailable: bounded reader is unavailable'
    exit 0
  fi
  echo 'Recent log signals (last 5 minutes; at most 60 entries, 16 KiB input, 20 signals):'
  # Only emit fixed, allowlisted signals. Free-form messages can contain unlabeled
  # secrets, so no raw log text, environment values, URLs or inspect Config is printed.
  timeout --signal=TERM --kill-after=1s 5s docker compose -f "$COMPOSE_FILE" logs --no-color --no-log-prefix --tail 60 --since 5m app 2>/dev/null |
    head -c 16384 2>/dev/null |
    LC_ALL=C awk '
      NR <= 60 {
        seen++; signal = ""; line = toupper($0);
        if (line ~ /(^|[^A-Z0-9_])ECONNREFUSED([^A-Z0-9_]|$)/) signal = "connection refused (ECONNREFUSED)";
        else if (line ~ /(^|[^A-Z0-9_])ETIMEDOUT([^A-Z0-9_]|$)/) signal = "dependency timed out (ETIMEDOUT)";
        else if (line ~ /(^|[^A-Z0-9_])ENOTFOUND([^A-Z0-9_]|$)/) signal = "hostname resolution failed (ENOTFOUND)";
        else if (line ~ /(^|[^A-Z0-9_])EAI_AGAIN([^A-Z0-9_]|$)/) signal = "temporary DNS failure (EAI_AGAIN)";
        else if (line ~ /(^|[^A-Z0-9_])ECONNRESET([^A-Z0-9_]|$)/) signal = "connection reset (ECONNRESET)";
        else if (line ~ /(^|[^A-Z0-9_])EADDRINUSE([^A-Z0-9_]|$)/) signal = "listen address is already in use (EADDRINUSE)";
        else if (line ~ /(^|[^A-Z0-9_])P1000([^A-Z0-9_]|$)/) signal = "database authentication failed (P1000)";
        else if (line ~ /(^|[^A-Z0-9_])P1001([^A-Z0-9_]|$)/) signal = "database is unreachable (P1001)";
        else if (line ~ /(^|[^A-Z0-9_])P1002([^A-Z0-9_]|$)/) signal = "database connection timed out (P1002)";
        else if (line ~ /(^|[^A-Z0-9_])P2024([^A-Z0-9_]|$)/) signal = "database pool timed out (P2024)";
        else if (line ~ /HEAP OUT OF MEMORY/) signal = "JavaScript heap exhausted";
        else if (line ~ /READINESS/ && line ~ /FAIL|UNAVAILABLE|TIMEOUT/) signal = "readiness check failed";
        if (signal != "") {
          matched++;
          if (matched <= 20) printf "[log %d] %s\n", NR, signal;
        } else omitted++;
      }
      END {
        if (!seen) print "No recent log entries were read";
        if (omitted) printf "Unclassified log entries omitted: %d\n", omitted;
        if (matched > 20) print "Additional diagnostic signals omitted";
      }
    ' 2>/dev/null
  local -a diagnostic_status=("${PIPESTATUS[@]}")
  if (( (diagnostic_status[0] != 0 && diagnostic_status[0] != 141) || diagnostic_status[1] != 0 || diagnostic_status[2] != 0 )); then
    echo 'Recent logs unavailable or incomplete: bounded read failed'
  fi
  exit 0
)

write_last_healthy_release() {
  local resolved_release_sha="${RELEASE_SHA:-}"
  if [[ -z "$resolved_release_sha" ]]; then
    resolved_release_sha="$(basename "$APP_DIR_REAL")"
  fi
  local healthy_image_id=""
  healthy_image_id="$(docker image inspect my-next-app:latest --format '{{.Id}}' 2>/dev/null | tr -d '\r' || true)"
  local last_backup_dir=""
  if [[ "${BACKUP_BEFORE_DEPLOY:-0}" == 1 || -d "$DEPLOY_ROOT_REAL/shared/backups" ]]; then
    last_backup_dir="$DEPLOY_ROOT_REAL/shared/backups"
  elif [[ -f "$DEPLOY_ROOT_REAL/shared/last-healthy-release" ]]; then
    last_backup_dir="$(sed -n 's/^LAST_BACKUP_DIR=//p' "$DEPLOY_ROOT_REAL/shared/last-healthy-release" | head -n 1 | tr -d '\r')"
  fi

  mkdir -p "$DEPLOY_ROOT_REAL/shared"
  local meta_tmp="$DEPLOY_ROOT_REAL/shared/.last-healthy-release.tmp.$$"
  (
    umask 077
    printf 'RELEASE_SHA=%s\nIMAGE_ID=%s\nLAST_BACKUP_DIR=%s\n' \
      "$resolved_release_sha" \
      "$healthy_image_id" \
      "$last_backup_dir" > "$meta_tmp"
  )
  chmod 600 "$meta_tmp" 2>/dev/null || true
  mv -f "$meta_tmp" "$DEPLOY_ROOT_REAL/shared/last-healthy-release"
}

fail_deployment() {
  echo "Deployment failed: $1" >&2
  print_deployment_diagnostics "${2:-}" >&2 || true
  exit 1
}

for attempt in {1..12}; do
  container_id=$(docker compose -f "$COMPOSE_FILE" ps -a -q app 2>/dev/null) || {
    fail_deployment 'app service state is unreadable'
  }
  if [[ -z "$container_id" || "$container_id" == *$'\n'* ]]; then
    fail_deployment 'expected one app container'
  fi
  state=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id" 2>/dev/null) || {
    fail_deployment 'app health is unreadable'
  }
  case "$state" in
    'running healthy')
      if [[ -n "${RELEASE_DIR:-}" || "$APP_DIR_REAL" == "$DEPLOY_ROOT_REAL/releases/"* ]]; then
        if [[ -L "$DEPLOY_ROOT_REAL/current/.env" && -f "$DEPLOY_ROOT_REAL/shared/.env" && ! "$DEPLOY_ROOT_REAL/current" -ef "$APP_DIR_REAL" ]]; then
          prev_env_tmp="$DEPLOY_ROOT_REAL/current/.env.snapshot.$$"
          install -m 600 "$DEPLOY_ROOT_REAL/shared/.env" "$prev_env_tmp"
          mv -f "$prev_env_tmp" "$DEPLOY_ROOT_REAL/current/.env"
        fi
        mkdir -p "$DEPLOY_ROOT_REAL/shared"
        if [[ ! "$APP_DIR_REAL/.env" -ef "$DEPLOY_ROOT_REAL/shared/.env" ]]; then
          install -m 600 "$APP_DIR_REAL/.env" "$DEPLOY_ROOT_REAL/shared/.env"
        fi
        ln -sfn "$APP_DIR_REAL" "$DEPLOY_ROOT_REAL/current" 2>/dev/null ||
          node "$(to_host_path "$SCRIPT_DIR/prune-artifacts.cjs")" --switch-current "$(to_host_path "$APP_DIR_REAL")" "$(to_host_path "$DEPLOY_ROOT_REAL/current")"
      fi
      write_last_healthy_release
      node "$(to_host_path "$SCRIPT_DIR/prune-artifacts.cjs")" --prune-files "$(to_host_path "$DEPLOY_ROOT_REAL")" "$(to_host_path "$APP_DIR_REAL")" || true
      prune_old_image_tags
      echo 'Deployment succeeded: app is healthy'
      docker image prune -f >/dev/null 2>&1 || true
      exit 0
      ;;
    'running starting') ;;
    *) fail_deployment 'app is not running with a usable health state' "$state" ;;
  esac
  if (( attempt < 12 )); then sleep 5; fi
done
fail_deployment 'readiness timed out after 12 observations' "$state"
