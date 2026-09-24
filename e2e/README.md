# KCS product e2e (Playwright)

Browser journeys for the four workspace apps (`marketing`, `ops`, `dev`, `select`) + `apps/api` + **PostgreSQL** + **S3/MinIO**.

HTTP-only TDD is `pnpm test:blackbox`. TinyShip SaaS catalog is `pnpm test:e2e:tinyship`.

Host runner is official TinyShip Playwright (`@playwright/test` at repo root). Users, APIs, and the first testids come from `@kcs/contract`.

## How to run

```bash
pnpm exec playwright install chromium

# infra (same compose fullstack uses)
docker compose up -d postgres minio minio-init

# marketing :7000, ops :7002, dev :7003, select :7004, api :7100
# Start the four Nuxt apps and API in separate terminals.

pnpm test:e2e:seed
pnpm test:e2e
```

Wrapper (starts infra, runs Playwright, **does not** `compose down`):

```bash
pnpm test:e2e:compose
```

Isolated ports (55432 / 59000) if you must not touch root compose: `docker compose -f e2e/docker-compose.yml up -d`.

## Scripts

| script | what |
|--------|------|
| `pnpm test:e2e` | these journeys |
| `pnpm test:e2e:ui` | Playwright UI |
| `pnpm test:e2e:compose` | `e2e/scripts/run.sh` |
| `pnpm test:e2e:seed` | probe the 5 RBAC users |
| `pnpm test:e2e:tinyship` | upstream TinyShip catalog |

## Specs

| file | journey |
|------|---------|
| `specs/01-ops-publish.spec.ts` | Ops login → create → 合作过/没合作过 → publish → Postgres |
| `specs/02-selector-assign.spec.ts` | Selector project → filter/sort → assign → Postgres; cannot open `/ops` |
| `specs/03-devops-health.spec.ts` | Devops SQL health; cannot assign |
| `specs/04-viewer-pool.spec.ts` | Viewer sees pool; cannot assign |
| `specs/05-image-upload.spec.ts` | Avatar in MinIO; URL works |
| `specs/06-theme-i18n.spec.ts` | Light/dark + zh-CN/en/ko on Chromium |
| `specs/09-catalog-shortlist-capacity.spec.ts` | Ops category + source dictionary → fetch form dropdown; selector shortlist remove; devops capacity reading → Postgres |

Each app has its own origin. Configure overrides with `E2E_MARKETING_URL`, `E2E_OPS_URL`,
`E2E_DEV_URL`, and `E2E_SELECT_URL`; API and backing services retain their existing
`E2E_API_URL`, `E2E_DATABASE_URL`, and `E2E_S3_*` variables.

## Hooks

`e2e/CONTRACT.md` + `packages/kcs-contract/src/testids.ts`. Restart the web app after adding testids.
