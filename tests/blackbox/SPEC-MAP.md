# Black-box SPEC-MAP

HTTP-only tests in `tests/blackbox/suites/`. Paths bind to `packages/kcs-contract/src/api.ts`. Specs are `docs/product/PRD.md`, `UX-FLOWS.md`, `SCREEN-INVENTORY.md`, `DOMAIN.md`.

**144 cases** across 10 files (`it.each` expanded). Run: `pnpm test:blackbox`.

The queue file (`09`) needs the API pointed at the stand-in vendor from `global-setup.ts` (`QIANGUA_BASE_URL=http://127.0.0.1:7190 QIANGUA_TOKEN=blackbox-vendor-token`); without it 14 of its 32 cases skip and 1 demo-data case runs instead.

Auth is real: `global-setup.ts` signs the five seed accounts in with email +
password against TinyShip (`POST {BLACKBOX_AUTH_URL}/api/auth/sign-in/email`,
default `http://localhost:7004`) and provides the session tokens to every
suite. No dev tokens; the API introspects each Bearer token against TinyShip.

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

## 0. 登录 — email + password — `00-login.test.ts`

| case | spec | HTTP |
|------|------|------|
| each seed role signs in with email + password, `/api/auth/me` returns that KCS role | 05 §认证; 07 身份与权限「五个种子账号能在任一工作端登录」 | `POST /api/auth/sign-in/email` `GET /api/auth/me` |
| one session is honoured by select / ops / dev origins | 05 §认证「四端共用同一 TinyShip 库」 | `GET {origin}/api/auth/get-session` |
| wrong password → 401, no token, no user | 05 状态码约定 | `POST /api/auth/sign-in/email` |
| unknown email answers exactly like wrong password (no account enumeration) | 05 §认证 | same |
| malformed email → 400 | 05 状态码约定 | same |
| random token and `dev:` token → 401 `AUTH-LOGIN`, pool not leaked | 05 §认证「API 只认 TinyShip 会话」 | `GET /api/auth/me` `GET /api/select/pool` |
| sign-out revokes at TinyShip immediately and at the API within its cache window (≤ 15 s) | 07「退出后…再访问工作端跳登录」 | `POST /api/auth/sign-out` `GET /api/auth/get-session` `GET /api/auth/me` |
| `/__login` on select: 302 `/zh-CN/`, httpOnly better-auth cookie + non-httpOnly `kcs_session` | 05 §认证 流程图 | `POST /__login` |
| `/__login` wrong password: 302 `/zh-CN/login?error=1`, no session cookies | 06 登录页 | `POST /__login` |
| `/__login` locale follows the form (`/en/login?error=1`) | 06 登录页 | `POST /__login` |
| marketing `/__login` hands each role to its workspace origin | 06 宣传页登录交接 | `POST {marketing}/__login` |
| `kcs_last_ws` cookie wins for multi-workspace roles | 06 宣传页登录交接 | `POST {marketing}/__login` |
| public sign-up gets a TinyShip session but **no** KCS role | 05 §认证 `roleFromIdentity` | `POST /api/auth/sign-up/email` |
| role-less account → 403 `AUTH-DENIED` on `/me`, pool, ops, ingest, projects; nothing leaked | 07 身份与权限 | `GET` those |
| role-less account via `/__login` lands on `/zh-CN/denied` | 06 denied 页 | `POST /__login` |
| 6 rapid wrong passwords hit 429 with a retry hint; none succeed | 05 §认证 限速 | `POST /api/auth/sign-in/email` |

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
| default `cpe`↑ (null last) then `followers`↓ | 指标口径 §SavedQuery | `GET /api/select/pool` |
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
| devops retry follows the lifecycle: live / finished job → 409 `JOB-STATE`; cancelled (failed) job → 200 and back to `queued` | 04 抓取流水线 §生命周期; SCREEN DEV-JOB-DETAIL | `POST /api/ingest/jobs/:id/cancel` `POST /api/dev/jobs/:id/retry` |
| selector cannot retry | PRD §8.3; UX 4 | retry → 403 |
| ops cannot retry (M1) | UX 3 | retry → 403 |
| devops GET sees the same job | PRD §8.2 同套数据 | `GET /api/dev/jobs` |

## 9. 抓取队列 — `09-queue.test.ts`

Spec: `docs/04_抓取流水线与队列.md`（参数 / 任务状态 / 速率与配额 / 同步模式 / fixture 模式）. Vendor behaviour comes from `helpers/mock-vendor.ts` (keyword-driven: `bb-pages-N`, `bb-slow-MS`, `bb-fail`, `bb-flaky-K`).

### 入队与任务记录

| case | spec | HTTP |
|------|------|------|
| enqueue → 202 with full initial state (queued / 0 pages / 0 quota / 0 attempts / no timestamps) | 04 §任务状态 | `POST /api/ingest/fetch` |
| list newest-first, detail == list row | 04 队列图「列表 3s 轮询」 | `GET /api/ingest/jobs` `GET /api/ingest/jobs/:id` |
| `maxPages` clamped 1–100, default 5 | 04 §参数 `limit → max_pages` | `POST /api/ingest/fetch` |
| bad source / window 60 / no window / empty body → 400 `SOURCE-INVALID`, nothing queued | 04 §参数 | `POST /api/ingest/fetch` |
| `?sync=1` → 201 with the finished job, not left for the worker | 04 §同步模式 | `POST /api/ingest/fetch?sync=1` |

### worker 自动处理

| case | spec | HTTP |
|------|------|------|
| queued → ok within a tick; startedAt / endedAt / pagesDone / dupes recorded | 04 队列图 | `GET /api/ingest/jobs/:id` (poll) |
| sample lists this run's creators (needs_review), raw payload readable, one history snapshot per record | 04 队列图 creator_raw / creator_metrics_history | `GET /api/ingest/jobs/:id/sample` `GET /api/ingest/raw/:creatorId` (+ `SELECT count(*) creator_metrics_history`) |
| re-ingesting the same creators counts as dupes, history still grows | 04 §身份归并 | `POST /api/ingest/fetch?sync=1` ×2 |
| demo data does not consume quota (`quotaUsed` 0, daily usage unchanged) — *demo mode only* | 04 §fixture 模式「不计配额」 | `POST /api/ingest/fetch?sync=1` |

### 多页、配额、限速（stand-in vendor）

| case | spec | HTTP |
|------|------|------|
| 3 pages → ok, cursors null/2/3, quotaUsed 3, usage +3, 6 creators written | 04 §速率与配额「每页计 1」 | poll + vendor call log |
| `maxPages=2` on a 5-page source stops at 2 and keeps cursor `3` | 04 §任务状态 ok「到 max_pages」 | poll |
| vendor Bearer token is forwarded (stand-in answers 401 without it) | 03 适配器 | vendor call log |
| quota wall → `partial`, cursor kept, `QUOTA_EXHAUSTED`, `nextRunAt` = next UTC 00:00; when due, worker resumes from page 3 to ok on its own | 04 §任务状态 partial「自动续跑」 | poll (+ SQL: quota, `next_run_at = now()`) |
| partial + manual retry → queued, attempts 0, resumes from cursor `2` | 04 §任务状态 partial「可立刻重试」 | `POST /api/ingest/jobs/:id/retry` |
| quota 0 = paused source: immediate partial, no vendor call | 04 §速率与配额 | poll + vendor call log |
| same source runs one job at a time, FIFO (no overlap of startedAt/endedAt) | 04 §速率与配额「并发」 | poll |
| 6/min rate: 6 calls burst, 7th waits ≈10 s | 04 §速率与配额「令牌桶」 | vendor call log timestamps |

### 失败、退避、取消（stand-in vendor）

| case | spec | HTTP |
|------|------|------|
| vendor 500 ×3 → failed, attempts 3, `SOURCE_UNAVAILABLE`, endedAt set, nextRunAt null; visible in `/api/dev/failures` | 04 队列图「3 次后 failed」 | poll `GET /api/dev/failures` `GET /api/dev/jobs/:id` |
| backoff 2 s then 4 s between attempts | 04 队列图「指数退避」 | vendor call log timestamps |
| one hiccup then ok: attempts 1, error fields cleared | 04 队列图 | poll |
| failed → retry → attempts 0, queued; fails again after 3 more | 04 §任务状态 failed「可重试」 | `POST /api/ingest/jobs/:id/retry` |
| cancel a running job: 200 failed/cancelled, worker stops at the page boundary, no further vendor calls | 04 §任务状态 running「可取消」 | `POST /api/ingest/jobs/:id/cancel` |
| cancelled job keeps pagesDone + cursor; retry resumes from the break | 04 §任务状态 | retry + poll |

### 生命周期约束（no vendor needed）

| case | spec | HTTP |
|------|------|------|
| cancel queued → failed/cancelled, never started | 04 §任务状态 queued「可取消」 | `POST /api/ingest/jobs/:id/cancel` |
| ok job: cancel → 409 `JOB-STATE`, retry → 409 `JOB-STATE` | 04 §任务状态 | cancel / retry |
| cancel twice → second 409, record unchanged | 04 §任务状态 | cancel ×2 |
| unknown id: detail / retry / cancel / dev detail / dev retry → 404 `NOT-FOUND`; sample → empty | contract | all job routes |
| ops view and dev view show the same record | PRD §8.2 同套数据 | `GET /api/ingest/jobs/:id` `GET /api/dev/jobs/:id` |

### 谁能做什么

| case | spec | HTTP |
|------|------|------|
| fetch: ops / admin only; devops, selector, viewer → 403, nothing queued | RBAC `ingest.write` | `POST /api/ingest/fetch` |
| cancel is `ingest.write` (devops 403); retry is `ingest.retry` (ops 403, both routes); selector/viewer 403 everywhere | RBAC | cancel / retry / GET |
| job list identical for ops and devops | PRD §8.2 | `GET /api/ingest/jobs` |
| cancel + retry leave audit rows (`ingest.cancel`, `ingest.retry`) | 06 审计 | `GET /api/dev/audit` |

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
| id / creator_key / metrics / followers / display_name unchanged | DOMAIN §7; PRD §9 | `GET /api/select/pool` |
| detail keeps 서울살림노트 under `locale=ko` | PRD §9 原文 | `GET /api/select/creators/:id` |
