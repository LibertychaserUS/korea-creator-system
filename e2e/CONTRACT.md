# KCS Playwright contract

SSOT for roles, HTTP, and the first testid set is **`packages/kcs-contract`** (`TESTID`, `SEED_USERS`, `API`, `screenPath`). Black-box HTTP lives in `tests/blackbox/`. This file only adds **browser journey** hooks those modules do not name yet.

Do not invent a second user list or a second assign URL.

## Seeded users (`SEED_USERS`)

Password: `Kcs!demo2026`.

| role | email | home |
|------|-------|------|
| `platform_admin` | `admin@kcs.local` | any |
| `ops` | `ops@kcs.local` | ops origin `/{locale}` |
| `devops` | `devops@kcs.local` | dev origin `/{locale}` |
| `selector` | `selector@kcs.local` | select origin `/{locale}` |
| `selector_viewer` | `viewer@kcs.local` | select origin `/{locale}` (read pool) |

## Official `TESTID` (already in `@kcs/contract`)

`login-email` `login-password` `login-submit` `locale-switch` `theme-toggle` `nav-ops` `nav-dev` `nav-select` `btn-publish` `btn-assign` `btn-create-project` `btn-create-creator` `filter-followers` `filter-collab` `filter-price` `table-pool` `table-projects` `table-jobs` `screen-denied` plus `SCREEN_TESTID` (`screen-a-home`, `screen-c-project-board`, `screen-b-health`, …).

Routes use locale prefix `/{zh-CN|en|ko}` on each origin: marketing `/login`;
ops `/` and `/creators/new`; select `/`, `/projects`, and `/projects/:id`; dev `/`.

## RBAC the UI must prove

| actor | cannot |
|-------|--------|
| `selector` | open the ops origin `/{locale}` — `screen-denied`, zero inventory |
| `devops` | `btn-assign` + `POST /api/select/projects/:id/assignments` → 403 |
| `selector_viewer` | no `btn-assign`; same POST → 403 |

## Extra testids (journeys 1–5)

| id | where |
|----|-------|
| `auth-session` | signed-in chrome, `data-role` = seed slug |
| `creator-display-name` `creator-followers` `creator-price-min` | ops form |
| `creator-avatar` `creator-avatar-url` | file + result (`data-object-key`) |
| `category-collaborated` `category-never-collaborated` | `coop_history` exclusive, `aria-pressed` |
| `btn-save-creator` `btn-publish-confirm` | save / confirm publish |
| `creator-status` `creator-key` | `data-status` / `data-creator-key` |
| `project-name` `btn-open-library` | project create + 从库选人 |
| `filter-followers-min` `filter-followers-max` | range |
| `filter-price-min` `filter-price-max` | range |
| `sort-followers` `sort-price` `sort-collab` | pool sort |
| `row-pool` `row-pool-check` | pool row (`data-creator-key`) |
| `btn-assign-confirm` `row-project-assignment` | confirm + board row |
| `dev-job-count` `dev-sql-ok` | health integer = `COUNT(*) FROM ingest_job` |

## Persistence

Postgres tables: `creator`, `assignment`, `ingest_job` (DOMAIN.md).  
Assign body: `{ "creatorIds": ["…"] }` (same as blackbox).  
S3: root compose MinIO `kcs-assets` (`E2E_S3_*`).
