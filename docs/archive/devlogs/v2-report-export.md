## V2-3 批次报告导出

1. 本次实现功能
实现了 V2 批次报告预览与导出基础能力，支持汇总批次、分析运行、规则版本、Top 达人、AI 摘要、人工复核、分歧统计、联系状态、报价统计和候选达人清单，并导出为 Markdown 与 JSON。

2. 修改文件
`app/web.py`
`services/v2_state.py`
`static/app.js`
`docs/devlogs/v2-report-export.md`

3. 新增 API
`GET /api/v2/report-data`
`POST /api/v2/export-report`

4. 新增导出文件目录
`data/exports/v2_reports/`

5. 报告字段来源
批次、运行、规则版本来自 `services/v2_state.py` 管理的 V2 基线文件。
Top 达人、等级分布来自 `scores_full.csv` 与当前 dashboard summary。
AI 摘要来自 AI 缓存中的 reasons、risks、review_hint。
人工复核与分歧统计来自 `manual_reviews.json` 与 `v2_review_logs.json`。
联系与报价统计来自 `v2_contact_records.json` 与 `v2_quote_records.json`。

6. 验证结果
已执行 `python -c "import app.web; print('Import OK')"` 与 `node --check static/app.js`。
已验证 `/`、`/api/v2/report-data`、`/api/v2/export-report` 返回 200。
已验证导出时同时生成 `.md` 与 `.json` 文件，导出后页面可显示文件路径。
已验证空状态下也能生成报告，不依赖人工复核、联系记录或报价记录存在。

7. 已知问题
当前导出页为轻量预览区块，未做复杂模板排版，也未加入最近导出列表持久化。
导出文件默认写入 `data/exports/v2_reports/`，验证完成后如果不需要保留，建议手动清理测试文件，避免工作区出现新的未跟踪导出产物。

8. 下一步建议：演示版本整理、测试、截图、汇报材料
下一步建议进入演示版本整理，补充关键流程截图、空数据与非空数据样例、统一页面文案，再准备汇报材料与演示脚本。
