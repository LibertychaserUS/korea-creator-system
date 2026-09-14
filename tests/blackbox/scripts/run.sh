#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "[blackbox] root postgres already running"
else
  echo "[blackbox] starting postgres via docker compose"
  docker compose up -d postgres --wait || docker compose up -d postgres
fi

export BLACKBOX_BASE_URL="${BLACKBOX_BASE_URL:-http://localhost:7100}"
export BLACKBOX_DATABASE_URL="${BLACKBOX_DATABASE_URL:-postgres://kcs:kcs@127.0.0.1:5432/kcs}"

echo "[blackbox] API=${BLACKBOX_BASE_URL} DB=${BLACKBOX_DATABASE_URL}"
echo "[blackbox] expected RED until the HTTP API implements packages/kcs-contract"

pnpm exec vitest run --config tests/blackbox/vitest.config.ts
