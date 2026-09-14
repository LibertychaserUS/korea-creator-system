# Tinyship + Forge + Overlay 重建说明

> 项目标识：`korea-creator-system`。产品显示名：全球达人情报系统。
> 本文件是**实现栈 SSOT**。产品意图在 `VISION.md` / `PRD.md` / `DOMAIN.md`。
> 三件套都是技术名，不是产品品牌，也 **不是** Harness.io。
> **设计已写、实现已落地。** 下文提到的 `archive/` 已于 2026-09-12 从工作树删除（历史 git `f31c882`）；所有「只读 archive」一律改读 `docs/02`–`04`，其余不再逐条改写。
> **产品语言硬约束：** 宿主必须是 `zh-CN` / `en` / `ko` 三语，第一刀就要有语言切换。不是 Later，也不是「中文先可用」。

分类：架构设计（绿地重建）。本轮交付是设计，不是脚手架。

---

## 1. 三件套分别是什么、在哪

本机与账号上同名项目很多。下面是**本用户实际在用的那一套**，以及为什么丢掉其它同名物。

### 1.1 tinyship — 应用宿主 / 交付框架

| 项 | 值 |
|----|-----|
| 是什么 | TinyShip：面向国内+国际 SaaS 的 **pnpm monorepo 起始套件**。三框架（Next / Nuxt / TanStack Start）+ Better-Auth + Drizzle + CASL + i18n + `libs/ai`（含 DeepSeek）+ 存储。文档：[docs.tinyship.cn](https://docs.tinyship.cn/) |
| 官方仓 | `https://github.com/TinyshipCN/tinyship`（未登录 / 无权限时 API **404**，不能当公开依赖） |
| 技能仓 | 公开：`https://github.com/TinyshipCN/tinyship-skills`。安装：`npx skills add TinyshipCN/tinyship-skills`（须在**已 clone 的 TinyShip 目录**里跑） |
| 本机 | **没有**独立 `tinyship/` clone。本用户真正跑过的是 `/Users/nihao/Documents/Ascendia-code`：`origin` = `LibertychaserUS/Ascendia`，`upstream` = `TinyshipCN/tinyship`，冻结过 `v2.2.0` / `54ddc7a87801005b4b88486c11ed82b539954779` |
| 公开快照 | `Chen-Taos/tinyship-main`（非官方，只作对照） |

**为什么选这个，不选别的**

- npm `tinyship`（`tinyship.run`，静态站部署 CLI）、`@xiaomingio/tinyship`（PM2 部署）、PICO-8 / 船舶识别等同名仓：本机无使用痕迹，也接不上「重建应用」。
- Ascendia 的 ADR-002 / REPO-STRATEGY 写明：新产品以 TinyShip 为代码根，**不** submodule。

**怎么新建一个应用（官方路径，不是 `create-app` 一条命令）**

1. Clone 模板（官方 get-started）：

```text
git clone https://github.com/TinyshipCN/tinyship.git
cd tinyship
# 或 SSH：git clone git@github.com:TinyshipCN/tinyship.git
```

2. 本机无 GitHub 权限时，从已验证对象库取出 **v2.2.0**（Ascendia 已有该 commit，树根 `package.json` 的 `name` 是 `tinyship`）：

```text
git -C /Users/nihao/Documents/Ascendia-code archive --format=tar 54ddc7a | tar -x -C /tmp/tinyship-v220
```

3. 交互向导（`tinyship-setup`）：**逐步问人，禁止代选**。前提 Node `>= 22.20.0`、pnpm `>= 9`。

```text
cp env.example .env
openssl rand -hex 32   # 写入 BETTER_AUTH_SECRET
# 人选 SQLite 后：
#   DB_DIALECT="sqlite"
#   mkdir -p data && pnpm install && pnpm db:push:sqlite && pnpm db:seed:sqlite
# 人选框架后：
#   pnpm dev:nuxt   # 或 dev:next / dev:tanstack
# 打开 http://localhost:7001 与 /api/health
# 种子账号 admin@example.com / admin123
```

4. 新功能按 `tinyship-feature`：逻辑进 `libs/`，配置进 `config/`，薄 API 进当前 app，文案进 `libs/i18n`。

**本仓库禁止**：把 TinyShip 整仓 clone 直接盖到 `korea-creator-system` 根上（会打掉 `docs/` / `archive/`）。导入必须 **rsync 排除**，见 §4。

### 1.2 forge — GitHub 落地门（不是代码生成器、不是后端框架）

| 项 | 值 |
|----|-----|
| 是什么 | **Forge**：开发侧本地门 + 代推 draft PR。管谁能推、PR 落到哪条保护分支、哪些路径不能改、哪些 **CI job 名**必须绿。**不合入。不写 CODEOWNERS / AGENTS.md / workflows。** |
| 工具仓 | 一个仓两件产品：[`LibertychaserUS/AIOps`](https://github.com/LibertychaserUS/AIOps)。中文权威：`README.zh-CN.md`。CLI 权威：`docs/cli.md`（由 `--help` 生成，禁止在别的文档手抄「完整子命令百科」） |
| 本机 | 产品用法在 `/Users/nihao/learningguideportal/`（已有薄 `forge.yaml` + `.agents/skills/use-forge`）。旧草稿 `/Users/nihao/Documents/三千五线上实习-LG/AIOps` 仍是「initialized, no runner」——**不要当现行工具** |
| 技能 | 工作本 `skills/use-forge/SKILL.md`。Learning Guide 本地副本 pin 的是 `overlay-v1.0.1`；工作本 `main` 目标是 `overlay-v2.0.0` / `forge-v1.1.x` |

**真实 CLI**（`python -m forge --help`）：

`apply` `status` `check` `submit` `pr-title`/`title` `sop-lock` `ci-select` `ops-review` `promote` `bounce` `release`

**没有** `brief` / `credential` / `ops-chain` / `revoke`。

| 动作 | Agent | 人 / Ops |
|------|-------|----------|
| `forge check` | 可以 | — |
| `forge submit`（draft PR 到 `protect[0]`，通常 `dev`） | 可以，且必须有 `FORGE_SUBMIT_TOKEN` | — |
| live `forge apply`（写 Ruleset） | **不可以** | Ops / `$manage-repo` |
| merge / 自批 | **不可以** | 人 |

`gh auth` / `GITHUB_TOKEN` **不够**代推。密钥说明只在工具仓 `docs/submit-credential.md`。

### 1.3 overlay — 可审用例门（不是 UI overlay、不是 CSS）

| 项 | 值 |
|----|-----|
| 是什么 | **Overlay**：把需求叶子变成可审套件。`validate` / `cover` / `select` / `run`。CI 只跑 **`active`**。`blocked` 丢掉、不当红。人签走 PR 批准 + CODEOWNERS（ADR 0002 已去掉 `armed`） |
| 同一工具仓 | `LibertychaserUS/AIOps` 的 `overlay/` 包。产品仓只留薄文件，**禁止 vendor `overlay/`** |
| 本机 | Learning Guide：`overlay.yaml`、`inbox/`、`suites/`、`invariants.yaml`、`.github/workflows/overlay-check.yml` |

**真实 CLI**（`python -m overlay --help`）：

`validate` `select` `review` `run` `cover` `migrate`

产品仓叶子契约（工作本 README.zh-CN）：

```markdown
## INV-01
### Functional
### Negative
### Edge
```

- 技法名只能是 Functional / Negative / Edge。不要 `### Depth`。不要散文 `##`（会被当成 `function_id`）。
- `function_id` 在 overlay root **全局唯一**。
- `invariants.yaml` 必须对上已有 `##` 标题。
- v2 `status` 只有 `active` \| `blocked`。Learning Guide 旧 skill 仍写 `draft`/`armed`——那是 **v1 pin**。本仓第一刀跟工作本 **v2**，除非用户明确 pin v1。

`overlay review` 需要 `--i-am`（人）。Agent 不要把套件改成 `blocked`。

### 1.4 丢掉的同名物（避免接错）

- 技能目录 `~/.agents/skills`、`~/.claude/skills`、`~/.cursor/skills`、`~/.cursor/plugins`：**没有**名为 forge/overlay/tinyship 的独立 skill 包。本用户的 forge/overlay skill 在 **AIOps 工作本**和 **LearningGuidePortal** 里。
- `LibertychaserUS` / `First-Light-TechHK` 名下没有叫 `tinyship` 的仓。
- First-Light 空 `AIOps` 仓：官方 README 写明不要用。
- Harness.io：禁止。本仓库 harness = `AGENTS.md` + superpowers + writing-for-agents + writing-plans。

---

## 2. 三者如何组装（第一刀就必须同时在树上）

```text
korea-creator-system/          ← 产品仓（tinyship 代码根 + 薄 forge/overlay 配置）
  docs/                        ← 留下（历史 + 产品意图）
  archive/                     ← 旧 FastAPI 冻结 + 墓碑；只读
  apps/ nuxt-app …             ← tinyship 自带（不要再套一层 apps/tinyship）
  libs/                        ← tinyship libs + 新建 libs/kcs-domain
  forge.yaml                   ← 薄配置。禁止 git add forge/
  overlay.yaml                 ← 薄配置。禁止 git add overlay/
  inbox/  suites/  invariants.yaml
  AGENTS.md                    ← 产品规则 + 粘贴 forge/agent-policy.md 的条文（文本，不是目录）

/tmp/AIOps                     ← 工具仓 sibling checkout。PYTHONPATH 指向这里
```

**推荐：tinyship 落在仓库根，不要落在 `apps/`。** TinyShip 自己已经用 `apps/next-app|nuxt-app|tanstack-app`。若把整份模板塞进 `apps/`，会变成 `apps/apps/nuxt-app`，所有 `pnpm --filter @tinyship/*`、`env.example`、Drizzle 路径全部作废。Ascendia 也是「模板即代码根」。

Forge / Overlay **不是** tinyship 插件，也不是第二个前端。它们是产品仓根上的**门**：

1. 人在 tinyship 里写领域与页面。
2. Overlay 叶子描述「规则分不可被 AI/人工改写」等不变量；`product_command` 跑产品测试（本仓将是 vitest / pnpm test，不是再写一套 FastAPI）。
3. `forge check` 在有 `overlay.yaml` 时会跑 **overlay validate + cover**；红则禁止 `submit`。

最小接入样例（抄形状，改 id / repo / command）：[`examples/acme-python/`](https://github.com/LibertychaserUS/AIOps/tree/ef840a48dc767b3460ff5682d151f85baa5157d1/examples/acme-python)。

工作本 30 秒命令（README.zh-CN，原样）：

```text
git clone <本工作本> /tmp/AIOps
cd /tmp/AIOps
python3 -m pip install -r requirements.txt
export PYTHONPATH=/tmp/AIOps

cd /path/to/product
python3 -m overlay validate --root .
python3 -m overlay cover --root .
python3 -m forge check --root .
```

Learning Guide 冷启动（本地 skill，v1.0.1 pin）等价：

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.1
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
PYTHONPATH=/tmp/AIOps python3 -m forge check --root .
```

CPython **3.12+**。不要 pin 浮动 `main`。

---

## 3. 推荐针与框架（须人批）

| 选择 | 推荐 | 备选 | 人必须批 |
|------|------|------|----------|
| AIOps pin | `overlay-v2.0.0` + `forge-v1.1.1`（工作本 `docs/STATE.md` 已发布 tag） | Learning Guide 正在用的 `overlay-v1.0.1` / `forge-v1.0.1`（仍有 `draft`/`armed`） | 是。v2 套件 `status` 只有 active/blocked |
| TinyShip 基线 | 能 clone 官方仓则用当时 **已发布 tag**；否则本机 `v2.2.0` / `54ddc7a` | `Chen-Taos/tinyship-main` 仅应急对照 | 是 |
| 产品框架 | **Nuxt**（`pnpm dev:nuxt`）。本用户 Ascendia Phase 1 已验证这条线；不做三端 parity | Next / TanStack | 是。`tinyship-setup` 禁止代选 |
| 数据库 | MVP **SQLite**（`DB_DIALECT=sqlite`，`mkdir -p data`） | 生产再 pg | 是 |
| 支付 / 积分 | MVP **不用** | — | 默认 |
| live `forge apply` | **不做**（与 Learning Guide 相同） | 以后 Ops | 默认 |

---

## 4. 导入计划（批准后才执行；现在不要跑）

目标活树：

```text
docs/          # 不动位置
archive/       # 旧 FastAPI + 墓碑（另一代理在搬）
<tinyship 根文件: apps libs config package.json …>
forge.yaml overlay.yaml inbox/ suites/ invariants.yaml
```

**安全导入（排除，不要整仓覆盖）：**

```text
# 1) 取出 tinyship 树到临时目录（§1.1 两条路径选一条）
# 2) 拷进本仓根，排除会打碎文档/归档的路径：
rsync -a --exclude docs --exclude archive --exclude .git \
  --exclude 'docs/**' \
  /tmp/tinyship-src/ /Users/nihao/korea-creator-system/
# 3) 若 tinyship 自带 docs/user-guide，放到 docs/tinyship-upstream/，不要覆盖 docs/00_* 或 docs/product/
# 4) 根 AGENTS.md：保留产品规则，再粘贴工具仓 forge/agent-policy.md 条文（文本）
# 5) npx skills add TinyshipCN/tinyship-skills
#    以及从 AIOps 装 skill（工作本）：
#    gh skill install LibertychaserUS/AIOps --agent cursor --pin overlay-v2.0.0 --all
#    或 symlink skills/* → .agents/skills
```

`tinyship-setup` 是对话向导，**不是**可无人值守的 `create`。批准后第一步仍是问人：库、框架、是否删另外两端。

---

## 5. 领域模块（深模块，新建，不从 archive 搬文件）

`archive/` 只读对照字段名与口径。**禁止**把 `services/scoring.py` 等搬进新树当实现。

| 模块 | 接口（调用方只需知道这些） | 实现藏什么 |
|------|---------------------------|------------|
| Ingest | `ingestPgyWorkbook(path) → { rows, creators, missingKeyCount }` | Excel 列映射、去噪、`creator_key` |
| ScoreEngine | `scoreCreators(creators, ruleVersion) → ScoreBatch` | 百分位、六维权重、风险扣分。输入不得含 AI/人工 |
| RiskReview | `reviewTop50(scores, llm) → AIReview[]` | DeepSeek / 模板 fallback。**不写 Score** |
| ManualConfirm | `saveReview(creatorKey, runId, decision, note)` | 四态。**不写 Score** |
| Export | `exportRun(runId, kind) → filePath` | 时间戳 Excel/CSV |

缝（真有第二适配器才算缝）：LLM = DeepSeek \| 模板。存储先只用 Drizzle（SQLite）。不要为「将来 CSV」再做一层假缝。

Tinyship 侧复用：`libs/ai`（`DEEPSEEK_API_KEY`、`createAIHandler({ provider: 'deepseek' })`）、`libs/i18n`、`libs/auth`、`libs/database`、`libs/permissions`。路由保持薄适配。

---

## 5.1 产品 i18n（硬约束；抄真实模板，禁止自造 API）

对照本：本机 TinyShip / Ascendia 冻结点 `v2.2.0` / `54ddc7a`，树在 `/Users/nihao/Documents/Ascendia-code`。权威说明：该树 `libs/i18n/README.md`、`libs/i18n/AGENTS.md`，以及 [docs.tinyship.cn 基础配置](https://docs.tinyship.cn/zh-CN/user-guide/basic-config)。**官方模板只自带 `en` + `zh-CN`。** 本产品必须在同一套登记表上**扩 `ko`**，不要另写一套字典或 FastAPI `?lang=` 引擎。

### 模板里真实怎么做（Nuxt 线）

| 层 | 真实位置与 API | 不要发明 |
|----|----------------|----------|
| 登记 | 根 `config.ts` → `app.i18n`：`defaultLocale`、`locales`、`cookieKey: 'NEXT_LOCALE'`、`autoDetect` | 不要新 cookie 名；不要 `dashboard-locale` |
| 文案 | `libs/i18n/locales/en.ts`（结构真理源）+ `zh-CN.ts`；入口 `libs/i18n/index.ts` 导出 `translations` / `locales` / `isValidLocale` / `getTranslation` | 不要页面内硬编码用户可见文案；不要 archive 那种扁平 `translations["zh-CN"][key]` |
| Nuxt 模块 | `apps/nuxt-app` 的 `@nuxtjs/i18n`；`nuxt.config.ts`：`strategy: 'prefix'`；`apps/nuxt-app/i18n/i18n.config.ts`：`legacy: false`，`messages: translations` | 不要 query-only 路由当主方案 |
| 组件 | `useI18n()` → `t` / `locale` / `locales`；链接 `useLocalePath()`；切换 `useSwitchLocalePath()` + `navigateTo(path)`（见 `GlobalHeader.vue` 的 `changeLanguage`） | 不要抄 Ascendia 顶栏 `locale === 'en' ? english : chinese` 二元判断——加上 `ko` 后会把韩语藏掉 |

`tinyship-feature` 已写：新文案进 `libs/i18n`。`en.ts` 先加 key，再补 `zh-CN.ts` 与（本仓必加的）`ko.ts`，形状对齐。

### 本仓必须扩的第三语

在**同一登记路径**上加 `ko`，不要平行系统：

1. 新增 `libs/i18n/locales/ko.ts`（嵌套对象，与 `en.ts` 同形）。
2. `locales/index.ts` 再导出 `ko`。
3. `libs/i18n/index.ts`：`locales` 含 `'ko'`，`translations` 增加 `ko`。
4. `config.ts`：`app.i18n.locales` 为 `['en', 'zh-CN', 'ko']`；**`defaultLocale: 'zh-CN'`**（与旧 Demo 和官方默认一致；`autoDetect: false`，新访客不跟浏览器语）。
5. `nuxt.config.ts` 的 `locales.map` 名称表改成显式映射（模板里 `code === 'en' ? 'English' : '中文'` 只有两语）：`en` → English，`zh-CN` → 中文，`ko` → 한국어。

URL（模板前缀策略，不是旧 SPA）：

```text
http://localhost:7001/zh-CN/
http://localhost:7001/en/
http://localhost:7001/ko/
```

持久化：`@nuxtjs/i18n` + cookie `NEXT_LOCALE`。刷新后仍是上次语言。

### 旧 Demo 要保留的是产品行为，不是实现

`archive/` 里 FastAPI SPA 用 `?lang=zh-CN|en|ko` + `localStorage["dashboard-locale"]` + 扁平 `t(key)`。那套 **JS/接口不要搬**。要对齐的产品行为：

| 产品行为 | 旧实现（只读对照） | 新栈（模板 API） |
|----------|-------------------|------------------|
| 三种语言 | `zh-CN` / `en` / `ko` | 同上，登记进 `config.app.i18n.locales` |
| 顶栏切换 中文 / EN / 한국어 | `.lang-btn[data-locale]` | `useSwitchLocalePath` + `navigateTo` |
| URL 可直接进某语（演示/截图） | `?lang=` | 主入口是前缀 `/zh-CN` `/en` `/ko`。第一刀加一层薄适配：若出现 `?lang=` 且 `isValidLocale(lang)`，`navigateTo` 到对应前缀路径。**不要**再写 `dashboard-locale` |
| 刷新保持 | `localStorage` | cookie `NEXT_LOCALE` |
| 界面文案 `t()` | 扁平 key | Nuxt：`t('kcs.brand.title')`（嵌套 key）；Next 不用本仓默认框架 |
| 豁免原文 | 昵称、小红书号、原始关键词、手写备注 | 照旧；这些不是 i18n key |
| 切语言不改分 | 只重渲染 | Score / grade / rank 字节级不变；不重跑导入/排序/AI |
| 默认中文 | `resolveInitialLocale` 回落 `zh-CN` | `defaultLocale: 'zh-CN'` |

AI 自然语言（Top50 说明）是**展示层**翻译：分析一次，切语言时不重跑主复核。旧 `POST /api/ai/translate` + 本地缓存是意图，等 `KCS-TS-04` / `KCS-TS-07` 再用 `libs/ai` 做，**不要**把 archive 的 FastAPI 路由抄过来。fallback 用三语本地模板。第一刀只要求宿主 chrome + 切换器三语，不要求 AI 译文缓存。

### 第一刀 i18n 完成线

`KCS-TS-01I` 与三件套同绿。完成当且仅当：

1. `config.app.i18n.locales` 含 `en` / `zh-CN` / `ko`；默认 `zh-CN`。
2. 顶栏能切三种语言；刷新后仍在所选语言。
3. `/zh-CN`、`/en`、`/ko` 都能打开；`?lang=ko`（及 zh-CN / en）能落到对应前缀。
4. 产品显示名「全球达人情报系统」及宿主可见 chrome（导航/按钮/空态）走 `t()`，三语文件都有 key；没有中文-only 宿主。
5. 未从 `archive/` 拷 `static/app.js` 字典。未自造第二套 i18n。

---

## 6. 第一刀（必须三件套 + 三语切换一起绿）

**不要**先只起 tinyship、把 forge/overlay 写成 Later，也**不要**先做一个中文-only 宿主再把三语写成 Later。缺 forge、缺 overlay、或缺三语切换，则 `KCS-TS-01` 失败。

完成当且仅当下列**全部**为真（在本仓根，不是 archive）：

1. **tinyship**：`pnpm dev:nuxt`（或人批的另一端）能起来；`http://localhost:7001/api/health` 有响应；`docs/` 与 `archive/` 仍在原处。
2. **overlay 薄树存在**（与 acme-python 同形）：`overlay.yaml`、`inbox/`、`suites/<id>/{suite.yaml,cases.md,trace.yaml}`、`invariants.yaml`。第一套叶子证明 **Score 三元组不被 AI/人工写入**（`function_id` 建议 `INV-01`，invariant 对上 `DOMAIN.md` 不变量 1–3）。`cases.md` 必须有 Functional / Negative / Edge。
3. **`product_command` 真跑产品测试**（acme 原句形状：`python3 -m unittest discover -s tests -q`；本仓对应改成已存在的 `pnpm exec vitest run <第一条测 Score 不可变的文件>`，写进 `suite.yaml`，不要空转）。
4. **forge 薄配置存在**：从 `forge/forge.example.yaml` 抄，改 `protect` / `required_checks` 为**本仓真实 CI job 名**（仓尚未有 GitHub Actions 时，先只保证本地 `forge check`；不要抄 Learning Guide 的 `Typecheck`/`Verify`）。
5. 工具在旁边：

```text
export PYTHONPATH=/tmp/AIOps
python3 -m overlay validate --root .
python3 -m overlay cover --root .
python3 -m forge check --root .
```

三条都退出 0。红 → 不停工去写页面。

6. 未 `git add forge/` 或 `overlay/` 工具包。未 live-`forge apply`。未代填 Overlay 人签字段。未改 `archive/`。
7. **三语切换已在宿主上**：`KCS-TS-01I` 同绿（§5.1）。hello-world / health 页就不能是中文-only。

第一刀**不做**：六个业务页面、Top50 DeepSeek、导出、支付、三端 parity、Ruleset、AI 译文缓存。
第一刀**要做**：语言切换 + `zh-CN` / `en` / `ko` 宿主 chrome。

随后 `KCS-TS-02`… 仍在同一树上加领域与页面；每张票的新文案必须同时进 `en.ts` / `zh-CN.ts` / `ko.ts`；每张票结束再跑上面三条门。

---

## 7. 保留 vs 扔掉

| 留（意图 / 口径） | 扔（不迁实现） |
|-------------------|----------------|
| V1 闭环：导入 → 规则排序 → 风险复核 → 人工确认 → 导出 | FastAPI、pandas 流水线、静态三页 SPA、CSV 当主库 |
| 中英韩三语产品行为（切换、URL 进某语、刷新保持、豁免原文） | 搬 archive `t()` 扁平字典 / `dashboard-locale` / FastAPI `?lang=` 引擎 |
| 六维名与权重 25/15/25/20/10/5；AI 不改分 | 把 archive 里的 Stage 8B 空页补完 |
| 去重键 `userId > 小红书号 > 主页 URL` | 人工缓存用 rank 当键 |
| DeepSeek 只打 Top50 + fallback | 全量 1725 调模型 |
| `docs/00_*`–`10_*` 留在 `docs/` 当旧快照 | 把编号文档改写成新栈说明书 |
| archive 墓碑 + 只读对照 | 从 archive `cp` 源文件当新模块 |

---

## 8. 风险

| 风险 | 处理 |
|------|------|
| `TinyshipCN/tinyship` 404 | 用本机 `54ddc7a` archive；人批是否接受冻结点 |
| AIOps v1 vs v2 套件状态词打架 | 第一刀跟一个 pin；在 `forge.yaml` / 墓碑旁写清 tag。不要混 `armed` 与 `active` |
| rsync 打到 `docs/` | 排除表写死；导入前 `test -d docs/product && test -d archive` |
| 把 Learning Guide 的 `required_checks` 抄过来 | 对不上 CI 则 `forge check` / Ruleset 假红。本仓 job 名以将来 PR 页为准 |
| 把 forge 当成「生成后端」 | 它不生成应用。生成/跑应用是 tinyship |
| Agent live-apply / 自合 | 禁止。与 Learning Guide 相同 |
| 中文-only 或另写 i18n | 第一刀就扩 `ko`；只改 `config.app.i18n` + `libs/i18n` + Nuxt 前缀。不要 archive 字典，不要顶栏 en/中文二元判断 |

---

## 9. 必须批准（未点头则不编码）

1. 三件套就是上文那三个仓（TinyShipCN 模板 + LibertychaserUS/AIOps 的 Forge/Overlay），不是 npm CLI，不是 Harness.io。
2. tinyship 落在 **仓库根**；`docs/` 留下；旧代码只在 `archive/`；不从 archive 搬文件。
3. AIOps pin：`overlay-v2.0.0` + `forge-v1.1.1`（推荐）还是 LG 的 `v1.0.1`。
4. 产品框架 Nuxt、库 SQLite、不做三端 parity、不做 live-apply。
5. 第一刀 = tinyship 能起 **并且** overlay validate/cover **并且** forge check 同绿；第一条 Overlay 叶子是「分不可变」。
6. 导入用排除 rsync，不整仓覆盖。
7. 产品语言从第一刀起就是 `zh-CN` / `en` / `ko`（§5.1）。用模板的 `libs/i18n` + `@nuxtjs/i18n` 前缀 + `NEXT_LOCALE`，扩 `ko`；不要中文-only，不要把三语推到 Later。

人批之后：用 writing-plans 写 `KCS-TS-01` 实施计划，再脚手架。
