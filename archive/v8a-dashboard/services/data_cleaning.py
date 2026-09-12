"""数据清洗：数值标准化 + 缺失标记 + 质量标签。"""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

QUALITY_COMPLETE = "完整"
QUALITY_PARTIAL = "部分缺失"
QUALITY_SEVERE = "严重缺失"

REGION_MAP: dict[str, str] = {
    "韩国": "韩国", "korea": "韩国", "한국": "韩国", "korea": "韩国",
    "中国": "中国", "china": "中国", "중국": "中国",
    "日本": "日本", "japan": "日本", "일본": "日本",
    "美国": "美国", "usa": "美国", "미국": "美国",
    "泰国": "泰国", "thailand": "泰国", "태국": "泰国",
    "越南": "越南", "vietnam": "越南", "베트남": "越南",
    "新加坡": "新加坡", "singapore": "新加坡", "싱가포르": "新加坡",
    "马来西亚": "马来西亚", "malaysia": "马来西亚", "말레이시아": "马来西亚",
    "印度尼西亚": "印度尼西亚", "indonesia": "印度尼西亚", "인도네시아": "印度尼西亚",
    "英国": "英国", "uk": "英国", "united kingdom": "英国", "영국": "英国",
    "法国": "法国", "france": "法国", "프랑스": "法国",
    "德国": "德国", "germany": "德国", "독일": "德国",
    "中国台湾": "中国台湾", "taiwan": "中国台湾", "대만": "中国台湾",
    "中国香港": "中国香港", "hong kong": "中国香港", "hongkong": "中国香港", "홍콩": "中国香港",
}


def _to_num(value: Any) -> float | None:
    """尝试将任意值转为 float，失败返回 None。"""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def normalize_follower_count(value: Any) -> tuple[float | None, str]:
    """标准化粉丝数：12.3万 → 123000，返回 (数值, 原始文本)。"""
    raw = str(value).strip() if value is not None and not (isinstance(value, float) and pd.isna(value)) else ""
    if not raw:
        return None, raw

    n = _to_num(value)
    if n is not None:
        return n, raw

    # 中文万
    m = re.match(r"([\d.]+)\s*万", raw)
    if m:
        return float(m.group(1)) * 10000, raw

    # 韩文만
    m = re.match(r"([\d.]+)\s*만", raw)
    if m:
        return float(m.group(1)) * 10000, raw

    return None, raw


def normalize_quote_price(value: Any) -> dict[str, Any]:
    """标准化报价：¥500-1000 → {"min": 500, "max": 1000, "avg": 750, "text": "¥500-1000"}。"""
    raw = str(value).strip() if value is not None and not (isinstance(value, float) and pd.isna(value)) else ""
    if not raw:
        return {"min": None, "max": None, "avg": None, "text": ""}

    n = _to_num(raw)
    if n is not None:
        return {"min": n, "max": n, "avg": n, "text": raw}

    # 范围: ¥500-1000, 500-1000, 500~1000
    cleaned = raw.replace("¥", "").replace("¥", "").replace(",", "").strip()
    m = re.match(r"([\d.]+)\s*[-~～]\s*([\d.]+)", cleaned)
    if m:
        lo = float(m.group(1))
        hi = float(m.group(2))
        return {"min": lo, "max": hi, "avg": round((lo + hi) / 2, 2), "text": raw}

    return {"min": None, "max": None, "avg": None, "text": raw}


def normalize_er(value: Any) -> float | None:
    """标准化互动率：5.2% → 5.2，空 → None。"""
    raw = str(value).strip() if value is not None and not (isinstance(value, float) and pd.isna(value)) else ""
    if not raw:
        return None

    n = _to_num(raw)
    if n is not None:
        return n if raw.endswith("%") else (n * 100 if n < 1 else n)

    # 百分号
    m = re.match(r"([\d.]+)\s*%", raw)
    if m:
        return float(m.group(1))

    return None


KEY_QUALITY_FIELDS = [
    "昵称",
    "粉丝数",
    "全部报价",
    "合作笔记ER",
    "creator_key",
]


def classify_row_quality(row: pd.Series) -> str:
    """对单行数据打质量标签。"""
    missing = 0
    for field in KEY_QUALITY_FIELDS:
        val = row.get(field)
        if field == "creator_key":
            has = bool(field in row.index)
        else:
            if val is None or (isinstance(val, float) and pd.isna(val)):
                has = False
            elif isinstance(val, str) and not val.strip():
                has = False
            else:
                has = True
        if not has:
            missing += 1

    if missing == 0:
        return QUALITY_COMPLETE
    if missing <= 2:
        return QUALITY_PARTIAL
    return QUALITY_SEVERE


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """对 DataFrame 执行清洗：标准化数值字段 + 添加质量列。"""
    result = df.copy()

    # 粉丝数标准化
    if "粉丝数" in result.columns:
        cleaned = result["粉丝数"].apply(normalize_follower_count)
        result["粉丝数_原始"] = cleaned.map(lambda t: t[1])
        result["粉丝数"] = cleaned.map(lambda t: t[0])
    else:
        result["粉丝数_原始"] = ""

    # 报价标准化
    if "全部报价" in result.columns:
        quotes = result["全部报价"].apply(normalize_quote_price)
        result["全部报价_原始"] = quotes.map(lambda q: q["text"])
        result["报价_平均值"] = quotes.map(lambda q: q["avg"])
    else:
        result["全部报价_原始"] = ""
        result["报价_平均值"] = None

    # ER 标准化
    if "合作笔记ER" in result.columns:
        result["合作笔记ER_原始"] = result["合作笔记ER"].astype(str)
        result["合作笔记ER"] = result["合作笔记ER"].apply(normalize_er)
    else:
        result["合作笔记ER_原始"] = ""

    # 质量标签
    result["数据质量"] = result.apply(classify_row_quality, axis=1)

    # 地区名归一化
    if "地域" in result.columns:
        result["地域_原始"] = result["地域"].astype(str)
        result["地域"] = result["地域"].apply(_normalize_region)
    elif "country_label" in result.columns:
        result["country_label_原始"] = result["country_label"].astype(str)
        result["country_label"] = result["country_label"].apply(_normalize_region)

    return result


def _normalize_region(value: Any) -> str:
    """地区名归一化：韩国/Korea/한국 → 韩国。"""
    raw = str(value).strip() if value is not None and not (isinstance(value, float) and pd.isna(value)) else ""
    if not raw:
        return raw
    key = raw.lower()
    return REGION_MAP.get(key, raw)


def build_cleaning_summary(df: pd.DataFrame) -> dict[str, Any]:
    """生成清洗摘要。"""
    has_quality = "数据质量" in df.columns
    quality_counts = dict(df["数据质量"].value_counts()) if has_quality else {}
    total = len(df)

    return {
        "total_rows": total,
        "quality_distribution": {
            QUALITY_COMPLETE: int(quality_counts.get(QUALITY_COMPLETE, 0)),
            QUALITY_PARTIAL: int(quality_counts.get(QUALITY_PARTIAL, 0)),
            QUALITY_SEVERE: int(quality_counts.get(QUALITY_SEVERE, 0)),
        },
        "follower_count_normalized_rate": round(
            df["粉丝数"].notna().sum() / max(total, 1), 4
        ) if "粉丝数" in df.columns else 0,
        "quote_avg_rate": round(
            df["报价_平均值"].notna().sum() / max(total, 1), 4
        ) if "报价_平均值" in df.columns else 0,
        "er_normalized_rate": round(
            df["合作笔记ER"].notna().sum() / max(total, 1), 4
        ) if "合作笔记ER" in df.columns else 0,
    }
