#!/usr/bin/env bash
set -euo pipefail
umask 077

# Backup failures leave the old app running. Stop its senders only after the
# completed dump has been validated; no schema changes happen in this script.
: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release SHA' >&2; exit 1; }
compose_file="${COMPOSE_FILE:-docker-compose.prod.yml}"
id=$(docker compose -f "$compose_file" ps -q app)
[[ -n "$id" && "$id" != *$'\n'* ]] || { echo 'Backup requires one running previous app container' >&2; exit 1; }
backup_dir="$DEPLOY_PATH/shared/backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$backup_dir/pre-${RELEASE_SHA}-${stamp}.dump"
connection=$(mktemp "$backup_dir/.connection.XXXXXX")
cleanup() { rm -f -- "$connection" "$backup.partial"; }
trap cleanup EXIT

# Read the actual old process environment without exposing it in CI logs.
if ! docker exec "$id" node -e '
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
' > "$connection"; then
  echo 'Production backup preflight failed; existing app is unchanged' >&2
  exit 1
fi
major=$(sed -n 's/^PG_VERSION=//p' "$connection")
[[ "$major" =~ ^[0-9]{2}$ ]] || { echo 'Invalid database version' >&2; exit 1; }
image="postgres:$major"
docker pull "$image" >/dev/null
old_image=$(docker inspect --format '{{.Image}}' "$id")
docker tag "$old_image" "my-next-app:pre-${RELEASE_SHA}-${stamp}"
if ! docker run --rm --network "container:$id" --env-file "$connection" "$image" sh -c 'exec pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL"' > "$backup.partial" 2>/dev/null; then
  echo 'Production backup failed; existing app is still running' >&2
  exit 1
fi
if [[ ! -s "$backup.partial" ]] || ! docker run --rm -i "$image" pg_restore --list < "$backup.partial" >/dev/null 2>&1; then
  echo 'Production backup validation failed; existing app is still running' >&2
  exit 1
fi
mv -- "$backup.partial" "$backup"
echo "Validated database backup: $(basename "$backup")"
docker stop --time 30 "$id" >/dev/null
[[ $(docker inspect --format '{{.State.Running}}' "$id") == false ]] || { echo 'Previous app did not stop' >&2; exit 1; }
echo 'Previous app and in-process Newsletter senders stopped; previous image retained'
