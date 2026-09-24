# Specification black-box tests

HTTP-only tests for korea-creator-system. They read the **external product spec** and the visible API contract (`packages/kcs-contract/src/api.ts`). They do **not** import service classes, mock internals, or use Playwright (`e2e/` is a different agent).

Case → spec mapping: [`SPEC-MAP.md`](./SPEC-MAP.md).

## How to run

PostgreSQL is required. SQLite is rejected.

```bash
# 1. Postgres (repo-root compose — user kcs / db kcs / port 5432)
docker compose up -d postgres

# 2. API process (default http://localhost:7100) with the demo data loaded —
#    the suites assert against it; without KCS_SEED=demo the API starts empty:
#    docker compose --profile full up -d        (compose already sets KCS_SEED=demo)
#    or: KCS_SEED=demo pnpm --filter @kcs/api dev

# 3. A workspace app serving TinyShip auth (default http://localhost:7004 = select)
#    with the five demo accounts + the role-less stranger seeded
#    (public sign-up is closed): pnpm db:seed:auth --stranger
#    emails: admin@ / ops@ / devops@ / selector@ / viewer@ / stranger@kcs.local
#    password: Kcs!demo2026
#    Sessions are minted by real email + password sign-in in global-setup.ts.

pnpm test:blackbox
```

### Queue suite and the stand-in vendor

`suites/09-queue.test.ts` drives the collection queue through several pages, a
slow page, a vendor outage, a quota wall and a rate limit. Demo data is a single
page and never fails, so `global-setup.ts` starts a tiny stand-in vendor
(`helpers/mock-vendor.ts`, 千瓜-shaped JSON on `127.0.0.1:7190`). Point the API at it:

```bash
QIANGUA_BASE_URL=http://127.0.0.1:7190 QIANGUA_TOKEN=blackbox-vendor-token pnpm --filter @kcs/api start
```

Without those two variables the API keeps serving demo data: the 14 vendor-dependent
queue cases skip with a message naming the missing setup, everything else runs.
The suite tunes the source's per-minute rate, daily quota and a job's resume time
over SQL (no console has those knobs); all assertions stay on HTTP.

The same stand-in answers TikHub-shaped routes under `/api/v1/` (`helpers/mock-tikhub.ts`:
蒲公英 relay with the two-layer `{code, request_id, data: {code, success, data}}` body,
plus the free `get_user_info` balance endpoint). `suites/15-tikhub.test.ts` drives 蒲公英
through billing (per-call quota, daily money budget, empty answers) and every failure class
(402 pause + resume + replay, 401, 400 retried once, inner `success=false`, 429 with
`Retry-After`, 5xx, timeout). Point the API at it — `scripts/ci/blackbox-up.sh` does:

```bash
TIKHUB_API_KEY=blackbox-vendor-token TIKHUB_BASE_URL=http://127.0.0.1:7190 PGY_TIMEOUT_MS=1500 \
  pnpm --filter @kcs/api start
```

No real TikHub / JustOneAPI / 千瓜 / 新红 call is ever made by the black-box suites.

Compose wrapper (starts Postgres, then runs Vitest — **red is OK** until the API implements the contract):

```bash
pnpm test:blackbox:compose
```

| script | what |
|--------|------|
| `pnpm test:blackbox` | Vitest, `tests/blackbox/vitest.config.ts` |
| `pnpm test:blackbox:compose` | `tests/blackbox/scripts/run.sh` |

## Env

See [`.env.example`](./.env.example). Defaults:

| var | default |
|-----|---------|
| `BLACKBOX_BASE_URL` | `http://localhost:7100` |
| `BLACKBOX_DATABASE_URL` / `DATABASE_URL` | `postgres://kcs:kcs@127.0.0.1:5432/kcs` |
| `BLACKBOX_PASSWORD` | `Kcs!demo2026` |
| `BLACKBOX_AUTH_URL` | `http://localhost:7004` (TinyShip auth origin used for sign-in) |
| `BLACKBOX_SELECT_URL` / `BLACKBOX_OPS_URL` / `BLACKBOX_DEV_URL` / `BLACKBOX_MARKETING_URL` | `:7004` / `:7002` / `:7003` / `:7005` (form-login and hand-off cases; unreachable origins are skipped) |
| `BLACKBOX_STRANGER_EMAIL` | `stranger@kcs.local` (signed-in account with no KCS role; provision it with `pnpm db:seed:auth --stranger`, password = `BLACKBOX_PASSWORD`) |
| `BLACKBOX_WORKSPACE_DEV` | unset. Set to `1` only when the workspace origins run `nuxt dev`: `11-security` then skips the `Secure` cookie assertions (production builds must send `Secure`) |
| `BLACKBOX_VENDOR_PORT` / `BLACKBOX_VENDOR_TOKEN` | `7190` / `blackbox-vendor-token` (stand-in vendor for the queue suite; the API's `QIANGUA_BASE_URL` / `QIANGUA_TOKEN` must match) |

`BLACKBOX_DATABASE_URL` must be `postgres://`. A `sqlite` URL fails setup.

## What “red / green” means

These tests are TDD-first. Until the HTTP API exists and matches the contract:

- **RED** — connection refused, 404, missing seed users, or wrong status/body. That is expected.
- **GREEN** — every case in `SPEC-MAP.md` passes against a live API + Postgres.

Persistence is asserted through GET APIs. One project test *may* `SELECT` from `assignment` if that table exists; if the query fails it falls back to GET. The queue suite additionally reads `ingest_source_usage` / `creator_metrics_history` counts and writes source quota / rate and a job's `next_run_at` to arrange scenarios.

## Out of scope

- Playwright / `e2e/` / `tests/e2e/`
- Importing `apps/api/src/*`
- AWS SDK calls (S3 is exercised via `/api/assets*`)
