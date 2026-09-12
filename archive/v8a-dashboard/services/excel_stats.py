from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from core.paths import CACHE_DIR, ensure_runtime_dirs, load_settings, resolve_source_file


SHEET_NAME = "筛选结果"
CREATOR_KEY_COLUMNS = ["userId", "小红书号", "小红书主页URL"]


def _normalize_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def _build_creator_key(frame: pd.DataFrame) -> pd.Series:
    key = pd.Series([""] * len(frame), index=frame.index, dtype="object")
    for column in CREATOR_KEY_COLUMNS:
        normalized = frame[column].map(_normalize_text)
        key = key.where(key != "", normalized)
    return key


def _build_field_stats(frame: pd.DataFrame) -> dict[str, Any]:
    numeric_candidates = [
        "粉丝数",
        "阅读中位数_日常",
        "互动中位数_日常",
        "互动中位数_合作",
        "全部报价",
        "图文报价",
        "视频报价",
        "匹配笔记数",
    ]
    field_stats: dict[str, Any] = {
        "row_count": int(len(frame)),
        "column_count": int(len(frame.columns)),
        "columns": list(frame.columns),
        "per_column": {},
    }

    for column in frame.columns:
        series = frame[column]
        column_stats: dict[str, Any] = {
            "non_null_count": int(series.notna().sum()),
            "null_count": int(series.isna().sum()),
            "unique_count": int(series.nunique(dropna=True)),
            "sample_values": [
                _normalize_text(v)
                for v in series.dropna().head(3).tolist()
                if _normalize_text(v) != ""
            ],
        }
        if column in numeric_candidates:
            numeric_series = pd.to_numeric(series, errors="coerce").dropna()
            if not numeric_series.empty:
                column_stats["numeric_summary"] = {
                    "min": float(numeric_series.min()),
                    "p25": float(numeric_series.quantile(0.25)),
                    "median": float(numeric_series.median()),
                    "mean": float(numeric_series.mean()),
                    "p75": float(numeric_series.quantile(0.75)),
                    "max": float(numeric_series.max()),
                }
        field_stats["per_column"][column] = column_stats

    return field_stats


def _build_dedupe_stats(frame: pd.DataFrame, deduped_frame: pd.DataFrame) -> dict[str, Any]:
    source_row_counts = deduped_frame["_source_rows"]
    distribution = source_row_counts.value_counts().sort_index()
    return {
        "creator_key_priority": CREATOR_KEY_COLUMNS,
        "raw_rows": int(len(frame)),
        "deduped_rows": int(len(deduped_frame)),
        "duplicate_rows": int(len(frame) - len(deduped_frame)),
        "missing_creator_key_rows": int((frame["creator_key"] == "").sum()),
        "source_rows_distribution": {str(int(k)): int(v) for k, v in distribution.items()},
        "source_rows_summary": {
            "min": int(source_row_counts.min()),
            "p50": float(source_row_counts.median()),
            "mean": float(source_row_counts.mean()),
            "max": int(source_row_counts.max()),
        },
    }


def _dedupe_frame(frame: pd.DataFrame) -> pd.DataFrame:
    working = frame.copy()
    working["creator_key"] = _build_creator_key(working)
    working["_missing_key"] = working["creator_key"] == ""
    working["_filled_count"] = working.notna().sum(axis=1)
    working["_抓取时间排序"] = pd.to_datetime(working["抓取时间"], errors="coerce")
    working["_source_row_number"] = range(2, len(working) + 2)

    fallback_mask = working["creator_key"] == ""
    if fallback_mask.any():
        working.loc[fallback_mask, "creator_key"] = working.loc[fallback_mask].apply(
            lambda row: f"missing_key_row_{int(row['_source_row_number'])}",
            axis=1,
        )

    source_counts = working.groupby("creator_key").size().rename("_source_rows")
    ranking = working.sort_values(
        by=["creator_key", "_filled_count", "_抓取时间排序", "_source_row_number"],
        ascending=[True, False, False, True],
    )
    deduped = ranking.drop_duplicates(subset=["creator_key"], keep="first").copy()
    deduped = deduped.merge(source_counts, on="creator_key", how="left")
    deduped = deduped.sort_values(by=["_source_rows", "_filled_count"], ascending=[False, False])
    return deduped


def run_stage_one() -> dict[str, Any]:
    ensure_runtime_dirs()
    settings = load_settings()
    source_file = resolve_source_file(settings)
    frame = pd.read_excel(source_file, sheet_name=SHEET_NAME)

    field_stats = _build_field_stats(frame)
    deduped = _dedupe_frame(frame)
    dedupe_stats = _build_dedupe_stats(deduped if False else frame.assign(creator_key=_build_creator_key(frame)), deduped)

    field_stats_path = CACHE_DIR / "field_stats.json"
    dedupe_stats_path = CACHE_DIR / "dedupe_stats.json"
    preview_path = CACHE_DIR / "creators_clean_preview.csv"

    field_stats_path.write_text(json.dumps(field_stats, ensure_ascii=False, indent=2), encoding="utf-8")
    dedupe_stats_path.write_text(json.dumps(dedupe_stats, ensure_ascii=False, indent=2), encoding="utf-8")

    preview_columns = [
        "creator_key",
        "昵称",
        "小红书号",
        "userId",
        "小红书主页URL",
        "地域",
        "身份|人设",
        "内容类目|标签",
        "抓取关键词",
        "抓取时间",
        "_source_rows",
    ]
    available_columns = [col for col in preview_columns if col in deduped.columns]
    deduped[available_columns].head(200).to_csv(preview_path, index=False, encoding="utf-8-sig")

    return {
        "source_file": str(source_file),
        "sheet_name": SHEET_NAME,
        "raw_rows": int(len(frame)),
        "deduped_rows": int(len(deduped)),
        "duplicate_rows": int(len(frame) - len(deduped)),
        "missing_creator_key_rows": int((frame.assign(creator_key=_build_creator_key(frame))["creator_key"] == "").sum()),
        "field_stats_path": str(field_stats_path),
        "dedupe_stats_path": str(dedupe_stats_path),
        "preview_path": str(preview_path),
    }
