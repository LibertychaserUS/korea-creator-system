# 墓碑：v8a-dashboard FastAPI Demo

- **日期**：2026-09-12
- **状态**：已冻结。仅作历史参考，不再作为实现底座。

## 这是什么

旧版 `v8a-dashboard` FastAPI Demo（pandas 评分 + 单页仪表盘）。当时用于韩国品牌小红书达人筛选演示：清洗、六维规则评分、AI 风险复核、人工标注与导出。

代码已整体迁入 [`v8a-dashboard/`](./v8a-dashboard/)，未删除。

## 为什么归档

后续改走 **tinyship 绿地重建**。旧 FastAPI / pandas 实现不再当底座，也不在此目录上继续扩功能。

旧代码仍可用于对照历史口径、评分规则与页面意图；产品决策以仓库根目录的 `docs/` 为准。

## 仓库里仍然活着的部分

以下内容留在仓库根目录，**没有**搬进 archive：

- `docs/`（含编号文档 00–10、demo、research、screenshots、product、pm）
- `AGENTS.md`
- `.gitignore`
- 根目录 `README.md`

## 快照位置

| 内容 | 路径 |
|------|------|
| 应用入口 | `archive/v8a-dashboard/app/`（`app.web:app`、`app.main`） |
| 评分 / 清洗 / AI | `archive/v8a-dashboard/services/` |
| 路径与运行时目录 | `archive/v8a-dashboard/core/paths.py` |
| 旧评分规则 | `archive/v8a-dashboard/config/`（`default_rules.json`、`exclude_rules.json`、`keyword_groups.json`、`settings.example.json`） |
| 运行时输入表 | `archive/v8a-dashboard/data/input/达人列表_20260623194334.xlsx` |
| 启动脚本 | `archive/v8a-dashboard/start_demo.bat` |

旧应用依赖清单已放在 `archive/v8a-dashboard/requirements.txt`（`fastapi`、`uvicorn`、`jinja2`、`python-multipart`、`pandas`、`numpy`、`openpyxl`、`httpx`）。

## 若必须运行这份快照

这是历史快照。迁入 `archive/v8a-dashboard/` 后，相对路径可能已失效，**不保证开箱即跑**；缺路径时以对照源码为准，不必在此修复。

已知会变的路径：

- `core.paths.ROOT_DIR` 现在指向 `archive/v8a-dashboard/`（`config/`、`data/` 仍相对该目录，这一点是对的）。
- `core.paths.DOCS_DIR` 会指向 `archive/v8a-dashboard/docs/`，该目录不存在；活文档仍在仓库根的 `docs/`。
- `config/settings.example.json` 里的 `../材料/0201...xlsx` 以及 `DEFAULT_SOURCE_CANDIDATES` 里对仓库父目录 `材料/` 的引用，在归档后可能对不上。输入表示例在 `archive/v8a-dashboard/data/input/`。

在快照目录内启动 Web（需已安装上述依赖）：

```bash
cd archive/v8a-dashboard
uvicorn app.web:app --reload --port 5000
```

- 页面：`http://127.0.0.1:5000`
- API 文档：`http://127.0.0.1:5000/docs`

评分引擎（可选）：

```bash
cd archive/v8a-dashboard
python -m app.main
```

Windows 也可在该目录运行 `start_demo.bat`（同样先 `cd` 到 `archive/v8a-dashboard`）。
