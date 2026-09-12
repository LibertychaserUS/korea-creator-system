from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import scripts.park_candidates_analysis as park


INPUT_FILE = ROOT_DIR / "data" / "input" / "达人列表_20260623194334.xlsx"
OUTPUT_FILE = ROOT_DIR / "data" / "output" / "朴代表候选达人评分拆解表_20260624.xlsx"
REPORT_FILE = sorted((ROOT_DIR / "data" / "output").glob("朴代表候选达人AI分析报告*.xlsx"))[-1]

DIMENSION_LABELS = [
    ("score_layered_match", "分层筛选", park.SCORE_WEIGHTS["layered_match"]),
    ("score_keyword_combo", "关键词组合", park.SCORE_WEIGHTS["keyword_combo"]),
    ("score_korea_brand", "韩国品牌", park.SCORE_WEIGHTS["korea_brand"]),
    ("score_cooperation_potential", "潜力合作", park.SCORE_WEIGHTS["cooperation_potential"]),
    ("score_performance", "表现", park.SCORE_WEIGHTS["performance"]),
    ("score_cost_effectiveness", "性价比", park.SCORE_WEIGHTS["cost_effectiveness"]),
]


def _load_config(name: str) -> dict[str, Any]:
    path = park.CONFIG_DIR / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def _compute_cpm(df: pd.DataFrame) -> pd.Series:
    fans = _safe_numeric(df["粉丝数"])
    price = _safe_numeric(df["全部报价"])
    return pd.Series(np.where(fans > 0, price / fans * 1000, np.nan), index=df.index)


def _load_ai_detail() -> pd.DataFrame:
    xl = pd.ExcelFile(REPORT_FILE)
    detail_df = pd.read_excel(REPORT_FILE, sheet_name=xl.sheet_names[2])
    rank_df = pd.read_excel(REPORT_FILE, sheet_name=xl.sheet_names[1])
    rank_keep = rank_df[
        ["排名", "达人昵称", "系统评分", "系统等级", "AI结论", "AI总结", "主要风险", "建议联系"]
    ].rename(columns={"排名": "rank", "达人昵称": "昵称", "主要风险": "AI主要风险"})
    merged = detail_df.merge(rank_keep, on=["rank", "昵称"], how="left")
    if "AI结论_y" in merged.columns:
        merged["AI结论"] = merged["AI结论_y"].fillna(merged.get("AI结论_x"))
    elif "AI结论_x" in merged.columns:
        merged["AI结论"] = merged["AI结论_x"]
    if "AI总结_y" in merged.columns:
        merged["AI总结"] = merged["AI总结_y"].fillna(merged.get("AI总结_x"))
    elif "AI总结_x" in merged.columns:
        merged["AI总结"] = merged["AI总结_x"]
    return merged


def _score_base_frame() -> pd.DataFrame:
    raw_df = pd.read_excel(INPUT_FILE, sheet_name="达人列表")
    df = park.map_pugongying_fields(raw_df)

    keyword_config = _load_config("keyword_groups.json")
    exclude_config = _load_config("exclude_rules.json")

    content_kw = [k.lower() for k in keyword_config.get("content_keywords", [])]
    korea_kw = [k.lower() for k in keyword_config.get("korea_keywords", [])]
    brand_kw = [k.lower() for k in keyword_config.get("brand_keywords", [])]
    exclude_kw = [k.lower() for k in exclude_config.get("exclude_keywords", [])]

    df["score_layered_match"] = park.score_layered_match(df)
    df["score_keyword_combo"], df["hit_content_keywords"] = park.score_keyword_combo(df, content_kw)
    (
        df["score_korea_brand"],
        df["hit_korea_keywords"],
        df["hit_brand_keywords"],
    ) = park.score_korea_brand(df, korea_kw, brand_kw)
    df["score_cooperation_potential"] = park.score_cooperation_potential(df)
    df["score_performance"] = park.score_performance(df)
    df["score_cost_effectiveness"] = park.score_cost_effectiveness(df)
    (
        df["score_risk_deduction"],
        df["risk_reasons"],
        df["exclude_flag"],
    ) = park.score_risk_deduction(df, exclude_kw)

    w = park.SCORE_WEIGHTS
    df["score_final"] = (
        df["score_layered_match"] * w["layered_match"]
        + df["score_keyword_combo"] * w["keyword_combo"]
        + df["score_korea_brand"] * w["korea_brand"]
        + df["score_cooperation_potential"] * w["cooperation_potential"]
        + df["score_performance"] * w["performance"]
        + df["score_cost_effectiveness"] * w["cost_effectiveness"]
        + df["score_risk_deduction"]
    ).clip(lower=0)

    grades = df["score_final"].map(park.determine_grade)
    df["recommend_grade"] = grades.map(lambda item: item[0])
    df["grade_short"] = grades.map(lambda item: item[1])
    df["cpm"] = _compute_cpm(df)
    df = df.sort_values(["score_final", "粉丝数"], ascending=[False, False]).reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)
    return df


def _build_risk_breakdown(df: pd.DataFrame, exclude_kw: list[str]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    cpm = df["cpm"]
    cpm_threshold = cpm.quantile(0.95) if cpm.notna().any() else float("inf")
    for _, row in df.iterrows():
        identity_missing = -2 if park._normalize_text(row["身份|人设"]) == "" else 0
        content_missing = -2 if park._normalize_text(row["内容类目|标签"]) == "" else 0
        coop_zero = -2 if float(row["互动中位数_合作"] or 0) == 0 else 0
        coop_er_low = -2 if park._parse_er(row["合作笔记ER"]) < 1.0 else 0
        cpm_high = -2 if pd.notna(row["cpm"]) and row["cpm"] > 0 and row["cpm"] >= cpm_threshold else 0
        exclude_hits = park._match_keywords(
            (
                park._normalize_text(row["内容类目|标签"]).lower()
                + " "
                + park._normalize_text(row["身份|人设"]).lower()
            ),
            exclude_kw,
        )
        exclude_deduction = -3 if exclude_hits else 0
        total = max(
            -park.RISK_DEDUCTION_MAX,
            identity_missing + content_missing + coop_zero + coop_er_low + cpm_high + exclude_deduction,
        )
        rows.append(
            {
                "达人昵称": row["昵称"],
                "标签缺失扣分": identity_missing,
                "内容标签缺失扣分": content_missing,
                "合作互动为零扣分": coop_zero,
                "合作ER过低扣分": coop_er_low,
                "CPM极端高扣分": cpm_high,
                "排除关键词扣分": exclude_deduction,
                "总风险扣分": total,
                "_exclude_hits": ",".join(exclude_hits),
            }
        )
    return pd.DataFrame(rows)


def _build_price_position(df: pd.DataFrame) -> pd.Series:
    valid = df["cpm"].rank(method="min", ascending=True)
    total = len(df)
    labels = []
    for idx, row in df.iterrows():
        order = int(valid.loc[idx]) if pd.notna(row["cpm"]) else total
        pct = order / total * 100
        labels.append(f"第{order}/{total}位（CPM由低到高，约{pct:.0f}%分位）")
    return pd.Series(labels, index=df.index)


def _main_loss_reason(row: pd.Series, risk_row: pd.Series) -> str:
    reasons: list[str] = []
    low_dims = []
    for key, label, _ in DIMENSION_LABELS:
        score = float(row[key])
        if score < 40:
            low_dims.append(f"{label}{score:.0f}分")
    if low_dims:
        reasons.append("维度偏低：" + "、".join(low_dims[:3]))
    if risk_row["总风险扣分"] < 0:
        reasons.append(f"风险扣分{int(risk_row['总风险扣分'])}分")
    if "报价" in park._normalize_text(row.get("AI主要风险", "")) or "CPM" in park._normalize_text(row.get("AI主要风险", "")):
        reasons.append("AI提示报价/性价比风险")
    if not reasons:
        reasons.append("无明显单点丢分，整体较均衡")
    return "；".join(reasons)


def _keyword_explanation(row: pd.Series, exclude_hits: str) -> tuple[str, str]:
    region_bonus = 40 if "韩国" in park._normalize_text(row["地域"]) else 0
    korea_hits = [hit for hit in park._normalize_text(row["hit_korea_keywords"]).split(",") if hit]
    brand_hits = [hit for hit in park._normalize_text(row["hit_brand_keywords"]).split(",") if hit]
    content_hits = [hit for hit in park._normalize_text(row["hit_content_keywords"]).split(",") if hit]

    korea_exp = (
        f"地域信号{region_bonus}分；韩国地点词命中{len(korea_hits)}个；韩国品牌词命中{len(brand_hits)}个；"
        f"最终韩国品牌维度{float(row['score_korea_brand']):.1f}分"
    )
    if not korea_hits and not brand_hits and region_bonus == 0:
        korea_exp += "；说明：几乎没有韩国相关直接信号"

    keyword_exp = (
        f"内容调性词命中{len(content_hits)}个（{','.join(content_hits) or '无'}）；"
        f"关键词组合维度{float(row['score_keyword_combo']):.1f}分"
    )
    if exclude_hits:
        keyword_exp += f"；命中排除词：{exclude_hits}"
    return korea_exp, keyword_exp


def _conflict_status(system_grade: str, ai_decision: str) -> tuple[str, str, str]:
    system_band = "推荐" if system_grade.startswith(("S", "A")) else "谨慎" if system_grade.startswith(("B", "C")) else "不推荐"
    if (system_band == "推荐" and ai_decision == "推荐") or (
        system_band == "谨慎" and ai_decision == "谨慎推荐"
    ) or (system_band == "不推荐" and ai_decision == "不优先推荐"):
        return "否", "系统与AI结论基本一致", "按当前结论补看内容样例即可"
    if system_band == "推荐" and ai_decision == "谨慎推荐":
        return "是", "系统分较高，但AI认为仍有商业/报价/匹配风险", "优先补看内容调性、报价合理性、历史品牌案例"
    if system_band == "谨慎" and ai_decision == "推荐":
        return "是", "AI比规则更乐观，可能更看重内容潜力", "补看商业数据是否被规则低估"
    return "是", "系统与AI判断方向不同，需要人工裁决", "重点核实报价、韩国关联和品牌调性"


def build_workbook() -> dict[str, pd.DataFrame]:
    base_df = _score_base_frame()
    ai_df = _load_ai_detail()
    merged = base_df.merge(
        ai_df[
            ["rank", "昵称", "AI结论", "AI总结", "AI推荐理由", "AI风险点", "AI主要风险", "建议联系"]
        ],
        on=["rank", "昵称"],
        how="left",
    )

    exclude_kw = [k.lower() for k in _load_config("exclude_rules.json").get("exclude_keywords", [])]
    risk_df = _build_risk_breakdown(merged, exclude_kw)
    merged = merged.merge(risk_df, left_on="昵称", right_on="达人昵称", how="left")
    merged["CPM在当前样本中的位置"] = _build_price_position(merged)

    overview_rows = []
    for _, row in merged.iterrows():
        risk_row = risk_df.loc[risk_df["达人昵称"] == row["昵称"]].iloc[0]
        overview_rows.append(
            {
                "达人昵称": row["昵称"],
                "最终分": round(float(row["score_final"]), 2),
                "等级": row["recommend_grade"],
                "AI结论": row["AI结论"],
                "联系建议": row["建议联系"],
                "主要丢分原因": _main_loss_reason(row, risk_row),
            }
        )
    overview_df = pd.DataFrame(overview_rows)

    six_dim_rows = []
    for _, row in merged.iterrows():
        item: dict[str, Any] = {"达人昵称": row["昵称"]}
        for key, label, weight in DIMENSION_LABELS:
            item[f"{label}原始分"] = round(float(row[key]), 2)
            item[f"{label}贡献分"] = round(float(row[key]) * weight, 2)
        item["风险扣分"] = round(float(row["score_risk_deduction"]), 2)
        item["最终分"] = round(float(row["score_final"]), 2)
        six_dim_rows.append(item)
    six_dim_df = pd.DataFrame(six_dim_rows)

    price_rows = []
    for _, row in merged.iterrows():
        ai_price_flag = "是" if any(
            token in park._normalize_text(row.get("AI风险点", "")) for token in ["报价", "CPM", "性价比"]
        ) else "否"
        price_rows.append(
            {
                "达人昵称": row["昵称"],
                "粉丝数": int(float(row["粉丝数"])),
                "图文报价": int(float(row["图文报价"])),
                "视频报价": int(float(row["视频报价"])),
                "全部报价": int(float(row["全部报价"])),
                "CPM": round(float(row["cpm"]), 2),
                "CPM在当前样本中的位置": row["CPM在当前样本中的位置"],
                "性价比分": round(float(row["score_cost_effectiveness"]), 2),
                "是否命中高CPM风险": "是" if row["CPM极端高扣分"] < 0 else "否",
                "AI是否提到报价风险": ai_price_flag,
            }
        )
    price_df = pd.DataFrame(price_rows)

    keyword_rows = []
    for _, row in merged.iterrows():
        risk_row = risk_df.loc[risk_df["达人昵称"] == row["昵称"]].iloc[0]
        korea_exp, keyword_exp = _keyword_explanation(row, risk_row["_exclude_hits"])
        keyword_rows.append(
            {
                "达人昵称": row["昵称"],
                "命中韩国地点词": park._normalize_text(row["hit_korea_keywords"]) or "无",
                "命中韩国品牌词": park._normalize_text(row["hit_brand_keywords"]) or "无",
                "命中内容调性词": park._normalize_text(row["hit_content_keywords"]) or "无",
                "命中排除词": risk_row["_exclude_hits"] or "无",
                "韩国品牌分解释": korea_exp,
                "关键词组合分解释": keyword_exp,
            }
        )
    keyword_df = pd.DataFrame(keyword_rows)

    risk_sheet_df = risk_df[
        [
            "达人昵称",
            "标签缺失扣分",
            "内容标签缺失扣分",
            "合作互动为零扣分",
            "合作ER过低扣分",
            "CPM极端高扣分",
            "排除关键词扣分",
            "总风险扣分",
        ]
    ].copy()

    divergence_rows = []
    for _, row in merged.iterrows():
        conflict, reason, direction = _conflict_status(row["recommend_grade"], park._normalize_text(row["AI结论"]))
        divergence_rows.append(
            {
                "达人昵称": row["昵称"],
                "人工初判（先留空）": "",
                "系统等级": row["recommend_grade"],
                "AI结论": row["AI结论"],
                "是否冲突": conflict,
                "冲突原因": reason,
                "建议人工判断方向": direction,
            }
        )
    divergence_df = pd.DataFrame(divergence_rows)

    return {
        "1_评分总览": overview_df,
        "2_六维分拆解": six_dim_df,
        "3_价格与性价比拆解": price_df,
        "4_关键词命中拆解": keyword_df,
        "5_风险扣分拆解": risk_sheet_df,
        "6_人工AI分歧分析": divergence_df,
    }


def write_workbook(sheets: dict[str, pd.DataFrame]) -> None:
    if OUTPUT_FILE.exists():
        raise FileExistsError(f"输出文件已存在，请先处理后再运行：{OUTPUT_FILE}")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)


def main() -> None:
    sheets = build_workbook()
    write_workbook(sheets)
    print(f"生成完成: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
