# Black-box SPEC-MAP

HTTP-only tests in `tests/blackbox/suites/`. Paths bind to `packages/kcs-contract/src/api.ts`. Specs are `docs/product/PRD.md`, `UX-FLOWS.md`, `SCREEN-INVENTORY.md`, `DOMAIN.md`.

**92 cases** across 8 files (`it.each` expanded). Run: `pnpm test:blackbox`.

Auth: `POST /api/auth/login` → `{ token, user.role }`. Send `Authorization: Bearer <token>`.

Seed users (`packages/kcs-contract/src/users.ts`):

| role | email | password |
|------|-------|----------|
| platform_admin | admin@kcs.local | `Kcs!demo2026` |
| ops | ops@kcs.local | same |
| devops | devops@kcs.local | same |
| selector | selector@kcs.local | same |
| selector_viewer | viewer@kcs.local | same |

Error envelope: `{ error: { code, message } }`. Codes **do not** localize: `AUTH-LOGIN` `AUTH-DENIED` `VALIDATION` `SOURCE-INVALID` `NOT-FOUND`.

---

## 1. AuthN / AuthZ — `01-authz.test.ts`

| case | spec | HTTP |
|------|------|------|
| each protected GET without session → 401 + `AUTH-LOGIN`, no pool JSON | DOMAIN 边界「未登录看库」; UX 权限跳转; SCREEN AUTH-LOGIN | `GET` `/api/auth/me` `/api/ops/*` `/api/select/*` `/api/ingest/*` `/api/dev/*` `/api/assets` |
| anon POST create → 401, no id | UX 未登录 | `POST /api/ops/creators` |
| selector / selector_viewer / devops GET ops inventory → 403 + `AUTH-DENIED`, zero items | PRD §2; UX 1 权限不够; SCREEN AUTH-DENIED | `GET /api/ops/creators` |
| selector / viewer / devops POST create → 403 | UX 2 选人写录入; UX 3 运维写 Creator | `POST /api/ops/creators` |
| selector / viewer / devops publish or unpublish → 403 | PRD §2; UX 3 运维调发布 | `POST /api/ops/creators/:id/publish` `/unpublish` |
| selector / viewer GET `/dev` or `/ingest` → 403, no job stack | UX 1 / 3 / 4 | `GET /api/dev/jobs` `GET /api/ingest/jobs` |
| selector POST ingest job or retry → 403 | PRD §8.3; UX 4 | `POST /api/ingest/jobs` `POST /api/dev/jobs/:id/retry` |
| ops retry → 403 (M1 重试仅运维) | UX 3 | `POST /api/dev/jobs/:id/retry` |
| ops / devops / viewer assign or create project → 403 | PRD §2 §8.1 §8.2; UX 权限跳转 | `POST /api/select/projects` `POST .../assignments` |
| viewer DELETE assignment → 403 | DOMAIN 移出 = 写 | `DELETE .../assignments/:creatorId` |
| devops PATCH price → 403 | UX 3 改报价 | `PATCH /api/ops/creators/:id` |
| selector PATCH category → 403 | PRD §4 | `PATCH /api/ops/categories/:slug` |
| selector / viewer presign → 403 | PRD §4 | `POST /api/assets/presign` |
| devops GET pool → 403 | PRD §2 / §8.2 不见业务表 | `GET /api/select/pool` |
| platform_admin reads ops + pool + ingest + dev | contract RBAC | `GET` those collections |
| 403 never includes the draft id | PRD §2 不返回未发布 payload | `GET /api/ops/creators` as selector |

## 2. Creator CRUD + publish — `02-creators.test.ts`

| case | spec | HTTP |
|------|------|------|
| create draft; ops GET sees it; pool omits; select detail 404 | PRD §7; DOMAIN §1; SCREEN SEL-CREATOR | `POST/GET /api/ops/creators` `GET /api/select/pool` `GET /api/select/creators/:id` |
| publish complete person → appears in pool without `status` / job fields | PRD §7 §12; UX 2 成功 | `POST .../publish` `GET /api/select/pool` |
| unpublish → pool drop + select 404 | PRD §7 撤回 | `POST .../unpublish` |
| ops PATCH display_name + followers | PRD §8.1 | `PATCH /api/ops/creators/:id` |
| empty displayName refused | PRD §7 必填齐 | `POST /api/ops/creators` |
| unpublish then publish again | PRD §8.1 撤回可撤销 | publish / unpublish / publish |
| ops list contains draft; pool does not | PRD §7 字段差 | `GET /api/ops/creators` vs `GET /api/select/pool` |

## 3. Categories — `03-categories.test.ts`

| case | spec | HTTP |
|------|------|------|
| builtin slugs present | PRD §5; SCREEN OPS-CATEGORY | `GET /api/ops/categories` |
| `collaborated` + `never_collaborated` → 400 | PRD §5 `coop_history` 互斥 | `POST /api/ops/creators` |
| switch replaces, does not stack | PRD §5 组内最多一个 | `PATCH /api/ops/creators/:id` |
| released + `blacklist` never in pool; select 404 | PRD §5; DOMAIN §1 / 边界 | `GET /api/select/pool` |
| cannot disable builtin coop slugs | SCREEN OPS-CATEGORY | `PATCH /api/ops/categories/:slug` `{ enabled: false }` |
| `hasCollaborated` from Collaboration count, not the tag | PRD §6.1; DOMAIN §3 / 边界 | create with `never_collaborated` + collab row; `GET pool?hasCollaborated=true` |

## 4. Filter AND + sort — `04-filters-sort.test.ts`

| case | spec | HTTP |
|------|------|------|
| default `rating`↓ then `followers`↓ | PRD §6.2 SEL-LIBRARY | `GET /api/select/pool` |
| followers ∩ hasCollaborated ∩ overlapping price | PRD §6 AND | `?followersMin&hasCollaborated&priceMin&priceMax&currency` |
| followers ∩ collab_count | PRD §6.1 | `?followersMin&followersMax&collabCountMin&collabCountMax` |
| sort followers desc / asc | PRD §6.1 | `?sort=followers&order=` |
| sort collab_count desc | PRD §6.1 | `?sort=collab_count&order=desc` |
| sort price by `amount_min`; missing price last | DOMAIN Price | `?sort=price&order=asc` |
| contradictory AND → empty list, not 5xx | DOMAIN 边界; UX 空态 | `?hasCollaborated=false&categories=collaborated` |

## 5. Project assign / remove — `05-projects.test.ts`

| case | spec | HTTP |
|------|------|------|
| selector assign once | PRD §4 步 3; UX 1 成功 | `POST /api/select/projects/:id/assignments` `{ creatorIds }` |
| second assign no duplicate | UX 1 不复制 | same POST → 409 or 200 with length 1 |
| DELETE then assign again | DOMAIN §8 | `DELETE .../assignments/:creatorId` |
| viewer cannot assign | UX 1; user brief | POST → 403 `AUTH-DENIED` |
| viewer cannot remove | DOMAIN 移出 | DELETE → 403 |
| unpublish: existing `pool_gone`, new assign blocked | PRD §7; DOMAIN 边界 | GET project; POST new project |
| optional SQL count ≥ 1 (fallback GET) | user brief persistence | `assignment` table or GET project |

## 6. Ingest — `06-ingest.test.ts`

| case | spec | HTTP |
|------|------|------|
| job on enabled `file_drop` source | PRD §8.3 §12; UX 4 | `GET /api/ingest/sources` `POST /api/ingest/jobs` |
| unknown `sourceId` → 400 `SOURCE-INVALID` | PRD §8.3 | `POST /api/ingest/jobs` |
| ad-hoc `sourceUrl` → 400, no silent job | UX 4 硬限制 | `POST /api/ingest/jobs` `{ sourceUrl }` |
| devops retry increments `attempt` | UX 3; SCREEN DEV-JOB-DETAIL | `POST /api/dev/jobs/:id/retry` |
| selector cannot retry | PRD §8.3; UX 4 | retry → 403 |
| ops cannot retry (M1) | UX 3 | retry → 403 |
| devops GET sees the same job | PRD §8.2 同套数据 | `GET /api/dev/jobs` |

## 7. S3 via API — `07-storage.test.ts`

| case | spec | HTTP |
|------|------|------|
| multipart upload returns URL + key | user brief §7; PRD 头像 | `POST /api/assets` |
| presign returns URL | contract `API.presign` | `POST /api/assets/presign` |
| list objects via API | user brief GET list | `GET /api/assets` |
| object metadata via API | user brief GET metadata | `GET /api/assets/:key` |
| selector cannot upload | PRD §4 | `POST /api/assets` → 403 |
| returned URL fetchable over HTTP | not AWS SDK | `GET <url>` |

## 8. i18n — `08-i18n.test.ts`

| case | spec | HTTP |
|------|------|------|
| `AUTH-DENIED` stable for zh-CN / en / ko | PRD §2; SCREEN AUTH-DENIED | `GET /api/ops/creators` + `Accept-Language` + `?locale=` |
| `AUTH-LOGIN` stable | UX 未登录 | `GET /api/select/pool` unauthenticated |
| id / creator_key / rating / followers / display_name unchanged | DOMAIN §7; PRD §9 | `GET /api/select/pool` |
| detail keeps 서울살림노트 under `locale=ko` | PRD §9 原文 | `GET /api/select/creators/:id` |
