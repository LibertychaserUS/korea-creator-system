# 交接

## 分支

`cursor/land-four-apps-on-main-d3aa`，PR #10 → `main`。`main` 只放稳定版本。

## 本地怎么跑

前置：Node ≥ 22、pnpm 9、Postgres 16 在 `localhost:5432`（用户 `kcs/kcs`，库 `kcs`、`kcs_test`、`tinyship`）。

```bash
pnpm install

# 1. TinyShip 身份库（四端共用）
export DB_DIALECT=pg DATABASE_URL=postgres://kcs:kcs@localhost:5432/tinyship
export BETTER_AUTH_SECRET=<32+ 字符> BETTER_AUTH_URL=http://localhost:7004
pnpm db:push            # 建 user / session / account / verification
pnpm db:seed:auth       # 五个种子账号 + KCS 角色（幂等）；公开注册已关闭，账号只能这样或用 admin 插件开通
# pnpm db:seed:auth --stranger   # 另建一个能登录但没有 KCS 角色的 stranger@kcs.local（黑盒要用）
# 本机 Postgres 已建好 tinyship 库；旧的 sqlite（/tmp/kcs-local.sqlite）不再使用

# 2. KCS API 库
DATABASE_URL=postgres://kcs:kcs@localhost:5432/kcs pnpm db:migrate:kcs   # schema_migrations 版本化；含数据源 / 内置分类等基础行
DATABASE_URL=postgres://kcs:kcs@localhost:5432/kcs pnpm --filter @kcs/api db:seed   # 可选：样例博主 + 4 条历史快照（加 -- --reset 清空重灌）

# 3. API（含 ingest worker）；本地演示可加 KCS_SEED=demo 让启动时顺带灌样例
DATABASE_URL=postgres://kcs:kcs@localhost:5432/kcs AUTH_BASE_URL=http://localhost:7004 KCS_SEED=demo pnpm dev:api   # :7100

# 4. 四端（每个一个终端；生产产物用 node apps/<app>/.output/server/index.mjs）
PORT=7004 pnpm --filter @kcs/app-select dev
PORT=7002 pnpm --filter @kcs/app-ops dev
PORT=7003 pnpm --filter @kcs/app-dev dev
PORT=7005 pnpm --filter @kcs/app-marketing dev
```

四端都要带 `DB_DIALECT` / `DATABASE_URL`（tinyship）/ `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `APP_BASE_URL` 与 `NUXT_PUBLIC_API_BASE=http://localhost:7100`。tmux 会话 `kcs-api` `kcs-select` `kcs-ops` `kcs-dev` `kcs-marketing` 里能看到上次的启动命令。

登录：`ops@kcs.local` / `selector@kcs.local` / `devops@kcs.local` / `viewer@kcs.local` / `admin@kcs.local`，密码 `Kcs!demo2026`。

## 环境变量

### API

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | `kcs` 库 |
| `AUTH_BASE_URL` | 任一工作端源站，用于 `GET /api/auth/get-session` 校验会话 |
| `KCS_SEED` | `demo` 时启动写入演示数据（24 个样例博主、4 个项目、6 条样例任务、2 个方案，重启会覆盖同 id 的样例行）；缺省不写。生产不要设。数据源行、内置分类由迁移 `0008` 写入，与此无关 |
| `KCS_DEV_TOKENS` | `1` 时接受 `Bearer dev:<email>`（仅非生产、仅本地临时 curl；黑盒与 E2E 都走真实登录，默认关） |
| `SESSION_CACHE_MS` | API 侧会话正缓存，默认 10000；也是退出后旧 token 最长存活时间 |
| `SESSION_CACHE_MAX` | 会话缓存条数上限，默认 5000；超出按最久未用淘汰，另每分钟清一次过期 |
| `LOG_REQUESTS` | `0` 关闭请求日志；默认每个请求一行 JSON（`http.request`：method / path / status / ms），健康探针成功不记 |
| `SHUTDOWN_TIMEOUT_MS` | 收到 SIGTERM / SIGINT 后最多等多久（默认 25000），要小于编排的宽限期（k8s `terminationGracePeriodSeconds: 30`） |
| `KCS_VERSION` | `/api/health` 报的版本号，缺省读 `apps/api/package.json` |
| `KCS_CURSOR_SECRET` | 选人池翻页游标的签名密钥，缺省用 `BETTER_AUTH_SECRET`；都没有时每个进程启动随机生成（记 `cursor.ephemeral_secret` 警告），多副本或重启后旧游标 400。**多副本必须配成同一个值** |
| `KCS_PUBLISHED_FULL_REFRESH` | `1` 时启动全量重建选人池窄表并重估各来源目标人数（5 万人约 24 秒，期间不监听端口）；缺省只补写有变化的行、重排相关的组（约 1 秒内）。改了池行推导逻辑的版本上线时设一次 |
| `KCS_PUBLISHED_REFRESH_MS` | 后台重排全部组的间隔，默认 21600000（6 小时）；快照超过 60 天要靠它失去排位 |
| `INGEST_WORKER` | `0` 时该进程不参与抽水，只服务 HTTP（多副本时给额外副本用；抽水本身已由顾问锁保证全局只有一条） |
| `INGEST_LEASE_MS` | 抓取任务租约，默认 60000；超过这个时间没续约的任务会被别的进程接手续跑 |
| `RETENTION_RAW_PER_SOURCE` | **现阶段全部保留，默认不删。** 设成正数 N 才会每个（博主，来源）只留最新 N 条平台原始 JSON；不设或 `0` 全留 |
| `RETENTION_DEAD_LETTER_DAYS` | 已处理的搁置记录保留天数；不设或 `0` 全留（默认）；待处理的永远不删 |
| `RETENTION_AUDIT_DAYS` | 审计日志保留天数；不设或 `0` 全留（默认） |
| `RETENTION_INTERVAL_HOURS` | 上面任一类打开后的清理间隔，默认 24；`0` 关闭。只有抽水进程执行，历史快照永不删（见 `docs/04` §保留期限） |
| `PGY_ACCESS_TOKEN` | 蒲公英；网关 token（TikHub / JustOneAPI）或官方 access token |
| `PGY_GATEWAY` | `tikhub`（默认）/ `justoneapi` / `official` |
| `PGY_BASE_URL` `PGY_BRAND_USER_ID` `PGY_ENRICH` | 可选：自定义网关地址、官方品牌账号、搜索结果是否逐个补全详情 |
| `QIANGUA_TOKEN` `QIANGUA_BASE_URL` `QIANGUA_SEARCH_PATH` `QIANGUA_FIELD_MAP` | 千瓜合同接口；`FIELD_MAP` 是 `{ canonicalKey: ["path", ...] }` JSON |
| `XINHONG_TOKEN` `XINHONG_BASE_URL` `XINHONG_SEARCH_PATH` `XINHONG_FIELD_MAP` | 新红同上（表单编码 POST，请求头 `Key`） |
| `S3_*` / MinIO | 头像上传；缺省时 bytes 落库 |

没有任何来源凭证时系统完全可用，只是全部是 `fixture`。

### 四端

| 变量 | 说明 |
|---|---|
| `DB_DIALECT=pg` `DATABASE_URL` | TinyShip `tinyship` 库 |
| `BETTER_AUTH_SECRET` `BETTER_AUTH_URL` | better-auth |
| `NUXT_PUBLIC_API_BASE` | API 地址 |
| `KCS_SELECT_URL` `KCS_OPS_URL` `KCS_DEV_URL` `KCS_MARKETING_URL`（运行时也可用 `NUXT_PUBLIC_*_URL` 覆盖） | 宣传站登录后按角色跳转的目标源站 |

部署样例：`docker-compose.yml`、`deploy/k8s/*.yaml`、`deploy/k8s/secret.example.yaml`。

## 当前状态

- 契约：`CreatorMetrics` 33 字段 + 派生；`SavedQuery`；分位按 `source × tier`；`MetricSnapshot`、`CreatorSourceLink`、任务生命周期；`roleFromIdentity`。
- API：路由按领域拆到 `routes/`；迁移版本化（执行时拿 `pg_advisory_lock`，多副本同时启动只有一个在迁）；身份走 TinyShip；ingest 队列 + worker + 速率 / 日配额 + 重试 / 取消；历史快照；身份归并；入库只有 `upsertCreatorFromNormalized` 一处。
- 博主池：筛选、排序、同层分位、分页都在 SQL 里读发布快照（`apps/api/src/http/pool.ts`），与契约 `applySavedQuery` / `cohortPercentiles` 逐行对拍；运营博主、任务、批次列表同样分页（`{ items, total, page, pageSize }`）。
- 运行：抽水进程每日清理旧原始 JSON / 已处理搁置记录 / 审计；SIGTERM 优雅停机；`/api/health` 真查库、`/api/health/live` 做存活；日志是单行 JSON。
- 接口命名：响应一律 camelCase，手工拼的行在契约 `responses.ts` 有类型；前端路径全部用契约 `API` + `apiPath`。
- 四端：池 + 方案编辑器、详情页（趋势、来源、cohort）、数据源页（队列状态、进度、重试 / 取消）、运维重试含 `partial`、退出走 `/__logout`。
- 文案：三语按新架构重写，清单在 `11`。
- 文档：`00`–`10` 只讲当前架构；旧文档在 `docs/archive/`。

## 环境坑

- Tailwind v4 只扫 Vite root，共享 layer 的类要在 `libs/panel` 的 css 里 `@source` 注册。
- Vue scoped 下写 `:global(.dark .x)`，不是 `:global(.dark) .x`。
- 新增 auto-import composable 后要 `npx nuxi prepare` 再 typecheck。
- Nuxt 同时有 `pages/x.vue` 与 `pages/x/[id].vue` 会生成父路由，用 `x/index.vue`。
- shadcn-vue sidebar 的 `useMediaQuery` 在 SSR 会错配，`isMobile` 要在 mounted 后才读。
- better-auth 的 cookie 在 https 下带 `__Secure-` 前缀；跨子域部署要配 `advanced.crossSubDomainCookies`。

## 下一步

见 `08_已知问题与后续计划.md`。
