# 架构边界

> 项目：`korea-creator-system`。
> **实现栈硬约束**：tinyship + **forge** + **overlay**（技术名，不是 Harness.io）。缺一不可，不是后期插件。
> 组装细节 SSOT：[`TINYSHIP-REBUILD.md`](./TINYSHIP-REBUILD.md)（已落地）。本文件只划产品边界与仓库布局。

## 仓库布局

| 路径 | 状态 |
|------|------|
| `docs/` | **留下**。历史 + 产品意图权威处。含编号 `00_*`–`10_*`、`docs/product/`、`docs/pm/`。不要搬进 archive。 |
| 旧 FastAPI / pandas Demo | **已删除**（历史 git `f31c882`）。仓库根不再有可施工的 `app/`。 |
| 仓库根 tinyship 树 | 新工作唯一落点：`apps/` `libs/` 来自 TinyShip。**不要**再套 `apps/tinyship`。 |
| 根上薄配置 | `forge.yaml` `overlay.yaml` `inbox/` `suites/` `invariants.yaml`。工具包留在 `/tmp/AIOps`，禁止 vendor。 |

## 目标形态

绿地：在 **tinyship + forge + overlay** 上重建 V1 闭环（导入 → 清洗去重 → 规则排序 → 风险复核 → 人工确认 → 导出）。第一刀就必须三件套同时在树上，不能先 tinyship 再补另外两个。产品 UI 从第一刀起就是 `zh-CN` / `en` / `ko`（`libs/i18n` + Nuxt 前缀），不能先中文-only。

旧 Demo 已不在工作树。不要为它做 Stage 8B，不要把它加回来当运行目标。

## 产品管道（与框架无关）

<div style="width:100%;max-width:1100px;box-sizing:border-box;position:relative;background:#fafbfc;padding:16px;border-radius:6px;border:1px solid #e5e7eb;"><style scoped>.arch-title{text-align:center;font-size:16px;font-weight:700;color:#1f2937;margin-bottom:12px;}.arch-pipeline{display:flex;gap:0;align-items:stretch;}.arch-stage{flex:1;padding:10px;border:2px solid #d1d5db;border-radius:6px;background:#fff;}.arch-stage-title{font-size:11px;font-weight:700;text-align:center;margin-bottom:8px;color:#374151;}.arch-arrow{display:flex;align-items:center;justify-content:center;width:28px;flex-shrink:0;color:#9ca3af;}.arch-box{border-radius:4px;padding:6px;text-align:center;font-size:10px;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb;margin:3px 0;color:#1f2937;}.arch-box.highlight{border:2px solid #6b7280;background:#f3f4f6;}</style><div class="arch-title">korea-creator-system 产品管道（绿地）</div><div class="arch-pipeline"><div class="arch-stage"><div class="arch-stage-title">Ingest</div><div class="arch-box">0201 / current.xlsx</div><div class="arch-box">清洗去重</div></div><div class="arch-arrow">→</div><div class="arch-stage"><div class="arch-stage-title">规则排序</div><div class="arch-box highlight">六维 + 风险</div><div class="arch-box">等级 / 排名</div></div><div class="arch-arrow">→</div><div class="arch-stage"><div class="arch-stage-title">风险复核</div><div class="arch-box">DeepSeek Top50</div><div class="arch-box">fallback 模板</div></div><div class="arch-arrow">→</div><div class="arch-stage"><div class="arch-stage-title">人工确认</div><div class="arch-box">四态标注</div><div class="arch-box">不改分</div></div><div class="arch-arrow">→</div><div class="arch-stage"><div class="arch-stage-title">导出</div><div class="arch-box">Excel / CSV</div><div class="arch-box">时间戳快照</div></div></div></div>

## 边界

| 层 | 允许 | 禁止 |
|----|------|------|
| 规则引擎 | 读配置算分、写解释字段 | 读 AI / 人工结果来改分 |
| AI | 读 Creator+Score 摘要，写 AIReview | 写 Score；全量 1725 人打模型（MVP） |
| 人工 | 写 ManualReview | 覆盖 final / grade / rank |
| 导出 | 快照当前运行 | 当邮件发送器 |
| i18n | `libs/i18n` + `@nuxtjs/i18n` 前缀；扩 `ko`；cookie `NEXT_LOCALE` | 搬 archive 扁平 `t()` / `dashboard-locale`；中文-only 宿主；把三语写成 Later |
| 旧 Demo | 只读 `docs/` 对照字段与口径 | 加回旧代码、8B 补页、继续扩 V2 API、假装根目录还有 `app/` |

## 旧 Demo 对照（不要扩展）

核对历史实现时只读 `docs/`；代码考古走 git `f31c882` 的 `archive/v8a-dashboard/`：

- 代码：原 `web` 入口、scoring、AI 模块（含未进编号文档的 `/api/v2/*`）
- 指标与数据源口径：`docs/03_指标口径与数据源.md`
- AI 口径：`docs/04_AI提示词与DeepSeek说明.md`
- 页面快照：`docs/06_页面说明.md`（`v8a-dashboard`）
- V2 意图备忘：`docs/devlogs/v2-*.md`

编号文档仍是旧 Demo 的官方说明，不要改写成 tinyship 施工图。不要把 `docs/` 当代码一起 archive。

## 明确不建（本阶段）

- 蒲公英自动登录、小红书抓取、多平台采集、模型训练
- 自动联系 / SMTP / 群发
- 完整 AnalysisRun 中心、在线改权重并自动生效（规则页 MVP 只读）
- IMOK V3 三角色、活动、合同、结算
- Harness.io 资源、`docs/pm/HARNESS.md`

存储、路由、测试命令、目录、forge/overlay 组装、i18n API：只写在 `TINYSHIP-REBUILD.md`。冲突以那份为准。三件套与三语约束以 [`../pm/STACK.md`](../pm/STACK.md) 为准，不得降级为 Later。

## 三件套在树上的位置

<div style="width:100%;max-width:1100px;box-sizing:border-box;position:relative;background:#fafbfc;padding:16px;border-radius:6px;border:1px solid #e5e7eb;"><style scoped>.arch-title{text-align:center;font-size:16px;font-weight:700;color:#1f2937;margin-bottom:12px;}.arch-layer{margin:8px 0;padding:12px;border-radius:6px;}.arch-layer-title{font-size:12px;font-weight:700;text-align:center;margin-bottom:8px;}.arch-grid{display:grid;gap:8px;grid-template-columns:repeat(3,1fr);}.arch-box{border-radius:4px;padding:8px;text-align:center;font-size:11px;font-weight:600;background:#fff;border:1px solid #e5e7eb;color:#1f2937;}.arch-box.highlight{border:2px solid #6b7280;background:#f3f4f6;}.arch-layer.user{background:#eff6ff;border:2px solid #3b82f6;}.arch-layer.application{background:#fffbeb;border:2px solid #d97706;}.arch-layer.ai{background:#f0fdf4;border:2px solid #16a34a;}.arch-layer.infra{background:#f3f4f6;border:2px solid #6b7280;}</style><div class="arch-title">活树：tinyship 宿主 + forge/overlay 门</div><div class="arch-layer user"><div class="arch-layer-title">产品 UI（tinyship Nuxt · zh-CN / en / ko）</div><div class="arch-grid"><div class="arch-box">控制台 / 榜单</div><div class="arch-box">详情 / 复核</div><div class="arch-box">规则只读 / 导出</div></div></div><div class="arch-layer application"><div class="arch-layer-title">领域（新建 libs/kcs-domain）</div><div class="arch-grid"><div class="arch-box highlight">ScoreEngine</div><div class="arch-box">Ingest / Review</div><div class="arch-box">禁止从 archive 搬文件</div></div></div><div class="arch-layer ai"><div class="arch-layer-title">门（同一产品仓根，工具在 /tmp/AIOps）</div><div class="arch-grid"><div class="arch-box">overlay validate/cover/run</div><div class="arch-box">forge check/submit</div><div class="arch-box">不 live-apply</div></div></div><div class="arch-layer infra"><div class="arch-layer-title">不动</div><div class="arch-grid"><div class="arch-box">docs/ 留下</div><div class="arch-box">旧 Python 已删</div><div class="arch-box">无 Harness.io</div></div></div></div>
