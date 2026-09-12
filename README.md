# 全球达人情报系统

韩国品牌小红书达人清洗、规则评分、AI 风险复核 Demo。

项目说明见 [`docs/00_项目总览.md`](docs/00_项目总览.md)。

## 运行

```bash
pip install -r requirements.txt
uvicorn app.web:app --reload --port 5000
```

- 页面：http://127.0.0.1:5000
- API 文档：http://127.0.0.1:5000/docs

Demo 数据集在 `data/input/`。DeepSeek API Key 通过环境变量 `DEEPSEEK_API_KEY` 配置，未配置时走 fallback。
