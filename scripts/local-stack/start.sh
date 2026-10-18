#!/usr/bin/env bash
# LOCAL STACK ONLY — runs a Supabase-compatible backend without Docker:
#   Postgres (all migrations) + GoTrue (auth) + PostgREST (REST) + the admin-users
#   Edge Function (Deno) + Mailpit (catches emails) + a small gateway.
# Usage: bash scripts/local-stack/start.sh [--reset]
# Then:  VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=$(cat .local-stack/anon.jwt) pnpm dev
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="$ROOT/.local-stack"
BIN="${LOCAL_STACK_BIN:-$STATE/bin}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
JWT_SECRET="local-stack-jwt-secret-not-for-production-0123456789"
PG_PORT=54322; GATEWAY_PORT=54321; AUTH_PORT=54332; REST_PORT=54331; FN_PORT=8000; MAIL_UI=54324; MAIL_SMTP=54325

mkdir -p "$STATE/logs" "$BIN"
as_pg() { if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi; }

download() {
  [[ -x "$BIN/auth/auth" && -x "$BIN/postgrest" && -x "$BIN/mailpit" ]] && return
  echo "• downloading GoTrue, PostgREST and Mailpit"
  (cd "$BIN" \
    && curl -sSL -o auth.tgz https://github.com/supabase/auth/releases/download/v2.177.0/auth-v2.177.0-x86.tar.gz \
    && mkdir -p auth && tar -xzf auth.tgz -C auth \
    && curl -sSL -o postgrest.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz \
    && tar -xJf postgrest.tar.xz \
    && curl -sSL -o mailpit.tgz https://github.com/axllent/mailpit/releases/download/v1.27.0/mailpit-linux-amd64.tar.gz \
    && tar -xzf mailpit.tgz mailpit)
}

if [[ "${1:-}" == "--reset" ]]; then
  bash "$ROOT/scripts/local-stack/stop.sh" >/dev/null 2>&1 || true
  rm -rf "$STATE/pgdata"
fi
download

ANON=$(node "$ROOT/scripts/local-stack/jwt.mjs" "$JWT_SECRET" anon)
SERVICE=$(node "$ROOT/scripts/local-stack/jwt.mjs" "$JWT_SECRET" service_role)
echo "$ANON" > "$STATE/anon.jwt"
echo "$SERVICE" > "$STATE/service.jwt"

FRESH=0
if [[ ! -d "$STATE/pgdata" ]]; then
  FRESH=1
  mkdir -p "$STATE/pgdata"
  [[ "$(id -u)" == "0" ]] && chown -R postgres "$STATE/pgdata"
  as_pg "$PG_BIN/initdb" -D "$STATE/pgdata" -U postgres --auth=trust -E UTF8 >/dev/null
fi
[[ "$(id -u)" == "0" ]] && chown -R postgres "$STATE/pgdata"
as_pg "$PG_BIN/pg_ctl" -D "$STATE/pgdata" -l /tmp/local-stack-postgres.log -w \
  -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k /tmp" start >/dev/null 2>&1 < /dev/null
PSQL=("$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)

if [[ $FRESH == 1 ]]; then
  echo "• roles and schemas"
  "${PSQL[@]}" -f "$ROOT/scripts/local-stack/roles.sql"
fi

echo "• GoTrue (auth) — runs its own migrations"
(cd "$BIN/auth" && env \
  GOTRUE_DB_DRIVER=postgres \
  DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:$PG_PORT/postgres?search_path=auth" \
  GOTRUE_DB_MIGRATIONS_PATH="$BIN/auth/migrations" \
  GOTRUE_API_HOST=127.0.0.1 PORT=$AUTH_PORT \
  API_EXTERNAL_URL="http://localhost:$GATEWAY_PORT/auth/v1" \
  GOTRUE_SITE_URL="http://localhost:5173" \
  GOTRUE_URI_ALLOW_LIST="http://localhost:5173/**" \
  GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
  GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_DISABLE_SIGNUP=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false \
  GOTRUE_PASSWORD_MIN_LENGTH=10 \
  GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify \
  GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify \
  GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=$MAIL_SMTP GOTRUE_SMTP_ADMIN_EMAIL=noreply@example.test \
  GOTRUE_SMTP_SENDER_NAME="Mini-Project Tracker (local)" GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
  nohup ./auth > "$STATE/logs/auth.log" 2>&1 < /dev/null &)

echo "• Mailpit (emails at http://localhost:$MAIL_UI)"
nohup "$BIN/mailpit" --listen 127.0.0.1:$MAIL_UI --smtp 127.0.0.1:$MAIL_SMTP --smtp-auth-accept-any --smtp-auth-allow-insecure \
  > "$STATE/logs/mailpit.log" 2>&1 < /dev/null &

# Wait until GoTrue has created auth.users, then apply our migrations once.
for _ in $(seq 1 60); do
  "${PSQL[@]}" -tAc "select to_regclass('auth.users') is not null" 2>/dev/null | grep -q t && break
  sleep 0.5
done
if [[ $FRESH == 1 ]]; then
  "${PSQL[@]}" -c "grant execute on all functions in schema auth to anon, authenticated, service_role;"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "• migration $(basename "$f")"
    "${PSQL[@]}" -f "$f"
  done
fi

echo "• PostgREST"
cat > "$STATE/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:postgres@127.0.0.1:$PG_PORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = $REST_PORT
CONF
nohup "$BIN/postgrest" "$STATE/postgrest.conf" > "$STATE/logs/postgrest.log" 2>&1 < /dev/null &

echo "• Edge Function admin-users (Deno)"
(cd "$ROOT/supabase/functions/admin-users" && env \
  SUPABASE_URL="http://localhost:$GATEWAY_PORT" SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SERVICE" \
  nohup npx --yes deno run --allow-net --allow-env index.ts > "$STATE/logs/functions.log" 2>&1 < /dev/null &)
# Deno.serve() listens on port 8000 by default.

echo "• gateway on http://localhost:$GATEWAY_PORT"
nohup node "$ROOT/scripts/local-stack/gateway.mjs" $GATEWAY_PORT $AUTH_PORT $REST_PORT $FN_PORT > "$STATE/logs/gateway.log" 2>&1 < /dev/null &

for _ in $(seq 1 60); do
  curl -sf "http://localhost:$GATEWAY_PORT/auth/v1/health" >/dev/null 2>&1 \
    && curl -sf -H "apikey: $ANON" "http://localhost:$GATEWAY_PORT/rest/v1/" >/dev/null 2>&1 && break
  sleep 0.5
done
echo "✓ local stack ready — API http://localhost:$GATEWAY_PORT · emails http://localhost:$MAIL_UI"
