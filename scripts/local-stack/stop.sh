#!/usr/bin/env bash
# LOCAL STACK ONLY — stops everything started by start.sh (data is kept unless start.sh --reset).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"

# Never signal this script or any of its parent shells (their command lines may
# contain the same words).
protected=" $$ "
p=$$
while [[ "$p" -gt 1 ]]; do
  p=$(awk '{print $4}' "/proc/$p/stat" 2>/dev/null || echo 1)
  protected+="$p "
done

stop_matching() {
  local pattern="$1" pid cmd
  for dir in /proc/[0-9]*; do
    pid=${dir#/proc/}
    [[ "$protected" == *" $pid "* ]] && continue
    cmd=$({ tr '\0' ' ' < "$dir/cmdline"; } 2>/dev/null) || continue
    [[ "$cmd" == *"$pattern"* ]] && kill "$pid" 2>/dev/null
  done
}

stop_matching "$ROOT/scripts/local-stack/gateway.mjs"
stop_matching "deno run --allow-net --allow-env index.ts"
stop_matching "$ROOT/.local-stack/postgrest.conf"
stop_matching "--smtp 127.0.0.1:54325"
for dir in /proc/[0-9]*; do
  pid=${dir#/proc/}
  [[ "$protected" == *" $pid "* ]] && continue
  [[ "$(readlink "$dir/exe" 2>/dev/null)" == *"/.local-stack/bin/auth/auth" || "$(readlink "$dir/exe" 2>/dev/null)" == */localstack-bin/auth/auth ]] && kill "$pid" 2>/dev/null
done
if [[ -d "$ROOT/.local-stack/pgdata" ]]; then
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$ROOT/.local-stack/pgdata" -m fast stop >/dev/null 2>&1
  else "$PG_BIN/pg_ctl" -D "$ROOT/.local-stack/pgdata" -m fast stop >/dev/null 2>&1; fi
fi
echo "stopped"
