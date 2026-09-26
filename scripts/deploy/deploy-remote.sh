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

# The candidate contains the same configuration policy consumed by /api/health/ready.
docker compose -f "$COMPOSE_FILE" run --rm --no-deps app node scripts/check-web-readiness.cjs

if [[ "${BACKUP_BEFORE_DEPLOY:-0}" == 1 ]]; then
  bash scripts/deploy/backup-production.sh
fi

run_database_migrations() {
  if compgen -G "prisma/migrations/*" > /dev/null; then
    docker compose -f "$COMPOSE_FILE" run --rm --no-deps app pnpm prisma migrate deploy
  else
    docker compose -f "$COMPOSE_FILE" run --rm --no-deps app pnpm prisma db push
  fi
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
