#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway Postgres cluster (plus a minimal
# Supabase shim) and runs every supabase/tests/*.sql file. Nothing persists.
#
#   pnpm test:db                 # auto-detects the newest local Postgres
#   PG_BIN=/path/to/bin pnpm test:db
set -euo pipefail

export ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PG_BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || true)}"
if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "PostgreSQL server binaries not found. Install PostgreSQL 15+ or set PG_BIN." >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54329}"

# initdb refuses to run as root; use the postgres OS user in that case.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}
if [[ "$(id -u)" == "0" ]]; then chown postgres "$WORK"; fi

cleanup() {
  as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

as_pg "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/server.log" -w \
  -o "-k $WORK -p $PORT -c listen_addresses='' -c fsync=off" start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)

# Query results are discarded; NOTICEs ("ok - ...") and errors are shown. With
# pipefail, a psql error (ON_ERROR_STOP) makes the whole pipeline fail.
run_sql() {
  "${PSQL[@]}" -o /dev/null -f "$1" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1: /; s/^NOTICE: /  /; s/^/  /'
}

echo "• Supabase shim"
run_sql "$ROOT/supabase/tests/_support/supabase_shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "• migration $(basename "$f")"
  run_sql "$f"
done

run_sql "$ROOT/supabase/tests/_support/test_helpers.sql"

failed=0
for f in "$ROOT"/supabase/tests/*.sql; do
  echo "• test $(basename "$f")"
  status=0
  out="$(run_sql "$f")" || status=$?
  printf '%s\n' "$out"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    # Surface failures (and the performance timings) on the run summary.
    grep -E 'timings \(ms\)' <<<"$out" | sed -E 's/^ +//; s/^/::notice title=db-test performance::/' || true
    if [[ $status -ne 0 ]]; then
      msg="$(grep -m1 -E 'ERROR' <<<"$out" | sed -E 's/^ +//')"
      echo "::error title=db-test $(basename "$f")::${msg:-failed}"
    fi
  fi
  if [[ $status -ne 0 ]]; then failed=$((failed + 1)); fi
done

if [[ $failed -gt 0 ]]; then
  echo "✕ $failed database test file(s) failed" >&2
  exit 1
fi
echo "✓ database tests passed"
