# 屏幕清单

> SSOT：哪些屏存在、属于哪个工作区、M1 做不做。规格正文见 [`PRD.md`](./PRD.md)。
> 分类：设计/规格。本文件用于 **先出 mockup、再一页一做**。未标 `m1=yes` 的屏：M1 可留「未做」空态，禁止假交付。
> 路由均套 `/{locale}`，`locale ∈ zh-CN|en|ko`。
> 共 **35** 屏。

图例：`m1` = Milestone 1 必做。`widgets` = mockup 上必须出现的控件，不是实现清单。

---

## 总表

| id | 工作区 | 名称 | 目的 | 关键控件 | m1 |
|----|--------|------|------|----------|----|
| AUTH-LOGIN | 共用 | 登录 | 三种角色进入各自工作区 | 邮箱/密码、错误提示、语言切、浅深色切 | yes |
| AUTH-DENIED | 共用 | 无权限 | 越权不露脏数据 | 原因、回自己工作区按钮 | yes |
| OPS-HOME | 运营录入 | 作业概览 | 看本轮流水线数字，不是营销首页 | 原始行/去重/Top50/AI success·fallback/人工待确认、最近批次、开始核对 | yes |
| OPS-BATCH-LIST | 运营录入 | 批次列表 | 找到供给公司交来的各次清单 | 表（公司、文件名、行数、状态、时间）、搜索 | no |
| OPS-BATCH-NEW | 运营录入 | 上传批次 | 把供给 Excel 录进系统 | 供给公司名、xlsx 选择、字段预览、提交 | yes |
| OPS-BATCH-DETAIL | 运营录入 | 批次详情 | 一次清单的原始/清洗/待补对照 | Tab：原始 / 清洗 / 待补；状态；开跑按钮 | yes |
| OPS-RAW-TABLE | 运营录入 | 原始清单 | 只给运营看的脏表 | 源行号、原始列、缺失标记；无选人入口 | no |
| OPS-CLEAN-TABLE | 运营录入 | 清洗结果 | 去重后人数与被合并行 | creator_key、保留行、丢弃原因 | no |
| OPS-MISSING | 运营录入 | 待补信息 | 缺主键/缺人设/缺报价队列 | 待补列表、标记已补、跳校对 | no |
| OPS-FIELD-EDIT | 运营录入 | 单条校对 | 补字段，不改最终分 | 表单、原值/新值、保存；无「改分」 | no |
| OPS-SUPPLY-STOCK | 运营录入 | 供给库存 | 某供给公司已入库达人 | 公司筛、人数、等级分布 | no |
| OPS-SCORE-RUN | 运营录入 | 确认跑分 | 防止误跑；展示规则版本 | 规则版本只读、预估人数、确认 | no |
| OPS-RULES | 运营录入 | 规则（只读） | 讲清六维与扣分为何 | 权重表、阈值、风险项、排除词 | yes |
| OPS-AI-QUEUE | 运营录入 | AI 复核队列 | Top50 风险复核，不改排序 | 覆盖率、success/fallback、决策分布、批量生成、列表 | yes |
| OPS-HUMAN-QUEUE | 运营录入 | 人工确认队列 | 人做最终作业确认 | 待确认池、四态筛、与 AI 分歧 | yes |
| OPS-CREATOR | 运营录入 | 达人详情（作业） | 为什么上榜、有何风险 | 基础、六维雷达/条、命中词、风险、AI、人工四态 | yes |
| OPS-EXPORT | 运营录入 | 作业导出 | 带走评分+标注 | Top10/50/全量、Excel/CSV、时间戳文件列表 | yes |
| OPS-SUPPLIER | 运营录入 | 供给公司 | M1 以后：多家供给档案 | 名称、批次计数 | no |
| DEV-HEALTH | 开发运维 | 健康总览 | 系统能不能跑，不是选人 | 进程健康、上次成功跑分、Key 是否存在 | yes |
| DEV-JOBS | 开发运维 | 任务列表 | ingest/score/ai 段状态 | 任务表、状态筛、失败高亮 | yes |
| DEV-JOB-DETAIL | 开发运维 | 任务失败详情 | 哪一段挂、什么错 | 阶段、错误摘要、重试（运维） | no |
| DEV-PIPELINE | 开发运维 | 数据管道 | 一眼看到卡在哪 | ingest→clean→score→ai 节点状态 | no |
| DEV-QUEUE | 开发运维 | 队列积压 | AI/导出是否堵住 | 积压数、最老等待 | no |
| DEV-LOGS | 开发运维 | 最近错误 | 排障 | 时间、级别、消息；无密钥 | no |
| DEV-KEYS | 开发运维 | 配置状态 | Key/路径是否就绪 | DeepSeek 布尔、输入文件是否存在 | no |
| DEV-GATES | 开发运维 | 门状态 | forge/overlay 是否绿 | check 结果只读；不 live-apply | no |
| BUY-HOME | 选人公司 | 选人工作台 | 本司项目进度 | 项目数、短名单人数、待分配入口 | no |
| BUY-LIBRARY | 选人公司 | 整理后达人库 | 从干净池筛选 | Top10/50/全量、等级/地区/关键词筛、搜索、分页 | yes |
| BUY-CREATOR | 选人公司 | 达人详情（干净） | 决定是否放进项目 | 干净字段、等级、六维、AI 摘要、「加入项目」 | yes |
| BUY-PROJECT-LIST | 选人公司 | 项目列表 | 找到本司项目 | 表（名、人数、更新）、新建 | no |
| BUY-PROJECT-NEW | 选人公司 | 新建项目 | 建立一个选人容器 | 名称、备注、创建 | yes |
| BUY-PROJECT | 选人公司 | 项目短名单 | 分配/移出/改三态 | 成员表、状态、移出、从库添加 | yes |
| BUY-ASSIGN | 选人公司 | 从库分配 | 勾选干净达人进项目 | 多选、目标项目、确认 | no |
| BUY-PROJECT-EXPORT | 选人公司 | 项目导出 | 带走短名单 | Excel/CSV、含状态与只读分数 | yes |
| BUY-COMPARE | 选人公司 | 达人对比 | 后期：2–3 人并排 | 并排六维 | no |

M1 共 **17** 屏（上表 `yes`）。其余 18 屏进 mockup 全集，实现排后期。

---

## 分工作区说明

### 共用

**AUTH-LOGIN**  
空：无。错：账号不存在 / 密码错。数据：不读达人表。登录后按角色进 `/ops`、`/select` 或 `/dev`。

**AUTH-DENIED**  
空：不展示任何 Creator 行。数据：零业务字段。

### 后台 · 运营录入 `/ops`

目的：我们运营如何把供给公司的清单录进去、校对、过清洗 / 评分 / AI 复核。  
数据默认含脏表能力；这些 API 不得给选人 token。

**OPS-HOME** 空：尚无批次，主按钮「上传第一份清单」。错：上次跑分失败摘要 + 链到 `/dev/jobs`。  
**OPS-BATCH-NEW** 空：未选文件禁用提交。错：非 xlsx、空表、缺工作表「筛选结果」。  
**OPS-BATCH-DETAIL** 空：文件在、0 行。错：清洗失败原因。M1 用 Tab 兼管 RAW/CLEAN/MISSING，不必先做独立三路由。  
**OPS-RULES** 空：无（规则总有默认版本）。错：配置缺失则显示内置默认并告警。  
**OPS-AI-QUEUE** 空：尚未跑分。错：AI 全失败仍显示 fallback 行。  
**OPS-HUMAN-QUEUE** 空：「待确认 0」。错：保存失败保留输入。  
**OPS-CREATOR** 空：未知 id → 404。错：AI pending 明示。  
**OPS-EXPORT** 空：尚无文件。错：导出失败可重试，不改分。

后期运营屏（RAW/CLEAN/MISSING/FIELD-EDIT/STOCK/SCORE-RUN/SUPPLIER）：把 M1 批次 Tab 拆成独立页，便于多家供给。

### 后台 · 开发运维监测 `/dev`

目的：看批次任务、失败、健康、队列、管道。  
**禁止**：达人筛选器、推荐按钮、项目分配、改分。

**DEV-HEALTH** 空：服务起来但从未跑分。错：health 红。  
**DEV-JOBS** 空：无任务。错：行标红，点进原因（M1 可用同一页展开，不必先做 DETAIL 路由）。

后期：DETAIL / PIPELINE / QUEUE / LOGS / KEYS / GATES。

### 前台 · 选人公司 `/select`

目的：已经整理好的库，筛选并分配到项目。  
**禁止**：原始行、待补表单、Pipeline 失败栈、改权重。

**BUY-LIBRARY** 空：池中 0 人（运营尚未跑分）。错：加载失败。列禁止：源行号、missing_key、exclude 原始脏标。  
**BUY-CREATOR** 空：未入池 id → 404（即使运营侧存在）。  
**BUY-PROJECT-NEW** 空：无。错：重名可允许，名称必填。  
**BUY-PROJECT** 空：短名单 0 人，主按钮「从库添加」。错：分配失败保留勾选。  
**BUY-PROJECT-EXPORT** 空：名单 0 人禁用下载。

后期：BUY-HOME、LIST 独立、ASSIGN 独立页、COMPARE。

---

## Mockup 出图要求（交付步骤 1，未批准不执行）

每张图标注 `id` + 工作区 + 语言 + 主题。

1. M1 的 17 屏优先：每屏 **浅色 + 深色** 至少各 1（34 张）。
2. 其余 18 屏各 1 张浅色即可（18 张）。全集约 **52** 张，符合「数十张」。
3. 至少 1 条路径出 `en`、`ko` 各一套 chrome（建议 OPS-HOME、BUY-LIBRARY），证明不是中文-only。
4. 图上必须能看出：运营有脏表 Tab；选人没有；`/dev` 没有选人表格。
5. 任何图出现 TinyShip / 定价 / SaaS slogan → 废图。

---

## 一页一做时的领取规则（交付步骤 2）

- 一次只领 **一个 id**（例外：AUTH-LOGIN+AUTH-DENIED 可同领）。
- 对照该 id 的 mockup + 本表 widgets + PRD §9 验收。
- 先写失败测试再写页。测：角色进错工作区 403；AI/人工/分配后 `score/grade/rank` 不变。
- 合入前 `python3 -m forge check`。
- 不要顺手做相邻未领取屏。
