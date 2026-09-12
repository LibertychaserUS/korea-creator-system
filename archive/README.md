# archive — 冻结墓碑

本目录是旧 Python / FastAPI / pandas Demo 的**只读归档**。

- 不要在这里继续开发、补 Stage 8B、或扩 `/api/v2/*`。
- 不要把这里的进程当成当前产品运行入口。
- 仓库根没有可施工的 `app/`。新实现只进 tinyship + forge + overlay（见 `docs/pm/STACK.md`）。

`docs/` **不在**本目录。编号文档与产品意图仍在仓库根 `docs/`。

## 冻结快照

| 项 | 说明 |
|----|------|
| 路径 | `archive/v8a-dashboard/` |
| 版本 | `v8a-dashboard`（含 A.1 / A.2 三语修复） |
| 历史入口 | `app/web.py`，当时用 `uvicorn app.web:app --reload --port 5000` |
| 规则引擎 | `config/default_rules.json`、`services/scoring.py` |
| AI 复核 | `services/ai_recommendation.py` |
| 未发布 V2 | `services/v2_state.py`（意图可迁新栈，不要在此续写） |
| 依赖 | `requirements.txt`（仅对照，不作为当前工程安装入口） |
| 样例表 | `data/input/达人列表_20260623194334.xlsx` |

对照字段、权重、冲突口径时：读本快照 + 仓库根 `docs/03_评分规则说明.md`、`docs/04_AI提示词与DeepSeek说明.md`。
