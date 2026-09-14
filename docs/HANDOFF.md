# 听潮四端实现线 — 交接报告（给 Fable 5.1）

> 交接时间：2026-09-13 00:35（UTC+8）
> 分支：`feature/kcs-four-apps-completion`（worktree：`.worktrees/kcs-completion`）
> 状态：功能冻结。本分支以 **draft PR** 形式提交，视觉验收未走完，合入前请先读完本文。

## 1. 分支与提交状态

基座：`feature/kcs-four-apps`（5fb04f0，K3 整理的四端 + panel 层）。
本分支在其上新增（按序）：

| commit | 内容 |
| --- | --- |
| cfe288c | 补上潮涌画布与 IMOK CSV 工具（tide.ts / TideCanvas.vue / imok-csv.ts + 11 条潮汐单测） |
| 975e37d | 补上宣传站落地页 + 四端结构回归测试（12 条） |
| 28ca02c | 修好四端各自寻址与按端权限（侧栏/切换器/中间件/登录跳转/断链） |
| 0120636 | 锁定四端工作区依赖（lockfile） |
| （merge） | 合并 `feature/theme-tide`：tide 深海主题 + config.ts 听潮品牌默认 |
| （merge） | 合并 `feature/i18n-panel-copy`：三语面板文案（含 Cookie consent 词条） |
| 最新 | WIP：panel 层别名 build 修复 + SSR WS 撞车修复 + 复选框样式 + 别名结构测试 |

两个 merge 保留了 K3 的原始 commit，K3 后续把 theme-tide / i18n-panel-copy 单独合 main 不会冲突（谁先合都行，另一边自动变空）。

## 2. 页面完成度（2026-09-13 Fable 设计重做后）

本轮对四端做了一次完整的设计升级，并用 Playwright 生产构建截图逐页验收（亮/暗 × 桌面 1440 / 手机 390，共 36 张，控制台错误 / HTTP≥400 / 横向溢出 / 水合不一致全部为 0）。

| 端 | 页面 | 状态 |
| --- | --- | --- |
| marketing | `/` 落地页 | **DONE**：完整落地页——顶栏锚点导航、主张 + 静态达人库预览卡（量级 / CPE）、三工作台卡、四步流程（抓取而非评分）、数据区（三数据源 / 六组字段 / 同量级比 / 健康等级门 / 转换层）、三条主张、深海 CTA、页脚 |
| marketing | `/login` | **DONE**：桌面双栏（左品牌叙事 + 三工作台，右表单带图标输入与错误框），手机单栏沿用 auth 布局引子 |
| select | `/` 达人库 | **DONE**：项目上下文条、粉丝/报价区间 + 合作记录 + 分段排序、表格（等级徽标/分数/粉丝/报价/合作次数、骨架屏、空态、行点选）、手机切卡片列表、底部分配栏 |
| select | `/projects`、`/projects/new`、`/projects/[id]` | **DONE**：列表卡 + 成员数、双栏新建（表单 + 预览）、详情 KPI（人数/均分/总粉丝/总报价）+ 名单表 + 「从库里选」 |
| ops | `/` 首页 | **DONE**：草稿/待复核/已清洗/已发布 KPI、最近批次表（手机隐藏计数列）、总览堆叠条 + 清洗率、快捷入口 |
| ops | `/creators/new` | **DONE**：分区表单（显示名/小红书号/粉丝/报价/合作记录/头像自定义上传按钮）、实时预览卡、保存 → 发布两步进度 |
| dev | `/` 健康面板 | **DONE**：SQL 脉冲 / 任务数 / 失败 / 数据源 KPI、任务状态分布、最近任务表（失败原因、按权限显示重试） |
| nuxt-app（遗留面板，7001） | 全部 | NOT STARTED——保持 TinyShip 原样，未验证 |

工作台外壳（`libs/panel`）也一并重做：侧栏（品牌头 + 高亮条导航 + 用户卡/角色/退出）、粘性顶栏、页头眉题；新增通用组件 `KpiTile` / `TableCard` / `StatusBadge` / `GradeBadge` / `EmptyState` 与 `useFormat`。所有 e2e testid 契约保持不变。

## 3. Tide 主题状态

- **已生效并截图验收**：亮/暗两态在四端全部页面确认无误（截图脚本见 §5）。之前暗色失效的根因是 scoped 样式里 `:global(.dark) .x` 被编译成裸 `.dark`，已改为 `:global(.dark .x)`。
- Tailwind v4 只扫描 Vite root，`libs/panel/assets/css/main.css` 已用 `@source` 显式登记 panel 层 / libs/ui / config.ts，生产构建不再丢工具类。
- 未决：ColorSchemeSelector 里 tide 与其他六套 TinyShip 配色并列，未决定是否精简；nuxt-app 未验证。

## 4. 已知未决 bug

**/en 路由文案显示中文** —— 本轮 **未能复现**：dev 与生产构建下，fresh context（无 cookie、Accept-Language zh-CN）分别打开 `/en`、`/en/login`、`/zh-CN`、`/ko` 等 10 条路径，SSR HTML 与水合后的 hero / consent 文案均与 URL 前缀一致。保留原始记录如下以备再现：
- 原复现描述：fresh 浏览器打开 `/en`，hero lead 与 consent 是中文；带 `NEXT_LOCALE=en` cookie 则正常英文。
- 当时怀疑方向：`libs/panel/nuxt.config.ts` 的 `detectBrowserLanguage: { useCookie, redirectOn: 'root', alwaysRedirect: true }` 在非 root 的 prefix 路由上覆盖了 route locale。

另有一处已修：`apps/api` 达人库默认排序原按原始 `rating` 列，与界面「综合分」不一致，已改按规则分排序。

## 5. 环境坑（重要）

- **EMFILE / kqueue**：本机（macOS）vnode/kqueue 压力到顶（`kern.num_vnodes == kern.maxvnodes`），`nuxt dev` 的 chokidar 扫描直接 EMFILE，dev server 起得来但 listen 会死。**绕行方案：用生产构建验证**（`pnpm build` + `node .output/server/index.mjs`，无 watcher）。重开 dev 前建议重启机器或至少杀掉残留 node 进程。
- **端口 7000**：macOS ControlCenter（AirPlay 接收器）常年占用 7000（v4+v6 双栈），marketing 在本机只能用别的端口验证（我用的 7005）。配置里仍是 7000——要么用户关掉 AirPlay 接收器，要么把 marketing 端口永久改掉（影响 KCS_*_URL 默认值与将来的 nginx conf）。
- 生产服务器启动方式：`set -a && . ../../.env && set +a && PORT=<port> node .output/server/index.mjs`（.env 在仓库根，DB 指向 `postgresql://localhost:5432/tinyship`；API 用 `kcs` 库，两边靠共享密钥/session 打通，上一轮验证过能登录）。
- 种子账号（密码 `Kcs!demo2026`）：admin@ / ops@ / devops@ / selector@ / viewer@kcs.local。
- Playwright 截图：页面有持续动画时 capture 会挂起——先 `page.emulateMedia({ reducedMotion: 'reduce' })`，不行就 `browser_close` 重开再用 `domcontentloaded` + 短等待。本轮用的截图脚本要点：先种 `kcs_consent=all` cookie 免掉 consent 弹层；`localStorage` 写 `kcs-ui-theme-pref` / `kcs-ui-theme` 切亮暗；登录后用 `waitForURL(u => !u.pathname.endsWith('/login'))`；URL 带尾斜杠避免 `/zh-CN → /zh-CN/` 跳转噪音。
- 新增 auto-import composable 后，`pnpm build` 的 typecheck 读的是 `.nuxt/types/imports.d.ts`，会报 `TS2304: Cannot find name`——先在该 app 目录 `npx nuxi prepare` 再 build。
- 云端（Linux）环境：Postgres 16 本地 `postgres://kcs:kcs@localhost:5432/kcs`，API 首启缺列已在 `apps/api/src/migrate.ts` 补齐（budget_note / er / locked_final / assignments.note）。

## 6. 不会断的东西 / 可能的雷

- 当前 HEAD 四端 `pnpm build` **全部通过**；`tests/unit/` 里 tide 11 条 + four-apps 12 条 + panel-imports 2 条全绿。
- 根目录其他单测有 6 个 TinyShip 模板遗留失败（credits/utils、validators/user、email/cloudflare），**先于本分支存在**，与本次无关。
- 主 checkout（feature/company-tenant）里还有三个**冗余文件**：`libs/panel/utils/tide.ts`、`libs/panel/components/TideCanvas.vue`、`libs/panel/server/utils/imok-csv.ts`——内容已进本分支，主树那份是重复，切分支前删掉即可，不要提交。
- apps/web 的 shadcn reskin WIP 是别的 agent 的，已废弃，别捡。

## 7. 下一步建议（按序）

1. 合 main 由用户决定，别自动合；PR #9 已包含本轮全部前端重做与后端/部署收尾。
2. nuxt-app（7001）面板过一遍 tide 主题，或决定是否下线。
3. 视觉可继续打磨的点：ColorSchemeSelector 精简为 tide 单一配色；达人库表格加列显隐；录入页头像裁切。
4. 编排层未验证项见文末「后端/部署收尾（sol）」。

## 8. 后端 / 部署 / 测试收尾（2026-09-14）

- API：达人库默认排序改按规则综合分（`queryPool`），概览 `recentJobs` 返回 `failed_count` / `batch_name` / `file_name`，录入保存 `xhs_id`；`WEB_ORIGIN` 支持逗号分隔多来源。`apps/api` 单测 27/27 通过。
- 部署（**只做了 YAML 语法校验，未在真实 Docker / 集群跑过**）：
  - `deploy/Dockerfile.workspace-app`：四端共用多阶段镜像（`--build-arg APP=marketing|ops|dev|select`），bookworm-slim 基底。
  - `deploy/k8s/workspace-apps.yaml`：四端 Deployment + Service + ConfigMap；运行期 URL 用 `NUXT_PUBLIC_*` 覆盖（`KCS_*_URL` 只在 build 时生效）；端口用 `NITRO_PORT`；面板库与 better-auth 密钥来自 Secret `kcs-web`（样例在 `secret.example.yaml`）。
  - `deploy/k8s/ingress.yaml`：`kcs.example.com`（marketing + `/api`）、`ops.` / `dev.` / `select.` / `legacy.` 子域。
  - `deploy/nginx/kcs.conf`：宿主机 7000–7004 + 7100 反代版本。
  - `docker-compose.yml`：`--profile full` 追加四端服务（面板库走容器内 sqlite）。
  - Kafka / Redpanda：队列协议（topic、幂等键、消费重试、状态回写）尚未定义，未声明服务；ingest 仍在 API 进程内执行。
- E2E：`e2e/helpers/constants.ts` 迁到四端地址（`E2E_{MARKETING,OPS,DEV,SELECT}_URL`），选人端首页指向 `/projects`；`06-theme-i18n` 改为匹配现有控件（单按钮主题切换 + 语言下拉）。本地生产构建栈上 **6/7 通过**，`05-image-upload` 需要 MinIO（本机没起）。
- 顺手修掉的产品问题：Cookie 提示原是全宽底栏，会盖住表单底部的保存 / 分配按钮（e2e 因此卡死），改为桌面右下角小卡。
- CI：`Build` 与 `Docker Build Verification` 之前挂在 `@tinyship/next-app` 类型检查——支付套餐 `i18n` 缺 `ko`；已补三语；文档站搜索 `localeMap` 补 `ko`；nuxt-app 布局的 `~/composables` 类型导入改相对路径。

## 9. 评分已删，改为指标 + 筛选方案（2026-09-14）

- 不再有综合分 / 等级 / 排名。契约见 `packages/kcs-contract/src/{metrics,source-adapter,saved-query}.ts`；口径见 `docs/03_指标口径与数据源.md`。
- 数据源只做 A（蒲公英 OpenAPI）与 B（千瓜 / 新红），**不做自建爬虫**。无凭证时 API 走 `apps/api/src/adapters/fixtures/*.json`，任务标 `sourceMode: 'fixture'`，界面显示「样例数据」。
- 接真实接口：填 `PGY_APP_ID / PGY_APP_SECRET / PGY_ACCESS_TOKEN`、`QIANGUA_TOKEN`、`XINHONG_TOKEN`（`deploy/k8s/secret.example.yaml`、`docker-compose.yml` 已留位），再按真实返回改各适配器顶部的 `FIELD_MAP`。
- 前端入口：选人端 `/`（方案栏 + 编辑器）、`/creators/[id]`（指标面板）；运营端 `/sources`（抓取参数）。
- `apps/web` 已删除；`apps/nuxt-app` + `libs/kcs-domain` 仍是旧六维口径的 mockup，未接触，建议下线。
