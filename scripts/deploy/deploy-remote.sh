#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${DEPLOY_PATH:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [[ -d "$APP_DIR/current" ]]; then
  APP_DIR="$APP_DIR/current"
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in $APP_DIR" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" down --remove-orphans
docker compose -f "$COMPOSE_FILE" up -d --build

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
