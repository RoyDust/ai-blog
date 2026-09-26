#!/usr/bin/env bash
set -euo pipefail

# Exercise the production Compose healthcheck against an isolated, disposable DB.
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
work=$(mktemp -d)
project="inkforge-health-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
compose() { docker compose -p "$project" -f "$work/compose.yml" -f "$work/database.yml" "$@"; }
cleanup() { compose down --volumes --remove-orphans >/dev/null 2>&1 || true; rm -rf -- "$work"; }
trap cleanup EXIT
cp "$root/docker-compose.prod.yml" "$work/compose.yml"
cat > "$work/.env" <<'EOF'
DATABASE_URL=postgresql://smoke:smoke@smoke-db:5432/image_smoke?schema=public
AUTH_SECRET=image-smoke-auth-secret
NEXTAUTH_SECRET=image-smoke-nextauth-secret
NEXTAUTH_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
EOF
cat > "$work/database.yml" <<'EOF'
services:
  smoke-db:
    image: postgres:16
    environment:
      POSTGRES_USER: smoke
      POSTGRES_PASSWORD: smoke
      POSTGRES_DB: image_smoke
EOF
compose config --quiet
compose run --rm --no-deps app node scripts/check-web-readiness.cjs
compose up -d --no-build

expect_http() {
  local route="$1" expected="$2" actual
  for attempt in {1..30}; do
    actual=$(curl --silent --max-time 4 --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:3000/api/health/$route") || actual=unavailable
    if [[ "$actual" == "$expected" ]]; then echo "$route: $expected"; return; fi
    sleep 2
  done
  echo "Image smoke failed: $route expected $expected, observed $actual" >&2
  return 1
}
expect_health() {
  local expected="$1" id state
  id=$(compose ps -a -q app)
  for attempt in {1..18}; do
    state=$(docker inspect --format '{{.State.Health.Status}}' "$id")
    if [[ "$state" == "$expected" ]]; then echo "Docker health: $expected"; return; fi
    sleep 5
  done
  echo "Image smoke failed: Docker health expected $expected, observed $state" >&2
  return 1
}
expect_http live 200
expect_http ready 200
expect_health healthy
compose stop smoke-db
expect_http live 200
expect_http ready 503
expect_health unhealthy
compose start smoke-db
expect_http ready 200
expect_health healthy
echo 'Production image database-outage smoke passed'
