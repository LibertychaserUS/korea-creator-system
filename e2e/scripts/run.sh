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

export E2E_MARKETING_URL="${E2E_MARKETING_URL:-http://localhost:7000}"
export E2E_OPS_URL="${E2E_OPS_URL:-http://localhost:7002}"
export E2E_DEV_URL="${E2E_DEV_URL:-http://localhost:7003}"
export E2E_SELECT_URL="${E2E_SELECT_URL:-http://localhost:7004}"
export E2E_API_URL="${E2E_API_URL:-http://localhost:7100}"
export E2E_DATABASE_URL="${E2E_DATABASE_URL:-postgres://kcs:kcs@127.0.0.1:5432/kcs}"
export E2E_S3_ENDPOINT="${E2E_S3_ENDPOINT:-http://127.0.0.1:9000}"
export E2E_S3_BUCKET="${E2E_S3_BUCKET:-kcs-assets}"
export E2E_S3_ACCESS_KEY="${E2E_S3_ACCESS_KEY:-kcsminio}"
export E2E_S3_SECRET_KEY="${E2E_S3_SECRET_KEY:-kcsminio123}"
export E2E_S3_REGION="${E2E_S3_REGION:-us-east-1}"

for app_url in "$E2E_MARKETING_URL" "$E2E_OPS_URL" "$E2E_DEV_URL" "$E2E_SELECT_URL"; do
  if curl -sf -o /dev/null --max-time 3 "$app_url"; then
    echo "[e2e] app reachable at $app_url"
  else
    echo "[e2e] app not reachable at $app_url — related journeys will fail"
  fi
done

pnpm exec tsx e2e/scripts/seed-users.ts || echo "[e2e] seed red (API/SQL not ready)"

pnpm exec playwright test --config=e2e/playwright.config.ts "$@"
exit $?
