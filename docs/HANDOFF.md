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

## 2. 页面完成度

| 端 | 页面 | 状态 |
| --- | --- | --- |
| marketing | `/` 落地页 | **DONE**（潮涌背景 + 品牌文案 + 三端入口卡片 + consent 弹层，生产构建截图确认） |
| marketing | `/login` | DONE（auth 布局潮涌背景，上一轮 dev 验证过；本轮生产构建未单独截图） |
| select | `/` 达人池 | DONE 级别渲染（筛选/排序/表格/指派），复选框样式已补；**生产截图未做** |
| select | `/projects`、`/projects/new`、`/projects/[id]` | 组件化完成，视觉未截图验收 |
| ops | `/` 首页（统计瓦片 + 批次表） | 组件化完成，视觉未截图验收 |
| ops | `/creators/new`（录入 + 发布） | 组件化完成，视觉未截图验收 |
| dev | `/` 健康面板 | 组件化完成，视觉未截图验收 |
| nuxt-app（遗留面板，7001） | 全部 | **NOT STARTED**——保持 TinyShip 原样，共享同一套 libs/ui 主题管线（tide 已进 index.css，理论上自动生效），未验证 |

四个端 `pnpm build` 全部通过（本轮已验证）。生产构建起在：marketing **7005**、ops 7002、dev 7003、select 7004，API 7100（见 §5 端口说明）。

## 3. Tide 主题状态

- **已生效**：`libs/ui/styles/themes/tide.css`（亮/暗两态，深海蓝主色 oklch 0.45/0.085/235）已注册进 `libs/ui/themes.ts` 与 `styles/index.css`；`config.ts` 默认配色 = tide、默认语言 = en、浏览器语言自动探测开。页面 `<html>` 确认带 `theme-tide` class，暗色加 `.dark` 生效（FOUC 脚本在 app.vue）。
- **缺失/未验**：
  - 暗色模式只改了代码路径，**没有截图验收过**（亮/暗对比未做）。
  - ColorSchemeSelector 里 tide 与其他六套 TinyShip 配色并列，未决定是否精简。
  - nuxt-app 未验证。

## 4. 已知未决 bug（不要在本分支修，PR 里已注明）

**/en 路由文案显示中文**：客户端 vue-i18n 的语言跟了浏览器检测（zh-CN）而不是 URL 前缀。
- 复现：fresh 浏览器（无 NEXT_LOCALE cookie、Accept-Language zh-CN）打开 `/en`，hero lead 与 consent 是中文；带 `NEXT_LOCALE=en` cookie 则正常英文。
- SSR HTML 不含 consent 文案（组件 hydration 后才渲染），所以问题在客户端水合时的 locale 取值。
- 中断时正在读 `libs/panel/i18n/i18n.config.ts`；层配置里 `detectBrowserLanguage: { useCookie, redirectOn: 'root', alwaysRedirect: true }`（`libs/panel/nuxt.config.ts` 的 i18n 块）。怀疑方向：detectBrowserLanguage 在非 root 的 prefix 路由上也覆盖了 route locale。

## 5. 环境坑（重要）

- **EMFILE / kqueue**：本机（macOS）vnode/kqueue 压力到顶（`kern.num_vnodes == kern.maxvnodes`），`nuxt dev` 的 chokidar 扫描直接 EMFILE，dev server 起得来但 listen 会死。**绕行方案：用生产构建验证**（`pnpm build` + `node .output/server/index.mjs`，无 watcher）。重开 dev 前建议重启机器或至少杀掉残留 node 进程。
- **端口 7000**：macOS ControlCenter（AirPlay 接收器）常年占用 7000（v4+v6 双栈），marketing 在本机只能用别的端口验证（我用的 7005）。配置里仍是 7000——要么用户关掉 AirPlay 接收器，要么把 marketing 端口永久改掉（影响 KCS_*_URL 默认值与将来的 nginx conf）。
- 生产服务器启动方式：`set -a && . ../../.env && set +a && PORT=<port> node .output/server/index.mjs`（.env 在仓库根，DB 指向 `postgresql://localhost:5432/tinyship`；API 用 `kcs` 库，两边靠共享密钥/session 打通，上一轮验证过能登录）。
- 种子账号（密码 `Kcs!demo2026`）：admin@ / ops@ / devops@ / selector@ / viewer@kcs.local。
- Playwright 截图：页面有持续动画时 capture 会挂起——先 `page.emulateMedia({ reducedMotion: 'reduce' })`，不行就 `browser_close` 重开再用 `domcontentloaded` + 短等待。

## 6. 不会断的东西 / 可能的雷

- 当前 HEAD 四端 `pnpm build` **全部通过**；`tests/unit/` 里 tide 11 条 + four-apps 12 条 + panel-imports 2 条全绿。
- 根目录其他单测有 6 个 TinyShip 模板遗留失败（credits/utils、validators/user、email/cloudflare），**先于本分支存在**，与本次无关。
- 主 checkout（feature/company-tenant）里还有三个**冗余文件**：`libs/panel/utils/tide.ts`、`libs/panel/components/TideCanvas.vue`、`libs/panel/server/utils/imok-csv.ts`——内容已进本分支，主树那份是重复，切分支前删掉即可，不要提交。
- apps/web 的 shadcn reskin WIP 是别的 agent 的，已废弃，别捡。

## 7. 下一步建议（按序）

1. 修 §4 的 /en i18n bug（客户端 locale 应优先 URL prefix）。
2. 机器重启后重开 dev server，走完全部页面的亮/暗截图验收（清单见 §2）。
3. nuxt-app 面板过一遍 tide 主题。
4. 然后才轮到编排层：nginx 反代（五端 + api 单端口）、Kafka/Redpanda 接入 apps/api 的 IngestJob 管道（排队→消费→状态回写）、K8s manifest。
5. 合 main 由用户决定，别自动合。
