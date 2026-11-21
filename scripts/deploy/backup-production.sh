#!/usr/bin/env bash
set -euo pipefail
umask 077

# Backup failures leave the old app running. Stop its senders only after the
# completed dump has been validated; no schema changes happen in this script.
: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release SHA' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${COMPOSE_FILE:-docker-compose.prod.yml}"

to_host_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
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

PREFLIGHT_NODE_SCRIPT='
const { Client } = require("pg");
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await client.query("SHOW server_version_num");
    const major = Math.floor(Number(result.rows[0].server_version_num) / 10000);
    if (!Number.isInteger(major) || major < 10 || major > 99) throw new Error();
    for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) url.searchParams.delete(key);
    process.stdout.write("PG_VERSION=" + major + "\nDATABASE_URL=" + url.toString() + "\n");
  } finally { await client.end(); }
})().catch(() => { console.error("Backup connection preflight failed"); process.exitCode = 1; });
'

id=$(docker compose -f "$compose_file" ps -q app)
if [[ "$id" == *$'\n'* ]]; then
  echo 'Backup requires at most one running previous app container' >&2
  exit 1
fi

stopped_id=""
env_source=""
if [[ -z "$id" ]]; then
  if [[ -f "$DEPLOY_PATH/shared/.env" ]]; then
    env_source="$DEPLOY_PATH/shared/.env"
  elif [[ -f ".env" ]]; then
    env_source=".env"
  else
    echo 'Backup requires one running previous app container or shared/.env' >&2
    exit 1
  fi
  stopped_id=$(docker compose -f "$compose_file" ps -a -q app 2>/dev/null | head -n 1 || true)
fi

backup_dir="$DEPLOY_PATH/shared/backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$backup_dir/pre-${RELEASE_SHA}-${stamp}.dump"
connection=$(mktemp "$backup_dir/.connection.XXXXXX")
raw_connection=$(mktemp "$backup_dir/.raw-connection.XXXXXX")
cleanup() { rm -f -- "$connection" "$raw_connection" "$backup.partial"; }
trap cleanup EXIT

backup_network=""
if [[ -n "$id" ]]; then
  backup_network="container:$id"
  # Read the actual old process environment without exposing it in CI logs.
  if ! docker exec "$id" node -e "$PREFLIGHT_NODE_SCRIPT" > "$connection"; then
    echo 'Production backup preflight failed; existing app is unchanged' >&2
    exit 1
  fi
else
  parsed_db_url=""
  exec 3< <(node "$(to_host_path "$SCRIPT_DIR/read-dotenv.cjs")" "$(to_host_path "$env_source")" DATABASE_URL)
  reader_pid=$!
  while IFS= read -r -d '' -u 3 env_key && IFS= read -r -d '' -u 3 env_val; do
    if [[ "$env_key" == "DATABASE_URL" ]]; then
      parsed_db_url="$env_val"
    fi
  done
  exec 3<&-
  wait "$reader_pid"

  if [[ -z "$parsed_db_url" || "$parsed_db_url" == *$'\n'* || "$parsed_db_url" == *$'\r'* ]]; then
    echo 'Production backup preflight failed; DATABASE_URL is missing or invalid' >&2
    exit 1
  fi

  printf 'DATABASE_URL=%s\n' "$parsed_db_url" > "$raw_connection"
  backup_network="host"
  if [[ ! "$parsed_db_url" =~ @(127\.0\.0\.1|localhost|\[::1\])(:|/|\?|$) && -n "$stopped_id" ]]; then
    inspected_net=$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$stopped_id" 2>/dev/null | head -n 1 || true)
    if [[ -n "$inspected_net" && "$inspected_net" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
      backup_network="$inspected_net"
    fi
  fi

  if ! docker run --rm --network "$backup_network" --env-file "$raw_connection" my-next-app:latest node -e "$PREFLIGHT_NODE_SCRIPT" > "$connection" 2>/dev/null; then
    echo 'Production backup preflight failed; existing app is unchanged' >&2
    exit 1
  fi
fi

major=$(sed -n 's/^PG_VERSION=//p' "$connection")
[[ "$major" =~ ^[0-9]{2}$ ]] || { echo 'Invalid database version' >&2; exit 1; }
image="postgres:$major"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker pull "$image" >/dev/null
fi

target_container="${id:-$stopped_id}"
if [[ -n "$target_container" ]]; then
  old_image=$(docker inspect --format '{{.Image}}' "$target_container")
  if [[ -n "$old_image" ]]; then
    docker tag "$old_image" "my-next-app:pre-${RELEASE_SHA}-${stamp}"
  fi
fi

if ! docker run --rm --network "$backup_network" --env-file "$connection" "$image" sh -c 'exec pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL"' > "$backup.partial" 2>/dev/null; then
  echo 'Production backup failed; existing app is still running' >&2
  exit 1
fi
if [[ ! -s "$backup.partial" ]] || ! docker run --rm -i "$image" pg_restore --list < "$backup.partial" >/dev/null 2>&1; then
  echo 'Production backup validation failed; existing app is still running' >&2
  exit 1
fi
mv -- "$backup.partial" "$backup"
echo "Validated database backup: $(basename "$backup")"

if [[ -n "$id" ]]; then
  docker stop --time 30 "$id" >/dev/null
  [[ $(docker inspect --format '{{.State.Running}}' "$id") == false ]] || { echo 'Previous app did not stop' >&2; exit 1; }
  echo 'Previous app and in-process Newsletter senders stopped; previous image retained'
elif [[ -n "$stopped_id" ]]; then
  echo 'Previous app container was already stopped; previous image retained'
else
  echo 'Initial deployment backup completed; no previous app container existed'
fi

node "$(to_host_path "$SCRIPT_DIR/prune-artifacts.cjs")" --prune-backups "$(to_host_path "$DEPLOY_PATH")" 5 || true
prune_old_image_tags
