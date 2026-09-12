"""第二阶段：六维评分引擎 + 第三阶段评分解释字段。

基于第一阶段去重结果，计算六个维度的得分，汇总为最终分、推荐等级、排名。
新增：排除规则标记、命中关键词解释、风险扣分原因、短等级标签。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Tuple

import pandas as pd
import numpy as np

from core.paths import CONFIG_DIR, CACHE_DIR, OUTPUT_DIR, ensure_runtime_dirs, load_settings, resolve_source_file


SHEET_NAME = "筛选结果"
CREATOR_KEY_COLUMNS = ["userId", "小红书号", "小红书主页URL"]

# 评分维度权重（来自 default_rules.json）
SCORE_WEIGHTS = {
    "layered_match": 0.25,
    "keyword_combo": 0.15,
    "korea_brand": 0.25,
    "cooperation_potential": 0.20,
    "performance": 0.10,
    "cost_effectiveness": 0.05,
}
RISK_DEDUCTION_MAX = 10

# 推荐等级阈值（统一标准）
GRADE_THRESHOLDS = [
    (80, "S级(强烈推荐)", "S"),
    (65, "A级(推荐)", "A"),
    (50, "B级(可考虑)", "B"),
    (35, "C级(观望)", "C"),
    (0, "D级(不推荐)", "D"),
]


def _load_config(name: str) -> dict[str, Any]:
    path = CONFIG_DIR / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _normalize_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def _parse_er(value: Any) -> float:
    """解析 '3.48%' 格式的 ER 值为浮点数。"""
    if pd.isna(value):
        return 0.0
    s = str(value).strip().replace("%", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _percentile_rank(series: pd.Series) -> pd.Series:
    """将数值列转换为 0-100 的百分位分数。"""
    ranked = series.rank(pct=True)
    return (ranked * 100).clip(0, 100)


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def _build_creator_key(frame: pd.DataFrame) -> pd.Series:
    key = pd.Series([""] * len(frame), index=frame.index, dtype="object")
    for column in CREATOR_KEY_COLUMNS:
        normalized = frame[column].map(_normalize_text)
        key = key.where(key != "", normalized)
    return key


def _dedupe_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """与第一阶段一致的去重逻辑。"""
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


def _match_keywords(text: str, keywords: List[str]) -> List[str]:
    """返回在文本中命中的关键词列表。"""
    matched = []
    text_lower = text.lower()
    for kw in keywords:
        if kw.lower() in text_lower:
            matched.append(kw)
    return matched


def _count_matches(text: str, keywords: List[str]) -> int:
    return len(_match_keywords(text, keywords))


# ======================== 六维评分 + 解释 ========================


def _score_layered_match(df: pd.DataFrame) -> pd.Series:
    """分层筛选 25%：按粉丝数分层打分。"""
    fans = _safe_numeric(df["粉丝数"])
    scores = pd.Series(50.0, index=df.index)

    scores = scores.where(fans < 100000, 65.0)
    scores = scores.where(fans < 150000, 80.0)
    scores = scores.where(fans < 300000, 90.0)
    scores = scores.where(fans < 1000000, 100.0)

    return scores


def _score_keyword_combo(df: pd.DataFrame, content_kw: List[str]) -> Tuple[pd.Series, pd.Series]:
    """关键词组合 15%：返回 (scores, hit_keywords)。"""
    if not content_kw:
        scores = pd.Series(50.0, index=df.index)
        hits = pd.Series([""] * len(df), index=df.index)
        return scores, hits

    combined_text = (
        df["内容类目|标签"].map(_normalize_text).str.lower()
        + " " + df["身份|人设"].map(_normalize_text).str.lower()
        + " " + df["抓取关键词"].map(_normalize_text).str.lower()
    )

    match_counts = combined_text.map(lambda t: _count_matches(t, content_kw))
    hit_keywords = combined_text.map(lambda t: ",".join(_match_keywords(t, content_kw)))

    if match_counts.max() > 0:
        scores = _percentile_rank(match_counts)
    else:
        scores = pd.Series(30.0, index=df.index)

    return scores, hit_keywords


def _score_korea_brand(df: pd.DataFrame, korea_kw: List[str], brand_kw: List[str]) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """韩国品牌 25%：返回 (scores, hit_korea, hit_brand)。"""
    combined_text = (
        df["地域"].map(_normalize_text).str.lower()
        + " " + df["内容类目|标签"].map(_normalize_text).str.lower()
        + " " + df["身份|人设"].map(_normalize_text).str.lower()
        + " " + df["抓取关键词"].map(_normalize_text).str.lower()
    )

    region = df["地域"].map(_normalize_text).str.lower()
    scores = region.map(lambda x: 40.0 if "韩国" in x else 0.0)

    korea_counts = combined_text.map(lambda t: _count_matches(t, korea_kw))
    hit_korea = combined_text.map(lambda t: ",".join(_match_keywords(t, korea_kw)))

    if korea_counts.max() > 0:
        korea_pct = _percentile_rank(korea_counts)
        scores += korea_pct * 0.30
    elif korea_counts.sum() == 0:
        scores += 10.0

    brand_counts = combined_text.map(lambda t: _count_matches(t, brand_kw))
    hit_brand = combined_text.map(lambda t: ",".join(_match_keywords(t, brand_kw)))

    if brand_counts.max() > 0:
        brand_pct = _percentile_rank(brand_counts)
        scores += brand_pct * 0.30
    elif brand_counts.sum() == 0:
        scores += 10.0

    scores = scores.clip(0, 100)
    return scores, hit_korea, hit_brand


def _score_cooperation_potential(df: pd.DataFrame) -> pd.Series:
    """潜力合作 20%：粉丝数 + 合作互动 + 匹配笔记数。"""
    fans = _safe_numeric(df["粉丝数"])
    coop_interact = _safe_numeric(df["互动中位数_合作"])
    match_notes = _safe_numeric(df["匹配笔记数"])

    fans_pct = _percentile_rank(fans)
    coop_pct = _percentile_rank(coop_interact)
    notes_pct = _percentile_rank(match_notes)

    scores = fans_pct * 0.40 + coop_pct * 0.35 + notes_pct * 0.25
    return scores.clip(0, 100)


def _score_performance(df: pd.DataFrame) -> pd.Series:
    """表现 10%：阅读中位数 + 互动中位数 + ER。"""
    read_median = _safe_numeric(df["阅读中位数_日常"])
    interact_daily = _safe_numeric(df["互动中位数_日常"])
    coop_er = df["合作笔记ER"].map(_parse_er)
    daily_er = df["日常笔记ER"].map(_parse_er)

    read_pct = _percentile_rank(read_median)
    interact_pct = _percentile_rank(interact_daily)
    coop_er_pct = _percentile_rank(coop_er)
    daily_er_pct = _percentile_rank(daily_er)

    scores = read_pct * 0.25 + interact_pct * 0.25 + coop_er_pct * 0.25 + daily_er_pct * 0.25
    return scores.clip(0, 100)


def _score_cost_effectiveness(df: pd.DataFrame) -> pd.Series:
    """性价比 5%：CPM 越低越好。"""
    fans = _safe_numeric(df["粉丝数"])
    price = _safe_numeric(df["全部报价"])

    cpm = pd.Series(np.where(fans > 0, price / fans * 1000, np.nan), index=df.index)

    valid = cpm.notna() & (cpm > 0)
    scores = pd.Series(30.0, index=df.index)

    if valid.any():
        cpm_valid = cpm[valid]
        cpm_ranked = cpm_valid.rank(pct=True)
        cpm_scores = (1 - cpm_ranked) * 100
        scores.loc[valid] = cpm_scores.clip(0, 100)

    return scores


def _score_risk_deduction(df: pd.DataFrame, exclude_kw: List[str]) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """风险扣分 0~-10 + 排除标记：返回 (deductions, risk_reasons, exclude_flag)。"""
    deductions = pd.Series(0.0, index=df.index, dtype=float)
    reasons = pd.Series([""] * len(df), index=df.index, dtype=str)

    def add_reason(idx, reason: str):
        current = reasons.loc[idx]
        reasons.loc[idx] = reason if current == "" else current + ";" + reason

    # 身份|人设 缺失 → -2
    identity = df["身份|人设"].map(_normalize_text)
    mask_id = identity == ""
    deductions -= mask_id.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_id].index:
        add_reason(idx, "身份画像缺失")

    # 内容类目|标签 缺失 → -2
    content = df["内容类目|标签"].map(_normalize_text)
    mask_ct = content == ""
    deductions -= mask_ct.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_ct].index:
        add_reason(idx, "内容标签缺失")

    # 互动中位数_合作 == 0 → -2
    coop_interact = _safe_numeric(df["互动中位数_合作"])
    mask_ci = coop_interact == 0
    deductions -= mask_ci.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_ci].index:
        add_reason(idx, "合作互动为零")

    # 合作笔记ER < 1% → -2
    coop_er = df["合作笔记ER"].map(_parse_er)
    mask_er = coop_er < 1.0
    deductions -= mask_er.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_er].index:
        add_reason(idx, "合作ER<1%")

    # CPM 极端高（前5%）→ -2
    fans = _safe_numeric(df["粉丝数"])
    price = _safe_numeric(df["全部报价"])
    cpm = pd.Series(np.where(fans > 0, price / fans * 1000, np.nan), index=df.index)
    cpm_threshold = cpm.quantile(0.95)
    mask_cpm = cpm.notna() & (cpm >= cpm_threshold)
    deductions -= mask_cpm.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_cpm].index:
        add_reason(idx, "CPM极端高")

    # ---- 排除规则：匹配排除关键词 → -3 + 标记 ----
    exclude_flag = pd.Series(False, index=df.index)
    if exclude_kw:
        exclude_text = (
            df["内容类目|标签"].map(_normalize_text).str.lower()
            + " " + df["身份|人设"].map(_normalize_text).str.lower()
        )
        for idx in df.index:
            text = exclude_text.loc[idx]
            matched_ex = _match_keywords(text, exclude_kw)
            if matched_ex:
                exclude_flag.loc[idx] = True
                deductions.loc[idx] -= 3.0
                add_reason(idx, f"排除类型:{','.join(matched_ex)}")

    deductions = deductions.clip(lower=-RISK_DEDUCTION_MAX, upper=0)
    return deductions, reasons, exclude_flag


def _determine_grade(final_score: float) -> Tuple[str, str]:
    for threshold, label, short in GRADE_THRESHOLDS:
        if final_score >= threshold:
            return label, short
    return "D级(不推荐)", "D"


def run_stage_two() -> dict[str, Any]:
    """执行第二阶段：六维评分引擎 + 评分解释字段。"""
    ensure_runtime_dirs()
    settings = load_settings()
    source_file = resolve_source_file(settings)

    # 加载配置
    default_rules = _load_config("default_rules.json")
    keyword_config = _load_config("keyword_groups.json")
    exclude_config = _load_config("exclude_rules.json")

    content_kw = [k.lower() for k in keyword_config.get("content_keywords", [])]
    korea_kw = [k.lower() for k in keyword_config.get("korea_keywords", [])]
    brand_kw = [k.lower() for k in keyword_config.get("brand_keywords", [])]
    exclude_kw = [k.lower() for k in exclude_config.get("exclude_keywords", [])]

    # 读取并去重
    frame = pd.read_excel(source_file, sheet_name=SHEET_NAME)
    deduped = _dedupe_frame(frame)

    print(f"Stage 2: 去重后共 {len(deduped)} 人，开始六维评分...")

    # ---- 六个维度得分 + 解释 ----
    deduped["score_layered_match"] = _score_layered_match(deduped)

    kw_scores, kw_hits = _score_keyword_combo(deduped, content_kw)
    deduped["score_keyword_combo"] = kw_scores
    deduped["hit_content_keywords"] = kw_hits

    kb_scores, kb_hit_korea, kb_hit_brand = _score_korea_brand(deduped, korea_kw, brand_kw)
    deduped["score_korea_brand"] = kb_scores
    deduped["hit_korea_keywords"] = kb_hit_korea
    deduped["hit_brand_keywords"] = kb_hit_brand

    deduped["score_cooperation_potential"] = _score_cooperation_potential(deduped)
    deduped["score_performance"] = _score_performance(deduped)
    deduped["score_cost_effectiveness"] = _score_cost_effectiveness(deduped)

    risk_ded, risk_reasons, exclude_flag = _score_risk_deduction(deduped, exclude_kw)
    deduped["score_risk_deduction"] = risk_ded
    deduped["risk_reasons"] = risk_reasons
    deduped["exclude_flag"] = exclude_flag

    # ---- 最终分 ----
    w = SCORE_WEIGHTS
    deduped["score_final"] = (
        deduped["score_layered_match"] * w["layered_match"]
        + deduped["score_keyword_combo"] * w["keyword_combo"]
        + deduped["score_korea_brand"] * w["korea_brand"]
        + deduped["score_cooperation_potential"] * w["cooperation_potential"]
        + deduped["score_performance"] * w["performance"]
        + deduped["score_cost_effectiveness"] * w["cost_effectiveness"]
        + deduped["score_risk_deduction"]
    )
    deduped["score_final"] = deduped["score_final"].clip(lower=0)

    # ---- 推荐等级 + 短标签 ----
    grade_tuples = deduped["score_final"].map(_determine_grade)
    deduped["recommend_grade"] = grade_tuples.map(lambda t: t[0])
    deduped["grade_short"] = grade_tuples.map(lambda t: t[1])

    # ---- 排名 ----
    deduped = deduped.sort_values(by=["score_final", "_source_rows"], ascending=[False, False])
    deduped["rank"] = range(1, len(deduped) + 1)

    # ---- 输出列 ----
    output_columns = [
        "rank",
        "creator_key",
        "昵称",
        "小红书号",
        "userId",
        "小红书主页URL",
        "地域",
        "身份|人设",
        "内容类目|标签",
        "抓取关键词",
        "粉丝数",
        "阅读中位数_日常",
        "互动中位数_日常",
        "互动中位数_合作",
        "全部报价",
        "图文报价",
        "视频报价",
        "匹配笔记数",
        "合作笔记ER",
        "日常笔记ER",
        "抓取时间",
        "_source_rows",
        # 评分维度
        "score_layered_match",
        "score_keyword_combo",
        "score_korea_brand",
        "score_cooperation_potential",
        "score_performance",
        "score_cost_effectiveness",
        "score_risk_deduction",
        "score_final",
        "recommend_grade",
        "grade_short",
        # 评分解释
        "hit_content_keywords",
        "hit_korea_keywords",
        "hit_brand_keywords",
        "risk_reasons",
        "exclude_flag",
    ]
    available_cols = [c for c in output_columns if c in deduped.columns]
    result = deduped[available_cols].copy()

    # ---- 合并人工标注 ----
    manual_file = CACHE_DIR / "manual_reviews.json"
    if manual_file.exists():
        try:
            manual_data = json.loads(manual_file.read_text(encoding="utf-8"))
            manual_map = {int(k): v for k, v in manual_data.items()}
            decisions = result["rank"].map(lambda r: manual_map.get(r, {}).get("decision", ""))
            notes = result["rank"].map(lambda r: manual_map.get(r, {}).get("note", ""))
            result["manual_decision"] = decisions.fillna("")
            result["manual_note"] = notes.fillna("")
        except Exception:
            pass
    # 确保列存在（即使没有标注数据）
    if "manual_decision" not in result.columns:
        result["manual_decision"] = ""
    if "manual_note" not in result.columns:
        result["manual_note"] = ""

    # ---- 切片 ----
    top10 = result.head(10)
    top50 = result.head(50)

    # ---- 导出 CSV ----
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    full_csv = OUTPUT_DIR / "scores_full.csv"
    top10_csv = OUTPUT_DIR / "scores_top10.csv"
    top50_csv = OUTPUT_DIR / "scores_top50.csv"

    result.to_csv(full_csv, index=False, encoding="utf-8-sig")
    top10.to_csv(top10_csv, index=False, encoding="utf-8-sig")
    top50.to_csv(top50_csv, index=False, encoding="utf-8-sig")

    # ---- 导出 Excel ----
    excel_path = OUTPUT_DIR / "scores_full.xlsx"
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        result.to_excel(writer, sheet_name="全量评分", index=False)
        top50.to_excel(writer, sheet_name="Top50", index=False)
        top10.to_excel(writer, sheet_name="Top10", index=False)

    # ---- 统计 ----
    grade_distribution = result["recommend_grade"].value_counts().to_dict()
    exclude_count = int(exclude_flag.sum())

    dim_avg = {
        "layered_match": round(float(result["score_layered_match"].mean()), 2),
        "keyword_combo": round(float(result["score_keyword_combo"].mean()), 2),
        "korea_brand": round(float(result["score_korea_brand"].mean()), 2),
        "cooperation_potential": round(float(result["score_cooperation_potential"].mean()), 2),
        "performance": round(float(result["score_performance"].mean()), 2),
        "cost_effectiveness": round(float(result["score_cost_effectiveness"].mean()), 2),
        "risk_deduction": round(float(result["score_risk_deduction"].mean()), 2),
        "final": round(float(result["score_final"].mean()), 2),
    }

    summary = {
        "version": "v3-stage3",
        "total_creators": int(len(result)),
        "excluded_creators": exclude_count,
        "score_max": round(float(result["score_final"].max()), 2),
        "score_min": round(float(result["score_final"].min()), 2),
        "top10": top10[["rank", "昵称", "score_final", "recommend_grade", "grade_short", "exclude_flag"]].to_dict("records"),
        "top50_grade_distribution": {k: int(v) for k, v in top50["recommend_grade"].value_counts().to_dict().items()},
        "full_grade_distribution": {k: int(v) for k, v in grade_distribution.items()},
        "dimension_averages": dim_avg,
        "output_files": {
            "full_csv": str(full_csv),
            "top10_csv": str(top10_csv),
            "top50_csv": str(top50_csv),
            "excel": str(excel_path),
        },
    }

    # 写入统计缓存
    summary_path = CACHE_DIR / "scoring_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    return summary


def score_excel_to_csv(source_excel_path: str, output_csv_path: str) -> dict[str, Any]:
    """直接对指定 Excel 文件评分，输出到指定 CSV 路径（Web 导入用）。"""
    source = Path(source_excel_path)
    if not source.exists():
        raise FileNotFoundError(f"源文件不存在: {source}")

    config_dir = CONFIG_DIR
    default_rules = _load_config("default_rules.json") if (config_dir / "default_rules.json").exists() else {}
    keyword_config = _load_config("keyword_groups.json") if (config_dir / "keyword_groups.json").exists() else {}
    exclude_config = _load_config("exclude_rules.json") if (config_dir / "exclude_rules.json").exists() else {}

    content_kw = [k.lower() for k in keyword_config.get("content_keywords", [])]
    korea_kw = [k.lower() for k in keyword_config.get("korea_keywords", [])]
    brand_kw = [k.lower() for k in keyword_config.get("brand_keywords", [])]
    exclude_kw = [k.lower() for k in exclude_config.get("exclude_keywords", [])]

    frame = pd.read_excel(source, sheet_name=SHEET_NAME)
    deduped = _dedupe_frame(frame)

    # 六个维度评分
    deduped["score_layered_match"] = _score_layered_match(deduped)
    kw_scores, kw_hits = _score_keyword_combo(deduped, content_kw)
    deduped["score_keyword_combo"] = kw_scores
    deduped["hit_content_keywords"] = kw_hits
    kb_scores, kb_hit_korea, kb_hit_brand = _score_korea_brand(deduped, korea_kw, brand_kw)
    deduped["score_korea_brand"] = kb_scores
    deduped["hit_korea_keywords"] = kb_hit_korea
    deduped["hit_brand_keywords"] = kb_hit_brand
    deduped["score_cooperation_potential"] = _score_cooperation_potential(deduped)
    deduped["score_performance"] = _score_performance(deduped)
    deduped["score_cost_effectiveness"] = _score_cost_effectiveness(deduped)
    risk_ded, risk_reasons, exclude_flag = _score_risk_deduction(deduped, exclude_kw)
    deduped["score_risk_deduction"] = risk_ded
    deduped["risk_reasons"] = risk_reasons
    deduped["exclude_flag"] = exclude_flag

    w = SCORE_WEIGHTS
    deduped["score_final"] = (
        deduped["score_layered_match"] * w["layered_match"]
        + deduped["score_keyword_combo"] * w["keyword_combo"]
        + deduped["score_korea_brand"] * w["korea_brand"]
        + deduped["score_cooperation_potential"] * w["cooperation_potential"]
        + deduped["score_performance"] * w["performance"]
        + deduped["score_cost_effectiveness"] * w["cost_effectiveness"]
        + deduped["score_risk_deduction"]
    ).clip(lower=0)

    grade_tuples = deduped["score_final"].map(_determine_grade)
    deduped["recommend_grade"] = grade_tuples.map(lambda t: t[0])
    deduped["grade_short"] = grade_tuples.map(lambda t: t[1])
    deduped = deduped.sort_values(by=["score_final", "_source_rows"], ascending=[False, False])
    deduped["rank"] = range(1, len(deduped) + 1)

    output_columns = [
        "rank", "creator_key", "昵称", "小红书号", "userId", "小红书主页URL",
        "地域", "身份|人设", "内容类目|标签", "抓取关键词",
        "粉丝数", "阅读中位数_日常", "互动中位数_日常", "互动中位数_合作",
        "全部报价", "图文报价", "视频报价", "匹配笔记数", "合作笔记ER", "日常笔记ER",
        "抓取时间", "_source_rows",
        "score_layered_match", "score_keyword_combo", "score_korea_brand",
        "score_cooperation_potential", "score_performance", "score_cost_effectiveness",
        "score_risk_deduction", "score_final", "recommend_grade", "grade_short",
        "hit_content_keywords", "hit_korea_keywords", "hit_brand_keywords",
        "risk_reasons", "exclude_flag",
    ]
    available_cols = [c for c in output_columns if c in deduped.columns]
    result = deduped[available_cols].copy()

    # 数据清洗
    from services.data_cleaning import clean_dataframe as _clean
    result = _clean(result)

    out_path = Path(output_csv_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(out_path, index=False, encoding="utf-8-sig")

    return {
        "source_file": str(source),
        "creator_count": int(len(result)),
        "output_csv": str(out_path),
    }
