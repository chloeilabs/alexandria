#!/usr/bin/env bash
# Sync Neon production (public + drizzle schemas) into local Docker Postgres.
# Gives local dev parity with production smoke (426 entities, Tier 2/3 content).
#
# Requires PROD_DATABASE_URL, or source .env.prod (DATABASE_URL there targets Neon).
# Local target defaults to postgresql://library:changeme@localhost:5434/library.
#
# Usage:
#   set -a && source .env.prod && set +a && ./scripts/sync-prod-to-local.sh
#   PROD_DATABASE_URL='postgresql://...' ./scripts/sync-prod-to-local.sh
#
# After sync, refresh featured cache so /api/health returns 200:
#   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-featured
#   pnpm tsx scripts/smoke-test.ts --base=http://localhost:3000

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROD_URL="${PROD_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$PROD_URL" ]]; then
  echo "error: set PROD_DATABASE_URL or source .env.prod (DATABASE_URL)" >&2
  exit 1
fi

LOCAL_HOST="${LOCAL_PG_HOST:-127.0.0.1}"
LOCAL_PORT="${LOCAL_PG_PORT:-5434}"
LOCAL_USER="${POSTGRES_USER:-library}"
LOCAL_PASS="${POSTGRES_PASSWORD:-changeme}"
LOCAL_DB="${POSTGRES_DB:-library}"

DUMP_DIR="${TMPDIR:-/tmp}/alexandria-sync"
DUMP_FILE="$DUMP_DIR/alexandria.dump"
mkdir -p "$DUMP_DIR"

echo "==> Dumping production (public + drizzle) to $DUMP_FILE"
docker run --rm --network host \
  -e "DATABASE_URL=$PROD_URL" \
  -v "$DUMP_DIR:/out" \
  pgvector/pgvector:pg17 \
  sh -c 'pg_dump "$DATABASE_URL" --schema=public --schema=drizzle --no-owner --no-acl -Fc -f /out/alexandria.dump'

echo "==> Resetting local schemas on $LOCAL_HOST:$LOCAL_PORT"
docker exec library-of-alexandria-db psql -U "$LOCAL_USER" -d "$LOCAL_DB" -v ON_ERROR_STOP=1 -c "
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA drizzle;
GRANT ALL ON SCHEMA public TO $LOCAL_USER;
GRANT ALL ON SCHEMA drizzle TO $LOCAL_USER;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
"

echo "==> Restoring into local Docker Postgres"
docker run --rm --network host \
  -e "PGPASSWORD=$LOCAL_PASS" \
  -v "$DUMP_DIR:/out" \
  pgvector/pgvector:pg17 \
  pg_restore -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d "$LOCAL_DB" \
  --no-owner --no-acl /out/alexandria.dump || true

ENTITY_COUNT="$(docker exec library-of-alexandria-db psql -U "$LOCAL_USER" -d "$LOCAL_DB" -t -A -c 'SELECT count(*) FROM entities;')"
echo "==> Done. entities=$ENTITY_COUNT"
echo "Next: refresh featured cache, then local smoke:"
echo "  curl -H \"Authorization: Bearer \$CRON_SECRET\" http://localhost:3000/api/cron/refresh-featured"
echo "  pnpm tsx scripts/smoke-test.ts --base=http://localhost:3000"
