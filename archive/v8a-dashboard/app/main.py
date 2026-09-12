from services.excel_stats import run_stage_one
from services.scoring import run_stage_two


def main() -> None:
    # ---- 第一阶段：读取、统计、去重 ----
    s1 = run_stage_one()
    print("Stage 1 completed")
    print(f"  source_file={s1['source_file']}")
    print(f"  sheet_name={s1['sheet_name']}")
    print(f"  raw_rows={s1['raw_rows']}")
    print(f"  deduped_rows={s1['deduped_rows']}")
    print(f"  duplicate_rows={s1['duplicate_rows']}")
    print(f"  missing_creator_key_rows={s1['missing_creator_key_rows']}")

    # ---- 第二阶段：六维评分引擎 ----
    print()
    s2 = run_stage_two()
    print("\nStage 2 completed")
    print(f"  评分人数: {s2['total_creators']}")
    print(f"  最终分均值: {s2['dimension_averages']['final']}")
    print(f"  全量等级分布: {s2['full_grade_distribution']}")
    print(f"  Top50 等级分布: {s2['top50_grade_distribution']}")

    print("\n=== Top 10 ===")
    for i, row in enumerate(s2["top10"], 1):
        print(f"  {i}. {row['昵称']} | {row['score_final']:.1f}分 | {row['recommend_grade']}")

    print(f"\n导出文件:")
    for k, v in s2["output_files"].items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
