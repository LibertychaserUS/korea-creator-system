from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from core.paths import CACHE_DIR, CONFIG_DIR


V2_BATCHES_FILE = CACHE_DIR / "v2_batches.json"
V2_ANALYSIS_RUNS_FILE = CACHE_DIR / "v2_analysis_runs.json"
V2_RULE_VERSIONS_FILE = CACHE_DIR / "v2_rule_versions.json"
V2_REVIEW_LOGS_FILE = CACHE_DIR / "v2_review_logs.json"
V2_RULE_REPLAY_SUGGESTIONS_FILE = CACHE_DIR / "v2_rule_replay_suggestions.json"
V2_CONTACT_RECORDS_FILE = CACHE_DIR / "v2_contact_records.json"
V2_QUOTE_RECORDS_FILE = CACHE_DIR / "v2_quote_records.json"
V2_REPORTS_DIR = CACHE_DIR.parent / "exports" / "v2_reports"

V2_GROUPS_FILE = CACHE_DIR / "v2_groups.json"
V2_TASKS_FILE = CACHE_DIR / "v2_tasks.json"

V2_FILES: dict[Path, dict[str, Any]] = {
    V2_BATCHES_FILE: {"items": []},
    V2_ANALYSIS_RUNS_FILE: {"items": []},
    V2_RULE_VERSIONS_FILE: {"items": []},
    V2_REVIEW_LOGS_FILE: {"items": []},
    V2_RULE_REPLAY_SUGGESTIONS_FILE: {"generated_at": None, "rule_suggestions": []},
    V2_CONTACT_RECORDS_FILE: {"items": []},
    V2_QUOTE_RECORDS_FILE: {"items": []},
    V2_GROUPS_FILE: {"items": []},
    V2_TASKS_FILE: {"items": []},
}


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_v2_state_files() -> None:
    for path, default in V2_FILES.items():
        if not path.exists():
            _write_json(path, default)


def _load_items(path: Path) -> list[dict[str, Any]]:
    ensure_v2_state_files()
    payload = _read_json(path, {"items": []})
    items = payload.get("items", []) if isinstance(payload, dict) else []
    return items if isinstance(items, list) else []


def _save_items(path: Path, items: list[dict[str, Any]]) -> None:
    _write_json(path, {"items": items})


def _iso_now() -> str:
    return datetime.now().isoformat()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if pd.isna(value):
            return default
    except Exception:
        pass
    try:
        return int(float(value))
    except Exception:
        return default


def _normalize_rule_version(raw_rules: dict[str, Any]) -> str:
    version = str(raw_rules.get("version", "") or "").strip()
    return version or "rules_v1"


def _default_source_file(summary: dict[str, Any]) -> str:
    output_files = summary.get("output_files", {}) if isinstance(summary, dict) else {}
    return str(output_files.get("full_csv") or "data/output/scores_full.csv")


def ensure_v2_baseline(*, summary: dict[str, Any], rules: dict[str, Any], scores_df: pd.DataFrame) -> dict[str, Any]:
    ensure_v2_state_files()

    batches = _load_items(V2_BATCHES_FILE)
    runs = _load_items(V2_ANALYSIS_RUNS_FILE)
    rule_versions = _load_items(V2_RULE_VERSIONS_FILE)

    now = _iso_now()
    default_batch_id = "default_batch"
    default_run_id = "latest_run"
    rule_version = _normalize_rule_version(rules)

    if not any(item.get("batch_id") == default_batch_id for item in batches):
        batches.append(
            {
                "batch_id": default_batch_id,
                "name": "默认案例批次",
                "source_file": _default_source_file(summary),
                "source_type": "case_excel",
                "created_at": now,
                "creator_count": int(len(scores_df)),
                "note": "基于当前主系统已有评分结果自动初始化",
            }
        )
        _save_items(V2_BATCHES_FILE, batches)

    if not any(item.get("rule_version") == rule_version for item in rule_versions):
        rule_versions.append(
            {
                "rule_version": rule_version,
                "name": "当前默认评分规则快照",
                "created_at": now,
                "source_file": str(CONFIG_DIR / "default_rules.json"),
                "weights": rules.get("score_weights", {}),
                "risk_deduction_max": rules.get("risk_deduction_max", 10),
                "status": "active",
                "note": "从现有 default_rules.json 自动生成",
            }
        )
        _save_items(V2_RULE_VERSIONS_FILE, rule_versions)

    if not any(item.get("run_id") == default_run_id for item in runs):
        grade_distribution = {}
        if not scores_df.empty and "grade_short" in scores_df.columns:
            counts = scores_df["grade_short"].fillna("unknown").astype(str).value_counts().to_dict()
            grade_distribution = {key: int(value) for key, value in counts.items()}
        runs.append(
            {
                "run_id": default_run_id,
                "batch_id": default_batch_id,
                "rule_version": rule_version,
                "compare_scope": "global",
                "created_at": now,
                "input_file": _default_source_file(summary),
                "output_files": summary.get("output_files", {}) if isinstance(summary, dict) else {},
                "summary": {
                    "total_count": int(len(scores_df)),
                    "top50_count": int(min(len(scores_df), 50)),
                    "top10_count": int(min(len(scores_df), 10)),
                    "grade_distribution": grade_distribution,
                },
            }
        )
        _save_items(V2_ANALYSIS_RUNS_FILE, runs)

    return {
        "current_batch_id": default_batch_id,
        "current_run_id": default_run_id,
        "current_rule_version": rule_version,
    }


def list_batches(*, include_deleted: bool = False) -> list[dict[str, Any]]:
    items = _load_items(V2_BATCHES_FILE)
    if not include_deleted:
        items = [item for item in items if not item.get("deleted")]
    return items


def list_analysis_runs() -> list[dict[str, Any]]:
    return _load_items(V2_ANALYSIS_RUNS_FILE)


def list_rule_versions() -> list[dict[str, Any]]:
    return _load_items(V2_RULE_VERSIONS_FILE)


def list_review_logs() -> list[dict[str, Any]]:
    return _load_items(V2_REVIEW_LOGS_FILE)


def list_contact_records() -> list[dict[str, Any]]:
    return _load_items(V2_CONTACT_RECORDS_FILE)


def list_quote_records() -> list[dict[str, Any]]:
    return _load_items(V2_QUOTE_RECORDS_FILE)


def _match_record(item: dict[str, Any], *, creator_key: str = "", rank: str = "") -> bool:
    item_creator_key = str(item.get("creator_key", "") or "")
    item_rank = str(item.get("rank", "") or "")
    return bool((creator_key and item_creator_key == creator_key) or (rank and item_rank == rank))


def get_contact_record(*, creator_key: str = "", rank: str = "") -> dict[str, Any] | None:
    for item in reversed(list_contact_records()):
        if _match_record(item, creator_key=creator_key, rank=rank):
            return item
    return None


def get_quote_record(*, creator_key: str = "", rank: str = "") -> dict[str, Any] | None:
    for item in reversed(list_quote_records()):
        if _match_record(item, creator_key=creator_key, rank=rank):
            return item
    return None


def save_contact_record(payload: dict[str, Any]) -> dict[str, Any]:
    items = list_contact_records()
    creator_key = str(payload.get("creator_key", "") or payload.get("rank", "") or "")
    rank = str(payload.get("rank", "") or "")
    updated_at = str(payload.get("updated_at") or _iso_now())
    record = {
        "creator_key": creator_key,
        "rank": rank,
        "batch_id": str(payload.get("batch_id", "default_batch") or "default_batch"),
        "run_id": str(payload.get("run_id", "latest_run") or "latest_run"),
        "contact_status": str(payload.get("contact_status", "not_contacted") or "not_contacted"),
        "contact_channel": str(payload.get("contact_channel", "") or ""),
        "owner": str(payload.get("owner", "") or ""),
        "contact_note": str(payload.get("contact_note", "") or ""),
        "next_follow_up_at": str(payload.get("next_follow_up_at", "") or ""),
        "is_shortlisted": bool(payload.get("is_shortlisted", False)),
        "updated_at": updated_at,
    }

    replaced = False
    for index, item in enumerate(items):
        if _match_record(item, creator_key=creator_key, rank=rank):
            items[index] = record
            replaced = True
            break
    if not replaced:
        items.append(record)
    _save_items(V2_CONTACT_RECORDS_FILE, items)
    return record


def save_quote_record(payload: dict[str, Any]) -> dict[str, Any]:
    items = list_quote_records()
    creator_key = str(payload.get("creator_key", "") or payload.get("rank", "") or "")
    rank = str(payload.get("rank", "") or "")
    updated_at = str(payload.get("updated_at") or _iso_now())

    def _optional_number(value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except Exception:
            return None

    record = {
        "creator_key": creator_key,
        "rank": rank,
        "batch_id": str(payload.get("batch_id", "default_batch") or "default_batch"),
        "platform_reference_price": _optional_number(payload.get("platform_reference_price")),
        "inquiry_price": _optional_number(payload.get("inquiry_price")),
        "final_price": _optional_number(payload.get("final_price")),
        "currency": str(payload.get("currency", "CNY") or "CNY"),
        "price_note": str(payload.get("price_note", "") or ""),
        "updated_at": updated_at,
    }

    replaced = False
    for index, item in enumerate(items):
        if _match_record(item, creator_key=creator_key, rank=rank):
            items[index] = record
            replaced = True
            break
    if not replaced:
        items.append(record)
    _save_items(V2_QUOTE_RECORDS_FILE, items)
    return record


def build_contact_summary() -> dict[str, Any]:
    contact_records = list_contact_records()
    quote_records = list_quote_records()
    status_counts = Counter(str(item.get("contact_status", "not_contacted") or "not_contacted") for item in contact_records)
    shortlisted_count = sum(1 for item in contact_records if item.get("is_shortlisted"))
    quote_received_count = int(status_counts.get("quote_received", 0))

    def _avg(values: list[float | None]) -> float | None:
        valid = [value for value in values if value is not None]
        if not valid:
            return None
        return round(sum(valid) / len(valid), 2)

    platform_prices = [item.get("platform_reference_price") for item in quote_records]
    inquiry_prices = [item.get("inquiry_price") for item in quote_records]
    final_prices = [item.get("final_price") for item in quote_records]

    gaps_platform_to_inquiry = []
    gaps_inquiry_to_final = []
    for item in quote_records:
        platform_price = item.get("platform_reference_price")
        inquiry_price = item.get("inquiry_price")
        final_price = item.get("final_price")
        if platform_price is not None and inquiry_price is not None:
            gaps_platform_to_inquiry.append(round(float(platform_price) - float(inquiry_price), 2))
        if inquiry_price is not None and final_price is not None:
            gaps_inquiry_to_final.append(round(float(inquiry_price) - float(final_price), 2))

    return {
        "total": len(contact_records),
        "status_counts": dict(status_counts),
        "shortlisted_count": shortlisted_count,
        "quote_received_count": quote_received_count,
        "avg_platform_reference_price": _avg(platform_prices),
        "avg_inquiry_price": _avg(inquiry_prices),
        "avg_final_price": _avg(final_prices),
        "price_gap_summary": {
            "avg_platform_to_inquiry_gap": _avg(gaps_platform_to_inquiry),
            "avg_inquiry_to_final_gap": _avg(gaps_inquiry_to_final),
            "records_with_platform_reference": len([value for value in platform_prices if value is not None]),
            "records_with_final_price": len([value for value in final_prices if value is not None]),
        },
        "recent_contact_records": sorted(contact_records, key=lambda item: item.get("updated_at", ""), reverse=True)[:10],
        "recent_quote_records": sorted(quote_records, key=lambda item: item.get("updated_at", ""), reverse=True)[:10],
    }


def _safe_number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except Exception:
        return None


def build_v2_report_data(
    *,
    scores_df: pd.DataFrame,
    summary: dict[str, Any],
    rules: dict[str, Any],
    ai_cache: dict[str, Any],
    manual_reviews: dict[str, Any],
) -> dict[str, Any]:
    batches = list_batches()
    runs = list_analysis_runs()
    rule_versions = list_rule_versions()
    review_logs = list_review_logs()
    contact_records = list_contact_records()
    quote_records = list_quote_records()
    review_disagreements = build_review_disagreements()
    contact_summary = build_contact_summary()

    current_batch = batches[-1] if batches else {}
    current_run = runs[-1] if runs else {}
    current_rule = rule_versions[-1] if rule_versions else {
        "rule_version": str(rules.get("version", "rules_v1") or "rules_v1")
    }

    total_creators = int(len(scores_df)) if not scores_df.empty else 0
    top10_records: list[dict[str, Any]] = []
    top50_records: list[dict[str, Any]] = []
    grade_distribution: dict[str, int] = {}

    creator_index: dict[str, dict[str, Any]] = {}
    if not scores_df.empty:
        working_df = scores_df.copy()
        if "grade_short" in working_df.columns:
            grade_distribution = {
                str(key): int(value)
                for key, value in working_df["grade_short"].fillna("unknown").astype(str).value_counts().to_dict().items()
            }
        for _, row in working_df.iterrows():
            rank_value = str(int(row["rank"])) if "rank" in working_df.columns else ""
            creator_index[rank_value] = row.to_dict()
        if "rank" in working_df.columns:
            top10_df = working_df.sort_values(by="rank", ascending=True).head(10)
            top50_df = working_df.sort_values(by="rank", ascending=True).head(50)
            top10_records = [
                {
                    "rank": int(row["rank"]),
                    "creator_name": str(row.get("昵称", "") or row.get("creator_key", "")),
                    "grade_short": str(row.get("grade_short", "") or ""),
                    "score_final": _safe_number(row.get("score_final")),
                }
                for _, row in top10_df.iterrows()
            ]
            top50_records = [
                {
                    "rank": int(row["rank"]),
                    "creator_name": str(row.get("昵称", "") or row.get("creator_key", "")),
                    "grade_short": str(row.get("grade_short", "") or ""),
                    "score_final": _safe_number(row.get("score_final")),
                }
                for _, row in top50_df.iterrows()
            ]

    ai_reasons: Counter[str] = Counter()
    ai_risks: Counter[str] = Counter()
    ai_review_hints: list[str] = []
    for item in ai_cache.values():
        for reason in item.get("reasons", []) or []:
            ai_reasons[str(reason)] += 1
        for risk in item.get("risks", []) or []:
            ai_risks[str(risk)] += 1
        review_hint = str(item.get("review_hint", "") or "").strip()
        if review_hint:
            ai_review_hints.append(review_hint)

    shortlisted_items: list[dict[str, Any]] = []
    quote_index = {
        str(item.get("rank", "") or item.get("creator_key", "")): item
        for item in quote_records
    }
    contact_index = {
        str(item.get("rank", "") or item.get("creator_key", "")): item
        for item in contact_records
    }
    for item in contact_records:
        if not item.get("is_shortlisted"):
            continue
        rank_key = str(item.get("rank", "") or "")
        creator = creator_index.get(rank_key, {})
        review = manual_reviews.get(rank_key, {})
        quote_record = quote_index.get(rank_key, {})
        shortlisted_items.append(
            {
                "rank": rank_key,
                "creator_name": str(creator.get("昵称", "") or creator.get("creator_key", "") or item.get("creator_key", "")),
                "recommend_grade": str(creator.get("recommend_grade", "") or creator.get("grade_short", "") or ""),
                "manual_decision": str(review.get("decision", "pending") or "pending"),
                "contact_status": str(item.get("contact_status", "not_contacted") or "not_contacted"),
                "final_price": quote_record.get("final_price"),
                "note": str(item.get("contact_note", "") or quote_record.get("price_note", "") or ""),
            }
        )

    report_generated_at = datetime.now().isoformat()
    return {
        "generated_at": report_generated_at,
        "batch": current_batch,
        "analysis_run": current_run,
        "rule_version": current_rule,
        "summary": {
            "creator_count": total_creators,
            "review_count": len(review_logs),
            "contact_count": len(contact_records),
            "quote_count": len(quote_records),
            "shortlisted_count": len(shortlisted_items),
            "manual_review_total": len(manual_reviews),
            "grade_distribution": grade_distribution,
        },
        "screening": {
            "top10": top10_records,
            "top50": top50_records,
        },
        "ai_summary": {
            "top_reasons": [{"name": key, "count": value} for key, value in ai_reasons.most_common(8)],
            "top_risks": [{"name": key, "count": value} for key, value in ai_risks.most_common(8)],
            "review_hints": ai_review_hints[:8],
        },
        "manual_review": review_disagreements,
        "rule_suggestions": review_disagreements.get("rule_suggestions", []),
        "contact_summary": contact_summary,
        "shortlisted_creators": shortlisted_items,
        "source_summary": summary,
    }


def _batch_source_label(source_type: str) -> str:
    labels = {"csv_import": "CSV导入", "excel_import": "Excel导入+评分", "default_scores": "自检测评分"}
    return labels.get(source_type, source_type or "未知")


def _build_grade_distribution_table(lines: list[str], grade_dist: dict[str, int]) -> None:
    if not grade_dist:
        lines.append("- 暂无等级数据")
        return
    total = sum(grade_dist.values()) or 1
    lines.append("| 等级 | 数量 | 占比 |")
    lines.append("|---|---|---|")
    grade_order = ["S", "A", "B", "C", "D", "unknown"]
    for g in grade_order:
        count = grade_dist.get(g, 0)
        if count > 0:
            lines.append(f"| {g} | {count} | {count/total*100:.1f}% |")


def _markdown_list(lines: list[str], title: str, items: list[str]) -> None:
    lines.append(title)
    if items:
        lines.extend([f"- {item}" for item in items])
    else:
        lines.append("- 暂无")
    lines.append("")


def export_v2_report_markdown(report_data: dict[str, Any]) -> Path:
    V2_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = V2_REPORTS_DIR / f"v2_report_{timestamp}.md"

    summary = report_data.get("summary", {})
    batch = report_data.get("batch", {})
    analysis_run = report_data.get("analysis_run", {})
    rule_version = report_data.get("rule_version", {})
    screening = report_data.get("screening", {})
    ai_summary = report_data.get("ai_summary", {})
    manual_review = report_data.get("manual_review", {})
    contact_summary = report_data.get("contact_summary", {})
    shortlisted_creators = report_data.get("shortlisted_creators", [])

    lines = [
        "# 韩国品牌达人数据统一管理与合作决策系统 V2 批次报告",
        "",
        "## 1. 报告概览",
        f"- 生成时间：{report_data.get('generated_at', '-')}",
        f"- 当前批次：{batch.get('name') or batch.get('batch_id') or '-'}",
        f"- 当前规则版本：{rule_version.get('rule_version') or '-'}",
        f"- 达人总数：{summary.get('creator_count', 0)}",
        f"- 已复核数量：{summary.get('review_count', 0)}",
        f"- 已联系数量：{contact_summary.get('total', 0)}",
        f"- 已获取报价数量：{contact_summary.get('quote_received_count', 0)}",
        f"- 候选达人数量：{summary.get('shortlisted_count', 0)}",
        "",
        "## 2. 批次与分析运行",
        f"- 批次名称：{batch.get('name') or batch.get('batch_id') or '-'}",
        f"- 批次来源：{_batch_source_label(batch.get('source_type', ''))}",
        f"- 达人数量：{batch.get('creator_count', 0)}",
        f"- 分析运行：{analysis_run.get('run_id') or '-'}",
        f"- 规则版本：{rule_version.get('rule_version') or '-'}",
        "",
        "## 3. 等级分布",
    ]
    _build_grade_distribution_table(lines, summary.get("grade_distribution", {}))
    lines.append("")
    lines.extend([
        "## 4. 达人筛选结果摘要",
        f"- Top10 数量：{len(screening.get('top10', []))}",
        f"- Top50 数量：{len(screening.get('top50', []))}",
        "",
    ])
    _markdown_list(lines, "## 5. AI 辅助分析摘要", [item["name"] for item in ai_summary.get("top_reasons", [])[:5]])
    _markdown_list(lines, "### 风险提示摘要", [item["name"] for item in ai_summary.get("top_risks", [])[:5]])
    _markdown_list(lines, "### 需要人工确认事项", ai_summary.get("review_hints", [])[:5])
    lines.extend(
        [
            "## 6. 人工复核与分歧统计",
            f"- 人工复核总数：{manual_review.get('total_reviews', 0)}",
            f"- AI 与人工一致数量：{manual_review.get('aligned_count', 0)}",
            f"- AI 与人工分歧数量：{manual_review.get('disagreed_count', 0)}",
            f"- 分歧类型排行：{json.dumps(manual_review.get('disagreement_types', {}), ensure_ascii=False)}",
            f"- 复核原因标签排行：{json.dumps(manual_review.get('reason_tag_counts', {}), ensure_ascii=False)}",
            "",
            "## 7. 规则复盘建议",
        ]
    )
    _markdown_list(lines, "", report_data.get("rule_suggestions", []))
    lines.extend(
        [
            "## 8. 联系跟进与报价统计",
            f"- 联系状态分布：{json.dumps(contact_summary.get('status_counts', {}), ensure_ascii=False)}",
            f"- 候选达人数量：{contact_summary.get('shortlisted_count', 0)}",
            f"- 平台参考报价均值：{contact_summary.get('avg_platform_reference_price')}",
            f"- 询价报价均值：{contact_summary.get('avg_inquiry_price')}",
            f"- 最终报价均值：{contact_summary.get('avg_final_price')}",
            f"- 报价差异说明：{json.dumps(contact_summary.get('price_gap_summary', {}), ensure_ascii=False)}",
            "",
            "## 9. 候选达人清单",
            "| 排名 | 达人 | 推荐等级 | 人工判断 | 联系状态 | 最终报价 | 备注 |",
            "|---|---|---|---|---|---|---|",
        ]
    )
    if shortlisted_creators:
        for item in shortlisted_creators:
            lines.append(
                f"| {item.get('rank', '-')} | {item.get('creator_name', '-')} | {item.get('recommend_grade', '-')} | "
                f"{item.get('manual_decision', '-')} | {item.get('contact_status', '-')} | {item.get('final_price', '-')} | {item.get('note', '-')} |"
            )
    else:
        lines.append("| - | 暂无 | - | - | - | - | - |")
    lines.extend(
        [
            "",
            "## 10. 后续行动建议",
            f"- 待联系：{contact_summary.get('status_counts', {}).get('to_contact', 0)}",
            f"- 待报价确认：{contact_summary.get('status_counts', {}).get('quote_received', 0)}",
            f"- 待人工复核：{max(0, summary.get('creator_count', 0) - summary.get('manual_review_total', 0))}",
            f"- 规则待优化：{len(report_data.get('rule_suggestions', []))}",
            "",
        ]
    )

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def export_v2_report_json(report_data: dict[str, Any]) -> Path:
    V2_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = V2_REPORTS_DIR / f"v2_report_{timestamp}.json"
    path.write_text(json.dumps(report_data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def get_rule_replay_suggestions() -> dict[str, Any]:
    ensure_v2_state_files()
    payload = _read_json(V2_RULE_REPLAY_SUGGESTIONS_FILE, {"generated_at": None, "rule_suggestions": []})
    return payload if isinstance(payload, dict) else {"generated_at": None, "rule_suggestions": []}


def _determine_disagreement_type(ai_decision: str, manual_decision: str) -> str | None:
    if not ai_decision or ai_decision == "unknown":
        return None
    if manual_decision in {"pending", "reviewed", ""}:
        return None
    if ai_decision == manual_decision:
        return "aligned"
    return f"ai_{ai_decision}_manual_{manual_decision}"


def append_review_log(
    *,
    rank: str,
    review: dict[str, Any],
    creator: dict[str, Any] | None = None,
    ai_record: dict[str, Any] | None = None,
    batch_id: str = "default_batch",
    run_id: str = "latest_run",
    rule_version: str = "rules_v1",
) -> dict[str, Any]:
    items = _load_items(V2_REVIEW_LOGS_FILE)
    created_at = review.get("updated_at") or _iso_now()
    manual_decision = str(review.get("decision", "pending") or "pending")
    ai_decision = str((ai_record or {}).get("ai_decision", "unknown") or "unknown")
    reason_tags = review.get("reason_tags", [])
    if isinstance(reason_tags, str):
        reason_tags = [item.strip() for item in reason_tags.split(",") if item.strip()]
    if not isinstance(reason_tags, list):
        reason_tags = []

    log = {
        "review_id": f"review_{rank}_{created_at.replace(':', '').replace('-', '').replace('.', '')}",
        "rank": rank,
        "creator_key": str((creator or {}).get("creator_key") or rank),
        "creator_name": str((creator or {}).get("nickname") or (creator or {}).get("name") or ""),
        "run_id": run_id or "latest_run",
        "batch_id": batch_id or "default_batch",
        "rule_version": rule_version or "rules_v1",
        "ai_decision": ai_decision,
        "manual_decision": manual_decision,
        "disagreement_type": _determine_disagreement_type(ai_decision, manual_decision),
        "reason_tags": reason_tags,
        "note": str(review.get("note", "") or ""),
        "reviewer": str(review.get("reviewer", "人工") or "人工"),
        "created_at": created_at,
    }
    items.append(log)
    _save_items(V2_REVIEW_LOGS_FILE, items)
    return log


def save_review_log(payload: dict[str, Any]) -> dict[str, Any]:
    items = _load_items(V2_REVIEW_LOGS_FILE)
    reason_tags = payload.get("reason_tags", [])
    if isinstance(reason_tags, str):
        reason_tags = [item.strip() for item in reason_tags.split(",") if item.strip()]
    if not isinstance(reason_tags, list):
        reason_tags = []

    created_at = str(payload.get("created_at") or _iso_now())
    review_id = str(payload.get("review_id") or f"review_custom_{created_at.replace(':', '').replace('-', '').replace('.', '')}")
    entry = {
        "review_id": review_id,
        "rank": str(payload.get("rank", "") or ""),
        "creator_key": str(payload.get("creator_key", "") or payload.get("rank", "") or ""),
        "creator_name": str(payload.get("creator_name", "") or ""),
        "run_id": str(payload.get("run_id", "latest_run") or "latest_run"),
        "batch_id": str(payload.get("batch_id", "default_batch") or "default_batch"),
        "rule_version": str(payload.get("rule_version", "rules_v1") or "rules_v1"),
        "ai_decision": str(payload.get("ai_decision", "unknown") or "unknown"),
        "manual_decision": str(payload.get("manual_decision", "pending") or "pending"),
        "disagreement_type": payload.get("disagreement_type")
        or _determine_disagreement_type(
            str(payload.get("ai_decision", "unknown") or "unknown"),
            str(payload.get("manual_decision", "pending") or "pending"),
        ),
        "reason_tags": reason_tags,
        "note": str(payload.get("note", "") or ""),
        "reviewer": str(payload.get("reviewer", "人工") or "人工"),
        "created_at": created_at,
    }
    items.append(entry)
    _save_items(V2_REVIEW_LOGS_FILE, items)
    return entry


def build_review_disagreements() -> dict[str, Any]:
    review_logs = list_review_logs()
    disagreement_types: Counter[str] = Counter()
    reason_tags: Counter[str] = Counter()
    aligned_count = 0
    disagreed_count = 0

    for item in review_logs:
        manual_decision = str(item.get("manual_decision", "pending") or "pending")
        ai_decision = str(item.get("ai_decision", "unknown") or "unknown")
        disagreement_type = item.get("disagreement_type")

        if manual_decision in {"pending", "reviewed"} or ai_decision == "unknown":
            continue
        if disagreement_type == "aligned":
            aligned_count += 1
        else:
            disagreed_count += 1
            if disagreement_type:
                disagreement_types[str(disagreement_type)] += 1
        for tag in item.get("reason_tags", []) or []:
            tag_text = str(tag).strip()
            if tag_text:
                reason_tags[tag_text] += 1

    suggestions = generate_rule_suggestions(disagreement_types)
    payload = {
        "total_reviews": len(review_logs),
        "aligned_count": aligned_count,
        "disagreed_count": disagreed_count,
        "disagreement_types": dict(disagreement_types),
        "reason_tag_counts": dict(reason_tags),
        "rule_suggestions": suggestions,
        "recent_reviews": sorted(review_logs, key=lambda item: item.get("created_at", ""), reverse=True)[:10],
    }
    _write_json(
        V2_RULE_REPLAY_SUGGESTIONS_FILE,
        {"generated_at": _iso_now(), "rule_suggestions": suggestions},
    )
    return payload


# ── Batch & Import helpers ──────────────────────────────────────────────

BATCH_CANDIDATE_FIELDS = {
    "rank": {"label": "field.rank", "required": True, "aliases": ["rank", "排名", "序号"]},
    "score_final": {"label": "field.score_final", "required": True, "aliases": ["score_final", "最终评分", "综合评分"]},
    "grade_short": {"label": "field.grade_short", "required": True, "aliases": ["grade_short", "等级", "推荐等级"]},
    "昵称": {"label": "field.nickname", "required": False, "aliases": ["昵称", "名称", "达人名称"]},
    "creator_key": {"label": "field.creator_key", "required": False, "aliases": ["creator_key", "userId", "小红书号"]},
    "platform": {"label": "field.platform", "required": False, "aliases": ["platform", "平台"]},
    "粉丝数": {"label": "field.follower_count", "required": False, "aliases": ["粉丝数", "粉丝", "follower_count"]},
    "全部报价": {"label": "field.quote_price", "required": False, "aliases": ["全部报价", "报价", "平台报价"]},
    "合作笔记ER": {"label": "field.engagement_rate", "required": False, "aliases": ["合作笔记ER", "合作ER", "engagement_rate"]},
    "score_layered_match": {"label": "field.score_layered_match", "required": False, "aliases": ["score_layered_match"]},
    "score_keyword_combo": {"label": "field.score_keyword_combo", "required": False, "aliases": ["score_keyword_combo"]},
    "score_korea_brand": {"label": "field.score_korea_brand", "required": False, "aliases": ["score_korea_brand"]},
    "score_cooperation_potential": {"label": "field.score_cooperation_potential", "required": False, "aliases": ["score_cooperation_potential"]},
    "score_performance": {"label": "field.score_performance", "required": False, "aliases": ["score_performance"]},
    "score_cost_effectiveness": {"label": "field.score_cost_effectiveness", "required": False, "aliases": ["score_cost_effectiveness"]},
    "recommend_grade": {"label": "field.recommend_grade", "required": False, "aliases": ["recommend_grade", "grade"]},
    "country_label": {"label": "field.country", "required": False, "aliases": ["country_label", "地域", "地区"]},
}


def detect_csv_fields(df: pd.DataFrame) -> dict[str, Any]:
    """检测CSV列名与系统字段的映射关系，支持别名匹配，返回字段完整率报告。"""
    csv_columns = {str(col).strip().lower() for col in df.columns}
    csv_columns_orig = {str(col).strip() for col in df.columns}
    field_report: dict[str, dict[str, Any]] = {}
    required_missing: list[str] = []
    optional_found: list[str] = []
    optional_missing: list[str] = []
    column_mapping: dict[str, str] = {}  # CSV列名 → 系统字段名

    for field_key, meta in BATCH_CANDIDATE_FIELDS.items():
        aliases = meta.get("aliases", [field_key])
        matched_col = None
        for alias in aliases:
            alias_lower = alias.lower()
            if alias_lower in csv_columns:
                matched_col = next((c for c in csv_columns_orig if c.lower() == alias_lower), None)
                break
        if matched_col:
            column_mapping[matched_col] = field_key

    for field_key, meta in BATCH_CANDIDATE_FIELDS.items():
        matches = [k for k, v in column_mapping.items() if v == field_key]
        exists = len(matches) > 0
        matched_col = matches[0] if matches else None
        if exists and matched_col:
            total = len(df)
            non_null = int(df[matched_col].notna().sum())
            completeness = round(non_null / total, 4) if total > 0 else 0.0
        else:
            completeness = 0.0

        field_report[field_key] = {
            "label": meta["label"],
            "required": meta["required"],
            "found": exists,
            "completeness": completeness,
            "mapped_from": matched_col,
        }

        if meta["required"] and not exists:
            required_missing.append(meta["label"])
        elif not meta["required"]:
            if exists:
                optional_found.append(meta["label"])
            else:
                optional_missing.append(meta["label"])

    overall_required = 1.0 if not required_missing else 0.0
    overall_optional = round(len(optional_found) / max(len(optional_found) + len(optional_missing), 1), 4)

    return {
        "valid": len(required_missing) == 0,
        "required_missing": required_missing,
        "optional_found": optional_found,
        "optional_missing": optional_missing,
        "overall_required_completeness": overall_required,
        "overall_optional_completeness": overall_optional,
        "fields": field_report,
        "total_rows": int(len(df)),
        "column_mapping": column_mapping,
    }


def get_field_completeness(batch_id: str = "") -> dict[str, Any]:
    """返回指定批次的字段完整率，若未指定则返回最后活跃批次。"""
    batches = _load_items(V2_BATCHES_FILE)
    target = None
    if batch_id:
        target = next((b for b in batches if b.get("batch_id") == batch_id), None)
    if not target and batches:
        target = batches[-1]
    if not target:
        return {"batch_id": "", "field_completeness": {}, "total_rows": 0}

    return {
        "batch_id": target.get("batch_id", ""),
        "field_completeness": target.get("field_completeness", {}),
        "total_rows": int(target.get("creator_count", 0) or 0),
    }


def create_batch(
    *,
    batch_name: str,
    source_file: str,
    source_type: str = "csv_import",
    creator_count: int = 0,
    field_completeness: dict[str, Any] | None = None,
    note: str = "",
) -> dict[str, Any]:
    """创建新批次并持久化。"""
    batches = _load_items(V2_BATCHES_FILE)
    now = _iso_now()
    batch_id = f"batch_{now.replace(':', '').replace('-', '').replace('.', '')}"

    entry = {
        "batch_id": batch_id,
        "name": batch_name,
        "source_file": source_file,
        "source_type": source_type,
        "created_at": now,
        "creator_count": int(creator_count),
        "field_completeness": field_completeness or {},
        "note": note,
    }
    batches.append(entry)
    _save_items(V2_BATCHES_FILE, batches)
    return entry


def create_analysis_run_for_batch(
    batch_id: str,
    rule_version: str,
    creator_count: int = 0,
    input_file: str = "",
) -> dict[str, Any]:
    """为新批次创建对应的 analysis_run 记录。"""
    runs = _load_items(V2_ANALYSIS_RUNS_FILE)
    now = _iso_now()
    run_id = f"run_{batch_id}"

    if not any(item.get("run_id") == run_id for item in runs):
        runs.append({
            "run_id": run_id,
            "batch_id": batch_id,
            "rule_version": rule_version,
            "compare_scope": "batch",
            "created_at": now,
            "input_file": input_file,
            "output_files": {},
            "summary": {
                "total_count": int(creator_count),
                "top50_count": int(min(creator_count, 50)),
                "top10_count": int(min(creator_count, 10)),
                "grade_distribution": {},
            },
        })
        _save_items(V2_ANALYSIS_RUNS_FILE, runs)
    return runs


def get_batch_csv_path(batch_id: str) -> Path:
    """返回批次对应的 CSV 文件路径。"""
    return CACHE_DIR.parent / "input" / f"{batch_id}.csv"


def rename_batch(batch_id: str, new_name: str) -> dict[str, Any]:
    """重命名批次。"""
    batches = _load_items(V2_BATCHES_FILE)
    for b in batches:
        if b.get("batch_id") == batch_id:
            b["name"] = new_name
            b["updated_at"] = _iso_now()
            _save_items(V2_BATCHES_FILE, batches)
            return {"ok": True, "batch_id": batch_id, "name": new_name}
    return {"ok": False, "error": "batch not found"}


def delete_batch(batch_id: str, active_batch_id: str = "") -> dict[str, Any]:
    """软删除批次及关联数据（标记 deleted，不物理删除）。"""
    if batch_id == active_batch_id:
        return {"ok": False, "error": "不能删除当前活跃批次，请先切换"}

    # 标记 batch
    batches = _load_items(V2_BATCHES_FILE)
    found = False
    for b in batches:
        if b.get("batch_id") == batch_id:
            b["deleted"] = True
            b["updated_at"] = _iso_now()
            found = True
            break
    if not found:
        return {"ok": False, "error": "batch not found"}
    _save_items(V2_BATCHES_FILE, batches)

    # 标记关联 run
    runs = _load_items(V2_ANALYSIS_RUNS_FILE)
    for r in runs:
        if r.get("batch_id") == batch_id:
            r["deleted"] = True
    _save_items(V2_ANALYSIS_RUNS_FILE, runs)

    # 标记关联复核
    reviews = _load_items(V2_REVIEW_LOGS_FILE)
    for rv in reviews:
        if rv.get("batch_id") == batch_id:
            rv["deleted"] = True
    _save_items(V2_REVIEW_LOGS_FILE, reviews)

    # 标记关联联系
    contacts = _load_items(V2_CONTACT_RECORDS_FILE)
    for c in contacts:
        if c.get("batch_id") == batch_id:
            c["deleted"] = True
    _save_items(V2_CONTACT_RECORDS_FILE, contacts)

    # 标记关联报价
    quotes = _load_items(V2_QUOTE_RECORDS_FILE)
    for q in quotes:
        if q.get("batch_id") == batch_id:
            q["deleted"] = True
    _save_items(V2_QUOTE_RECORDS_FILE, quotes)

    return {"ok": True, "deleted": batch_id}


def toggle_batch_favorite(batch_id: str, is_favorite: bool) -> dict[str, Any]:
    """标记/取消收藏批次。"""
    batches = _load_items(V2_BATCHES_FILE)
    for b in batches:
        if b.get("batch_id") == batch_id:
            b["is_favorite"] = is_favorite
            b["updated_at"] = _iso_now()
            _save_items(V2_BATCHES_FILE, batches)
            return {"ok": True, "batch_id": batch_id, "is_favorite": is_favorite}
    return {"ok": False, "error": "batch not found"}


def generate_rule_suggestions(disagreement_types: Counter[str]) -> list[str]:
    suggestions: list[str] = []
    if disagreement_types.get("ai_recommend_manual_reject", 0) > 0:
        suggestions.extend(
            [
                "检查价格权重是否过低，避免系统高估高报价达人。",
                "补强韩国品牌关联与内容匹配判断，并增加风险提示。",
                "对系统强推但人工拒绝的样本提高人工确认优先级。",
            ]
        )
    if disagreement_types.get("ai_reject_manual_recommend", 0) > 0:
        suggestions.extend(
            [
                "补充关键词库，减少内容调性被漏识别的情况。",
                "增加“小而优”达人识别，降低单一粉丝数的压制影响。",
            ]
        )
    if disagreement_types.get("ai_cautious_manual_recommend", 0) > 0:
        suggestions.append("检查谨慎阈值是否过于保守，避免错过可先联系的小体量达人。")
    if disagreement_types.get("ai_recommend_manual_cautious", 0) > 0:
        suggestions.append("增加数据完整度与报价可信度标记，减少系统过早给出推荐。")
    if not suggestions:
        suggestions.append("当前分歧样本较少，先继续积累人工复核历史，再进行规则回放优化。")
    return suggestions


# ── Group Management ──────────────────────────────────────────────────────────

def _iso_now_compact() -> str:
    return datetime.now().strftime("%Y%m%dT%H%M%S")


def list_groups() -> list[dict[str, Any]]:
    return _load_items(V2_GROUPS_FILE)


def create_group(
    *, name: str, creator_keys: list[str] | None = None, batch_ids: list[str] | None = None, note: str = ""
) -> dict[str, Any]:
    groups = _load_items(V2_GROUPS_FILE)
    group_id = f"group_{_iso_now_compact()}"
    entry = {
        "group_id": group_id,
        "name": name,
        "created_at": _iso_now(),
        "creator_keys": creator_keys or [],
        "batch_ids": batch_ids or [],
        "note": note,
        "is_favorite": False,
    }
    groups.append(entry)
    _save_items(V2_GROUPS_FILE, groups)
    return entry


def add_to_group(group_id: str, creator_keys: list[str], batch_ids: list[str] | None = None) -> dict[str, Any]:
    groups = _load_items(V2_GROUPS_FILE)
    for g in groups:
        if g.get("group_id") == group_id:
            existing = set(g.get("creator_keys", []))
            existing.update(creator_keys)
            g["creator_keys"] = list(existing)
            if batch_ids:
                existing_batches = set(g.get("batch_ids", []))
                existing_batches.update(batch_ids)
                g["batch_ids"] = list(existing_batches)
            _save_items(V2_GROUPS_FILE, groups)
            return {"ok": True, "added": len(creator_keys), "total": len(g["creator_keys"])}
    return {"ok": False, "error": "group not found"}


def remove_from_group(group_id: str, creator_keys: list[str]) -> dict[str, Any]:
    groups = _load_items(V2_GROUPS_FILE)
    for g in groups:
        if g.get("group_id") == group_id:
            existing = set(g.get("creator_keys", []))
            existing.difference_update(creator_keys)
            g["creator_keys"] = list(existing)
            _save_items(V2_GROUPS_FILE, groups)
            return {"ok": True, "removed": len(creator_keys), "total": len(g["creator_keys"])}
    return {"ok": False, "error": "group not found"}


def delete_group(group_id: str) -> dict[str, Any]:
    groups = _load_items(V2_GROUPS_FILE)
    before = len(groups)
    groups = [g for g in groups if g.get("group_id") != group_id]
    _save_items(V2_GROUPS_FILE, groups)
    return {"ok": True, "deleted": before != len(groups)}


def rename_group(group_id: str, new_name: str) -> dict[str, Any]:
    groups = _load_items(V2_GROUPS_FILE)
    for g in groups:
        if g.get("group_id") == group_id:
            g["name"] = new_name
            _save_items(V2_GROUPS_FILE, groups)
            return {"ok": True}
    return {"ok": False, "error": "group not found"}


def get_group_detail(group_id: str) -> dict[str, Any] | None:
    groups = _load_items(V2_GROUPS_FILE)
    for g in groups:
        if g.get("group_id") == group_id:
            return g
    return None


# ── Task State (for async AI review progress) ─────────────────────────────────

import threading


def create_task(total: int) -> dict[str, Any]:
    tasks = _load_items(V2_TASKS_FILE)
    task_id = f"task_{_iso_now_compact()}"
    entry = {
        "task_id": task_id,
        "status": "pending",
        "total": total,
        "completed": 0,
        "errors": [],
        "created_at": _iso_now(),
    }
    tasks.append(entry)
    _save_items(V2_TASKS_FILE, tasks)
    return entry


def update_task(task_id: str, *, status: str = "", completed: int | None = None, error: str = "") -> dict[str, Any]:
    tasks = _load_items(V2_TASKS_FILE)
    for t in tasks:
        if t.get("task_id") == task_id:
            if status:
                t["status"] = status
            if completed is not None:
                t["completed"] = completed
            if error:
                t["errors"] = t.get("errors", []) + [error]
            _save_items(V2_TASKS_FILE, tasks)
            return t
    return {"ok": False, "error": "task not found"}


def get_task(task_id: str) -> dict[str, Any] | None:
    tasks = _load_items(V2_TASKS_FILE)
    for t in tasks:
        if t.get("task_id") == task_id:
            return t
    return None


def run_async_group_ai_review(group_id: str, batch_id: str) -> str:
    """Start async AI review for all creators in a group. Returns task_id."""
    from services.ai_recommendation import (
        AI_CACHE_FILE, _build_prompt, _call_deepseek, _parse_ai_response,
        _generate_fallback, _get_api_key, _read_json,
    )

    group = get_group_detail(group_id)
    if not group:
        raise ValueError(f"Group {group_id} not found")

    creator_keys = group.get("creator_keys", [])
    task = create_task(len(creator_keys))

    def _run():
        scores_path = CACHE_DIR.parent / "output" / "scores_full.csv"
        if not scores_path.exists():
            scores_path = CACHE_DIR.parent / "input" / f"{batch_id}.csv"

        df = pd.read_csv(scores_path, encoding="utf-8-sig")
        api_key = _get_api_key()
        cache = _read_json(AI_CACHE_FILE, {})

        for idx, ck in enumerate(creator_keys):
            try:
                matched = df[df["creator_key"].astype(str) == str(ck)]
                if matched.empty:
                    update_task(task["task_id"], completed=idx + 1, error=f"creator {ck} not found in CSV")
                    continue

                row = matched.iloc[0]
                creator_dict = {col: row[col] for col in row.index if not pd.isna(row[col])}
                prompt = _build_prompt(creator_dict)

                if api_key:
                    raw = _call_deepseek(prompt=prompt, api_key=api_key)
                    parsed = _parse_ai_response(raw)
                    parsed["status"] = "success"
                else:
                    parsed = _generate_fallback(creator_dict)
                    parsed["status"] = "fallback"

                rank_str = str(row.get("rank", str(idx)))
                # AI history: archive existing
                existing = cache.get(rank_str, {})
                if existing:
                    if "history" in existing:
                        history = existing["history"]
                        current_ver = len(history) + 1
                    else:
                        history = [{**existing, "version": 1, "created_at": existing.get("created_at", _iso_now())}]
                        current_ver = 2
                else:
                    history = []
                    current_ver = 1

                history.append({**parsed, "version": current_ver, "created_at": _iso_now()})
                cache[rank_str] = {"history": history, "current_version": current_ver}

                update_task(task["task_id"], completed=idx + 1)
            except Exception as exc:
                update_task(task["task_id"], completed=idx + 1, error=str(exc))

        AI_CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        update_task(task["task_id"], status="done")

    threading.Thread(target=_run, daemon=True).start()
    return task["task_id"]
