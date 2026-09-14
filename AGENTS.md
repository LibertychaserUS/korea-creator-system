# AI 开发与 Git 规则

产品：`korea-creator-system` / 全球达人情报系统。宿主是 TinyShip Nuxt，不是 Ascendia，也不是 Harness.io。
语言：`zh-CN` / `en` / `ko`。门：旁边 checkout 的 AIOps（`overlay-v2.0.0` + `forge-v1.1.1`）上跑 `python3 -m forge check`。不要 live-apply，不要 vendor `forge/` / `overlay/`。
系统 = 有参数的爬虫 + 转换层 + 指标筛选方案；身份统一 TinyShip（better-auth）。没有评分、权重、等级，不自建抓取。
文档只解释当前架构：从 `docs/00` 开始，字段口径看 `docs/02`–`04`，多 agent 分工看 `docs/09`。旧 Python / FastAPI Demo 已删除，`docs/archive/` 只用于考古（git `f31c882`）。不要把旧口径加回来。


开始任何开发任务前，必须：

1. 读取本文件。
2. 执行 git status。
3. 查看当前分支和未提交修改。
4. 不覆盖用户已有修改。
5. 分析需求并提出子任务划分。

## 分支规则

- main 分支只保存稳定版本。
- 一个独立功能创建一个 feature/功能名 分支。
- Bug 修复创建 fix/问题名 分支。
- UI 调整创建 ui/页面名 分支。
- 不要为每个很小的子任务创建分支。
- 功能分支默认从 main 创建。
- 未经允许不要合并 main，也不要 push。

## 提交规则

- 每个可以独立说明的子任务完成后创建一次 commit。
- 提交前运行相关测试。
- 每次只提交当前子任务涉及的文件。
- Commit 信息使用简洁中文。
- 不提交密钥、数据库、缓存、日志和依赖目录。

## 开始任务时

先告诉用户：

- 当前分支
- Git 状态
- 建议创建的分支
- 准备拆分的子任务

完成后告诉用户：

- 分支名称
- Commit 列表
- 测试结果
- 未提交文件
- 是否已经适合合并