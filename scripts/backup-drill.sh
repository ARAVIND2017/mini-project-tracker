#!/usr/bin/env bash
# Backup/restore drill (TEST_PLAN.md §5): dumps a database, restores the dump into a new
# scratch database on the same server, and checks that every table has the same number
# of rows. Defaults to the local stack (scripts/local-stack/start.sh).
#
#   bash scripts/backup-drill.sh                       # local stack
#   PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… PGDATABASE=… bash scripts/backup-drill.sh
#
# The dump file is kept (path printed at the end) so it can be inspected or archived.
set -euo pipefail

export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}"
SOURCE="${PGDATABASE:-postgres}"
SCRATCH="drill_restore_$(date +%s)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
OUT="${DRILL_DIR:-$(mktemp -d)}/backup-$(date +%Y%m%d-%H%M%S).dump"

counts() {
  "$PG_BIN/psql" -d "$1" -XAtq -v ON_ERROR_STOP=1 <<'SQL'
create temporary table c (t text, n bigint);
do $$
declare r record; n bigint;
begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('public', 'auth') order by 1, 2 loop
    execute format('select count(*) from %I.%I', r.schemaname, r.tablename) into n;
    insert into c values (r.schemaname || '.' || r.tablename, n);
  end loop;
end $$;
select t || '=' || n from c order by t;
SQL
}

echo "• dumping $SOURCE"
start=$(date +%s)
"$PG_BIN/pg_dump" -d "$SOURCE" -Fc -f "$OUT"
echo "  $(du -h "$OUT" | cut -f1) in $(( $(date +%s) - start )) s → $OUT"

echo "• restoring into $SCRATCH"
"$PG_BIN/createdb" "$SCRATCH"
trap '"$PG_BIN/dropdb" --if-exists "$SCRATCH" >/dev/null 2>&1 || true' EXIT
start=$(date +%s)
# Roles are cluster-wide and already exist; only ownership/grant noise may be reported.
"$PG_BIN/pg_restore" -d "$SCRATCH" --no-owner --exit-on-error "$OUT"
echo "  restored in $(( $(date +%s) - start )) s"

echo "• comparing row counts"
before="$(counts "$SOURCE")"
after="$(counts "$SCRATCH")"
tables=$(wc -l <<<"$before")
rows=$(awk -F= '{s += $2} END {print s}' <<<"$before")
if [[ "$before" != "$after" ]]; then
  echo "✕ row counts differ:" >&2
  diff <(echo "$before") <(echo "$after") >&2 || true
  exit 1
fi
echo "✓ $tables tables, $rows rows: identical after restore"

echo "• checking the restored database works (views, workflow functions, RLS)"
smoke() {
  "$PG_BIN/psql" -d "$1" -XAtq -v ON_ERROR_STOP=1 -c "
    select (select count(*) from public.v_projects) || '/' ||
           (select count(*) from public.v_review_queue) || '/' ||
           (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'app\_%') || '/' ||
           (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity)"
}
if [[ "$(smoke "$SOURCE")" != "$(smoke "$SCRATCH")" ]]; then
  echo "✕ the restored database behaves differently: $(smoke "$SOURCE") vs $(smoke "$SCRATCH")" >&2
  exit 1
fi
echo "✓ project rows / queue rows / workflow functions / tables without RLS: $(smoke "$SCRATCH")"
