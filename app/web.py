from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from core.paths import CACHE_DIR, CONFIG_DIR, OUTPUT_DIR, ROOT_DIR, ensure_runtime_dirs
from services.ai_recommendation import (
    AI_CACHE_FILE,
    AI_TRANSLATION_CACHE_FILE,
    _build_prompt,
    _call_deepseek,
    _generate_fallback,
    _get_api_key,
    _parse_ai_response,
    _read_json,
    has_deepseek_api_key,
    run_ai_recommendations,
    translate_ai_texts,
)
from services.v2_state import (
    add_to_group,
    append_review_log,
    build_contact_summary,
    build_v2_report_data,
    build_review_disagreements,
    create_analysis_run_for_batch,
    create_batch,
    create_group,
    delete_batch,
    delete_group,
    detect_csv_fields,
    ensure_v2_baseline,
    ensure_v2_state_files,
    export_v2_report_json,
    export_v2_report_markdown,
    get_batch_csv_path,
    get_contact_record,
    get_field_completeness,
    get_group_detail,
    get_quote_record,
    get_rule_replay_suggestions,
    get_task,
    list_analysis_runs,
    list_batches,
    list_contact_records,
    list_groups,
    list_quote_records,
    list_review_logs,
    list_rule_versions,
    remove_from_group,
    rename_batch,
    rename_group,
    run_async_group_ai_review,
    save_contact_record,
    save_quote_record,
    save_review_log,
    toggle_batch_favorite,
)
from services.scoring import score_excel_to_csv
from services.data_cleaning import clean_dataframe, build_cleaning_summary

MANUAL_REVIEWS_FILE = CACHE_DIR / "manual_reviews.json"
SCORES_CSV = OUTPUT_DIR / "scores_full.csv"
SUMMARY_JSON = CACHE_DIR / "scoring_summary.json"
FAVICON_FILE = ROOT_DIR / "static" / "favicon.svg"

APP_VERSION = "v8a-dashboard-a1"

templates = Jinja2Templates(directory=str(ROOT_DIR / "templates"))

app = FastAPI(title="全球达人情报系统", version=APP_VERSION)
app.mount("/static", StaticFiles(directory=str(ROOT_DIR / "static")), name="static")

_state: dict[str, Any] = {
    "data_key": None,
    "scores_df": pd.DataFrame(),
    "summary": {},
    "ai_cache": {},
    "manual_reviews": {},
    "rules": {},
    "active_batch_id": "",
    "active_batch_csv_path": "",
}

CHINA_REGIONS = {
    "北京",
    "上海",
    "天津",
    "重庆",
    "河北",
    "山西",
    "辽宁",
    "吉林",
    "黑龙江",
    "江苏",
    "浙江",
    "安徽",
    "福建",
    "江西",
    "山东",
    "河南",
    "湖北",
    "湖南",
    "广东",
    "海南",
    "四川",
    "贵州",
    "云南",
    "陕西",
    "甘肃",
    "青海",
    "台湾",
    "内蒙古",
    "广西",
    "西藏",
    "宁夏",
    "新疆",
    "香港",
    "澳门",
}
COUNTRY_MAP = {
    "中国": ("中国", "China"),
    "韩国": ("韩国", "South Korea"),
    "日本": ("日本", "Japan"),
    "美国": ("美国", "United States"),
    "英国": ("英国", "United Kingdom"),
    "法国": ("法国", "France"),
    "德国": ("德国", "Germany"),
    "意大利": ("意大利", "Italy"),
    "西班牙": ("西班牙", "Spain"),
    "加拿大": ("加拿大", "Canada"),
    "澳大利亚": ("澳大利亚", "Australia"),
    "新加坡": ("新加坡", "Singapore"),
    "泰国": ("泰国", "Thailand"),
    "马来西亚": ("马来西亚", "Malaysia"),
    "荷兰": ("荷兰", "Netherlands"),
    "智利": ("智利", "Chile"),
    "爱尔兰": ("爱尔兰", "Ireland"),
    "菲律宾": ("菲律宾", "Philippines"),
    "印度尼西亚": ("印度尼西亚", "Indonesia"),
}
REAL_AI_DECISIONS = {"recommend", "cautious", "reject"}
AI_STATUS_ORDER = ["success", "fallback", "pending", "failed"]
AI_DECISION_ORDER = ["recommend", "cautious", "reject"]
AI_ALIGNMENT_ORDER = ["consistent", "soft_divergence", "hard_conflict", "unknown"]
MANUAL_DECISION_ORDER = ["pending", "recommend", "cautious", "reject", "reviewed"]
DIMENSION_LABELS = {
    "score_layered_match": "dimension.layered_match",
    "score_keyword_combo": "dimension.keyword_combo",
    "score_korea_brand": "dimension.korea_brand",
    "score_cooperation_potential": "dimension.cooperation_potential",
    "score_performance": "dimension.performance",
    "score_cost_effectiveness": "dimension.cost_effectiveness",
}
WEIGHT_LABELS = {
    "layered_match": "dimension.layered_match",
    "keyword_combo": "dimension.keyword_combo",
    "korea_brand": "dimension.korea_brand",
    "cooperation_potential": "dimension.cooperation_potential",
    "performance": "dimension.performance",
    "cost_effectiveness": "dimension.cost_effectiveness",
}


@app.on_event("startup")
def on_startup() -> None:
    ensure_runtime_dirs()
    ensure_v2_state_files()
    _refresh_state(force=True)


def _safe_mtime(path: Path) -> float:
    return path.stat().st_mtime if path.exists() else 0.0


def _scores_csv_path() -> Path:
    """返回当前活跃批次的 CSV 路径，活跃批次为空时回退到默认 scores_full.csv。"""
    if _state.get("active_batch_csv_path"):
        return Path(_state["active_batch_csv_path"])
    if _state.get("active_batch_id"):
        p = get_batch_csv_path(_state["active_batch_id"])
        if p.exists():
            return p
    return SCORES_CSV


def _current_data_key() -> tuple[float, float, float, float, float, str]:
    return (
        _safe_mtime(_scores_csv_path()),
        _safe_mtime(SUMMARY_JSON),
        _safe_mtime(AI_CACHE_FILE),
        _safe_mtime(AI_TRANSLATION_CACHE_FILE),
        _safe_mtime(MANUAL_REVIEWS_FILE),
        _state.get("active_batch_id", ""),
    )


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _load_rules() -> dict[str, Any]:
    return _read_json(CONFIG_DIR / "default_rules.json", {})


def _refresh_state(force: bool = False) -> None:
    data_key = _current_data_key()
    if not force and _state["data_key"] == data_key:
        return

    _state["_cached_enriched_key"] = None
    _state["_cached_enriched_df"] = None

    scores_df = pd.read_csv(_scores_csv_path(), encoding="utf-8-sig") if _scores_csv_path().exists() else pd.DataFrame()
    _state.update(
        {
            "data_key": data_key,
            "scores_df": scores_df,
            "summary": _read_json(SUMMARY_JSON, {}),
            "ai_cache": _read_json(AI_CACHE_FILE, {}),
            "manual_reviews": _read_json(MANUAL_REVIEWS_FILE, {}),
            "rules": _load_rules(),
        }
    )
    ensure_v2_baseline(summary=_state["summary"], rules=_state["rules"], scores_df=scores_df)


def _replace_nan(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _replace_nan(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_replace_nan(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value) or np.isinf(value):
            return None
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        return value
    return value


def _creator_key_from_mapping(item: dict[str, Any]) -> str:
    for key in ("userId", "小红书号", "小红书主页URL", "rank"):
        value = item.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text and text.lower() != "nan":
            return text
    return "unknown"


def _parse_country_info(region: Any) -> tuple[str, str | None]:
    value = str(region).strip() if pd.notna(region) else ""
    if not value:
        return "未知地区", None
    first = value.split()[0]
    if first in CHINA_REGIONS:
        return "中国", "China"
    if first in COUNTRY_MAP:
        return COUNTRY_MAP[first]
    return first, None


def _normalize_ai_status(ai_record: dict[str, Any] | None) -> str:
    if not ai_record:
        return "pending"
    status = str(ai_record.get("status", "pending") or "pending")
    return status if status in {"success", "fallback", "pending", "failed"} else "pending"


def _normalize_ai_decision(ai_record: dict[str, Any] | None) -> str:
    if not ai_record:
        return "unknown"
    decision = str(ai_record.get("ai_decision", "unknown") or "unknown")
    return decision if decision in REAL_AI_DECISIONS else "unknown"


def classify_ai_alignment(rule_grade: str | None, ai_status: str | None, ai_decision: str | None) -> dict[str, Any]:
    grade = (rule_grade or "").strip().upper()
    status = (ai_status or "").strip()
    decision = (ai_decision or "").strip()

    if status != "success" or decision not in REAL_AI_DECISIONS:
        return {
            "level": "unknown",
            "is_real_ai": False,
            "is_conflict": False,
            "is_hard_conflict": False,
            "is_soft_divergence": False,
        }

    if (grade in {"S", "A"} and decision == "reject") or (grade == "D" and decision == "recommend"):
        return {
            "level": "hard_conflict",
            "is_real_ai": True,
            "is_conflict": True,
            "is_hard_conflict": True,
            "is_soft_divergence": False,
        }

    if (grade in {"S", "A"} and decision == "recommend") or (grade in {"B", "C"} and decision == "cautious") or (grade == "D" and decision == "reject"):
        return {
            "level": "consistent",
            "is_real_ai": True,
            "is_conflict": False,
            "is_hard_conflict": False,
            "is_soft_divergence": False,
        }

    return {
        "level": "soft_divergence",
        "is_real_ai": True,
        "is_conflict": True,
        "is_hard_conflict": False,
        "is_soft_divergence": True,
    }


def _serialize_ai_recommendation(
    *,
    rank_key: str,
    ai_record: dict[str, Any] | None,
    rule_grade: str | None,
) -> dict[str, Any] | None:
    if not ai_record:
        return None

    payload = {key: _replace_nan(value) for key, value in ai_record.items()}
    status = _normalize_ai_status(ai_record)
    decision = _normalize_ai_decision(ai_record)
    alignment = classify_ai_alignment(rule_grade, status, decision)
    payload.update(
        {
            "status": status,
            "ai_decision": decision,
            "creator_key": rank_key,
            "alignment_level": alignment["level"],
            "is_real_ai": alignment["is_real_ai"],
            "is_conflict": alignment["is_conflict"],
            "is_hard_conflict": alignment["is_hard_conflict"],
            "is_soft_divergence": alignment["is_soft_divergence"],
        }
    )
    return payload


def _build_fallback_localized_payload(row: pd.Series, ai_record: dict[str, Any], language: str) -> dict[str, Any]:
    locale = language if language in {"zh-CN", "en", "ko"} else "zh-CN"
    fans = float(row.get("粉丝数") or 0)
    score = float(row.get("score_final") or 0)

    text = {
        "zh-CN": {
            "summary.cautious": "规则模板判断：建议谨慎测试或人工复核",
            "summary.reject": "规则模板判断：当前不建议优先合作",
            "summary.default": "规则模板判断：建议结合人工复核再决定",
            "reason.fans": "粉丝规模较大，具备基础曝光能力",
            "reason.content": "内容标签与目标方向存在一定匹配",
            "reason.korea": "存在韩国相关内容信号",
            "reason.brand": "已命中品牌相关关键词",
            "reason.score": "规则综合评分处于较高区间",
            "reason.default": "模板基于规则评分结果生成",
            "risk.rule": "存在规则侧风险项，需人工复核",
            "risk.er": "合作ER偏低，建议谨慎验证转化效果",
            "risk.identity": "部分画像信息不足，建议补充核验",
            "risk.default": "此结果为规则模板，不代表真实AI调用",
            "suggestion.test": "建议先用小预算测试合作效果",
            "suggestion.manual": "建议结合人工复核后再决定是否合作",
            "hint": "当前为规则模板，未进行真实AI翻译或复核调用",
            "conflict": "规则模板结果不参与真实AI冲突统计",
        },
        "en": {
            "summary.cautious": "Rule template suggests a cautious trial or manual review.",
            "summary.reject": "Rule template suggests not prioritizing cooperation at this stage.",
            "summary.default": "Rule template suggests making the final decision after manual review.",
            "reason.fans": "The creator has a meaningful follower base for baseline exposure.",
            "reason.content": "Content tags show partial alignment with the target direction.",
            "reason.korea": "There are Korea-related content signals.",
            "reason.brand": "Brand-related keywords were matched.",
            "reason.score": "The rule-based score is in a relatively strong range.",
            "reason.default": "This recommendation is generated from rule-based scoring.",
            "risk.rule": "Rule-based risk items were detected and should be manually reviewed.",
            "risk.er": "Cooperation ER is low and should be validated carefully.",
            "risk.identity": "Some profile signals are incomplete and need verification.",
            "risk.default": "This is a rule fallback result, not a real AI call.",
            "suggestion.test": "Start with a small-budget trial to validate conversion quality.",
            "suggestion.manual": "Confirm the decision through manual review before cooperation.",
            "hint": "This is a rule fallback result and was not translated by a live AI call.",
            "conflict": "Rule fallback records are excluded from real AI conflict statistics.",
        },
        "ko": {
            "summary.cautious": "규칙 템플릿 기준으로 신중한 테스트 또는 수동 검토가 필요합니다.",
            "summary.reject": "규칙 템플릿 기준으로 현재는 우선 협업 비추천입니다.",
            "summary.default": "규칙 템플릿 기준으로 수동 검토 후 최종 판단을 권장합니다.",
            "reason.fans": "기본 노출을 기대할 수 있는 팔로워 규모를 보유하고 있습니다.",
            "reason.content": "콘텐츠 태그가 목표 방향과 일부 맞닿아 있습니다.",
            "reason.korea": "한국 관련 콘텐츠 신호가 존재합니다.",
            "reason.brand": "브랜드 관련 키워드가 적중했습니다.",
            "reason.score": "규칙 기반 종합 점수가 비교적 높은 편입니다.",
            "reason.default": "이 결과는 규칙 점수 기반 템플릿으로 생성되었습니다.",
            "risk.rule": "규칙 측 리스크 항목이 있어 수동 확인이 필요합니다.",
            "risk.er": "협업 ER이 낮아 실제 전환 효과를 신중히 검증해야 합니다.",
            "risk.identity": "프로필 정보가 일부 부족해 추가 확인이 필요합니다.",
            "risk.default": "이 결과는 실제 AI 호출이 아닌 규칙 fallback 결과입니다.",
            "suggestion.test": "소규모 예산으로 먼저 테스트 협업을 권장합니다.",
            "suggestion.manual": "최종 협업 여부는 수동 검토 후 결정하세요.",
            "hint": "현재 결과는 규칙 템플릿이며 실제 AI 번역/복호 호출이 아닙니다.",
            "conflict": "규칙 fallback 결과는 실제 AI 충돌 통계에 포함되지 않습니다.",
        },
    }[locale]

    reasons: list[str] = []
    if fans >= 300000:
        reasons.append(text["reason.fans"])
    if str(row.get("hit_content_keywords") or "").strip():
        reasons.append(text["reason.content"])
    if str(row.get("hit_korea_keywords") or "").strip():
        reasons.append(text["reason.korea"])
    if str(row.get("hit_brand_keywords") or "").strip():
        reasons.append(text["reason.brand"])
    if score >= 65:
        reasons.append(text["reason.score"])
    if not reasons:
        reasons.append(text["reason.default"])

    risks: list[str] = []
    raw_risk = str(row.get("risk_reasons") or "")
    if raw_risk:
        risks.append(text["risk.rule"])
        if "ER" in raw_risk:
            risks.append(text["risk.er"])
        if "身份" in raw_risk or "画像" in raw_risk:
            risks.append(text["risk.identity"])
    if not risks:
        risks.append(text["risk.default"])

    decision = _normalize_ai_decision(ai_record)
    summary_key = f"summary.{decision}" if f"summary.{decision}" in text else "summary.default"

    return {
        "summary": text[summary_key],
        "reasons": reasons[:4],
        "risks": risks[:4],
        "collab_suggestions": [text["suggestion.test"], text["suggestion.manual"]],
        "review_hint": text["hint"],
        "conflict_reason": text["conflict"],
    }


def _load_enriched_df() -> pd.DataFrame:
    _refresh_state()
    data_key = _state.get("data_key")
    if data_key and _state.get("_cached_enriched_key") == data_key and _state.get("_cached_enriched_df") is not None:
        return _state["_cached_enriched_df"]

    df = _state["scores_df"].copy()
    if df.empty:
        return df

    ai_cache: dict[str, dict[str, Any]] = _state["ai_cache"]
    manual_reviews: dict[str, dict[str, Any]] = _state["manual_reviews"]

    # Vectorized enrichment — 100x faster than iterrows()
    ranks = df["rank"].astype(int).astype(str)
    df["platform"] = "小红书"
    df["creator_key"] = [_creator_key_from_mapping(row.to_dict()) for _, row in df.iterrows()]

    # Country / region (vectorized)
    parsed_regions = [_parse_country_info(r) for r in df["地域"].fillna("")]
    df["country_label"] = [p[0] for p in parsed_regions]
    df["country_map_name"] = [p[1] for p in parsed_regions]
    df["region_display"] = df["地域"].fillna("未知地区").astype(str)

    # AI columns (vectorized)
    df["ai_status"] = ranks.map(lambda k: _normalize_ai_status(ai_cache.get(k)))
    df["ai_decision"] = ranks.map(lambda k: _normalize_ai_decision(ai_cache.get(k)))

    alignments = [
        classify_ai_alignment(g, df["ai_status"].iloc[i], df["ai_decision"].iloc[i])
        for i, g in enumerate(df["grade_short"])
    ]
    df["ai_alignment_level"] = [a["level"] for a in alignments]
    df["ai_conflict"] = [a["is_conflict"] for a in alignments]
    df["ai_hard_conflict"] = [a["is_hard_conflict"] for a in alignments]
    df["ai_soft_divergence"] = [a["is_soft_divergence"] for a in alignments]

    # Manual review columns (vectorized)
    df["manual_status"] = ranks.map(lambda k: manual_reviews.get(k, {}).get("decision", "pending"))
    df["manual_updated_at"] = ranks.map(lambda k: manual_reviews.get(k, {}).get("updated_at", ""))
    df["manual_note_safe"] = ranks.map(lambda k: manual_reviews.get(k, {}).get("note", ""))

    _state["_cached_enriched_key"] = data_key
    _state["_cached_enriched_df"] = df
    return df


def _keyword_top(series: pd.Series, limit: int = 10) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for value in series.fillna(""):
        for keyword in [item.strip() for item in str(value).split(",") if item.strip()]:
            counter[keyword] += 1
    return [{"name": name, "value": value} for name, value in counter.most_common(limit)]


def _distribution(df: pd.DataFrame, column: str, ordered_keys: list[str]) -> list[dict[str, Any]]:
    counts = df[column].fillna("unknown").astype(str).value_counts().to_dict()
    return [{"name": key, "value": int(counts.get(key, 0))} for key in ordered_keys]


def _recent_manual_reviews(df: pd.DataFrame, limit: int = 6) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for rank, review in _state["manual_reviews"].items():
        matched = df[df["rank"] == int(rank)]
        if matched.empty:
            continue
        creator = matched.iloc[0]
        rows.append(
            {
                "rank": int(rank),
                "nickname": creator["昵称"],
                "decision": review.get("decision", "pending"),
                "note": review.get("note", ""),
                "updated_at": review.get("updated_at", ""),
                "region": creator["country_label"],
                "grade": creator["grade_short"],
            }
        )
    rows.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    return rows[:limit]


def _serialize_creator(row: pd.Series) -> dict[str, Any]:
    payload = {column: _replace_nan(row[column]) for column in row.index}
    rank_key = str(int(row["rank"]))
    payload["manual_review"] = _state["manual_reviews"].get(rank_key)
    payload["ai_recommendation"] = _serialize_ai_recommendation(
        rank_key=row.get("creator_key", rank_key),
        ai_record=_state["ai_cache"].get(rank_key),
        rule_grade=row.get("grade_short"),
    )
    return payload


def _apply_creator_filters(
    df: pd.DataFrame,
    *,
    view: str,
    grade: str,
    search: str,
    exclude: str,
    country: str,
    platform: str,
    ai_status: str,
    manual_status: str,
) -> pd.DataFrame:
    filtered = df.copy()

    if grade:
        filtered = filtered[filtered["grade_short"] == grade]
    if country:
        filtered = filtered[filtered["country_label"] == country]
    if platform:
        filtered = filtered[filtered["platform"] == platform]
    if ai_status:
        filtered = filtered[filtered["ai_status"] == ai_status]
    if manual_status:
        filtered = filtered[filtered["manual_status"] == manual_status]

    if search:
        term = search.strip()
        search_fields = []
        for col, val in filtered.items():
            if col in ("昵称", "creator_key", "hit_content_keywords", "hit_korea_keywords",
                        "hit_brand_keywords", "地域", "country_label", "全部报价",
                        "内容类目|标签", "抓取关键词", "grade_short", "recommend_grade"):
                if val.dtype == "object":
                    search_fields.append(val.astype(str).str.contains(term, case=False, na=False))
        if search_fields:
            mask = pd.concat(search_fields, axis=1).any(axis=1)
            filtered = filtered[mask]
        else:
            filtered = filtered.iloc[:0]

    if exclude == "only":
        filtered = filtered[filtered["exclude_flag"] == True]
    elif exclude == "hide":
        filtered = filtered[filtered["exclude_flag"] != True]

    if view == "top10":
        filtered = filtered[filtered["rank"] <= 10]
    elif view == "top50":
        filtered = filtered[filtered["rank"] <= 50]

    return filtered


def _sort_creators(df: pd.DataFrame, sort_by: str, sort_order: str) -> pd.DataFrame:
    sort_column_map = {
        "rank": "rank",
        "nickname": "昵称",
        "country": "country_label",
        "grade": "grade_short",
        "score": "score_final",
        "fans": "粉丝数",
        "price": "全部报价",
        "cooperation_er": "合作笔记ER",
        "ai_status": "ai_status",
        "ai_decision": "ai_decision",
        "alignment": "ai_alignment_level",
        "manual_status": "manual_status",
    }
    column = sort_column_map.get(sort_by, "rank")
    ascending = sort_order != "desc"
    return df.sort_values(by=[column, "rank"], ascending=[ascending, True])


def _paginate(df: pd.DataFrame, page: int, per_page: int) -> tuple[pd.DataFrame, int]:
    total = len(df)
    start = (page - 1) * per_page
    end = start + per_page
    return df.iloc[start:end], total


def _build_ai_metrics(df: pd.DataFrame) -> dict[str, Any]:
    top50 = df[df["rank"] <= 50].copy()
    success_df = top50[top50["ai_status"] == "success"].copy()
    fallback_df = top50[top50["ai_status"] == "fallback"].copy()
    pending_count = max(0, len(top50) - len(success_df) - len(fallback_df))
    failed_count = int((top50["ai_status"] == "failed").sum())

    decision_counts = Counter(success_df["ai_decision"].astype(str).tolist())
    alignment_counts = Counter(success_df["ai_alignment_level"].astype(str).tolist())
    decision_base = len(success_df)

    decision_distribution = []
    for key in AI_DECISION_ORDER:
        count = int(decision_counts.get(key, 0))
        pct = round((count / decision_base * 100), 2) if decision_base else 0.0
        decision_distribution.append({"name": key, "value": count, "pct": pct})

    alignment_distribution = []
    for key in AI_ALIGNMENT_ORDER:
        count = int(alignment_counts.get(key, 0))
        pct = round((count / decision_base * 100), 2) if decision_base and key != "unknown" else 0.0
        alignment_distribution.append({"name": key, "value": count, "pct": pct})

    return {
        "top50_total": int(len(top50)),
        "real_success_count": int(len(success_df)),
        "fallback_count": int(len(fallback_df)),
        "pending_count": int(pending_count),
        "failed_count": int(failed_count),
        "real_coverage_all": round((len(success_df) / len(df) * 100), 2) if len(df) else 0.0,
        "total_coverage_all": round(((len(success_df) + len(fallback_df)) / len(df) * 100), 2) if len(df) else 0.0,
        "decision_base_count": int(decision_base),
        "decision_distribution": decision_distribution,
        "alignment_distribution": alignment_distribution,
        "consistent_count": int(alignment_counts.get("consistent", 0)),
        "soft_divergence_count": int(alignment_counts.get("soft_divergence", 0)),
        "hard_conflict_count": int(alignment_counts.get("hard_conflict", 0)),
        "unknown_count": int(len(fallback_df) + pending_count + failed_count),
    }


def _dashboard_payload() -> dict[str, Any]:
    df = _load_enriched_df()
    summary = _state["summary"]

    if df.empty:
        return {
            "version": APP_VERSION,
            "project_name": "全球达人情报系统",
            "total_creators": 0,
            "top50_count": 0,
            "final_score_avg": 0,
            "ai_real_review_count": 0,
            "ai_real_coverage": 0,
            "ai_total_review_count": 0,
            "ai_total_coverage": 0,
            "pending_manual_count": 0,
            "hard_conflict_count": 0,
            "soft_divergence_count": 0,
            "consistent_count": 0,
            "unknown_ai_count": 0,
            "last_data_updated": None,
            "charts": {},
            "recent_manual_reviews": [],
            "ai_status_overview": {},
            "platforms": ["小红书"],
            "countries": [],
            "manual_review_total": 0,
            "data_source_note_key": "note.no_data",
            "ai_source_note_key": "note.no_ai_data",
            "field_completeness": {},
        }

    top10 = df[df["rank"] <= 10]
    top50 = df[df["rank"] <= 50]
    grade_distribution = _distribution(df, "grade_short", ["S", "A", "B", "C", "D"])
    ai_metrics = _build_ai_metrics(df)
    pending_manual_count = int((top50["manual_status"] == "pending").sum())

    country_counts = df["country_label"].fillna("未知地区").astype(str).value_counts().head(10)
    region_chart = [{"name": name, "value": int(value)} for name, value in country_counts.items()]

    map_counts: dict[str, int] = {}
    unknown_total = 0
    for _, row in df.iterrows():
        map_name = row["country_map_name"]
        if map_name:
            map_counts[map_name] = map_counts.get(map_name, 0) + 1
        else:
            unknown_total += 1
    map_distribution = [{"name": name, "value": value} for name, value in sorted(map_counts.items(), key=lambda item: item[1], reverse=True)]
    if unknown_total:
        region_chart.append({"name": "未知地区", "value": unknown_total})

    latest_capture = pd.to_datetime(df["抓取时间"], errors="coerce").max()
    latest_manual = max((review.get("updated_at", "") for review in _state["manual_reviews"].values()), default="")

    # 字段完整性
    active_batch_id = _state.get("active_batch_id", "")
    field_comp = get_field_completeness(active_batch_id)
    key_fields = {}
    for fk, fv in (field_comp.get("field_completeness", {}).get("fields", {}) or {}).items():
        key_fields[fv.get("label", fk)] = fv.get("completeness", 0)

    return {
        "version": APP_VERSION,
        "project_name": "全球达人情报系统",
        "total_creators": int(len(df)),
        "top50_count": int(len(top50)),
        "final_score_avg": round(float(df["score_final"].mean()), 2),
        "ai_real_review_count": ai_metrics["real_success_count"],
        "ai_real_coverage": ai_metrics["real_coverage_all"],
        "ai_total_review_count": int(ai_metrics["real_success_count"] + ai_metrics["fallback_count"]),
        "ai_total_coverage": ai_metrics["total_coverage_all"],
        "pending_manual_count": pending_manual_count,
        "hard_conflict_count": ai_metrics["hard_conflict_count"],
        "soft_divergence_count": ai_metrics["soft_divergence_count"],
        "consistent_count": ai_metrics["consistent_count"],
        "unknown_ai_count": ai_metrics["unknown_count"],
        "manual_review_total": len(_state["manual_reviews"]),
        "last_data_updated": latest_capture.isoformat() if pd.notna(latest_capture) else None,
        "last_manual_reviewed_at": latest_manual or None,
        "platforms": ["小红书"],
        "countries": sorted(df["country_label"].fillna("未知地区").astype(str).unique().tolist()),
        "charts": {
            "top10_scores": [{"name": row["昵称"], "value": round(float(row["score_final"]), 2)} for _, row in top10.iterrows()],
            "grade_distribution": grade_distribution,
            "keyword_top10": _keyword_top(df["hit_content_keywords"], 10),
            "region_distribution": region_chart,
            "map_distribution": map_distribution,
        },
        "ai_status_overview": {
            "success": ai_metrics["real_success_count"],
            "fallback": ai_metrics["fallback_count"],
            "pending": ai_metrics["pending_count"],
            "failed": ai_metrics["failed_count"],
            "decision_base_count": ai_metrics["decision_base_count"],
            "decision_distribution": ai_metrics["decision_distribution"],
            "alignment_distribution": ai_metrics["alignment_distribution"],
            "consistent_count": ai_metrics["consistent_count"],
            "soft_divergence_count": ai_metrics["soft_divergence_count"],
            "hard_conflict_count": ai_metrics["hard_conflict_count"],
            "unknown_count": ai_metrics["unknown_count"],
        },
        "recent_manual_reviews": _recent_manual_reviews(df),
        "recent_ai_records": [
            {
                "rank": int(row["rank"]),
                "nickname": row["昵称"],
                "ai_status": row["ai_status"],
                "ai_decision": row["ai_decision"],
                "ai_alignment_level": row["ai_alignment_level"],
                "manual_status": row["manual_status"],
                "region": row["country_label"],
                "score_final": round(float(row["score_final"]), 2),
                "grade_short": row["grade_short"],
            }
            for _, row in top50.head(8).iterrows()
        ],
        "data_source_note_key": "note.data_source",
        "ai_source_note_key": "note.ai_source",
        "data_source_note_vars": {"total": len(df)},
        "ai_source_note_vars": {
            "success_count": ai_metrics['real_success_count'],
            "fallback_count": ai_metrics['fallback_count']
        },
        "legacy_summary": summary,
        "field_completeness": key_fields,
    }


def _resolve_v2_context(body: dict[str, Any]) -> dict[str, str]:
    batches = list_batches()
    runs = list_analysis_runs()
    rule_versions = list_rule_versions()
    latest_batch = batches[-1] if batches else {}
    latest_run = runs[-1] if runs else {}
    latest_rule_version = rule_versions[-1] if rule_versions else {}
    return {
        "batch_id": str(body.get("batch_id") or latest_batch.get("batch_id") or "default_batch"),
        "run_id": str(body.get("run_id") or latest_run.get("run_id") or "latest_run"),
        "rule_version": str(body.get("rule_version") or latest_rule_version.get("rule_version") or "rules_v1"),
    }


def _filter_options_payload() -> dict[str, Any]:
    df = _load_enriched_df()
    return {
        "countries": sorted(df["country_label"].fillna("未知地区").astype(str).unique().tolist()) if not df.empty else [],
        "platforms": ["小红书"],
        "grades": ["S", "A", "B", "C", "D"],
        "ai_statuses": AI_STATUS_ORDER,
        "ai_decisions": AI_DECISION_ORDER + ["unknown"],
        "alignment_levels": AI_ALIGNMENT_ORDER,
        "manual_statuses": MANUAL_DECISION_ORDER,
    }


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "app_version": APP_VERSION})


@app.get("/favicon.ico")
def favicon():
    if not FAVICON_FILE.exists():
        raise HTTPException(status_code=404, detail="favicon not found")
    return FileResponse(FAVICON_FILE, media_type="image/svg+xml", filename="favicon.svg")


@app.get("/api/dashboard")
def api_dashboard():
    return _dashboard_payload()


@app.get("/api/filter-options")
def api_filter_options():
    return _filter_options_payload()


@app.get("/api/v2/batches")
def api_v2_batches():
    _refresh_state()
    return {"items": list_batches(), "total": len(list_batches())}


@app.get("/api/v2/analysis-runs")
def api_v2_analysis_runs():
    _refresh_state()
    return {"items": list_analysis_runs(), "total": len(list_analysis_runs())}


@app.get("/api/v2/rule-versions")
def api_v2_rule_versions():
    _refresh_state()
    return {"items": list_rule_versions(), "total": len(list_rule_versions())}


@app.get("/api/v2/review-logs")
def api_v2_review_logs():
    _refresh_state()
    logs = sorted(list_review_logs(), key=lambda item: item.get("created_at", ""), reverse=True)
    return {"items": logs, "total": len(logs)}


@app.post("/api/v2/review-logs")
async def api_v2_save_review_log(request: Request):
    _refresh_state()
    body = await request.json()
    saved = save_review_log(body)
    return {"ok": True, "review_log": saved}


@app.get("/api/v2/review-disagreements")
def api_v2_review_disagreements():
    _refresh_state()
    payload = build_review_disagreements()
    payload["snapshot"] = get_rule_replay_suggestions()
    return payload


@app.get("/api/v2/contact-records")
def api_v2_contact_records():
    _refresh_state()
    items = sorted(list_contact_records(), key=lambda item: item.get("updated_at", ""), reverse=True)
    return {"items": items, "total": len(items)}


@app.post("/api/v2/contact-records")
async def api_v2_save_contact_record(request: Request):
    _refresh_state()
    body = await request.json()
    context = _resolve_v2_context(body)
    payload = {
        **body,
        "batch_id": body.get("batch_id") or context["batch_id"],
        "run_id": body.get("run_id") or context["run_id"],
        "updated_at": body.get("updated_at") or datetime.now().isoformat(),
    }
    saved = save_contact_record(payload)
    return {"ok": True, "contact_record": saved}


@app.get("/api/v2/quote-records")
def api_v2_quote_records():
    _refresh_state()
    items = sorted(list_quote_records(), key=lambda item: item.get("updated_at", ""), reverse=True)
    return {"items": items, "total": len(items)}


@app.post("/api/v2/quote-records")
async def api_v2_save_quote_record(request: Request):
    _refresh_state()
    body = await request.json()
    context = _resolve_v2_context(body)
    payload = {
        **body,
        "batch_id": body.get("batch_id") or context["batch_id"],
        "updated_at": body.get("updated_at") or datetime.now().isoformat(),
    }
    saved = save_quote_record(payload)
    return {"ok": True, "quote_record": saved}


@app.get("/api/v2/contact-summary")
def api_v2_contact_summary():
    _refresh_state()
    return build_contact_summary()


@app.get("/api/v2/report-data")
def api_v2_report_data():
    _refresh_state()
    return build_v2_report_data(
        scores_df=_state["scores_df"],
        summary=_state["summary"],
        rules=_state["rules"],
        ai_cache=_state["ai_cache"],
        manual_reviews=_state["manual_reviews"],
    )


@app.post("/api/v2/export-report")
def api_v2_export_report():
    _refresh_state()
    report_data = build_v2_report_data(
        scores_df=_state["scores_df"],
        summary=_state["summary"],
        rules=_state["rules"],
        ai_cache=_state["ai_cache"],
        manual_reviews=_state["manual_reviews"],
    )
    markdown_path = export_v2_report_markdown(report_data)
    json_path = export_v2_report_json(report_data)
    summary = report_data.get("summary", {})
    contact_summary = report_data.get("contact_summary", {})
    return {
        "ok": True,
        "files": {
            "markdown": str(markdown_path),
            "json": str(json_path),
        },
        "summary": {
            "creator_count": int(summary.get("creator_count", 0) or 0),
            "review_count": int(summary.get("review_count", 0) or 0),
            "contact_count": int(contact_summary.get("total", 0) or 0),
            "quote_count": int(summary.get("quote_count", 0) or 0),
            "shortlisted_count": int(summary.get("shortlisted_count", 0) or 0),
        },
    }


@app.get("/api/v2/batches/current")
def api_v2_batches_current():
    """返回当前活跃批次信息。"""
    _refresh_state()
    batches = list_batches()
    active_id = _state.get("active_batch_id", "")
    current = next((b for b in batches if b.get("batch_id") == active_id), None) if active_id else (batches[-1] if batches else None)
    return {
        "active_batch_id": active_id,
        "current": current,
        "all": batches,
        "total": len(batches),
    }


@app.post("/api/v2/batches/switch")
async def api_v2_batches_switch(request: Request):
    """切换活跃批次。"""
    body = await request.json()
    batch_id = str(body.get("batch_id", "") or "").strip()
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")

    batches = list_batches()
    if not any(b.get("batch_id") == batch_id for b in batches):
        raise HTTPException(status_code=404, detail=f"batch {batch_id} not found")

    _state["active_batch_id"] = batch_id
    _state["active_batch_csv_path"] = ""
    _refresh_state(force=True)
    batch = next(b for b in list_batches() if b.get("batch_id") == batch_id)
    return {"ok": True, "batch": batch}


@app.get("/api/v2/batches/compare")
def api_v2_batches_compare():
    """返回多批次对比数据。"""
    batches = list_batches()
    if not batches:
        return {"batches": [], "comparison": {}}

    result = []
    for b in batches:
        csv_path = get_batch_csv_path(b.get("batch_id", ""))
        grade_dist: dict[str, int] = {}
        avg_score = 0.0
        field_completeness = 0.0
        try:
            fe = b.get("field_completeness", {})
            if isinstance(fe, dict):
                field_completeness = fe.get("overall_optional_completeness", 0)
        except Exception:
            field_completeness = 0.0
        if csv_path.exists():
            try:
                df = pd.read_csv(csv_path, encoding="utf-8-sig")
                if "grade_short" in df.columns:
                    grade_dist = {str(k): int(v) for k, v in df["grade_short"].value_counts().items()}
                if "score_final" in df.columns and len(df) > 0:
                    avg_score = round(float(df["score_final"].mean()), 1)
            except Exception:
                pass
        result.append({
            "batch_id": b.get("batch_id", ""),
            "name": b.get("name", ""),
            "source_type": b.get("source_type", ""),
            "created_at": b.get("created_at", ""),
            "creator_count": int(b.get("creator_count", 0) or 0),
            "grade_distribution": grade_dist,
            "avg_final_score": avg_score,
            "field_completeness": field_completeness,
        })

    comparison = {}
    if len(result) >= 2:
        latest = result[-1]
        prev = result[-2]
        comparison = {
            "count_change": latest["creator_count"] - prev["creator_count"],
            "avg_score_change": round(latest["avg_final_score"] - prev["avg_final_score"], 1) if latest["avg_final_score"] and prev["avg_final_score"] else None,
        }

    return {"batches": result, "comparison": comparison}


@app.post("/api/v2/batches/rename")
async def api_v2_batches_rename(request: Request):
    """重命名批次。"""
    body = await request.json()
    batch_id = str(body.get("batch_id", "") or "").strip()
    new_name = str(body.get("name", "") or "").strip()
    if not batch_id or not new_name:
        raise HTTPException(status_code=400, detail="batch_id and name are required")
    result = rename_batch(batch_id, new_name)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "not found"))
    return result


@app.post("/api/v2/batches/delete")
async def api_v2_batches_delete(request: Request):
    """软删除批次及关联数据。"""
    body = await request.json()
    batch_id = str(body.get("batch_id", "") or "").strip()
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")
    active_id = _state.get("active_batch_id", "")
    result = delete_batch(batch_id, active_batch_id=active_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "not found"))
    return result


@app.post("/api/v2/batches/favorite")
async def api_v2_batches_favorite(request: Request):
    """收藏/取消收藏批次。"""
    body = await request.json()
    batch_id = str(body.get("batch_id", "") or "").strip()
    is_favorite = bool(body.get("is_favorite", False))
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")
    result = toggle_batch_favorite(batch_id, is_favorite)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "not found"))
    return result


@app.post("/api/v2/batches/preview-csv")
async def api_v2_batches_preview_csv(file: UploadFile):
    """预览 CSV 字段检测结果，不导入。"""
    import io

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="只支持 CSV 文件")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法解析 CSV: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV 文件为空")

    # 数据清洗
    df = clean_dataframe(df)
    cleaning_summary = build_cleaning_summary(df)

    field_report = detect_csv_fields(df)
    field_report["cleaning_summary"] = cleaning_summary
    return {"ok": True, "field_report": field_report, "filename": file.filename}


@app.post("/api/v2/batches/import-csv")
async def api_v2_batches_import_csv(file: UploadFile, batch_name: str = Form("")):
    """上传 CSV 文件并创建新批次。支持自定义批次名。"""
    import io
    import shutil

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="只支持 CSV 文件")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法解析 CSV: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV 文件为空")

    # 数据清洗
    df = clean_dataframe(df)

    # 字段检测
    field_report = detect_csv_fields(df)
    if not field_report["valid"]:
        missing = ", ".join(field_report["required_missing"])
        raise HTTPException(status_code=400, detail=f"缺少必含列: {missing}")

    cleaning_summary = build_cleaning_summary(df)
    field_report["cleaning_summary"] = cleaning_summary

    # 保存 CSV
    batch_input_dir = CACHE_DIR.parent / "input"
    batch_input_dir.mkdir(parents=True, exist_ok=True)

    # 使用用户自定义名或默认取文件名
    final_batch_name = (batch_name or "").strip() or file.filename.rsplit(".", 1)[0]
    rule_version = _normalize_rule_version(_state.get("rules") or _load_rules())

    # 先创建批次以获取 batch_id
    batch = create_batch(
        batch_name=final_batch_name,
        source_file=f"data/input/{final_batch_name}.csv",
        source_type="csv_import",
        creator_count=int(len(df)),
        field_completeness=field_report,
        note=f"Web上传: {file.filename}",
    )

    batch_id = batch["batch_id"]
    dest_path = get_batch_csv_path(batch_id)
    dest_path.write_bytes(content)

    # 创建 analysis run
    create_analysis_run_for_batch(batch_id, rule_version, int(len(df)), str(dest_path))

    # 切换为当前批次
    _state["active_batch_id"] = batch_id
    _state["active_batch_csv_path"] = str(dest_path)
    _refresh_state(force=True)

    return {
        "ok": True,
        "batch": batch,
        "field_report": field_report,
        "message": f"已导入 {len(df)} 条达人记录",
    }


@app.post("/api/v2/batches/import-excel")
async def api_v2_batches_import_excel(
    file: UploadFile,
    background_tasks: BackgroundTasks,
):
    """上传 Excel 文件 → 评分 → 创建批次（后台执行）。"""
    import io

    valid_ext = (file.filename or "").lower().endswith((".xlsx", ".xls"))
    if not valid_ext:
        raise HTTPException(status_code=400, detail="只支持 Excel 文件(.xlsx/.xls)")

    content = await file.read()
    batch_input_dir = CACHE_DIR.parent / "input"
    batch_input_dir.mkdir(parents=True, exist_ok=True)

    batch_name = (file.filename or "import").rsplit(".", 1)[0]
    raw_path = batch_input_dir / f"{batch_name}_raw_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    raw_path.write_bytes(content)

    # 先创建批次 placeholder
    rule_version = _normalize_rule_version(_state.get("rules") or _load_rules())
    batch = create_batch(
        batch_name=batch_name,
        source_file=str(raw_path),
        source_type="excel_import",
        creator_count=0,
        field_completeness={},
        note=f"Excel上传: {file.filename} (评分中...)",
    )
    batch_id = batch["batch_id"]
    csv_path = get_batch_csv_path(batch_id)

    background_tasks.add_task(_run_excel_scoring_task, batch_id, str(raw_path), str(csv_path), rule_version)

    return {
        "ok": True,
        "batch": batch,
        "message": f"Excel 已上传，后台评分中... batch_id={batch_id}",
    }


def _run_excel_scoring_task(batch_id: str, raw_path: str, csv_path: str, rule_version: str) -> None:
    """后台任务：执行 Excel 评分并更新批次。"""
    try:
        result = score_excel_to_csv(raw_path, csv_path)
        batches = list_batches()
        for b in batches:
            if b.get("batch_id") == batch_id:
                b["creator_count"] = result["creator_count"]
                b["note"] = f"Excel导入完成: {result['creator_count']} 条"
                break
        v2_state_module = __import__("services.v2_state", fromlist=["_save_items", "V2_BATCHES_FILE"])
        v2_state_module._save_items(v2_state_module.V2_BATCHES_FILE, batches)
        create_analysis_run_for_batch(batch_id, rule_version, result["creator_count"], csv_path)

        # 更新字段完整率
        if Path(csv_path).exists():
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
            field_report = detect_csv_fields(df)
            batches2 = list_batches()
            for b in batches2:
                if b.get("batch_id") == batch_id:
                    b["field_completeness"] = field_report
                    break
            v2_state_module._save_items(v2_state_module.V2_BATCHES_FILE, batches2)
    except Exception as e:
        # 标记批次失败
        batches = list_batches()
        for b in batches:
            if b.get("batch_id") == batch_id:
                b["note"] = f"Excel评分失败: {e}"
                break
        import services.v2_state as vs
        vs._save_items(vs.V2_BATCHES_FILE, batches)


def _normalize_rule_version(raw_rules: dict[str, Any]) -> str:
    version = str(raw_rules.get("version", "") or "").strip()
    return version or "rules_v1"


@app.get("/api/summary")
def api_summary():
    payload = _dashboard_payload()
    legacy = _state["summary"].copy()
    legacy.update(
        {
            "version": payload["version"],
            "total_creators": payload["total_creators"],
            "dimension_averages": {"final": payload["final_score_avg"]},
            "ai_total_review_count": payload["ai_total_review_count"],
            "ai_real_review_count": payload["ai_real_review_count"],
            "pending_manual_count": payload["pending_manual_count"],
            "conflict_count": payload["hard_conflict_count"],
            "hard_conflict_count": payload["hard_conflict_count"],
            "soft_divergence_count": payload["soft_divergence_count"],
            "consistent_count": payload["consistent_count"],
            "last_data_updated": payload["last_data_updated"],
        }
    )
    return legacy


@app.get("/api/creators")
def api_creators(
    view: str = Query(default="all"),
    grade: str = Query(default=""),
    search: str = Query(default=""),
    exclude: str = Query(default=""),
    country: str = Query(default=""),
    platform: str = Query(default=""),
    ai_status: str = Query(default=""),
    manual_status: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=200),
    sort_by: str = Query(default="rank"),
    sort_order: str = Query(default="asc"),
):
    df = _load_enriched_df()
    if df.empty:
        return {"creators": [], "total": 0, "page": page, "per_page": per_page}

    filtered = _apply_creator_filters(
        df,
        view=view,
        grade=grade,
        search=search,
        exclude=exclude,
        country=country,
        platform=platform,
        ai_status=ai_status,
        manual_status=manual_status,
    )
    filtered = _sort_creators(filtered, sort_by, sort_order)
    page_df, total = _paginate(filtered, page, per_page)

    columns = [
        "rank",
        "creator_key",
        "昵称",
        "platform",
        "country_label",
        "region_display",
        "grade_short",
        "recommend_grade",
        "score_final",
        "粉丝数",
        "全部报价",
        "合作笔记ER",
        "ai_status",
        "ai_decision",
        "ai_alignment_level",
        "ai_conflict",
        "ai_hard_conflict",
        "ai_soft_divergence",
        "manual_status",
        "manual_updated_at",
        "hit_content_keywords",
        "hit_korea_keywords",
        "hit_brand_keywords",
        "exclude_flag",
    ]
    available = [column for column in columns if column in page_df.columns]
    records = [_serialize_creator(row[available]) for _, row in page_df.iterrows()]
    return {"creators": records, "total": total, "page": page, "per_page": per_page}


@app.get("/api/creator/{rank}")
def api_creator_detail(rank: int):
    df = _load_enriched_df()
    if df.empty:
        raise HTTPException(status_code=404, detail="No score data available")

    matched = df[df["rank"] == rank]
    if matched.empty:
        raise HTTPException(status_code=404, detail=f"Creator rank={rank} not found")

    detail = matched.iloc[0].copy()
    payload = _serialize_creator(detail)
    payload["weights"] = _state["rules"].get("score_weights", {})
    payload["weight_labels"] = WEIGHT_LABELS
    payload["risk_deduction_max"] = _state["rules"].get("risk_deduction_max")
    payload["rule_note_key"] = "drawer.ruleNote"
    payload["contact_record"] = get_contact_record(
        creator_key=str(detail.get("creator_key") or rank),
        rank=str(rank),
    ) or {
        "creator_key": str(detail.get("creator_key") or rank),
        "rank": str(rank),
        "batch_id": "default_batch",
        "run_id": "latest_run",
        "contact_status": "not_contacted",
        "contact_channel": "",
        "owner": "",
        "contact_note": "",
        "next_follow_up_at": "",
        "is_shortlisted": False,
        "updated_at": "",
    }
    payload["quote_record"] = get_quote_record(
        creator_key=str(detail.get("creator_key") or rank),
        rank=str(rank),
    ) or {
        "creator_key": str(detail.get("creator_key") or rank),
        "rank": str(rank),
        "batch_id": "default_batch",
        "platform_reference_price": None,
        "inquiry_price": None,
        "final_price": None,
        "currency": "CNY",
        "price_note": "",
        "updated_at": "",
    }
    payload["score_dimensions"] = [
        {
            "key": key,
            "label": label,
            "value": _replace_nan(detail.get(key)),
        }
        for key, label in DIMENSION_LABELS.items()
    ]
    return payload


@app.get("/api/ai/reviews")
def api_ai_reviews(
    view: str = Query(default="all"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str = Query(default=""),
):
    df = _load_enriched_df()
    if df.empty:
        return {"records": [], "total": 0, "page": page, "per_page": per_page}

    ai_df = df[df["rank"] <= 50].copy()
    if view == "pending":
        ai_df = ai_df[ai_df["manual_status"] == "pending"]
    elif view == "hard_conflict":
        ai_df = ai_df[ai_df["ai_alignment_level"] == "hard_conflict"]
    elif view == "soft_divergence":
        ai_df = ai_df[ai_df["ai_alignment_level"] == "soft_divergence"]
    elif view == "consistent":
        ai_df = ai_df[ai_df["ai_alignment_level"] == "consistent"]
    elif view == "success":
        ai_df = ai_df[ai_df["ai_status"] == "success"]
    elif view == "fallback":
        ai_df = ai_df[ai_df["ai_status"] == "fallback"]

    if search:
        ai_df = ai_df[
            ai_df["昵称"].astype(str).str.contains(search, case=False, na=False)
            | ai_df["地域"].astype(str).str.contains(search, case=False, na=False)
        ]

    ai_df = ai_df.sort_values(by=["ai_hard_conflict", "ai_soft_divergence", "rank"], ascending=[False, False, True])
    page_df, total = _paginate(ai_df, page, per_page)
    columns = [
        "rank",
        "creator_key",
        "昵称",
        "platform",
        "country_label",
        "region_display",
        "grade_short",
        "score_final",
        "ai_status",
        "ai_decision",
        "ai_alignment_level",
        "ai_conflict",
        "ai_hard_conflict",
        "ai_soft_divergence",
        "manual_status",
        "manual_updated_at",
        "合作笔记ER",
        "粉丝数",
        "全部报价",
    ]
    available = [column for column in columns if column in page_df.columns]
    records = [_serialize_creator(row[available]) for _, row in page_df.iterrows()]
    ai_metrics = _build_ai_metrics(df)

    return {
        "records": records,
        "total": total,
        "page": page,
        "per_page": per_page,
        "coverage": {
            "total_top50": ai_metrics["top50_total"],
            "reviewed": int(ai_metrics["real_success_count"] + ai_metrics["fallback_count"]),
            "success": ai_metrics["real_success_count"],
            "fallback": ai_metrics["fallback_count"],
            "pending": ai_metrics["pending_count"],
            "failed": ai_metrics["failed_count"],
            "decision_base_count": ai_metrics["decision_base_count"],
            "consistent_count": ai_metrics["consistent_count"],
            "soft_divergence_count": ai_metrics["soft_divergence_count"],
            "hard_conflict_count": ai_metrics["hard_conflict_count"],
            "unknown_count": ai_metrics["unknown_count"],
            "decision_distribution": ai_metrics["decision_distribution"],
            "alignment_distribution": ai_metrics["alignment_distribution"],
        },
    }


@app.get("/api/download/{file_type}")
def api_download(file_type: str):
    _refresh_state()
    files = _state["summary"].get("output_files", {})
    file_map = {
        "excel": files.get("excel"),
        "full_csv": files.get("full_csv"),
        "top10_csv": files.get("top10_csv"),
        "top50_csv": files.get("top50_csv"),
    }
    path_str = file_map.get(file_type)
    if not path_str:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file_type}")
    path = Path(path_str)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    return FileResponse(path, filename=path.name)


@app.post("/api/ai/run")
async def api_ai_run(
    limit: int = Query(default=50, ge=1, le=50),
    force_refresh: bool = Query(default=False),
):
    _refresh_state()
    if _state["scores_df"].empty:
        raise HTTPException(status_code=400, detail="No score data")

    result = await run_ai_recommendations(limit=limit, force=force_refresh)
    _refresh_state(force=True)
    return {
        "has_api_key": result["has_api_key"],
        "total": result["total"],
        "success": result["success"],
        "fail": result["fail"],
        "fallback": result["fallback"],
        "cached": result["cached"],
        "total_cached": result["total_cached"],
        "total_success_cached": result["total_success_cached"],
        "total_fallback_cached": result["total_fallback_cached"],
    }


@app.get("/api/ai/status")
def api_ai_status():
    _refresh_state()
    df = _load_enriched_df()
    ai_metrics = _build_ai_metrics(df) if not df.empty else {
        "real_success_count": 0,
        "fallback_count": 0,
        "pending_count": 0,
        "failed_count": 0,
    }
    available = ai_metrics["real_success_count"] + ai_metrics["fallback_count"] > 0
    return {
        "available": available,
        "total": int(ai_metrics["real_success_count"] + ai_metrics["fallback_count"]),
        "success": ai_metrics["real_success_count"],
        "fallback": ai_metrics["fallback_count"],
        "pending": ai_metrics["pending_count"],
        "failed": ai_metrics["failed_count"],
        "translation_api_key_available": has_deepseek_api_key(),
    }


@app.post("/api/ai/translate")
async def api_ai_translate(request: Request):
    _refresh_state()
    body = await request.json()
    rank = str(body.get("rank", "")).strip()
    target_language = str(body.get("target_language", "zh-CN") or "zh-CN").strip()
    if not rank:
        raise HTTPException(status_code=400, detail="rank is required")

    df = _load_enriched_df()
    matched = df[df["rank"] == int(rank)]
    if matched.empty:
        raise HTTPException(status_code=404, detail=f"Creator rank={rank} not found")

    row = matched.iloc[0]
    ai_record = _state["ai_cache"].get(rank)
    if not ai_record:
        raise HTTPException(status_code=404, detail="AI review not found")

    creator_key = str(row.get("creator_key") or rank)
    ai_status = _normalize_ai_status(ai_record)
    original = _serialize_ai_recommendation(rank_key=creator_key, ai_record=ai_record, rule_grade=row.get("grade_short")) or ai_record

    if ai_status == "fallback":
        payload = _build_fallback_localized_payload(row, ai_record, target_language)
        return {
            "rank": int(rank),
            "creator_key": creator_key,
            "language": target_language,
            "cache_status": "fallback_template",
            "translated": target_language != "zh-CN",
            "used_original": target_language == "zh-CN",
            "source_kind": "fallback",
            "original": {
                "summary": ai_record.get("summary", ""),
                "reasons": ai_record.get("reasons", []),
                "risks": ai_record.get("risks", []),
                "collab_suggestions": ai_record.get("collab_suggestions", []),
                "review_hint": ai_record.get("review_hint", ""),
                "conflict_reason": ai_record.get("conflict_reason", ""),
            },
            "payload": payload,
            "meta": {
                "decision": original.get("ai_decision", "unknown"),
                "status": ai_status,
                "alignment_level": original.get("alignment_level", "unknown"),
                "rule_grade": row.get("grade_short"),
            },
        }

    translation = await translate_ai_texts(
        creator_key=creator_key,
        ai_record=ai_record,
        target_language=target_language,
    )
    return {
        "rank": int(rank),
        "creator_key": creator_key,
        "language": target_language,
        "cache_status": translation["cache_status"],
        "translated": translation["translated"],
        "used_original": translation["used_original"],
        "source_hash": translation["source_hash"],
        "source_kind": "success",
        "original": translation["original"],
        "payload": translation["payload"],
        "meta": {
            "decision": original.get("ai_decision", "unknown"),
            "status": ai_status,
            "alignment_level": original.get("alignment_level", "unknown"),
            "rule_grade": row.get("grade_short"),
        },
    }


@app.post("/api/manual/save")
def api_manual_save():
    raise HTTPException(status_code=400, detail="Use POST /api/manual/update instead")


@app.post("/api/manual/update")
async def api_manual_update(request: Request):
    _refresh_state()
    body = await request.json()
    rank = str(body.get("rank", "")).strip()
    if not rank:
        raise HTTPException(status_code=400, detail="rank is required")

    reviews = _read_json(MANUAL_REVIEWS_FILE, {})
    updated_at = body.get("updated_at") or datetime.now().isoformat()
    review = reviews.get(rank, {})
    review["rank"] = rank
    review["decision"] = body.get("decision", review.get("decision", "pending"))
    review["note"] = body.get("note", review.get("note", ""))
    review["reviewer"] = body.get("reviewer", review.get("reviewer", "人工"))
    review["reason_tags"] = body.get("reason_tags", review.get("reason_tags", []))
    review["updated_at"] = updated_at
    reviews[rank] = review
    MANUAL_REVIEWS_FILE.write_text(json.dumps(reviews, ensure_ascii=False, indent=2), encoding="utf-8")

    df = _load_enriched_df()
    matched = df[df["rank"] == int(rank)] if not df.empty else pd.DataFrame()
    creator = {}
    if not matched.empty:
        row = matched.iloc[0]
        creator = {
            "creator_key": row.get("creator_key", rank),
            "nickname": row.get("昵称", ""),
        }
    context = _resolve_v2_context(body)
    append_review_log(
        rank=rank,
        review=review,
        creator=creator,
        ai_record=_state["ai_cache"].get(rank),
        batch_id=context["batch_id"],
        run_id=context["run_id"],
        rule_version=context["rule_version"],
    )
    _refresh_state(force=True)
    return {"ok": True, "rank": rank, "review": review}


@app.get("/api/manual/list")
def api_manual_list():
    _refresh_state()
    return {"reviews": _state["manual_reviews"], "total": len(_state["manual_reviews"])}


# ── V2: Single Creator AI Reanalyze & History ──────────────────────────────────

def _normalize_ai_cache(record: dict[str, Any]) -> dict[str, Any]:
    """Upgrade old flat ai_cache record to history format in-place."""
    if "history" in record:
        return record
    # Old flat format: {summary, reasons, risks, ...}
    return {
        "history": [{**record, "version": 1, "created_at": record.get("created_at", "")}],
        "current_version": 1,
    }


def _ai_history_list(rank: str) -> list[dict[str, Any]]:
    record = _state["ai_cache"].get(rank, {})
    record = _normalize_ai_cache(record)
    return [
        {"version": h["version"], "created_at": h.get("created_at", ""),
         "ai_decision": h.get("ai_decision", ""),
         "ai_decision_label": h.get("ai_decision_label", ""),
         "summary": h.get("summary", "")[:120]}
        for h in record.get("history", [])
    ]


@app.post("/api/v2/creators/{rank}/reanalyze")
async def api_reanalyze_creator(rank: str):
    """Re-run AI analysis for a single creator and archive old version."""
    _refresh_state()
    context = _resolve_v2_context({})
    csv_path = get_batch_csv_path(context["batch_id"])
    if not csv_path.exists():
        raise HTTPException(404, "Current batch CSV not found")

    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    if "rank" not in df.columns:
        df["rank"] = range(1, len(df) + 1)
    matched = df[df["rank"].astype(str) == str(rank)]
    if matched.empty:
        raise HTTPException(404, f"Creator rank={rank} not found")

    row = matched.iloc[0]
    creator_dict = {col: row[col] for col in row.index if not pd.isna(row[col])}
    prompt = _build_prompt(creator_dict)

    api_key = _get_api_key()
    if api_key:
        try:
            raw = await _call_deepseek(
                prompt=prompt,
                api_key=api_key,
                system_prompt="你是一个专业的品牌达人筛选顾问。请严格按 JSON 格式输出。",
                max_tokens=600,
                temperature=0.3,
            )
            parsed = _parse_ai_response(raw) if raw else None
        except Exception as exc:
            print(f"[Reanalyze] rank={rank} DeepSeek error: {exc}")
            raw = None
            parsed = None
        if not parsed:
            parsed = _generate_fallback(creator_dict)
            parsed["status"] = "fallback"
        else:
            parsed["status"] = "success"
    else:
        parsed = _generate_fallback(creator_dict)
        parsed["status"] = "fallback"

    # Read + normalize existing AI cache
    cache = _read_json(AI_CACHE_FILE, {})
    existing = cache.get(rank, {})
    normalized = _normalize_ai_cache(existing)
    history = normalized["history"]
    new_version = len(history) + 1

    history.append({**parsed, "version": new_version, "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")})
    cache[rank] = {"history": history, "current_version": new_version}
    AI_CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

    _refresh_state(force=True)
    return {"ok": True, "rank": rank, "version": new_version, "result": parsed}


@app.get("/api/v2/creators/{rank}/ai-history")
def api_ai_history(rank: str):
    _refresh_state()
    return {"rank": rank, "versions": _ai_history_list(rank)}


@app.get("/api/v2/creators/{rank}/ai-history/{version}")
def api_ai_history_version(rank: str, version: int):
    _refresh_state()
    record = _state["ai_cache"].get(rank, {})
    record = _normalize_ai_cache(record)
    for h in record.get("history", []):
        if h.get("version") == version:
            return {"rank": rank, "version": version, "result": h}
    raise HTTPException(404, f"Version {version} not found for rank {rank}")


# ── V2: Group Management ──────────────────────────────────────────────────────

@app.get("/api/v2/groups")
def api_list_groups():
    items = list_groups()
    return {"items": items, "total": len(items)}


@app.post("/api/v2/groups")
def api_create_group(request: Request):
    import asyncio
    async def _body():
        return await request.json()
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    body = loop.run_until_complete(_body())
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(422, "name is required")
    creator_keys = body.get("creator_keys", [])
    batch_ids = body.get("batch_ids", [])
    note = body.get("note", "")
    entry = create_group(name=name, creator_keys=creator_keys, batch_ids=batch_ids, note=note)
    return {"ok": True, "group": entry}


@app.post("/api/v2/groups/{group_id}/add")
def api_group_add(group_id: str, request: Request):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    body = loop.run_until_complete(request.json())
    creator_keys = body.get("creator_keys", [])
    batch_ids = body.get("batch_ids")
    result = add_to_group(group_id, creator_keys, batch_ids)
    return result


@app.post("/api/v2/groups/{group_id}/remove")
def api_group_remove(group_id: str, request: Request):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    body = loop.run_until_complete(request.json())
    creator_keys = body.get("creator_keys", [])
    result = remove_from_group(group_id, creator_keys)
    return result


@app.post("/api/v2/groups/{group_id}/ai-review")
def api_group_ai_review(group_id: str):
    context = _resolve_v2_context({})
    try:
        task_id = run_async_group_ai_review(group_id, context["batch_id"])
        return {"ok": True, "task_id": task_id}
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.put("/api/v2/groups/{group_id}/rename")
def api_group_rename(group_id: str, request: Request):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    body = loop.run_until_complete(request.json())
    new_name = body.get("name", "").strip()
    if not new_name:
        raise HTTPException(422, "name is required")
    result = rename_group(group_id, new_name)
    return result


@app.delete("/api/v2/groups/{group_id}")
def api_delete_group(group_id: str):
    result = delete_group(group_id)
    return result


# ── V2: Task Polling ──────────────────────────────────────────────────────────

@app.get("/api/v2/tasks/{task_id}")
def api_get_task(task_id: str):
    task = get_task(task_id)
    if not task:
        raise HTTPException(404, "task not found")
    return task
