#!/usr/bin/env bash
# Start root-compose Postgres + MinIO, seed if possible, run KCS Playwright.
# Does not tear down fullstack compose. Red is OK until web+api+SQL are real.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "[e2e] starting repo-root Postgres + MinIO"
if ! docker compose up -d postgres minio minio-init; then
  echo "[e2e] root compose failed — still running Playwright (expected red)"
fi

export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:7001}"
export E2E_API_URL="${E2E_API_URL:-http://localhost:7100}"
export E2E_DATABASE_URL="${E2E_DATABASE_URL:-postgres://kcs:kcs@127.0.0.1:5432/kcs}"
export E2E_S3_ENDPOINT="${E2E_S3_ENDPOINT:-http://127.0.0.1:9000}"
export E2E_S3_BUCKET="${E2E_S3_BUCKET:-kcs-assets}"
export E2E_S3_ACCESS_KEY="${E2E_S3_ACCESS_KEY:-kcsminio}"
export E2E_S3_SECRET_KEY="${E2E_S3_SECRET_KEY:-kcsminio123}"
export E2E_S3_REGION="${E2E_S3_REGION:-us-east-1}"

if curl -sf -o /dev/null --max-time 3 "$E2E_BASE_URL"; then
  echo "[e2e] web reachable at $E2E_BASE_URL"
else
  echo "[e2e] web not reachable at $E2E_BASE_URL — journeys will fail (red is OK)"
fi

pnpm exec tsx e2e/scripts/seed-users.ts || echo "[e2e] seed red (API/SQL not ready)"

pnpm exec playwright test --config=e2e/playwright.config.ts "$@"
exit $?
