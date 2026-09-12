from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import scripts.park_candidates_analysis as park

INPUT_FILE = ROOT_DIR / "data" / "input" / "达人列表_20260623194334.xlsx"
OUTPUT_FILE = ROOT_DIR / "data" / "output" / "评分规则敏感性分析_20260623.xlsx"
REPORT_FILE = sorted((ROOT_DIR / "data" / "output").glob("朴代表候选达人AI分析报告*.xlsx"))[-1]

SCENARIO_NAMES = {
    "A": "场景A_原始规则",
    "B": "场景B_价格权重减半",
    "C": "场景C_价格风险放宽",
    "D": "场景D_只看内容与韩国匹配",
    "E": "场景E_按粉丝量级比较报价",
}

RECOMMENDATION_BAND = {
    "S": "推荐",
    "A": "推荐",
    "B": "谨慎",
    "C": "谨慎",
    "D": "不推荐",
}


@dataclass
class ScenarioConfig:
    code: str
    weights: dict[str, float]
    include_risk: bool = True
    cost_mode: str = "global"
    cpm_penalty: float = -2.0
    only_content_match: bool = False


def _load_config(name: str) -> dict[str, Any]:
    path = park.CONFIG_DIR / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def _fan_bucket_label(fans: float) -> str:
    if fans >= 1_000_000:
        return "100w+"
    if fans >= 300_000:
        return "30w-100w"
    if fans >= 150_000:
        return "15w-30w"
    if fans >= 100_000:
        return "10w-15w"
    return "<10w"


def _compute_cpm(df: pd.DataFrame) -> pd.Series:
    fans = _safe_numeric(df["粉丝数"])
    price = _safe_numeric(df["全部报价"])
    return pd.Series(np.where(fans > 0, price / fans * 1000, np.nan), index=df.index)


def _cost_scores_global(df: pd.DataFrame) -> pd.Series:
    return park.score_cost_effectiveness(df)


def _cost_scores_by_bucket(df: pd.DataFrame) -> pd.Series:
    scores = pd.Series(50.0, index=df.index, dtype=float)
    cpm = _compute_cpm(df)
    buckets = _safe_numeric(df["粉丝数"]).map(_fan_bucket_label)

    for bucket in buckets.unique():
        idx = buckets[buckets == bucket].index
        cpm_bucket = cpm.loc[idx]
        valid = cpm_bucket.notna() & (cpm_bucket > 0)
        if valid.sum() >= 2:
            ranked = cpm_bucket[valid].rank(pct=True)
            scores.loc[ranked.index] = ((1 - ranked) * 100).clip(0, 100)
        elif valid.sum() == 1:
            scores.loc[valid[valid].index] = 50.0
    return scores


def _risk_deduction(
    df: pd.DataFrame,
    exclude_kw: list[str],
    cpm_penalty: float,
    cpm_mode: str,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    deductions = pd.Series(0.0, index=df.index, dtype=float)
    reasons = pd.Series([""] * len(df), index=df.index, dtype=str)

    def add_reason(idx: int, reason: str) -> None:
        current = reasons.loc[idx]
        reasons.loc[idx] = reason if current == "" else current + ";" + reason

    identity = df["身份|人设"].map(park._normalize_text)
    mask_id = identity == ""
    deductions -= mask_id.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_id].index:
        add_reason(idx, "标签画像缺失")

    content = df["内容类目|标签"].map(park._normalize_text)
    mask_ct = content == ""
    deductions -= mask_ct.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_ct].index:
        add_reason(idx, "内容标签缺失")

    coop_interact = _safe_numeric(df["互动中位数_合作"])
    mask_ci = coop_interact == 0
    deductions -= mask_ci.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_ci].index:
        add_reason(idx, "合作互动为零")

    coop_er = df["合作笔记ER"].map(park._parse_er)
    mask_er = coop_er < 1.0
    deductions -= mask_er.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_er].index:
        add_reason(idx, "合作ER<1%")

    cpm = _compute_cpm(df)
    if cpm_mode == "fan_bucket":
        buckets = _safe_numeric(df["粉丝数"]).map(_fan_bucket_label)
        mask_cpm = pd.Series(False, index=df.index)
        for bucket in buckets.unique():
            idx = buckets[buckets == bucket].index
            cpm_bucket = cpm.loc[idx]
            valid = cpm_bucket.notna() & (cpm_bucket > 0)
            if valid.sum() >= 2:
                threshold = cpm_bucket[valid].quantile(0.95)
                mask_cpm.loc[idx] = cpm_bucket >= threshold
    else:
        threshold = cpm.quantile(0.95) if cpm.notna().any() else float("inf")
        mask_cpm = cpm.notna() & (cpm > 0) & (cpm >= threshold)

    deductions += mask_cpm.map(lambda x: cpm_penalty if x else 0.0)
    for idx in deductions[mask_cpm].index:
        add_reason(idx, "CPM极端高")

    exclude_flag = pd.Series(False, index=df.index)
    if exclude_kw:
        exclude_text = (
            df["内容类目|标签"].map(park._normalize_text).str.lower()
            + " " + df["身份|人设"].map(park._normalize_text).str.lower()
        )
        for idx in df.index:
            matched_ex = park._match_keywords(exclude_text.loc[idx], exclude_kw)
            if matched_ex:
                exclude_flag.loc[idx] = True
                deductions.loc[idx] -= 3.0
                add_reason(idx, f"排除类型:{','.join(matched_ex)}")

    deductions = deductions.clip(lower=-park.RISK_DEDUCTION_MAX, upper=0)
    return deductions, reasons, exclude_flag


def _recommendation_band(grade_short: str) -> str:
    return RECOMMENDATION_BAND.get(grade_short, "不推荐")


def _classify_alignment(grade_short: str, ai_decision_zh: str) -> tuple[str, bool]:
    band = _recommendation_band(grade_short)
    if (band == "推荐" and ai_decision_zh == "推荐") or (
        band == "谨慎" and ai_decision_zh == "谨慎推荐"
    ) or (band == "不推荐" and ai_decision_zh == "不优先推荐"):
        return "一致", False
    if band == "推荐" and ai_decision_zh == "谨慎推荐":
        return "规则更乐观", True
    if band == "谨慎" and ai_decision_zh == "推荐":
        return "AI更乐观", True
    if band == "不推荐" and ai_decision_zh != "不优先推荐":
        return "AI更乐观", True
    if band in {"推荐", "谨慎"} and ai_decision_zh == "不优先推荐":
        return "AI更保守", True
    return "需要人工复核", True


def _pick_primary_factors(row: pd.Series) -> str:
    factors: list[str] = []
    risk_text = " ".join(
        str(row.get(col, "")) for col in ["AI风险点", "AI总结", "AI推荐理由", "risk_reasons"]
    )
    if any(token in risk_text for token in ["报价", "性价比", "CPM", "压价"]):
        factors.append("价格")
    if row.get("score_korea_brand", 0) < 35 or not park._normalize_text(row.get("hit_korea_keywords", "")):
        factors.append("韩国关联")
    if not park._normalize_text(row.get("hit_brand_keywords", "")) or "品牌" in risk_text:
        factors.append("品牌匹配")
    if row.get("score_keyword_combo", 0) < 40 or any(token in risk_text for token in ["内容", "调性", "风格", "标签"]):
        factors.append("内容调性")
    if (
        park._normalize_text(row.get("过往合作品牌", "")) in {"", "-", "nan"}
        or row.get("score_performance", 0) < 45
        or float(row.get("邀约48小时回复率", 0) or 0) < 0.6
    ):
        factors.append("商业表现")
    missing_brand = park._normalize_text(row.get("过往合作品牌", "")) in {"", "-", "nan"}
    try:
        missing_store = float(row.get("外溢进店中位数", 0) or 0) == 0
    except (TypeError, ValueError):
        missing_store = True
    if missing_brand or missing_store:
        factors.append("数据缺失")
    ordered = []
    for factor in ["价格", "韩国关联", "品牌匹配", "内容调性", "商业表现", "数据缺失"]:
        if factor in factors:
            ordered.append(factor)
    return " / ".join(ordered)


def _suggest_action(row: pd.Series) -> str:
    ai = park._normalize_text(row.get("AI结论", ""))
    score = float(row.get("score_final", 0) or 0)
    factors = _pick_primary_factors(row)
    if ai == "推荐" and score >= 65:
        return "优先联系"
    if "数据缺失" in factors or "韩国关联" in factors:
        return "补充人工观察"
    if ai == "谨慎推荐" or score >= 50:
        return "小预算试投"
    return "暂缓联系"


def _scenario_configs() -> list[ScenarioConfig]:
    base_weights = dict(park.SCORE_WEIGHTS)
    return [
        ScenarioConfig(code="A", weights=dict(base_weights)),
        ScenarioConfig(
            code="B",
            weights={**base_weights, "cost_effectiveness": base_weights["cost_effectiveness"] * 0.5},
        ),
        ScenarioConfig(code="C", weights=dict(base_weights), cpm_penalty=-1.0),
        ScenarioConfig(code="D", weights=dict(base_weights), include_risk=False, only_content_match=True),
        ScenarioConfig(code="E", weights=dict(base_weights), cost_mode="fan_bucket"),
    ]


def load_base_frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    raw_df = pd.read_excel(INPUT_FILE, sheet_name="达人列表")
    mapped_df = park.map_pugongying_fields(raw_df)
    return raw_df, mapped_df


def score_for_scenario(mapped_df: pd.DataFrame, config: ScenarioConfig, exclude_kw: list[str]) -> pd.DataFrame:
    df = mapped_df.copy()
    df["score_layered_match"] = park.score_layered_match(df)
    df["score_keyword_combo"], df["hit_content_keywords"] = park.score_keyword_combo(
        df, [k.lower() for k in _load_config("keyword_groups.json").get("content_keywords", [])]
    )
    (
        df["score_korea_brand"],
        df["hit_korea_keywords"],
        df["hit_brand_keywords"],
    ) = park.score_korea_brand(
        df,
        [k.lower() for k in _load_config("keyword_groups.json").get("korea_keywords", [])],
        [k.lower() for k in _load_config("keyword_groups.json").get("brand_keywords", [])],
    )
    df["score_cooperation_potential"] = park.score_cooperation_potential(df)
    df["score_performance"] = park.score_performance(df)
    if config.cost_mode == "fan_bucket":
        df["score_cost_effectiveness"] = _cost_scores_by_bucket(df)
    else:
        df["score_cost_effectiveness"] = _cost_scores_global(df)

    risk_ded, risk_reasons, exclude_flag = _risk_deduction(
        df,
        exclude_kw=exclude_kw,
        cpm_penalty=config.cpm_penalty,
        cpm_mode=config.cost_mode,
    )
    df["score_risk_deduction"] = risk_ded if config.include_risk else 0.0
    df["risk_reasons"] = risk_reasons
    df["exclude_flag"] = exclude_flag
    df["cpm"] = _compute_cpm(df).round(2)
    df["fan_bucket"] = _safe_numeric(df["粉丝数"]).map(_fan_bucket_label)

    if config.only_content_match:
        df["score_final"] = (
            df["score_keyword_combo"] * park.SCORE_WEIGHTS["keyword_combo"]
            + df["score_korea_brand"] * park.SCORE_WEIGHTS["korea_brand"]
        ) / (park.SCORE_WEIGHTS["keyword_combo"] + park.SCORE_WEIGHTS["korea_brand"])
    else:
        w = config.weights
        df["score_final"] = (
            df["score_layered_match"] * w["layered_match"]
            + df["score_keyword_combo"] * w["keyword_combo"]
            + df["score_korea_brand"] * w["korea_brand"]
            + df["score_cooperation_potential"] * w["cooperation_potential"]
            + df["score_performance"] * w["performance"]
            + df["score_cost_effectiveness"] * w["cost_effectiveness"]
            + df["score_risk_deduction"]
        )
    df["score_final"] = df["score_final"].clip(lower=0)

    grade_tuples = df["score_final"].map(park.determine_grade)
    df["recommend_grade"] = grade_tuples.map(lambda item: item[0])
    df["grade_short"] = grade_tuples.map(lambda item: item[1])

    df = df.sort_values(["score_final", "粉丝数"], ascending=[False, False]).reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)
    df["recommendation_band"] = df["grade_short"].map(_recommendation_band)
    df["scenario_code"] = config.code
    df["scenario_name"] = SCENARIO_NAMES[config.code]
    return df


def load_latest_report_detail() -> pd.DataFrame:
    xl = pd.ExcelFile(REPORT_FILE)
    detail_df = pd.read_excel(REPORT_FILE, sheet_name=xl.sheet_names[2])
    rank_df = pd.read_excel(REPORT_FILE, sheet_name=xl.sheet_names[1])
    keep_cols = ["排名", "达人昵称", "系统评分", "系统等级", "AI结论", "建议联系"]
    merged = rank_df[keep_cols].rename(columns={"排名": "rank", "达人昵称": "昵称"})
    detail_df = detail_df.merge(merged, on=["rank", "昵称"], how="left")
    if "AI结论_y" in detail_df.columns:
        detail_df["AI结论"] = detail_df["AI结论_y"].fillna(detail_df.get("AI结论_x"))
    elif "AI结论_x" in detail_df.columns:
        detail_df["AI结论"] = detail_df["AI结论_x"]
    return detail_df


def build_divergence_table(base_df: pd.DataFrame, detail_df: pd.DataFrame) -> pd.DataFrame:
    merged = base_df.merge(
        detail_df[
            [
                "rank",
                "昵称",
                "系统评分",
                "系统等级",
                "AI结论",
                "建议联系",
                "AI总结",
                "AI推荐理由",
                "AI风险点",
            ]
        ],
        on=["rank", "昵称"],
        how="left",
    )

    rows = []
    for _, row in merged.iterrows():
        alignment_text, is_divergent = _classify_alignment(row["grade_short"], park._normalize_text(row["AI结论"]))
        risk_text = park._normalize_text(row.get("AI风险点", ""))
        if is_divergent:
            reason = f"系统{row['recommend_grade']}，AI为{row['AI结论']}；主要因为{risk_text or 'AI更重视价格/匹配等风险'}"
        else:
            reason = f"系统与AI基本一致；AI关注点集中在{risk_text or '常规风险复核'}"
        rows.append(
            {
                "达人昵称": row["昵称"],
                "系统分": round(float(row["score_final"]), 1),
                "系统等级": row["recommend_grade"],
                "AI结论": row["AI结论"],
                "推荐联系建议": row["建议联系"],
                "人工初步观感": "",
                "是否存在分歧": "是" if is_divergent else "否",
                "分歧原因": reason,
                "主要影响因素": _pick_primary_factors(row),
                "建议处理": _suggest_action(row),
            }
        )
    return pd.DataFrame(rows)


def build_price_diagnostics(base_df: pd.DataFrame) -> pd.DataFrame:
    df = base_df.copy()
    df["粉丝数(万)"] = (df["粉丝数"] / 10000).round(1)
    df["阅读中位数/粉丝"] = (df["阅读中位数_日常"] / df["粉丝数"]).replace([np.inf, -np.inf], np.nan).round(4)
    df["互动中位数/粉丝"] = (df["互动中位数_日常"] / df["粉丝数"]).replace([np.inf, -np.inf], np.nan).round(4)
    df["合作ER数值"] = df["合作笔记ER"].map(park._parse_er).round(2)
    df["日常ER数值"] = df["日常笔记ER"].map(park._parse_er).round(2)
    df["价格贡献分"] = (df["score_cost_effectiveness"] * park.SCORE_WEIGHTS["cost_effectiveness"]).round(2)
    df["高CPM风险扣分"] = df["risk_reasons"].map(lambda x: -2 if "CPM极端高" in park._normalize_text(x) else 0)
    df["AI是否提到报价偏高"] = df["AI风险点"].map(
        lambda x: "是" if any(token in park._normalize_text(x) for token in ["报价", "CPM", "性价比"]) else "否"
    )
    return df[
        [
            "rank",
            "昵称",
            "粉丝数(万)",
            "图文报价",
            "视频报价",
            "全部报价",
            "cpm",
            "fan_bucket",
            "阅读中位数_日常",
            "互动中位数_日常",
            "合作ER数值",
            "日常ER数值",
            "score_cost_effectiveness",
            "价格贡献分",
            "高CPM风险扣分",
            "AI是否提到报价偏高",
        ]
    ].rename(columns={"rank": "原始排名", "昵称": "达人昵称"})


def build_scenario_comparison(scenarios: dict[str, pd.DataFrame]) -> pd.DataFrame:
    base = scenarios["A"][["昵称", "rank", "score_final", "recommend_grade", "grade_short", "recommendation_band"]].rename(
        columns={
            "rank": "原始排名",
            "score_final": "原始分",
            "recommend_grade": "原始等级",
            "grade_short": "原始短等级",
            "recommendation_band": "原始推荐带",
        }
    )
    frames: list[pd.DataFrame] = []
    for code, df in scenarios.items():
        scenario_df = df[
            ["昵称", "rank", "score_final", "recommend_grade", "grade_short", "recommendation_band"]
        ].rename(
            columns={
                "rank": "排名",
                "score_final": "最终分",
                "recommend_grade": "等级",
                "grade_short": "短等级",
                "recommendation_band": "推荐带",
            }
        )
        merged = base.merge(scenario_df, on="昵称", how="left")
        merged["场景"] = SCENARIO_NAMES[code]
        merged["与原始排名变化"] = merged["原始排名"] - merged["排名"]
        merged["是否从谨慎变成推荐"] = np.where(
            (merged["原始推荐带"] == "谨慎") & (merged["推荐带"] == "推荐"), "是", "否"
        )
        merged["是否从不推荐变成谨慎"] = np.where(
            (merged["原始推荐带"] == "不推荐") & (merged["推荐带"] == "谨慎"), "是", "否"
        )
        frames.append(merged)
    comparison = pd.concat(frames, ignore_index=True)
    return comparison[
        [
            "场景",
            "昵称",
            "排名",
            "最终分",
            "等级",
            "与原始排名变化",
            "是否从谨慎变成推荐",
            "是否从不推荐变成谨慎",
        ]
    ].rename(columns={"昵称": "达人昵称"})


def build_scenario_summary(scenarios: dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows = []
    base = scenarios["A"].set_index("昵称")
    for code, df in scenarios.items():
        aligned = df.set_index("昵称")
        deltas = (base["rank"] - aligned["rank"]).abs()
        rows.append(
            {
                "场景": SCENARIO_NAMES[code],
                "推荐人数(S/A)": int(aligned["grade_short"].isin(["S", "A"]).sum()),
                "谨慎人数(B/C)": int(aligned["grade_short"].isin(["B", "C"]).sum()),
                "不推荐人数(D)": int((aligned["grade_short"] == "D").sum()),
                "平均最终分": round(float(aligned["score_final"].mean()), 2),
                "平均排名变化绝对值": round(float(deltas.mean()), 2),
                "最大排名提升": int((base["rank"] - aligned["rank"]).max()),
                "最大排名下降": int((base["rank"] - aligned["rank"]).min()),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    if OUTPUT_FILE.exists():
        raise FileExistsError(f"输出文件已存在，请先处理后再运行：{OUTPUT_FILE}")

    _, mapped_df = load_base_frames()
    exclude_kw = [k.lower() for k in _load_config("exclude_rules.json").get("exclude_keywords", [])]

    scenarios = {
        config.code: score_for_scenario(mapped_df, config, exclude_kw)
        for config in _scenario_configs()
    }
    detail_df = load_latest_report_detail()

    divergence_df = build_divergence_table(scenarios["A"], detail_df)
    price_df = build_price_diagnostics(
        scenarios["A"].merge(
            detail_df[["rank", "昵称", "AI风险点"]],
            on=["rank", "昵称"],
            how="left",
        )
    )
    scenario_comparison_df = build_scenario_comparison(scenarios)
    scenario_summary_df = build_scenario_summary(scenarios)

    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        divergence_df.to_excel(writer, sheet_name="分歧分析", index=False)
        price_df.to_excel(writer, sheet_name="价格诊断", index=False)
        scenario_summary_df.to_excel(writer, sheet_name="场景汇总", index=False)
        scenario_comparison_df.to_excel(writer, sheet_name="场景对比", index=False)
        for code, df in scenarios.items():
            out = df.copy()
            out["粉丝数(万)"] = (out["粉丝数"] / 10000).round(1)
            out.to_excel(writer, sheet_name=f"{code}_{SCENARIO_NAMES[code]}", index=False)

    print(f"生成完成: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
