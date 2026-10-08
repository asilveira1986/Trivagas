#!/usr/bin/env bash
# Aplica as migrações num PostgreSQL local (com PostGIS) e roda os testes de RLS.
# Uso: DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/postgres}"
DB="trivagas_test_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" "$ADMIN_URL" -c "create database $DB"
trap '"${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists $DB" >/dev/null' EXIT

TEST_URL="${ADMIN_URL%/*}/$DB"
"${PSQL[@]}" "$TEST_URL" -c "alter database $DB set search_path = \"\$user\", public, extensions"
"${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/tests/supabase_stub.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$migration")"
  "${PSQL[@]}" "$TEST_URL" -f "$migration"
done
for test in "$ROOT"/supabase/tests/*_test.sql; do
  echo "→ $(basename "$test")"
  "${PSQL[@]}" "$TEST_URL" -o /dev/null -f "$test" 2>&1 | sed -E "s/^psql:[^ ]+ (NOTICE: +)?//"
done
