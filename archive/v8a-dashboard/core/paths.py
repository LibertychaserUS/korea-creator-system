from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"
CONFIG_DIR = ROOT_DIR / "config"
DOCS_DIR = ROOT_DIR / "docs"

DEFAULT_SOURCE_CANDIDATES = [
    INPUT_DIR / "current.xlsx",
    ROOT_DIR.parent / "材料" / "0201小红书蒲公英抓取数据详情表1.0.xlsx",
]


def ensure_runtime_dirs() -> None:
    for path in [
        DATA_DIR,
        CACHE_DIR,
        INPUT_DIR,
        OUTPUT_DIR,
        CONFIG_DIR,
        DOCS_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def load_settings() -> dict[str, Any]:
    settings_path = CONFIG_DIR / "settings.example.json"
    if settings_path.exists():
        return json.loads(settings_path.read_text(encoding="utf-8"))
    return {}


def resolve_source_file(settings: dict[str, Any]) -> Path:
    configured = settings.get("source_excel")
    if configured:
        candidate = Path(configured)
        if not candidate.is_absolute():
            candidate = (ROOT_DIR / candidate).resolve()
        if candidate.exists():
            return candidate

    for candidate in DEFAULT_SOURCE_CANDIDATES:
        if candidate.exists():
            return candidate

    raise FileNotFoundError("未找到可用的原始 Excel，请检查 data/input/current.xlsx 或 材料/0201 文件。")
