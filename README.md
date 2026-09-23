# KCS — 韩国品牌 × 小红书博主数据系统

仓库名：`korea-creator-system`。宿主：TinyShip（Nuxt 4 + better-auth + drizzle）。

系统本质是**有参数的爬虫 + 转换层 + 指标筛选方案**：从蒲公英（官方 / TikHub / JustOneAPI 网关）和千瓜、新红（企业接口）按参数拉博主数据，原样落库；转换层规范成统一指标；选人同事用可保存的筛选方案在统一指标上找人、分派、导出。不打分、不设权重，取不到的值显示"—"。

## 组成

| | 端口 | 说明 |
|---|---|---|
| `apps/api` | 7100 | Hono API：适配器、ingest 队列 worker、筛选方案、项目；Postgres `kcs` |
| `apps/marketing` | 7005 | 宣传站（公开） |
| `apps/ops` | 7002 | 运营端：录入审核、批量导入、数据源与抓取任务 |
| `apps/dev` | 7003 | 运维端：任务 / 失败 / 流水线 / 审计 |
| `apps/select` | 7004 | 选人端：博主池 + 筛选方案、项目分派、博主详情 |
| `libs/panel` | — | 四端共用的 Nuxt layer |
| `packages/kcs-contract` | — | 契约：指标、适配器、筛选方案、RBAC、API 路径、testids |

身份统一用 TinyShip（better-auth），KCS 角色存在 `user.role`：`platform_admin` / `ops` / `devops` / `selector` / `selector_viewer`。

## 怎么跑

Node ≥ 22、pnpm 9、本地 Postgres 16。完整步骤与环境变量见 [`docs/HANDOFF.md`](docs/HANDOFF.md)。

```bash
pnpm install
# TinyShip 身份库
DB_DIALECT=pg DATABASE_URL=postgres://kcs:kcs@localhost:5432/tinyship pnpm db:push && pnpm db:seed:auth
# KCS 库
DATABASE_URL=postgres://kcs:kcs@localhost:5432/kcs pnpm db:migrate:kcs && pnpm db:seed:kcs
# API + 四端
DATABASE_URL=postgres://kcs:kcs@localhost:5432/kcs AUTH_BASE_URL=http://localhost:7004 pnpm dev:api
PORT=7004 pnpm --filter @kcs/app-select dev   # ops 7002 / dev 7003 / marketing 7005 同理
```

没有任何数据源凭证也能跑：适配器返回标记为 `fixture` 的样例数据。

## 测试

```bash
pnpm --filter @kcs/contract test && pnpm --filter @kcs/api test   # 单测
pnpm test:blackbox     # 对运行中 API 的 HTTP 黑盒
pnpm test:e2e          # Playwright 浏览器旅程
```

清单见 [`docs/07_测试与验收清单.md`](docs/07_测试与验收清单.md)。

## 文档

从 [`docs/00_项目总览.md`](docs/00_项目总览.md) 开始；`docs/archive/` 是重建前的历史，不描述当前系统。

TinyShip 来源：`TinyshipCN/tinyship` @ `v2.2.0` / `54ddc7a`（`git archive` 导入，排除 `docs/` `archive/`）。
