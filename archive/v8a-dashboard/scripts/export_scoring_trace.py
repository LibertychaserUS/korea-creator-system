from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import scripts.export_scoring_breakdown as breakdown
import scripts.park_candidates_analysis as park


INPUT_FILE = ROOT_DIR / "data" / "input" / "达人列表_20260623194334.xlsx"
OUTPUT_FILE = ROOT_DIR / "data" / "output" / "朴代表候选达人逐项评分追踪表_20260624.xlsx"


def _split_hits(value: Any) -> list[str]:
    text = park._normalize_text(value)
    if not text:
        return []
    return [item for item in text.split(",") if item]


def _percentiles(base_df: pd.DataFrame) -> pd.DataFrame:
    df = base_df.copy()
    df["粉丝数百分位"] = park._percentile_rank(pd.to_numeric(df["粉丝数"], errors="coerce").fillna(0)).round(2)
    df["合作互动百分位"] = park._percentile_rank(pd.to_numeric(df["互动中位数_合作"], errors="coerce").fillna(0)).round(2)
    df["匹配笔记数百分位"] = park._percentile_rank(pd.to_numeric(df["匹配笔记数"], errors="coerce").fillna(0)).round(2)
    df["阅读百分位"] = park._percentile_rank(pd.to_numeric(df["阅读中位数_日常"], errors="coerce").fillna(0)).round(2)
    df["互动百分位"] = park._percentile_rank(pd.to_numeric(df["互动中位数_日常"], errors="coerce").fillna(0)).round(2)
    df["合作ER百分位"] = park._percentile_rank(df["合作笔记ER"].map(park._parse_er)).round(2)
    df["日常ER百分位"] = park._percentile_rank(df["日常笔记ER"].map(park._parse_er)).round(2)
    df["CPM百分位"] = (df["cpm"].rank(pct=True) * 100).round(2)
    return df


def _fan_bucket(score: float) -> str:
    if score >= 100:
        return ">=100万粉"
    if score >= 90:
        return "30万-100万粉"
    if score >= 80:
        return "15万-30万粉"
    if score >= 65:
        return "10万-15万粉"
    return "<10万粉"


def build_field_mapping_sheet() -> pd.DataFrame:
    rows = [
        {
            "原始字段": "达人昵称",
            "清洗后字段": "昵称",
            "所属评分维度": "全部维度的对象标识",
            "作用": "用于输出、排序和对照 AI 报告",
            "是否直接影响最终分": "否",
            "示例说明": "例如：小鱼同学UAU",
        },
        {
            "原始字段": "粉丝数",
            "清洗后字段": "粉丝数",
            "所属评分维度": "分层筛选、潜力合作、性价比",
            "作用": "用于粉丝档位打分、粉丝百分位和 CPM 计算",
            "是否直接影响最终分": "是",
            "示例说明": "蒲公英原始单位是“万”，清洗后转成实际人数",
        },
        {
            "原始字段": "达人标签",
            "清洗后字段": "内容类目|标签 / 抓取关键词 / 身份|人设",
            "所属评分维度": "关键词组合、韩国品牌、风险扣分",
            "作用": "命中内容词、韩国词、品牌词、排除词",
            "是否直接影响最终分": "是",
            "示例说明": "同一份标签文本会复用到多个维度",
        },
        {
            "原始字段": "达人所属城市",
            "清洗后字段": "地域",
            "所属评分维度": "韩国品牌",
            "作用": "地域含“韩国”会先拿到 40 分地域信号",
            "是否直接影响最终分": "是",
            "示例说明": "地域=韩国，则韩国品牌维度先得 40 分",
        },
        {
            "原始字段": "阅读中位数（日常笔记 · 30 天）",
            "清洗后字段": "阅读中位数_日常",
            "所属评分维度": "表现",
            "作用": "参与阅读百分位计算",
            "是否直接影响最终分": "是",
            "示例说明": "和样本内其他达人比较后转成百分位",
        },
        {
            "原始字段": "互动中位数（日常笔记 · 30 天）",
            "清洗后字段": "互动中位数_日常",
            "所属评分维度": "表现",
            "作用": "参与互动百分位计算",
            "是否直接影响最终分": "是",
            "示例说明": "互动越高，表现维度通常越高",
        },
        {
            "原始字段": "互动率（日常笔记 · 30 天）",
            "清洗后字段": "日常笔记ER / 日常笔记ER_raw",
            "所属评分维度": "表现、风险扣分",
            "作用": "既参与 ER 百分位，也用于判断 ER 是否低于 1%",
            "是否直接影响最终分": "是",
            "示例说明": "朴代表脚本里合作 ER 缺失时，直接用日常 ER 代替",
        },
        {
            "原始字段": "互动中位数（日常笔记 · 30 天）",
            "清洗后字段": "互动中位数_合作",
            "所属评分维度": "潜力合作、风险扣分",
            "作用": "朴代表脚本里缺少合作互动字段时，用日常互动代替",
            "是否直接影响最终分": "是",
            "示例说明": "这会让“潜力合作”更偏向日常表现",
        },
        {
            "原始字段": "近30天发布笔记数",
            "清洗后字段": "匹配笔记数",
            "所属评分维度": "潜力合作",
            "作用": "作为匹配笔记数替代字段参与百分位",
            "是否直接影响最终分": "是",
            "示例说明": "并不是主流程原生字段，而是朴代表脚本的映射替代",
        },
        {
            "原始字段": "图文笔记一口价 / 视频笔记一口价",
            "清洗后字段": "图文报价 / 视频报价 / 全部报价",
            "所属评分维度": "性价比、风险扣分",
            "作用": "取较高值作为全部报价，再计算 CPM",
            "是否直接影响最终分": "是",
            "示例说明": "如果视频比图文贵，就用视频价进入 CPM",
        },
        {
            "原始字段": "过往合作品牌",
            "清洗后字段": "过往合作品牌",
            "所属评分维度": "不直接进规则分",
            "作用": "不直接参与规则打分，但会影响 AI 风险解释",
            "是否直接影响最终分": "否",
            "示例说明": "业务会据此判断商业成熟度",
        },
        {
            "原始字段": "小红书主页 / 达人蒲公英后台链接",
            "清洗后字段": "小红书主页URL / 蒲公英链接",
            "所属评分维度": "不参与评分",
            "作用": "只用于定位达人和回看原始资料",
            "是否直接影响最终分": "否",
            "示例说明": "方便人工复核，不进入公式",
        },
    ]
    return pd.DataFrame(rows)


def build_all_creator_scores_sheet(base_df: pd.DataFrame) -> pd.DataFrame:
    df = _percentiles(base_df.copy())
    rows = []
    for _, row in df.iterrows():
        rows.append(
            {
                "达人昵称": row["昵称"],
                "粉丝数": int(float(row["粉丝数"])),
                "分层筛选规则命中档位": _fan_bucket(float(row["score_layered_match"])),
                "分层筛选原始分": round(float(row["score_layered_match"]), 2),
                "内容关键词命中数量": len(_split_hits(row["hit_content_keywords"])),
                "关键词组合原始分": round(float(row["score_keyword_combo"]), 2),
                "韩国词命中数量": len(_split_hits(row["hit_korea_keywords"])),
                "品牌词命中数量": len(_split_hits(row["hit_brand_keywords"])),
                "韩国品牌原始分": round(float(row["score_korea_brand"]), 2),
                "粉丝数百分位": round(float(row["粉丝数百分位"]), 2),
                "合作互动百分位": round(float(row["合作互动百分位"]), 2),
                "匹配笔记数百分位": round(float(row["匹配笔记数百分位"]), 2),
                "潜力合作原始分": round(float(row["score_cooperation_potential"]), 2),
                "阅读百分位": round(float(row["阅读百分位"]), 2),
                "互动百分位": round(float(row["互动百分位"]), 2),
                "合作ER百分位": round(float(row["合作ER百分位"]), 2),
                "日常ER百分位": round(float(row["日常ER百分位"]), 2),
                "表现原始分": round(float(row["score_performance"]), 2),
                "全部报价": int(float(row["全部报价"])),
                "CPM": round(float(row["cpm"]), 2),
                "CPM百分位": round(float(row["CPM百分位"]), 2),
                "性价比原始分": round(float(row["score_cost_effectiveness"]), 2),
                "风险扣分": round(float(row["score_risk_deduction"]), 2),
                "最终分": round(float(row["score_final"]), 2),
            }
        )
    return pd.DataFrame(rows)


def build_top1_trace_sheet(base_df: pd.DataFrame, raw_df: pd.DataFrame) -> pd.DataFrame:
    df = _percentiles(base_df.copy())
    top1 = df.sort_values("rank").iloc[0]
    raw_row = raw_df.loc[raw_df["达人昵称"] == top1["昵称"]].iloc[0]

    keyword_hits = _split_hits(top1["hit_content_keywords"])
    korea_hits = _split_hits(top1["hit_korea_keywords"])
    brand_hits = _split_hits(top1["hit_brand_keywords"])

    contribution_map = {
        "分层筛选": round(float(top1["score_layered_match"]) * park.SCORE_WEIGHTS["layered_match"], 2),
        "关键词组合": round(float(top1["score_keyword_combo"]) * park.SCORE_WEIGHTS["keyword_combo"], 2),
        "韩国品牌": round(float(top1["score_korea_brand"]) * park.SCORE_WEIGHTS["korea_brand"], 2),
        "潜力合作": round(float(top1["score_cooperation_potential"]) * park.SCORE_WEIGHTS["cooperation_potential"], 2),
        "表现": round(float(top1["score_performance"]) * park.SCORE_WEIGHTS["performance"], 2),
        "性价比": round(float(top1["score_cost_effectiveness"]) * park.SCORE_WEIGHTS["cost_effectiveness"], 2),
    }

    rows = [
        {
            "步骤": "基础识别",
            "原始字段值": raw_row["达人昵称"],
            "清洗后值": top1["昵称"],
            "中间变量": "达人主键/展示名称",
            "该项如何转成维度原始分": "仅作为对象识别，不直接计分",
            "维度原始分": "",
            "权重": "",
            "贡献分": "",
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "分层筛选",
            "原始字段值": raw_row["粉丝数"],
            "清洗后值": int(float(top1["粉丝数"])),
            "中间变量": f"粉丝档位={_fan_bucket(float(top1['score_layered_match']))}",
            "该项如何转成维度原始分": "按固定粉丝档位直接给分",
            "维度原始分": round(float(top1["score_layered_match"]), 2),
            "权重": park.SCORE_WEIGHTS["layered_match"],
            "贡献分": contribution_map["分层筛选"],
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "关键词组合",
            "原始字段值": raw_row["达人标签"],
            "清洗后值": top1["内容类目|标签"],
            "中间变量": f"内容关键词命中{len(keyword_hits)}个：{','.join(keyword_hits) or '无'}",
            "该项如何转成维度原始分": "在10位样本内，按内容词命中数做百分位",
            "维度原始分": round(float(top1["score_keyword_combo"]), 2),
            "权重": park.SCORE_WEIGHTS["keyword_combo"],
            "贡献分": contribution_map["关键词组合"],
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "韩国品牌",
            "原始字段值": f"地域={raw_row['达人所属城市']}；标签={raw_row['达人标签']}",
            "清洗后值": f"地域={top1['地域']}；标签={top1['内容类目|标签']}",
            "中间变量": f"地域韩国信号={'是' if '韩国' in park._normalize_text(top1['地域']) else '否'}；韩国词{len(korea_hits)}个；品牌词{len(brand_hits)}个",
            "该项如何转成维度原始分": "地域命中先给40分，再叠加韩国词/品牌词样本内百分位",
            "维度原始分": round(float(top1["score_korea_brand"]), 2),
            "权重": park.SCORE_WEIGHTS["korea_brand"],
            "贡献分": contribution_map["韩国品牌"],
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "潜力合作",
            "原始字段值": f"粉丝={raw_row['粉丝数']}；互动中位数={raw_row['互动中位数（日常笔记 · 30 天）']}；近30天笔记数={raw_row['近30天发布笔记数']}",
            "清洗后值": f"粉丝={int(float(top1['粉丝数']))}；合作互动={int(float(top1['互动中位数_合作']))}；匹配笔记数={int(float(top1['匹配笔记数']))}",
            "中间变量": f"粉丝百分位{top1['粉丝数百分位']}；合作互动百分位{top1['合作互动百分位']}；匹配笔记数百分位{top1['匹配笔记数百分位']}",
            "该项如何转成维度原始分": "0.40×粉丝百分位 + 0.35×合作互动百分位 + 0.25×匹配笔记数百分位",
            "维度原始分": round(float(top1["score_cooperation_potential"]), 2),
            "权重": park.SCORE_WEIGHTS["cooperation_potential"],
            "贡献分": contribution_map["潜力合作"],
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "表现",
            "原始字段值": f"阅读={raw_row['阅读中位数（日常笔记 · 30 天）']}；互动={raw_row['互动中位数（日常笔记 · 30 天）']}；日常ER={raw_row['互动率（日常笔记 · 30 天）']}",
            "清洗后值": f"阅读={int(float(top1['阅读中位数_日常']))}；互动={int(float(top1['互动中位数_日常']))}；合作ER={top1['合作笔记ER']}；日常ER={top1['日常笔记ER']}",
            "中间变量": f"阅读百分位{top1['阅读百分位']}；互动百分位{top1['互动百分位']}；合作ER百分位{top1['合作ER百分位']}；日常ER百分位{top1['日常ER百分位']}",
            "该项如何转成维度原始分": "四项百分位各占25%",
            "维度原始分": round(float(top1["score_performance"]), 2),
            "权重": park.SCORE_WEIGHTS["performance"],
            "贡献分": contribution_map["表现"],
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "性价比",
            "原始字段值": f"图文价={raw_row['图文笔记一口价']}；视频价={raw_row['视频笔记一口价']}",
            "清洗后值": f"全部报价={int(float(top1['全部报价']))}",
            "中间变量": f"CPM={round(float(top1['cpm']),2)}；CPM百分位={top1['CPM百分位']}",
            "该项如何转成维度原始分": "先算 CPM，再按10位样本内反向百分位转成性价比分",
            "维度原始分": round(float(top1["score_cost_effectiveness"]), 2),
            "权重": park.SCORE_WEIGHTS["cost_effectiveness"],
            "贡献分": contribution_map["性价比"],
            "风险扣分": "",
            "最终分复算": "",
        },
        {
            "步骤": "风险扣分",
            "原始字段值": top1["risk_reasons"] or "无",
            "清洗后值": top1["risk_reasons"] or "无",
            "中间变量": "本次样本中未命中任何扣分项",
            "该项如何转成维度原始分": "风险项直接以负分加到最终分",
            "维度原始分": "",
            "权重": "",
            "贡献分": "",
            "风险扣分": round(float(top1["score_risk_deduction"]), 2),
            "最终分复算": "",
        },
    ]

    recomputed = round(sum(contribution_map.values()) + float(top1["score_risk_deduction"]), 2)
    rows.append(
        {
            "步骤": "最终分复算",
            "原始字段值": "",
            "清洗后值": "",
            "中间变量": "六维贡献分求和 + 风险扣分",
            "该项如何转成维度原始分": f"{' + '.join(str(v) for v in contribution_map.values())} + {round(float(top1['score_risk_deduction']),2)}",
            "维度原始分": "",
            "权重": "",
            "贡献分": round(sum(contribution_map.values()), 2),
            "风险扣分": round(float(top1["score_risk_deduction"]), 2),
            "最终分复算": recomputed,
        }
    )
    rows.append(
        {
            "步骤": "与现有报告核对",
            "原始字段值": "",
            "清洗后值": "",
            "中间变量": "",
            "该项如何转成维度原始分": "应与现有评分拆解表/AI报告中的最终分一致",
            "维度原始分": "",
            "权重": "",
            "贡献分": "",
            "风险扣分": "",
            "最终分复算": round(float(top1["score_final"]), 2),
        }
    )
    return pd.DataFrame(rows)


def build_percentile_explanation_sheet() -> pd.DataFrame:
    rows = [
        {
            "维度": "分层筛选",
            "计算方式": "固定粉丝档位",
            "说明": "不是百分位。按粉丝数直接落到 50 / 65 / 80 / 90 / 100 分档。",
        },
        {
            "维度": "关键词组合",
            "计算方式": "当前样本内关键词命中数百分位",
            "说明": "先统计内容词命中数量，再在本次 10 位已覆盖达人内部做百分位。",
        },
        {
            "维度": "韩国品牌",
            "计算方式": "地域固定信号 + 韩国词/品牌词百分位",
            "说明": "地域含韩国先给 40 分；韩国词和品牌词命中数再按当前 10 人样本做百分位叠加。",
        },
        {
            "维度": "潜力合作",
            "计算方式": "粉丝数 / 合作互动 / 匹配笔记数百分位",
            "说明": "三项都不是绝对分，都是先在样本内做百分位，再按 0.40 / 0.35 / 0.25 加权。",
        },
        {
            "维度": "表现",
            "计算方式": "阅读 / 互动 / 合作ER / 日常ER 百分位",
            "说明": "四项都按当前 10 人样本内比较，分别取百分位后等权平均。",
        },
        {
            "维度": "性价比",
            "计算方式": "CPM 反向百分位",
            "说明": "先算 CPM，再按“CPM 越低越好”取反向百分位，因此便宜达人会拿高分。",
        },
        {
            "维度": "统一口径提醒",
            "计算方式": "样本内比较",
            "说明": "本次朴代表只有 10 位覆盖达人，所以所有百分位维度都是这 10 人内部比较，不是对全站达人比较。",
        },
    ]
    return pd.DataFrame(rows)


def build_business_explanation_sheet() -> pd.DataFrame:
    rows = [
        {
            "主题": "为什么有些看起来不错的人得分不高",
            "说明": "规则不会只看主观观感。只要韩国关联弱、关键词命中少、报价相对高，或者样本内商业数据不突出，最终分就会被拉低。",
        },
        {
            "主题": "为什么价格会被 AI 提醒",
            "说明": "规则里价格只占 5%，但 AI 会把报价、阅读、互动、ER、过往合作经验一起理解成 ROI 风险，所以在文字解释里会更频繁地强调价格问题。",
        },
        {
            "主题": "为什么样本越多评分越稳定",
            "说明": "关键词组合、韩国品牌、潜力合作、表现、性价比里大量使用了样本内百分位。样本只有 10 人时，前后名次和百分位会更敏感；样本越多，分布越稳定。",
        },
        {
            "主题": "为什么当前不建议直接改权重",
            "说明": "这批数据里，问题不只是价格权重，而是价格比较口径还很粗，并且样本量太小。直接改权重可能误伤便宜达人已有的正向加分，结论反而更不稳定。",
        },
    ]
    return pd.DataFrame(rows)


def build_workbook() -> dict[str, pd.DataFrame]:
    raw_df = pd.read_excel(INPUT_FILE, sheet_name="达人列表")
    base_df = breakdown._score_base_frame()
    return {
        "1_字段到维度映射": build_field_mapping_sheet(),
        "2_单人完整计算样例": build_top1_trace_sheet(base_df, raw_df),
        "3_所有达人六维原始分": build_all_creator_scores_sheet(base_df),
        "4_百分位计算说明": build_percentile_explanation_sheet(),
        "5_非技术解释版": build_business_explanation_sheet(),
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
