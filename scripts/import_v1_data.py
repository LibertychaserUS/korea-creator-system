"""将 V1 达人反馈 Excel 转换为系统可导入的 CSV，并提取 AI 结果和人工意见。"""

import json
import sys
from pathlib import Path

import pandas as pd

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.paths import CACHE_DIR, ensure_runtime_dirs
from services.ai_recommendation import AI_CACHE_FILE

V1_FILE = Path(r"K:\Trae_workk\paqu\材料\0204_V1_达人反馈表格_中文版_260626.xlsx")
OUTPUT_CSV = CACHE_DIR.parent / "input" / "v1_imported.csv"
MANUAL_REVIEWS_FILE = CACHE_DIR / "manual_reviews.json"


def main():
    ensure_runtime_dirs()

    # 1. 读取 V1 Excel
    df3 = pd.read_excel(V1_FILE, sheet_name="3_详细分析")
    df2 = pd.read_excel(V1_FILE, sheet_name="2_推荐顺序")
    df4 = pd.read_excel(V1_FILE, sheet_name="4_原始数据", header=1)

    print(f"Sheet 3 详细分析: {len(df3)} 行")
    print(f"Sheet 2 推荐顺序: {len(df2)} 行")
    print(f"Sheet 4 原始数据: {len(df4)} 行")

    # 2. 列映射 V1 → 系统
    result = pd.DataFrame()
    result["rank"] = df3["排名"].astype(int)
    result["昵称"] = df3["昵称"].astype(str)

    # creator_key: RedNote ID
    result["creator_key"] = df3["RedNote ID"].astype(str)
    result["小红书号"] = df3["RedNote ID"].astype(str)
    result["userId"] = df3["RedNote ID"].astype(str)
    result["小红书主页URL"] = df3["小红书/RedNote主页URL"].astype(str)

    # 地域 - normalize
    result["地域"] = df3["地区"].astype(str)

    # 粉丝数 (sheet 3 中是实际数值不是"万")
    result["粉丝数"] = pd.to_numeric(df3["粉丝数"], errors="coerce").fillna(0).astype(int)

    # 报价
    result["图文报价"] = pd.to_numeric(df3["图文报价"], errors="coerce").fillna(0).astype(float)
    result["视频报价"] = pd.to_numeric(df3["视频报价"], errors="coerce").fillna(0).astype(float)
    result["全部报价"] = pd.to_numeric(df3["全部报价"], errors="coerce").fillna(0).astype(float)

    # 内容分类
    result["内容类目|标签"] = df3.get("内容类目/标签", df3.get("内容分类（系统推断）", "")).fillna("").astype(str)
    result["身份|人设"] = ""
    result["抓取关键词"] = ""

    # 互动/ER 数据 - 从 sheet 4 合并
    if "日常笔记ER" in df3.columns:
        result["日常笔记ER"] = df3["日常笔记ER"].astype(str)
    else:
        result["日常笔记ER"] = ""

    # 合作笔记ER - try from df4
    df4_er_col = None
    for c in df4.columns:
        if "ER" in str(c) and "日常" in str(c):
            df4_er_col = c
            break
    if "合作笔记ER" in df3.columns:
        result["合作笔记ER"] = df3["合作笔记ER"].astype(str)
    else:
        result["合作笔记ER"] = ""

    result["匹配笔记数"] = 0
    result["阅读中位数_日常"] = 0
    result["互动中位数_日常"] = 0
    result["互动中位数_合作"] = 0
    result["抓取时间"] = "2026-06-23"

    # 评分维度 - 直接使用 V1 的评分
    for dim in ["score_layered_match", "score_keyword_combo", "score_korea_brand",
                "score_cooperation_potential", "score_performance", "score_cost_effectiveness"]:
        if dim in df3.columns:
            result[dim] = pd.to_numeric(df3[dim], errors="coerce").fillna(50).astype(float)
        else:
            result[dim] = 50.0

    result["score_risk_deduction"] = pd.to_numeric(
        df3.get("score_risk_deduction", 0), errors="coerce"
    ).fillna(0).astype(float)
    result["score_final"] = pd.to_numeric(df3["score_final"], errors="coerce").fillna(0).astype(float)

    # 等级
    result["recommend_grade"] = df3["推荐等级"].astype(str)
    # 从推荐等级提取短标签
    grade_map = {
        "S级（强烈推荐）": "S", "S级(强烈推荐)": "S",
        "A级（推荐）": "A", "A级(推荐)": "A",
        "B级（可考虑）": "B", "B级(可考虑)": "B",
        "C级（观望）": "C", "C级(观望)": "C",
        "D级（不推荐）": "D", "D级(不推荐)": "D",
    }
    result["grade_short"] = df3["推荐等级"].map(lambda x: grade_map.get(str(x).strip(), "B"))

    # 关键词命中
    result["hit_content_keywords"] = df3.get("命中内容关键词", "").fillna("").astype(str)
    result["hit_korea_keywords"] = df3.get("命中韩国关键词", "").fillna("").astype(str)
    result["hit_brand_keywords"] = df3.get("命中品牌关键词", "").fillna("").astype(str)
    result["risk_reasons"] = df3.get("风险原因", "").fillna("").astype(str)
    result["exclude_flag"] = df3.get("排除标记", False).fillna(False).astype(bool)

    # 3. 写 CSV
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"\nCSV 已写入: {OUTPUT_CSV} ({len(result)} 行)")

    # 4. 提取人工复核意见 → manual_reviews.json
    # Sheet 2 "反馈" 列
    manual_reviews = {}
    for _, row in df2.iterrows():
        rank = str(int(row["排名"]))
        feedback = str(row.get("反馈", "") or "").strip()
        if feedback and feedback != "nan":
            manual_reviews[rank] = {
                "rank": rank,
                "decision": "reviewed",
                "note": feedback,
                "reviewer": "V1导入",
                "updated_at": "2026-06-23T20:43:00",
            }

    # Sheet 3 "AI人工复核备注" 也合并进去
    for _, row in df3.iterrows():
        rank = str(int(row["排名"]))
        note = str(row.get("AI人工复核备注", "") or "").strip()
        if note and note != "nan":
            if rank in manual_reviews:
                existing_note = manual_reviews[rank].get("note", "")
                manual_reviews[rank]["note"] = existing_note + "\n[AI复核备注] " + note
            else:
                manual_reviews[rank] = {
                    "rank": rank,
                    "decision": "reviewed",
                    "note": "[AI复核备注] " + note,
                    "reviewer": "V1导入",
                    "updated_at": "2026-06-23T20:43:00",
                }

    MANUAL_REVIEWS_FILE.write_text(
        json.dumps(manual_reviews, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"人工复核意见已写入: {MANUAL_REVIEWS_FILE} ({len(manual_reviews)} 条)")

    # 5. 提取 AI 结果 → ai_recommendations.json
    ai_cache = {}
    for _, row in df3.iterrows():
        rank = str(int(row["排名"]))
        ai_decision_raw = str(row.get("AI结论", "") or "")
        # Map V1 decisions
        decision_map = {
            "推荐": "recommend",
            "谨慎推荐": "cautious",
            "不推荐": "reject",
        }
        ai_decision = decision_map.get(ai_decision_raw, "cautious")

        ai_cache[rank] = {
            "ai_decision": ai_decision,
            "ai_decision_label": ai_decision_raw,
            "summary": str(row.get("AI摘要", "") or ""),
            "reasons": [str(row.get("AI推荐理由", "") or "")] if str(row.get("AI推荐理由", "") or "").strip() else [],
            "risks": [str(row.get("AI风险", "") or "")] if str(row.get("AI风险", "") or "").strip() else [],
            "collab_suggestions": [str(row.get("AI合作方向", "") or ""), str(row.get("AI联系建议", "") or "")],
            "review_hint": str(row.get("AI人工复核备注", "") or ""),
            "conflict_reason": "",
            "status": str(row.get("AI数据来源", "") or "success"),
            "created_at": "2026-06-23T20:43:00",
        }

    AI_CACHE_FILE.write_text(
        json.dumps(ai_cache, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"AI 结果已写入: {AI_CACHE_FILE} ({len(ai_cache)} 条)")

    print("\n=== 导入完成 ===")
    print(f"CSV: {OUTPUT_CSV}")
    print(f"可在 Web 界面通过「数据导入 → 上传 CSV」导入该文件")
    print(f"导入后 AI 复核和人工意见会自动关联")


if __name__ == "__main__":
    main()
