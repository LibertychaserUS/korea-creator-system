# V2 联系与报价基础

## 本次实现功能

- 在现有 `services/v2_state.py` 基础上扩展联系记录与报价记录能力。
- 新增轻量 JSON 状态文件：
  - `data/cache/v2_contact_records.json`
  - `data/cache/v2_quote_records.json`
- 新增联系/报价 API，支持读取、保存和汇总。
- 在达人详情抽屉新增“联系与报价”标签页，支持保存联系状态、联系备注、跟进时间、候选状态、平台参考报价、询价报价、最终报价、币种和报价备注。
- 复用现有 `outreach` 页面入口，改成轻量“联系跟进”页，展示联系状态统计、候选数、均价和最近记录。

## 修改文件

- `services/v2_state.py`
- `app/web.py`
- `static/app.js`

## 新增 API

- `GET /api/v2/contact-records`
- `POST /api/v2/contact-records`
- `GET /api/v2/quote-records`
- `POST /api/v2/quote-records`
- `GET /api/v2/contact-summary`

## 新增数据文件

- `data/cache/v2_contact_records.json`
- `data/cache/v2_quote_records.json`

## 前端改动

- 达人详情抽屉新增“联系与报价”标签页。
- 抽屉表单字段包括：
  - 联系状态
  - 联系渠道
  - 联系人/负责人
  - 联系备注
  - 下次跟进时间
  - 是否进入候选合作池
  - 平台参考报价
  - 首次询价报价
  - 最终报价
  - 报价币种
  - 报价备注
- “邮件触达”页面改为“联系跟进”看板，显示：
  - 联系记录数
  - 候选达人数量
  - 已获取报价数量
  - 平均平台参考报价
  - 平均询价报价
  - 平均最终报价
  - 联系状态统计
  - 最近联系记录
  - 最近报价记录

## 验证结果

- `python -c "import app.web; print('Import OK')"` 通过。
- `node --check static/app.js` 通过。
- `TestClient` 验证通过：
  - `/`
  - `/api/v2/contact-records`
  - `/api/v2/quote-records`
  - `/api/v2/contact-summary`
  - `/api/creator/1`
- 真实落盘验证通过：
  - `POST /api/v2/contact-records` 可写入联系记录
  - `POST /api/v2/quote-records` 可写入报价记录
  - 重新读取 `/api/creator/1` 可回显 `contact_record` 与 `quote_record`
  - `/api/v2/contact-summary` 会随写入结果变化
- 浏览器验证通过：
  - 首页能打开
  - 达人详情抽屉可见“联系与报价”标签页
  - 抽屉字段可读取已保存值
  - “邮件触达”页能展示联系跟进统计
  - 控制台无报错

## 是否还原测试数据

- 已还原。
- 验证前备份了：
  - `data/cache/v2_contact_records.json`
  - `data/cache/v2_quote_records.json`
- 验证后恢复了原始文件；若原文件不存在，则删除测试生成文件。
- 恢复后 `/api/v2/contact-summary` 已回到空状态：
  - `total = 0`
  - `status_counts = {}`
  - `avg_* = null`

## 已知问题

- 当前工作区中仍有用户未提交的甘特图相关前端改动（例如 `templates/index.html`、`static/styles.css`），本次未纳入提交。
- 浏览器自动化里，带抽屉遮罩的导航切换有偶发不稳定，因此详情页与联系页的验收采取了“抽屉字段读取 + 页面文本检查”的方式完成。
- 本次没有把联系状态、最终报价、候选状态加回达人列表列展示，优先保证详情抽屉与联系跟进页可用。

## 下一步建议

- 下一步进入“批次报告导出”，可基于现有批次、规则复盘、人工复核、联系记录和报价记录统一组装导出结构。
