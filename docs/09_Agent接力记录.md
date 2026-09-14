# Agent 接力记录

多个 agent 在同一分支同一工作树上并行时的分工与约定。历史轮次的细节在 `01_开发日志.md`，这里只留规则和当前分工。

## 开工前

1. 读 `AGENTS.md`、本文件、`HANDOFF.md`。
2. `git status`，看当前分支与未提交修改；不覆盖别人正在改的文件。
3. 先说：当前分支、Git 状态、建议分支、子任务拆分。

## 分工边界（按目录）

| 角色 | 只改 | 不碰 |
|---|---|---|
| 后端（sol） | `apps/api/**`、`libs/auth/**`、`libs/database/**`、`libs/panel/server/**`、`deploy/**`、`docker-compose.yml`、`e2e/scripts|helpers`、`tests/blackbox/**`、根 `package.json` scripts | 页面、组件、composables、i18n、docs |
| 前端（fable） | `apps/{select,ops,dev,marketing}/pages|components`、`libs/panel/{pages,components,composables,middleware}`、`packages/kcs-contract/**`、`docs/*.md`、`e2e/specs` | API 实现、server routes |
| 文案（gemini） | `libs/i18n/locales/*.ts`（只改值，不改键）、`docs/11_文案清单与草稿.md` | 其他一切 |

契约（`packages/kcs-contract`）改动先做、先提交，后端与前端都从提交后的契约出发。

## 提交

- 每人只 `git add` 自己边界内的文件，不用 `git add -A`。
- Commit 信息中文、简洁、说清子任务；每个可独立说明的子任务一个 commit。
- 未经允许不 push、不合 main。
- 提交前跑相关测试（见 07）。

## 交接时说清

- 分支名、commit 列表。
- 端点 / 表 / env 的变化（后端）；页面与 testid 的变化（前端）；改动的键数与术语表（文案）。
- 测试结果、未提交文件、是否适合合并。
- 未完成与风险 → 写进 `08`，不散落在聊天里。

## 文档约定

- 所有文档只解释当前架构（有参数的爬虫 + 转换层 + 指标筛选方案；TinyShip 身份）。旧口径（评分、权重、等级、AI 复核、Excel 输入）不再出现；需要考古看 `docs/archive/` 与 git `f31c882`。
- `01` 是唯一按日期堆历史的地方；`07` `08` 只保留当前状态。
- 界面文字全部走 i18n 三语，键名稳定；文案改动在 `11` 留清单。
