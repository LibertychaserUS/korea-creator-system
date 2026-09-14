# Specification black-box tests

HTTP-only tests for korea-creator-system. They read the **external product spec** and the visible API contract (`packages/kcs-contract/src/api.ts`). They do **not** import service classes, mock internals, or use Playwright (`e2e/` is a different agent).

Case → spec mapping: [`SPEC-MAP.md`](./SPEC-MAP.md).

## How to run

PostgreSQL is required. SQLite is rejected.

```bash
# 1. Postgres (repo-root compose — user kcs / db kcs / port 5432)
docker compose up -d postgres

# 2. API process (default http://localhost:7100)
#    when fullstack ships it:
#    docker compose --profile full up -d
#    or: pnpm --filter @kcs/api dev

# 3. Seed the five RBAC users if the API did not already
#    emails: admin@ / ops@ / devops@ / selector@ / viewer@kcs.local
#    password: Kcs!demo2026

pnpm test:blackbox
```

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

`BLACKBOX_DATABASE_URL` must be `postgres://`. A `sqlite` URL fails setup.

## What “red / green” means

These tests are TDD-first. Until the HTTP API exists and matches the contract:

- **RED** — connection refused, 404, missing seed users, or wrong status/body. That is expected.
- **GREEN** — every case in `SPEC-MAP.md` passes against a live API + Postgres.

Persistence is asserted through GET APIs. One project test *may* `SELECT` from `assignment` if that table exists; if the query fails it falls back to GET.

## Out of scope

- Playwright / `e2e/` / `tests/e2e/`
- Importing `apps/api/src/*`
- AWS SDK calls (S3 is exercised via `/api/assets*`)
