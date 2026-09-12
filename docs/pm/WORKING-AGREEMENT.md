# 工作约定

> 项目标识：`korea-creator-system`。
> 产品显示名：全球达人情报系统（只出现在 UI / 愿景，不出现在分支名、工单前缀、包名）。
> Git 细则以仓库根 [`AGENTS.md`](../../AGENTS.md) 为准；本文件补代理工作流与文档同步。

## 代理 harness（不是 Harness.io）

本仓库说的 harness 是 **代理技术工作流**：

1. 开任务先读 `AGENTS.md`，再 `git status`。
2. 创意 / 范围变化走 brainstorming；领域词写进 `docs/product/DOMAIN.md`。
3. 多步实现先 writing-plans，再执行；不要对 `archive/` 写 8B 或续写旧 FastAPI。
4. 给后续代理看的文档按 writing-for-agents：有完成标准、有指针、少复述。

禁止：Harness.io MCP、`docs/pm/HARNESS.md`、把 CI 产品当本项目依赖。

## 命名

| 用途 | 写法 |
|------|------|
| 仓库 / 远程 | `korea-creator-system` |
| 工单 | `KCS-TS-03` 这种 |
| 功能分支 | `feature/kcs-ts-03-rule-score` |
| 文档分支 | `docs/product-pm-init`（本批） |
| 修复 | `fix/简述` |
| UI | `ui/页面名`（仅新应用） |
| main | 只收稳定版；未允许不合并、不 push |

## 仓库布局

- `docs/`：**留下**。编号文档是历史；`docs/product/` 与 `docs/pm/` 是产品意图与施工约定。不要 archive 文档。
- `archive/`：旧 Demo **冻结** + 墓碑。不要假设仓库根还有可改的 `app/`。
- 新代码：只进 **tinyship + forge + overlay** 绿地（硬约束见 [`STACK.md`](./STACK.md)；细则见 `TINYSHIP-REBUILD.md`）。

## 改哪里

| 任务 | 做 | 不做 |
|------|----|------|
| 产品意图 / 范围 | `docs/product/*` `docs/pm/*` | 把编号 `docs/00_*`–`10_*` 改成新栈说明书；把 `docs/` 搬进 archive |
| 实现 | tinyship + forge + overlay（见 `STACK.md` / `TINYSHIP-REBUILD.md`） | 新功能打进 `archive/`；只用其中一件；手写 FastAPI 顶替 |
| 对照口径 | 只读 `archive/`（跟墓碑）+ `docs/03` `docs/04` | 删除 archive、续写旧页 |
| 脚手架 | 等 `TINYSHIP-REBUILD.md` | 第二套自创框架 |

## 文档同步

每个可独立说明的实现子任务结束后：

- 更新 `docs/01_开发日志.md`
- 更新 `docs/09_Agent接力记录.md`

改了评分 / 接口 / prompt：同步 `docs/03` / `docs/05` / `docs/04` **或** 在新栈文档里写新 SSOT 并在编号文档顶部加一句「旧快照，实现面已迁移」（不要偷偷改历史验收数字冒充新结果）。

## 密钥与产物

不提交：`config/settings.json`、`.env`、API Key、真实客户表、账号 Cookie、`data/output/`、`data/cache/`、日志、`.tmp-v1-plan/`、计划书 zip。

Key 只用环境变量或本地未跟踪配置。`config/settings.example.json` 保持无密钥。

## 开始 / 结束时要说的话

开始：当前分支、工作区是否脏、建议分支、准备拆的 `KCS-*`。

结束：分支、commit 列表、怎么测的、未提交文件、是否可合并（默认否）。

## 完成标准（文档任务）

本约定被遵守，当且仅当：后续代理读完本文件 + `STACK.md` + `ROADMAP.md` 后，会把第一刀同时用上 tinyship、forge、overlay，把旧 Demo 当成 `archive/` 冻结物，把 `docs/` 留在原处，并且不会去建 Harness.io 项目。
