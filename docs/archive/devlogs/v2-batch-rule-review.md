# V2 批次与规则复盘基础

## 本次实现内容

- 新增 `services/v2_state.py`，集中管理 V2 批次、分析运行、规则版本、复核历史和规则建议 5 类 JSON 状态。
- 应用启动时自动初始化 `data/cache/v2_batches.json`、`v2_analysis_runs.json`、`v2_rule_versions.json`、`v2_review_logs.json`、`v2_rule_replay_suggestions.json`。
- 在 `app/web.py` 新增 `/api/v2/*` 接口，提供批次、分析运行、规则版本、复核历史和分歧统计能力。
- 扩展原有人工复核保存逻辑，继续写入旧的 `manual_reviews.json`，同时同步写入 V2 复核历史，避免旧功能失效。
- 将前端 `rules` 占位页改为“规则复盘”页，展示当前规则版本、当前批次、复核总数、一致数、分歧数、分歧类型、原因标签、规则建议和最近复核记录。

## 修改文件

- `services/v2_state.py`
- `app/web.py`
- `static/app.js`

## 新增 API

- `GET /api/v2/batches`
- `GET /api/v2/analysis-runs`
- `GET /api/v2/rule-versions`
- `GET /api/v2/review-logs`
- `POST /api/v2/review-logs`
- `GET /api/v2/review-disagreements`

## 新增数据文件

- `data/cache/v2_batches.json`
- `data/cache/v2_analysis_runs.json`
- `data/cache/v2_rule_versions.json`
- `data/cache/v2_review_logs.json`
- `data/cache/v2_rule_replay_suggestions.json`

## 启动与验证

1. 运行 `python -c "import app.web; print('Import OK')"`，确认后端可导入。
2. 启动 FastAPI 服务后访问首页，确认概览页、达人列表页、AI 复核页仍可打开。
3. 打开“规则复盘”页，确认能看到默认批次、规则版本和分歧统计。
4. 访问新增 `/api/v2/*` 接口，确认返回 JSON。
5. 保存人工复核时，应同时保留旧 `manual_reviews.json` 兼容格式，并新增 V2 复核历史记录。

## 落盘验证

1. 使用旧人工复核保存接口 `POST /api/manual/update` 做真实链路验证，而不是只调用 `/api/v2/review-logs`。
2. 已验证旧 `manual_reviews.json` 兼容写入：测试后 `rank=1` 的人工复核状态被更新，`/api/creator/1` 也能读到新值。
3. 已验证 V2 `review_logs` 历史写入：同一次旧接口保存后，`data/cache/v2_review_logs.json`、`GET /api/v2/review-logs` 都出现了新增历史记录。
4. 已验证分歧统计变化：`GET /api/v2/review-disagreements` 的 `disagreed_count` 从 `0` 变为 `1`，原因标签计数同步变化；浏览器中的“规则复盘”页也能看到新增分歧类型和最近记录。
5. 已恢复测试数据：验证完成后用 `_tmp_v2_review_verify/` 里的备份还原了 `data/cache/manual_reviews.json` 与 `data/cache/v2_review_logs.json`，并重新触发一次分歧统计计算，恢复后 `disagreed_count` 回到 `0`。
6. 未解决问题：当前详情抽屉保存只会提交 `decision`、`note`、`updated_at`，不会提交 `reason_tags`；因此本次“原因标签统计变化”是通过旧接口扩展 payload 验证的，不是通过现有前端按钮直接验证的。

## V2-1.1 人工复核原因标签补丁

1. 本次补了达人详情抽屉里的“人工复核原因标签”多选 UI，保存人工复核时会把标签作为 `reason_tags` 一起提交到旧接口 `POST /api/manual/update`。
2. 修改文件：
   - `static/app.js`
   - `docs/devlogs/v2-batch-rule-review.md`
3. 前端提交字段：
   - `rank`
   - `decision`
   - `note`
   - `reason_tags`
   - `updated_at`
4. 已验证落盘：
   - `manual_reviews.json` 能保存 `reason_tags`
   - `v2_review_logs.json` 能保存 `reason_tags`
   - `GET /api/v2/review-logs` 能读到 `reason_tags`
   - `GET /api/v2/review-disagreements` 的 `reason_tag_counts` 会变化
5. 已还原测试数据：使用 `_tmp_v2_reason_tags_verify/` 备份并恢复 `data/cache/manual_reviews.json` 与 `data/cache/v2_review_logs.json`，恢复后分歧统计已回到测试前状态。
6. 已知问题：
   - 浏览器自动化环境下，侧栏跳转与详情打开有偶发不稳定，因此本次“多标签保存后的真实落盘与回显”主要通过前端代码检查 + 旧接口落盘验证 + 读取 `/api/creator/1` 返回结果确认。
   - 本次没有修改后端，因为 `app/web.py` 已经支持接收并存储 `reason_tags`。

## 已知问题

- 当前默认批次、默认运行和默认规则版本来自现有主系统数据的自动初始化，后续可以再补真实的批次创建与运行创建入口。
- 规则建议目前基于分歧类型统计生成，还没有接入更细的规则回放测试。
- 本次没有改动甘特图独立预览包，也没有处理联系 SOP、报价记录和报告导出。

## 下一步建议

- 新增真正的批次创建、运行创建和范围对比入口。
- 在人工复核保存处补充 `reason_tags` 选择器，减少纯文本备注带来的统计损耗。
- 在后续阶段继续补联系 SOP、报价记录和批次报告导出。
