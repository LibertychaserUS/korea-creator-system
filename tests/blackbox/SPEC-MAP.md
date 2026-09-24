# Black-box SPEC-MAP

HTTP-only tests in `tests/blackbox/suites/`. Paths bind to `packages/kcs-contract/src/api.ts`. Specs are `docs/product/PRD.md`, `UX-FLOWS.md`, `SCREEN-INVENTORY.md`, `DOMAIN.md`.

**206 cases** across 15 files (`it.each` expanded). Run: `pnpm test:blackbox`.

The queue files (`09`, `10`) need the API pointed at the stand-in vendor from `global-setup.ts` (`QIANGUA_BASE_URL=http://127.0.0.1:7190 QIANGUA_TOKEN=blackbox-vendor-token`); without it 14 of `09`'s 32 cases and 13 of `10`'s 16 skip (one demo-data case in `09` runs instead).

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

Error envelope: `{ error: { code, message } }`. Codes **do not** localize: `AUTH-LOGIN` `AUTH-DENIED` `VALIDATION` `SOURCE-INVALID` `NOT-FOUND` `JOB-STATE` `CONFLICT` `UPLOAD-TYPE` `UPLOAD-TOO-LARGE` `GONE`. `VALIDATION` bodies add `error.fields: [{ path, message }]`.

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
| public sign-up is refused (4xx, no token, no session cookie) and the email cannot sign in afterwards | 05 §认证 公开注册已关闭 | `POST /api/auth/sign-up/email` `POST /api/auth/sign-in/email` |
| an admin-provisioned account with no KCS job signs in to TinyShip but holds **no** KCS role | 05 §认证 `roleFromIdentity` | `POST /api/auth/sign-in/email` `GET /api/auth/get-session` |
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
| selector POST ingest job or retry → 403 | PRD §8.3; UX 4 | `POST /api/ingest/fetch` `POST /api/dev/jobs/:id/retry` |
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
| server paging: `page` / `pageSize`, `total` counted before paging, `dir` = `order`, `pageSize` capped at 100 | 05 §分页 | `?page&pageSize&sort=followers&dir=desc` |
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
| optional SQL count ≥ 1 (fallback GET) | user brief persistence | `assignments` table or GET project |

## 6. Ingest — `06-ingest.test.ts`

| case | spec | HTTP |
|------|------|------|
| job on a registered source goes through the queue → 202 `{ job }` | PRD §8.3 §12; UX 4; 04 队列 | `POST /api/ingest/fetch` `GET /api/ingest/jobs/:id` |
| old inline route → 410 `GONE`, no job, no made-up creator | 05 数据源与抓取 | `POST /api/ingest/jobs` |
| batch without a workbook → 400 `VALIDATION`, no job | 05 运营端 | `POST /api/ops/batches` |
| unknown `source` → 400 `SOURCE-INVALID` | PRD §8.3 | `POST /api/ingest/fetch` |
| ad-hoc `sourceUrl` → 400 `SOURCE-INVALID`, no silent job | UX 4 硬限制 | `POST /api/ingest/fetch` `{ sourceUrl }` |
| devops retry follows the lifecycle: live / finished job → 409 `JOB-STATE`; cancelled (failed) job → 200 and back to `queued` | 04 抓取流水线 §生命周期; SCREEN DEV-JOB-DETAIL | `POST /api/ingest/fetch` `POST /api/ingest/jobs/:id/cancel` `POST /api/dev/jobs/:id/retry` |
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
| sample lists this run's creators (`needsReview`, camelCase keys), raw payload readable, one history snapshot per record | 04 队列图 creator_raw / creator_metrics_history | `GET /api/ingest/jobs/:id/sample` `GET /api/ingest/raw/:creatorId` (+ `SELECT count(*) creator_metrics_history`) |
| re-ingesting the same creators counts as dupes, history still grows | 04 §身份归并 | `POST /api/ingest/fetch?sync=1` ×2 |
| demo data does not consume quota (`quotaUsed` 0, daily usage unchanged) — *demo mode only* | 04 §fixture 模式「不计配额」 | `POST /api/ingest/fetch?sync=1` |

### 多页、配额、限速（stand-in vendor）

| case | spec | HTTP |
|------|------|------|
| 3 pages → ok, cursors null/2/3, quotaUsed 3, usage +3, 6 creators written | 04 §速率与配额「每页计 1」 | poll + vendor call log |
| `maxPages=2` on a 5-page source stops at 2 and keeps cursor `3` | 04 §任务状态 ok「到 max_pages」 | poll |
| vendor Bearer token is forwarded (stand-in answers 401 without it) | 03 适配器 | vendor call log |
| quota wall → `partial`, cursor kept, `QUOTA_EXHAUSTED`, `nextRunAt` = next 00:00 in the source's `quota_tz` (Beijing → 16:00 UTC); when due, worker resumes from page 3 to ok on its own | 04 §任务状态 partial「自动续跑」 | poll (+ SQL: quota, `next_run_at = now()`) |
| partial + manual retry → queued, attempts 0, resumes from cursor `2` | 04 §任务状态 partial「可立刻重试」 | `POST /api/ingest/jobs/:id/retry` |
| quota 0 = paused source: immediate partial, no vendor call | 04 §速率与配额 | poll + vendor call log |
| same source runs one job at a time, FIFO (no overlap of startedAt/endedAt) | 04 §速率与配额「并发」 | poll |
| 6/min rate: 6 calls burst, 7th waits ≈10 s | 04 §速率与配额「令牌桶」 | vendor call log timestamps |

### 失败、退避、取消（stand-in vendor）

| case | spec | HTTP |
|------|------|------|
| vendor 500 ×3 → failed, attempts 3, `SOURCE_UNAVAILABLE`, endedAt set, nextRunAt null; visible in `/api/dev/failures` | 04 队列图「3 次后 failed」 | poll `GET /api/dev/failures` `GET /api/dev/jobs/:id` |
| backoff full jitter under 2 s then 4 s between attempts | 04 队列图「指数退避」 | vendor call log timestamps |
| 429 + `Retry-After: 6` → next call ≥ 6 s later, then ok | 04 §失败「Retry-After 是下限」 | vendor call log timestamps (`bb-429-6`) |
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

## 10. 搁置记录（死信队列）与一条流水线 — `10-dead-letters.test.ts`

Spec: `docs/04_抓取流水线与队列.md`（§抽水 / §失败 / §搁置记录）. Needs the same stand-in vendor as `09`; three of its behaviours exist only for this file (`bb-reject` → 403, `bb-shape` → 200 without a record list, `bb-badrecord` → a creator with no name).

### 整次抓取

| case | spec | HTTP |
|------|------|------|
| vendor 403 parks on attempt 1 (`VENDOR_REJECTED`), no backoff, no further vendor call, no credential in the message | 04 §失败 permanent | poll + `GET /api/dev/dead-letters` + vendor log |
| a 200 without a record list parks on attempt 1 (`CONFIG_MISSING`) | 04 §失败 permanent | same |
| vendor 500 spends all 3 attempts first, then parks (`SOURCE_UNAVAILABLE`) | 04 §失败 transient | same |
| replay re-queues a *new* job from the saved query + cursor and settles the entry (`replayed`, `replayJobId`) | 04 §搁置记录 | `POST /api/dev/dead-letters/:id/replay` |
| retrying the job itself also settles its entry — no orphan | 04 §搁置记录 | `POST /api/ingest/jobs/:id/retry` |

### 单个博主

| case | spec | HTTP |
|------|------|------|
| unreadable record parks with its payload; the rest of the page still lands | 04 §搁置记录 record | `POST /api/ingest/fetch?sync=1` + list |
| the same record failing twice updates one entry (attempts++), no duplicates | 04 §搁置记录 | list |
| replay after the payload is fixed writes the creator, spends no quota and no vendor call | 04 §搁置记录「不打平台」 | replay + usage/vendor log |
| a replay that keeps failing stays open and counts; after 3 it is refused (409) | 04 §搁置记录 poison | replay ×4 |

### 处理、权限、可见性

| case | spec | HTTP |
|------|------|------|
| devops reads list + detail; ops reads but cannot act (403); selector / viewer 403; anonymous 401 | RBAC `dev.read` / `dev.retry` | all dead-letter routes |
| dismiss removes it from the open list; dismissing or replaying again is 409 | 04 §搁置记录 | dismiss / replay |
| unknown `state` / `kind` → 400 `VALIDATION`; unknown id → 404 | contract | list / detail / replay / dismiss |
| health reports parked counts and who is draining | 04 §抽水 | `GET /api/dev/health` |

### 一条流水线

| case | spec | HTTP |
|------|------|------|
| five jobs at once: `running` never exceeds 1, all finish | 04 §抽水「一次一个」 | `GET /api/ingest/jobs` (poll) |
| a running job carries holder + lease and releases both when it ends | 04 §抽水「租约」 | poll + health (+ SQL read of `locked_by`) |
| a run abandoned mid-page is left alone while its lease is good and taken over from the cursor once it lapses | 04 §抽水「进程中途没了」 | poll + vendor log (SQL arranges the orphan) |

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

## 11. 安全（上线阻塞项回归）— `11-security.test.ts`

Specs: `docs/05_接口说明.md` §认证 / §上传限制 / §错误码; `docs/07_测试与验收清单.md` §安全.
Workspace origins that are not running are skipped case by case. The `Secure`
assertions expect production builds (`NODE_ENV=production`, as in the deploy
images); set `BLACKBOX_WORKSPACE_DEV=1` when pointing at `nuxt dev`.

### 登录跳转

| case | spec | HTTP |
|------|------|------|
| `/__login` with `locale` = `/evil…`, `//evil…`, `\evil…`, `https://evil…`, `zh-CN/../..`, `fr` and a wrong password → 302 `/zh-CN/login?error=1` every time | 05 §认证「跳转只拼站内相对路径」 | `POST /__login` |
| successful `/__login` with `locale=//evil…` → 302 `/zh-CN/`; `kcs_session` carries `Secure`, not `HttpOnly` | 05 §认证 `kcs_session` | `POST /__login` |
| `/__logout` clears `kcs_session` with the same attributes (`Secure` in production) | 05 §认证 退出 | `POST /__logout` |
| marketing hand-off with an evil `locale` still lands on the configured select origin `/zh-CN/` | 05 §认证「目标源站只取服务端配置」 | `POST {marketing}/__login` |

### 上传

| case | spec | HTTP |
|------|------|------|
| HTML declared as `image/png` → 415 `UPLOAD-TYPE`, no asset stored | 05 §上传限制 魔数 | `POST /api/assets` `GET /api/assets` |
| script-bearing SVG and a `text/html` file → 415 | 05 §上传限制 四种图片 | `POST /api/assets` |
| > 5 MB with a real PNG header → 413 `UPLOAD-TOO-LARGE` | 05 §上传限制 5 MB | `POST /api/assets` |
| presign for `text/html` → 415 `UPLOAD-TYPE` | 05 §上传限制 | `POST /api/assets/presign` |
| raw read of a real PNG: `Content-Type: image/png`, `nosniff`, `inline`, `default-src 'none'`, bytes intact | 05 §上传限制 读回 | `GET /api/assets/raw/*` |
| a pre-fix HTML row (planted over SQL) is 404 on raw read, never served as a page | 05 §上传限制 旧行 | `GET /api/assets/raw/*` |
| unknown key and a badly percent-encoded key → 404 | 05 §上传限制 | `GET /api/assets/raw/*` |

### 模板路由与注册

| case | spec | HTTP |
|------|------|------|
| on each of select / ops / dev / marketing: `/api/chat`, `/api/image-generate`, `/api/video-generate(/status)`, `/api/upload`, `/api/kcs/overview`, `/api/kcs/reviews`, `/api/orders`, `/api/users/:id`, `/api/admin/*`, `/api/blog`, `/api/credits/*`, `/api/subscription/*`, `/api/payment/initiate`, all five `/api/payment/webhook/*`, `/api/payment/return/paypal`, `/api/fixtures/imok/*` → 404 (4 cases) | 07 §安全「四端只剩身份路由」 | `GET` / `POST` those |
| better-auth identity routes still answer (`get-session`) | 05 §认证 | `GET /api/auth/get-session` |
| the API origin has none of those routes either | 05 | same paths on the API |
| public sign-up refused on every reachable workspace origin | 05 §认证 公开注册已关闭 | `POST {origin}/api/auth/sign-up/email` |

### 错误处理

| case | spec | HTTP |
|------|------|------|
| broken JSON on creator create / patch, ingest job, project, saved query → 400 `VALIDATION`, never 500 | 05 §错误码 | `POST` / `PATCH` those |
| bad fields → 400 `VALIDATION` with `error.fields[].path` (e.g. `followers`) | 05 §错误码 | `POST /api/ops/creators` |
| PATCH / unpublish a creator that does not exist → 404 `NOT-FOUND`, no audit row | 05 §错误码「不写审计」 | `PATCH /api/ops/creators/:id` `POST …/unpublish` `GET /api/dev/audit` |
| assign into a missing project, remove a missing assignment → 404, no audit row | 05 §错误码 | `POST /api/select/projects/:id/assignments` `DELETE …/assignments/:creatorId` |

## 12. 运营审核与发布快照 — `12-ops-review.test.ts`

Specs: `docs/02_数据字典.md` `metrics_locked` / `metrics_locked_at`; `docs/03_指标口径与数据源.md` §发布快照与审计; `docs/05_接口说明.md` 运营端.
The re-ingest group needs the stand-in vendor (`bb-grow`: the same two creators, 40 000 more followers per call); without it those 4 cases skip.

| case | spec | HTTP |
|------|------|------|
| a freshly fetched creator is `stage: review`, no snapshot, not in the pool | 02 `creatorStage` | `POST /api/ingest/fetch?sync=1` `GET /api/ingest/jobs/:id/sample` `GET /api/ops/creators/:id` `GET /api/select/pool` |
| publish → `refreshed: true`, pool followers = the numbers at publish, `metricsLockedAt` set, stage `released` | 03 §发布快照 | `POST /api/ops/creators/:id/publish` |
| re-fetch → ops latest followers grow, `metricsLocked` unchanged; pool followers / tier / `followersMin` filter unchanged; select detail `metrics` = publish-time, `metricsLatest` = latest | 03 §发布快照「抓取永远不写它」 | `POST /api/ingest/fetch` `GET /api/select/pool` `GET /api/select/creators/:id` |
| publish while released → `refreshed: false`; take down → `withdrawn`, off the pool; publish again → pool on the latest numbers (tier moves to `mid`) | 03 §发布快照「下架、再发布」 | `POST …/publish` `POST …/unpublish` |
| manual PATCH of metrics after publish leaves the pool alone; detail shows both; re-publish moves the pool | 02 `metrics` / `metrics_locked` | `PATCH /api/ops/creators/:id` |
| ops list rows carry `stage`; overview has `pending` / `withdrawn` counts | 05 运营端 | `GET /api/ops/creators` `GET /api/ops/overview` |

## 13. 项目导出与移出 — `13-project-board.test.ts`

Specs: `docs/05_接口说明.md` 选人端 · 项目导出 / 移出分派; `docs/03_指标口径与数据源.md` §发布快照（导出用发布时的数字）.

| case | spec | HTTP |
|------|------|------|
| export is `text/csv` attachment, bytes start with the UTF-8 BOM, Chinese headers, followers = publish-time (not the later PATCH), `=` in the nickname is defused, status 已分派 | 05 项目导出 | `GET /api/select/projects/:id/export` |
| `?locale=en` / `ko` headers; unknown locale falls back to Chinese | 05 项目导出 | `GET …/export?locale=` |
| viewer (select.read) can export; ops 403; anonymous `AUTH-LOGIN` | 01 RBAC | `GET …/export` |
| viewer cannot remove an assignment (403) | 01 RBAC `select.assign` | `DELETE /api/select/projects/:id/assignments/:creatorId` |
| selector removes → board empty, export no longer lists the creator, second delete 404 | 05 移出分派 | `DELETE …/assignments/:creatorId` `GET /api/select/projects/:id` |
| ops reads a creator's history; selector 403 | 05 运营端 | `GET /api/ops/creators/:id/history` |

## 14. 账号管理 — `14-accounts.test.ts`

Specs: `docs/05_接口说明.md` 账号管理（工作端源站 `/api/kcs-admin/*`，`admin.users` 只给 platform_admin）; `docs/07_测试与验收清单.md` §账号.
These routes live on the workspace origin (`BLACKBOX_AUTH_URL`), next to sign-in, not on the API. Role changes and disabling reach the API within its 10 s session cache; the cases wait up to 15 s.

| case | spec | HTTP |
|------|------|------|
| anonymous → 401, no list | 01 AuthN | `GET /api/kcs-admin/users` |
| ops / devops / selector / selector_viewer → 403 on list, create (even asking for platform_admin) and patch; nothing gets created (`it.each` ×4) | 01 RBAC `admin.users` | `GET` `POST /api/kcs-admin/users` `PATCH …/:id` |
| admin lists every account with role, disabled flag, last sign-in; own row is `self` | 05 账号管理 | `GET /api/kcs-admin/users` |
| bad email / short password / unknown role → 400 with code; taken email → 409; admin cannot demote or disable self (409 `self`); unknown id 404 | 05 账号管理 | `POST` `PATCH` |
| admin creates an ops account → it signs in with the starting password, API role `ops`, ops list 200 / pool 403, form sign-in hands off to the ops origin, list shows last sign-in | 05 账号管理 · 00 登录分流 | `POST /api/kcs-admin/users` `POST /api/auth/sign-in/email` `POST /__login` `GET /api/auth/me` |
| role → selector: API reports `selector` within the cache window, pool 200, ops list 403 | 05 账号管理（10 秒生效） | `PATCH …/:id {role}` `GET /api/auth/me` |
| disable: old session gone at once on the workspace origin, API 401 within the cache window, sign-in 403; restore → signs in again as selector | 05 账号管理（停用） | `PATCH …/:id {disabled}` `GET /api/auth/get-session` `POST /api/auth/sign-in/email` |
