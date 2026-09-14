# scoring-rule-audit 开发日志

## 任务目标

- 审计当前评分规则的真实实现
- 解释价格/性价比的计算口径
- 对朴代表候选达人做规则/AI 分歧分析
- 在不修改主评分规则、不改 AI prompt、不改页面的前提下，补一份价格敏感性分析

## 分支

- `analysis/scoring-rule-audit`

## 输入与基准

- 输入文件：`data/input/达人列表_20260623194334.xlsx`
- AI 报告基准：`data/output/朴代表候选达人AI分析报告_最终交付版_20260623204306.xlsx`
- 主评分实现：`services/scoring.py`
- 候选达人分析实现：`scripts/park_candidates_analysis.py`

## 关键发现

1. 主流程与朴代表脚本都使用六维评分 + 风险扣分，但朴代表脚本的价格比较是在当前 10 位样本内部完成，不是对全量 1725 人比较。
2. 规则里的价格维度只看 `全部报价` 和 `粉丝数`，不看阅读中位数、互动中位数、合作 ER。
3. DeepSeek 文案里的“报价偏高”不是规则直接输出的判断标签，而是 AI 基于报价、阅读、互动、ER、性价比分等字段做的二次解释。
4. “降低价格权重”并不会单向抬高高报价达人，因为低报价达人本来也在吃价格维度的正向加分。

## 本次新增文件

- `scripts/analysis_scoring_sensitivity.py`
- `scripts/export_scoring_breakdown.py`
- `scripts/export_scoring_trace.py`
- `docs/research/scoring_rule_audit_20260623.md`
- `docs/devlogs/scoring-rule-audit.md`

## 输出文件

- `data/output/评分规则敏感性分析_20260623.xlsx`
- `data/output/朴代表候选达人评分拆解表_20260624.xlsx`
- `data/output/朴代表候选达人逐项评分追踪表_20260624.xlsx`

## 场景模拟口径

- 场景 A：原始规则
- 场景 B：价格权重减半
- 场景 C：仅放宽价格风险扣分，模拟 `CPM极端高` 从 `-2` 放宽为 `-1`
- 场景 D：仅保留“关键词组合 + 韩国品牌”
- 场景 E：按现有粉丝分层档位比较报价

## 执行验证

- 已运行：`python scripts/analysis_scoring_sensitivity.py`
- 成功生成：`data/output/评分规则敏感性分析_20260623.xlsx`
- 已运行：`python scripts/export_scoring_breakdown.py`
- 成功生成：`data/output/朴代表候选达人评分拆解表_20260624.xlsx`
- 已运行：`python scripts/export_scoring_trace.py`
- 成功生成：`data/output/朴代表候选达人逐项评分追踪表_20260624.xlsx`

## 2026-06-24 补充：评分拆解表导出

- 目标：把朴代表 10 位已覆盖达人的最终分拆成“六维原始分 / 贡献分 / 价格拆解 / 关键词命中 / 风险扣分 / AI分歧”六张表，降低黑盒感。
- 实现方式：新增独立脚本 `scripts/export_scoring_breakdown.py`，完全复用 `scripts/park_candidates_analysis.py` 的当前打分逻辑，不改权重、不改 prompt、不改页面。
- 导出内容：
  - `1_评分总览`
  - `2_六维分拆解`
  - `3_价格与性价比拆解`
  - `4_关键词命中拆解`
  - `5_风险扣分拆解`
  - `6_人工AI分歧分析`
- 说明：
  - `CPM在当前样本中的位置` 明确按本次 10 位样本内部排序展示。
  - `主要丢分原因` 通过低分维度、风险扣分和 AI 报价风险提示组合生成，面向非技术阅读。
  - `人工初判（先留空）` 保持空列，便于后续人工填写。

## 2026-06-24 补充：逐项评分追踪表导出

- 目标：把“原始字段 -> 清洗字段 -> 中间变量 -> 六维原始分 -> 权重贡献 -> 最终分”完整展开，进一步降低黑盒感。
- 实现方式：新增 `scripts/export_scoring_trace.py`，直接复用现有朴代表分析脚本和拆解脚本的评分口径，不改主评分函数、不重跑 AI。
- 导出内容：
  - `1_字段到维度映射`
  - `2_单人完整计算样例`
  - `3_所有达人六维原始分`
  - `4_百分位计算说明`
  - `5_非技术解释版`
- 验证结果：
  - Top1 达人 `小鱼同学UAU` 的最终分成功复算为 `75.45`
  - 与现有评分拆解表和 AI 报告中的最终分一致
  - 百分位说明页已明确写明：本次朴代表只有 10 位覆盖达人，所以百分位全部是这 10 人内部比较

## 额外说明

- 用户要求检查的 `docs/v2/01_V2需求确认书.md`、`docs/v2/02_页面功能清单.md` 在当前仓库中不存在，本次已在审计报告中注明。
- `data/output` 结果文件仅生成，不纳入提交。
