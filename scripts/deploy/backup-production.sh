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

NORMALIZE_DB_URL_NODE_SCRIPT='
try {
  const url = new URL(process.env.RAW_DATABASE_URL || "");
  if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") || !url.hostname) throw new Error();
  for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) url.searchParams.delete(key);
  process.stdout.write(url.toString());
} catch {
  process.exit(1);
}
'

REPLY_DB_URL=""
read_db_url_from_file() {
  local source_file="$1"
  local parsed="" env_key env_val reader_pid
  exec 3< <(node "$(to_host_path "$SCRIPT_DIR/read-dotenv.cjs")" "$(to_host_path "$source_file")" DATABASE_URL)
  reader_pid=$!
  while IFS= read -r -d '' -u 3 env_key && IFS= read -r -d '' -u 3 env_val; do
    if [[ "$env_key" == "DATABASE_URL" ]]; then
      parsed="$env_val"
    fi
  done
  exec 3<&-
  wait "$reader_pid"
  if [[ -z "$parsed" || "$parsed" == *$'\n'* || "$parsed" == *$'\r'* ]]; then
    return 1
  fi
  REPLY_DB_URL="$parsed"
}

normalize_db_url() {
  RAW_DATABASE_URL="$1" node -e "$NORMALIZE_DB_URL_NODE_SCRIPT" 2>/dev/null
}

resolve_network_for_db_url() {
  local db_url="$1" ref_container="${2:-}"
  local net="host" inspected_net=""
  if [[ ! "$db_url" =~ @(127\.0\.0\.1|localhost|\[::1\])(:|/|\?|$) && -n "$ref_container" ]]; then
    inspected_net=$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$ref_container" 2>/dev/null | head -n 1 || true)
    if [[ -n "$inspected_net" && "$inspected_net" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
      net="$inspected_net"
    fi
  fi
  printf '%s' "$net"
}

preflight_env_db_url() {
  local db_url="$1" net="$2" conn_out="$3"
  printf 'DATABASE_URL=%s\n' "$db_url" > "$raw_connection"
  if ! docker run --rm --network "$net" --env-file "$raw_connection" my-next-app:latest node -e "$PREFLIGHT_NODE_SCRIPT" > "$conn_out" 2>/dev/null; then
    echo 'Production backup preflight failed; existing app is unchanged' >&2
    exit 1
  fi
}

REPLY_PG_IMAGE=""
ensure_pg_client_image() {
  local conn_file="$1" major image
  major=$(sed -n 's/^PG_VERSION=//p' "$conn_file" | tr -d '\r')
  [[ "$major" =~ ^[0-9]{2}$ ]] || { echo 'Invalid database version' >&2; exit 1; }
  image="postgres:$major"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker pull "$image" >/dev/null
  fi
  REPLY_PG_IMAGE="$image"
}

dump_and_validate_connection() {
  local conn_file="$1" net="$2" image="$3" out_partial="$4"
  if ! docker run --rm --network "$net" --env-file "$conn_file" "$image" sh -c 'exec pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL"' > "$out_partial" 2>/dev/null; then
    echo 'Production backup failed; existing app is still running' >&2
    exit 1
  fi
  if [[ ! -s "$out_partial" ]] || ! docker run --rm -i "$image" pg_restore --list < "$out_partial" >/dev/null 2>&1; then
    echo 'Production backup validation failed; existing app is still running' >&2
    exit 1
  fi
}

id=$(docker compose -f "$compose_file" ps -q app)
if [[ "$id" == *$'\n'* ]]; then
  echo 'Backup requires at most one running previous app container' >&2
  exit 1
fi

candidate_db_url=""
candidate_normalized_url=""
if [[ -f ".env" ]]; then
  if ! read_db_url_from_file ".env"; then
    echo 'Production backup preflight failed; DATABASE_URL is missing or invalid' >&2
    exit 1
  fi
  candidate_db_url="$REPLY_DB_URL"
  candidate_normalized_url="$(normalize_db_url "$candidate_db_url" || true)"
fi

stopped_id=""
shared_db_url=""
shared_normalized_url=""
if [[ -z "$id" ]]; then
  if [[ -f "$DEPLOY_PATH/shared/.env" ]]; then
    if read_db_url_from_file "$DEPLOY_PATH/shared/.env"; then
      shared_db_url="$REPLY_DB_URL"
      shared_normalized_url="$(normalize_db_url "$shared_db_url" || true)"
    elif [[ -z "$candidate_db_url" ]]; then
      echo 'Production backup preflight failed; DATABASE_URL is missing or invalid' >&2
      exit 1
    fi
  fi
  if [[ -z "$candidate_db_url" && -z "$shared_db_url" ]]; then
    echo 'Backup requires one running previous app container or .env / shared/.env' >&2
    exit 1
  fi
  stopped_id=$(docker compose -f "$compose_file" ps -a -q app 2>/dev/null | head -n 1 || true)
fi

backup_dir="$DEPLOY_PATH/shared/backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$backup_dir/pre-${RELEASE_SHA}-${stamp}.dump"
running_backup="$backup_dir/pre-running-${RELEASE_SHA}-${stamp}.dump"
connection=$(mktemp "$backup_dir/.connection.XXXXXX")
secondary_connection=$(mktemp "$backup_dir/.secondary-connection.XXXXXX")
raw_connection=$(mktemp "$backup_dir/.raw-connection.XXXXXX")
cleanup() {
  rm -f -- "$connection" "$secondary_connection" "$raw_connection" "$backup.partial" "$running_backup.partial"
}
trap cleanup EXIT

target_container="${id:-$stopped_id}"
tag_previous_image() {
  if [[ -n "$target_container" ]]; then
    local old_image
    old_image=$(docker inspect --format '{{.Image}}' "$target_container")
    if [[ -n "$old_image" ]]; then
      docker tag "$old_image" "my-next-app:pre-${RELEASE_SHA}-${stamp}"
    fi
  fi
}

if [[ -n "$id" ]]; then
  backup_network="container:$id"
  # Read the actual old process environment without exposing it in CI logs.
  if ! docker exec "$id" node -e "$PREFLIGHT_NODE_SCRIPT" > "$connection"; then
    echo 'Production backup preflight failed; existing app is unchanged' >&2
    exit 1
  fi
  ensure_pg_client_image "$connection"
  running_image="$REPLY_PG_IMAGE"
  running_normalized_url="$(sed -n 's/^DATABASE_URL=//p' "$connection" | tr -d '\r')"

  need_dual_backup=0
  if [[ -n "$candidate_db_url" ]]; then
    if [[ -z "$candidate_normalized_url" || "$candidate_normalized_url" != "$running_normalized_url" ]]; then
      candidate_network="$(resolve_network_for_db_url "$candidate_db_url" "$id")"
      preflight_env_db_url "$candidate_db_url" "$candidate_network" "$secondary_connection"
      preflighted_candidate_url="$(sed -n 's/^DATABASE_URL=//p' "$secondary_connection" | tr -d '\r')"
      if [[ "$preflighted_candidate_url" != "$running_normalized_url" ]]; then
        need_dual_backup=1
      fi
    fi
  fi

  if (( need_dual_backup == 1 )); then
    ensure_pg_client_image "$secondary_connection"
    candidate_image="$REPLY_PG_IMAGE"

    tag_previous_image
    dump_and_validate_connection "$connection" "$backup_network" "$running_image" "$running_backup.partial"
    dump_and_validate_connection "$secondary_connection" "$candidate_network" "$candidate_image" "$backup.partial"
    mv -- "$running_backup.partial" "$running_backup"
    mv -- "$backup.partial" "$backup"
    echo "Validated database backup: $(basename "$backup") and $(basename "$running_backup")"
  else
    tag_previous_image
    dump_and_validate_connection "$connection" "$backup_network" "$running_image" "$backup.partial"
    mv -- "$backup.partial" "$backup"
    echo "Validated database backup: $(basename "$backup")"
  fi
else
  primary_db_url="${candidate_db_url:-$shared_db_url}"
  primary_network="$(resolve_network_for_db_url "$primary_db_url" "$stopped_id")"
  preflight_env_db_url "$primary_db_url" "$primary_network" "$connection"
  ensure_pg_client_image "$connection"
  primary_image="$REPLY_PG_IMAGE"
  primary_norm="$(sed -n 's/^DATABASE_URL=//p' "$connection" | tr -d '\r')"

  need_secondary_backup=0
  if [[ -n "$candidate_db_url" && -n "$shared_db_url" && "$shared_db_url" != "$candidate_db_url" ]]; then
    if [[ -z "$shared_normalized_url" || "$shared_normalized_url" != "$primary_norm" ]]; then
      secondary_network="$(resolve_network_for_db_url "$shared_db_url" "$stopped_id")"
      preflight_env_db_url "$shared_db_url" "$secondary_network" "$secondary_connection"
      secondary_norm="$(sed -n 's/^DATABASE_URL=//p' "$secondary_connection" | tr -d '\r')"
      if [[ "$secondary_norm" != "$primary_norm" ]]; then
        need_secondary_backup=1
      fi
    fi
  fi

  if (( need_secondary_backup == 1 )); then
    ensure_pg_client_image "$secondary_connection"
    secondary_image="$REPLY_PG_IMAGE"

    tag_previous_image
    dump_and_validate_connection "$secondary_connection" "$secondary_network" "$secondary_image" "$running_backup.partial"
    dump_and_validate_connection "$connection" "$primary_network" "$primary_image" "$backup.partial"
    mv -- "$running_backup.partial" "$running_backup"
    mv -- "$backup.partial" "$backup"
    echo "Validated database backup: $(basename "$backup") and $(basename "$running_backup")"
  else
    tag_previous_image
    dump_and_validate_connection "$connection" "$primary_network" "$primary_image" "$backup.partial"
    mv -- "$backup.partial" "$backup"
    echo "Validated database backup: $(basename "$backup")"
  fi
fi

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
