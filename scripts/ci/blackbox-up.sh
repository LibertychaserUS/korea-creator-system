#!/usr/bin/env bash
# Bring up everything tests/blackbox needs on top of a running Postgres, then
# return once it is healthy:
#   1. KCS database + TinyShip identity database (created if missing)
#   2. identity schema (drizzle push) + the five seed accounts (db:seed:auth)
#   3. workspace app(s) as the TinyShip sign-in origin (production build)
#   4. KCS API wired to the stand-in vendor that global-setup starts
#
# Same script in CI (.github/workflows/kcs.yml, job `blackbox`) and locally:
#
#   scripts/ci/blackbox-up.sh && pnpm test:blackbox; scripts/ci/blackbox-down.sh
#
# Everything is driven by the BLACKBOX_* variables the suites already read
# (tests/blackbox/.env.example), so one environment feeds both this script and
# `pnpm test:blackbox`. Extra knobs:
#   BLACKBOX_AUTH_DATABASE_URL  identity DB           (default …/tinyship)
#   BLACKBOX_APPS               apps to start          (default "select"; e.g. "select marketing")
#   BLACKBOX_BUILD              auto | 1 | 0           (auto = build only when .output is missing)
#   BLACKBOX_RESET_DB           1 = drop + recreate both databases first
#   BLACKBOX_APP_NODE_ENV       runtime NODE_ENV of the apps (default development, see below)
#   BLACKBOX_RUN_DIR            logs + pid files       (default $RUNNER_TEMP or /tmp, /kcs-blackbox)
#   BETTER_AUTH_SECRET          shared by all apps     (default: a fixed test-only value)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export BLACKBOX_DATABASE_URL="${BLACKBOX_DATABASE_URL:-postgres://kcs:kcs@127.0.0.1:5432/kcs}"
export BLACKBOX_AUTH_DATABASE_URL="${BLACKBOX_AUTH_DATABASE_URL:-postgres://kcs:kcs@127.0.0.1:5432/tinyship}"
export BLACKBOX_BASE_URL="${BLACKBOX_BASE_URL:-http://localhost:7100}"
export BLACKBOX_AUTH_URL="${BLACKBOX_AUTH_URL:-${BLACKBOX_SELECT_URL:-http://localhost:7004}}"
export BLACKBOX_SELECT_URL="${BLACKBOX_SELECT_URL:-$BLACKBOX_AUTH_URL}"
export BLACKBOX_OPS_URL="${BLACKBOX_OPS_URL:-http://localhost:7002}"
export BLACKBOX_DEV_URL="${BLACKBOX_DEV_URL:-http://localhost:7003}"
export BLACKBOX_MARKETING_URL="${BLACKBOX_MARKETING_URL:-http://localhost:7005}"
export BLACKBOX_VENDOR_PORT="${BLACKBOX_VENDOR_PORT:-7190}"
export BLACKBOX_VENDOR_TOKEN="${BLACKBOX_VENDOR_TOKEN:-blackbox-vendor-token}"
BLACKBOX_APPS="${BLACKBOX_APPS:-select}"
BLACKBOX_BUILD="${BLACKBOX_BUILD:-auto}"
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-kcs-blackbox-only-secret-not-for-production}"
RUN_DIR="${BLACKBOX_RUN_DIR:-${RUNNER_TEMP:-/tmp}/kcs-blackbox}"
mkdir -p "$RUN_DIR"

log() { echo "[blackbox-up] $*"; }
port_of() { local url="${1%/}"; echo "${url##*:}"; }

app_url() {
  case "$1" in
    select) echo "$BLACKBOX_SELECT_URL" ;;
    ops) echo "$BLACKBOX_OPS_URL" ;;
    dev) echo "$BLACKBOX_DEV_URL" ;;
    marketing) echo "$BLACKBOX_MARKETING_URL" ;;
    *) echo "unknown app: $1" >&2; exit 1 ;;
  esac
}

# Detached in its own session so blackbox-down.sh can stop the whole group.
start_bg() {
  local name="$1"; shift
  if [[ -f "$RUN_DIR/$name.pid" ]] && kill -0 "$(cat "$RUN_DIR/$name.pid")" 2>/dev/null; then
    log "$name already running (pid $(cat "$RUN_DIR/$name.pid")); run scripts/ci/blackbox-down.sh first"
    exit 1
  fi
  setsid "$@" >"$RUN_DIR/$name.log" 2>&1 < /dev/null &
  echo $! >"$RUN_DIR/$name.pid"
  log "$name started (pid $!, log $RUN_DIR/$name.log)"
}

wait_http() {
  local name="$1" url="$2" deadline=$((SECONDS + ${3:-120}))
  local pid
  pid="$(cat "$RUN_DIR/$name.pid")"
  until curl -sf -o /dev/null --max-time 3 "$url"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      log "$name exited before becoming healthy:"
      tail -n 60 "$RUN_DIR/$name.log" || true
      exit 1
    fi
    if (( SECONDS > deadline )); then
      log "$name not healthy at $url in time:"
      tail -n 60 "$RUN_DIR/$name.log" || true
      exit 1
    fi
    sleep 1
  done
  log "$name healthy at $url"
}

log "databases: kcs=$BLACKBOX_DATABASE_URL identity=$BLACKBOX_AUTH_DATABASE_URL"
BLACKBOX_RESET_DB="${BLACKBOX_RESET_DB:-0}" node - <<'NODE'
const pg = require('pg')
const reset = process.env.BLACKBOX_RESET_DB === '1'
async function ensure(raw) {
  const url = new URL(raw)
  const name = decodeURIComponent(url.pathname.slice(1))
  const admin = new URL(raw)
  admin.pathname = '/postgres'
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    const ident = '"' + name.replace(/"/g, '""') + '"'
    if (reset) await client.query(`DROP DATABASE IF EXISTS ${ident} WITH (FORCE)`)
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (!rowCount) {
      await client.query(`CREATE DATABASE ${ident}`)
      console.log(`[blackbox-up] created database ${name}`)
    }
  } finally {
    await client.end()
  }
}
;(async () => {
  for (const raw of [process.env.BLACKBOX_DATABASE_URL, process.env.BLACKBOX_AUTH_DATABASE_URL]) await ensure(raw)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
NODE

log "identity schema + seed accounts"
DB_DIALECT=pg DATABASE_URL="$BLACKBOX_AUTH_DATABASE_URL" \
  pnpm exec drizzle-kit push --config drizzle.config.ts --force
DB_DIALECT=pg DATABASE_URL="$BLACKBOX_AUTH_DATABASE_URL" \
  BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" BETTER_AUTH_URL="$BLACKBOX_AUTH_URL" \
  pnpm db:seed:auth

for app in $BLACKBOX_APPS; do
  output="apps/$app/.output/server/index.mjs"
  if [[ "$BLACKBOX_BUILD" == "1" || ( "$BLACKBOX_BUILD" == "auto" && ! -f "$output" ) ]]; then
    log "building @kcs/app-$app"
    NODE_ENV=production pnpm --filter "@kcs/app-$app" build
  fi
  [[ -f "$output" ]] || { log "missing $output (BLACKBOX_BUILD=0?)"; exit 1; }
  url="$(app_url "$app")"
  # Production build, but NODE_ENV=development at runtime: with no proxy in front
  # there is no X-Forwarded-For, and better-auth only falls back to a loopback IP
  # for its sign-in throttle under development/test ("test" would also disable
  # its Origin check, so not that).
  start_bg "$app" env \
    NODE_ENV="${BLACKBOX_APP_NODE_ENV:-development}" \
    PORT="$(port_of "$url")" \
    DB_DIALECT=pg \
    DATABASE_URL="$BLACKBOX_AUTH_DATABASE_URL" \
    BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
    BETTER_AUTH_URL="$url" \
    APP_BASE_URL="$url" \
    NUXT_PUBLIC_API_BASE="$BLACKBOX_BASE_URL" \
    NUXT_PUBLIC_SELECT_URL="$BLACKBOX_SELECT_URL" \
    NUXT_PUBLIC_OPS_URL="$BLACKBOX_OPS_URL" \
    NUXT_PUBLIC_DEV_URL="$BLACKBOX_DEV_URL" \
    NUXT_PUBLIC_MARKETING_URL="$BLACKBOX_MARKETING_URL" \
    node "$output"
done

start_bg api env \
  NODE_ENV=test \
  PORT="$(port_of "$BLACKBOX_BASE_URL")" \
  DATABASE_URL="$BLACKBOX_DATABASE_URL" \
  API_PUBLIC_URL="$BLACKBOX_BASE_URL" \
  AUTH_BASE_URL="$BLACKBOX_AUTH_URL" \
  KCS_SEED=demo \
  QIANGUA_BASE_URL="http://127.0.0.1:$BLACKBOX_VENDOR_PORT" \
  QIANGUA_TOKEN="$BLACKBOX_VENDOR_TOKEN" \
  bash -c 'cd apps/api && exec node --import tsx src/index.ts'

for app in $BLACKBOX_APPS; do
  wait_http "$app" "$(app_url "$app")/api/auth/get-session"
done
wait_http api "$BLACKBOX_BASE_URL/api/health"

log "ready — run: pnpm test:blackbox"
