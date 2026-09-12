"""朴代表候选达人 AI 分析脚本。

读取蒲公英导出的候选达人 Excel，复用现有评分规则和 DeepSeek AI 复核逻辑，
生成包含 4 个 sheet 的分析报告。

不修改主评分流程，不修改现有页面，不自动登录蒲公英，不爬取小红书。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
import numpy as np
import pandas as pd

# 确保项目根目录在 sys.path 中
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

from core.paths import CONFIG_DIR, ensure_runtime_dirs

# ======================== 常量 ========================

INPUT_FILE = ROOT_DIR / "data" / "input" / "达人列表_20260623194334.xlsx"
SHEET_NAME = "达人列表"
TIMESTAMP = datetime.now().strftime("%Y%m%d%H%M%S")
OUTPUT_FILE = ROOT_DIR / "data" / "output" / f"朴代表候选达人AI分析报告_最终交付版_{TIMESTAMP}.xlsx"

DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_TIMEOUT = 30

# 评分维度权重（与主流程一致）
SCORE_WEIGHTS = {
    "layered_match": 0.25,
    "keyword_combo": 0.15,
    "korea_brand": 0.25,
    "cooperation_potential": 0.20,
    "performance": 0.10,
    "cost_effectiveness": 0.05,
}
RISK_DEDUCTION_MAX = 10

GRADE_THRESHOLDS = [
    (80, "S级(强烈推荐)", "S"),
    (65, "A级(推荐)", "A"),
    (50, "B级(可考虑)", "B"),
    (35, "C级(观望)", "C"),
    (0, "D级(不推荐)", "D"),
]

# ======================== 配置加载 ========================

def _load_config(name: str) -> dict:
    path = CONFIG_DIR / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _get_api_key() -> str | None:
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if key:
        return key
    settings_path = CONFIG_DIR / "settings.json"
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            key = settings.get("deepseek_api_key", "").strip()
            if key:
                return key
        except Exception:
            pass
    try:
        import winreg
        reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment")
        try:
            key, _ = winreg.QueryValueEx(reg, "DEEPSEEK_API_KEY")
            if key and key.strip():
                return key.strip()
        except FileNotFoundError:
            pass
        finally:
            winreg.CloseKey(reg)
    except Exception:
        pass
    return None

# ======================== 达人分类推断 ========================

TAG_CLASSIFICATION_RULES = [
    ("出行旅游", ["出行旅游", "旅行", "旅游"]),
    ("时尚穿搭", ["时尚", "穿搭", "ootd", "每日穿搭", "箱包"]),
    ("美妆护肤", ["美妆", "护肤", "化妆"]),
    ("美食探店", ["美食", "探店", "美食探店"]),
    ("生活记录", ["生活记录", "vlog", "沉浸式", "plog"]),
    ("教育知识", ["教育", "留学", "教程", "知识"]),
    ("娱乐影视", ["影视综", "娱乐资讯", "娱乐"]),
    ("韩系文化", ["韩系", "韩国", "首尔"]),
    ("潮流品牌", ["开箱", "测评", "潮流"]),
    ("户外运动", ["露营", "徒步", "户外"]),
    ("家居生活", ["家居家装", "生活方式"]),
    ("中外生活", ["中外生活", "接地气生活"]),
]


def classify_creator_tags(tags: str) -> str:
    """根据达人标签自动推断内容分类。"""
    if not tags or tags == "-":
        return "未分类"
    tags_lower = tags.lower()
    matched = []
    for label, keywords in TAG_CLASSIFICATION_RULES:
        for kw in keywords:
            if kw.lower() in tags_lower:
                matched.append(label)
                break
    if not matched:
        return "综合/其他"
    return "、".join(dict.fromkeys(matched))  # 去重保序


# ======================== 客户原始分类映射 ========================

# key: 小红书主页 URL 中的 userId
# value: (韩文分类, 中文分类)
CLIENT_CLASSIFICATION_MAP: dict[str, tuple[str, str]] = {
    "590ae5ea5e87e777a11ea906": ("vlog 와 제품 하울 형태의 왕홍", "vlog和产品开箱种草型"),
    "5e821bc4000000000100afc1": ("브이로그", "vlog类"),
    "5a94e67de8ac2b2bed6a6729": ("브이로그", "vlog类"),
    "5b8b63b3b0d787000169b7b3": ("브이로그", "vlog类"),
    "59f52d254eacab548582dad6": ("힙한 무드의 패션 계정", "潮流氛围时尚账号"),
    "588f01326a6a690f1312a408": ("힙한 무드의 패션 계정", "潮流氛围时尚账号"),
    "659ae124000000002001daa4": ("힙한 무드의 패션 계정", "潮流氛围时尚账号"),
    "5a3735774eacab0d3461e3ac": ("여성스러운 느낌의 패션 왕홍", "女性化风格时尚达人"),
    "5ad8c73a11be10345d6e2632": ("여성스러운 느낌의 패션 왕홍", "女性化风格时尚达人"),
    "5f7be2fc000000000101d11a": ("일상 무드", "日常氛围账号"),
    "60d20118000000000101eea7": ("방문형 체험단", "到店体验类账号"),
    "5961998650c4b40808c7a305": ("방문형 체험단", "到店体验类账号"),
}


def _extract_user_id(url: str) -> str:
    """从蒲公英/小红书主页 URL 提取 userId。"""
    if not url or pd.isna(url):
        return ""
    url = str(url).strip()
    # https://www.xiaohongshu.com/user/profile/5e821bc4000000000100afc1
    # https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/5e821bc4000000000100afc1
    parts = url.rstrip("/").split("/")
    if parts:
        candidate = parts[-1]
        if len(candidate) >= 20 and candidate.isalnum():
            return candidate
    return ""


# ======================== 字段映射 ========================

def map_pugongying_fields(df: pd.DataFrame) -> pd.DataFrame:
    """将蒲公英导出字段映射为内部评分系统字段。"""
    out = pd.DataFrame()
    out["昵称"] = df["达人昵称"]
    out["小红书号"] = df["小红书号"]
    out["小红书主页URL"] = df["小红书主页"]
    out["地域"] = df["达人所属城市"]

    # 粉丝数：蒲公英单位为万，转为实际数值
    fans_raw = pd.to_numeric(df["粉丝数"], errors="coerce").fillna(0)
    out["粉丝数"] = (fans_raw * 10000).round(0)

    # 标签 → 内容类目|标签 + 抓取关键词 + 身份|人设
    tags = df["达人标签"].fillna("").astype(str)
    out["内容类目|标签"] = tags
    out["抓取关键词"] = tags
    out["身份|人设"] = tags  # 蒲公英无独立人设字段，用标签代替

    # 日常数据
    out["阅读中位数_日常"] = pd.to_numeric(df["阅读中位数（日常笔记 · 30 天）"], errors="coerce").fillna(0)
    out["互动中位数_日常"] = pd.to_numeric(df["互动中位数（日常笔记 · 30 天）"], errors="coerce").fillna(0)

    # 互动率：蒲公英是小数 (0.065 = 6.5%)，主系统期望 "6.5%" 格式
    er_raw = pd.to_numeric(df["互动率（日常笔记 · 30 天）"], errors="coerce").fillna(0)
    out["日常笔记ER"] = (er_raw * 100).round(2).astype(str) + "%"
    out["日常笔记ER_raw"] = er_raw * 100  # 保留数值用于评分

    # 蒲公英无合作专属字段，用日常数据替代
    out["互动中位数_合作"] = out["互动中位数_日常"]
    out["合作笔记ER"] = out["日常笔记ER"]
    out["匹配笔记数"] = pd.to_numeric(df.get("近30天发布笔记数", 0), errors="coerce").fillna(0)

    # 报价：图文+视频取较大值作为全部报价
    price_img = pd.to_numeric(df["图文笔记一口价"], errors="coerce").fillna(0)
    price_video = pd.to_numeric(df["视频笔记一口价"], errors="coerce").fillna(0)
    out["全部报价"] = price_img.where(price_img >= price_video, price_video)
    out["图文报价"] = price_img
    out["视频报价"] = price_video

    # 额外信息
    out["过往合作品牌"] = df["过往合作品牌"].fillna("-")
    out["蒲公英链接"] = df["达人蒲公英后台链接"].fillna("-")
    out["账号健康等级"] = df.get("账号健康等级", "-").fillna("-")
    out["达人所属机构"] = df.get("达人所属机构", "-").fillna("-")
    out["性别"] = df.get("性别", "-").fillna("-")
    out["城市分布"] = df.get("城市分布", "-").fillna("-")
    out["兴趣分布"] = df.get("兴趣分布", "-").fillna("-")
    out["邀约48小时回复率"] = df.get("邀约48小时回复率", "-")
    out["最近发布笔记时间"] = df.get("最近发布笔记时间", "-").fillna("-")
    out["曝光中位数"] = pd.to_numeric(df.get("曝光中位数（日常笔记 · 30 天）", 0), errors="coerce").fillna(0)
    out["外溢进店中位数"] = pd.to_numeric(df.get("外溢进店中位数", 0), errors="coerce").fillna(0)

    # 客户原始分类：基于达人标签自动推断
    out["内容分类(系统推断)"] = tags.map(classify_creator_tags)

    # 客户提供分类：从 URL 提取 userId 后查映射表
    user_ids = out["小红书主页URL"].map(_extract_user_id)
    out["_user_id"] = user_ids
    out["客户提供分类（韩文）"] = user_ids.map(
        lambda uid: CLIENT_CLASSIFICATION_MAP.get(uid, ("-", "-"))[0]
    )
    out["客户提供分类（中文）"] = user_ids.map(
        lambda uid: CLIENT_CLASSIFICATION_MAP.get(uid, ("-", "-"))[1]
    )

    return out

# ======================== 评分工具 ========================

def _normalize_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def _parse_er(value: Any) -> float:
    if pd.isna(value):
        return 0.0
    s = str(value).strip().replace("%", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _percentile_rank(series: pd.Series) -> pd.Series:
    ranked = series.rank(pct=True)
    return (ranked * 100).clip(0, 100)


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def _match_keywords(text: str, keywords: List[str]) -> List[str]:
    matched = []
    text_lower = text.lower()
    for kw in keywords:
        if kw.lower() in text_lower:
            matched.append(kw)
    return matched


def _count_matches(text: str, keywords: List[str]) -> int:
    return len(_match_keywords(text, keywords))

# ======================== 六维评分 ========================

def score_layered_match(df: pd.DataFrame) -> pd.Series:
    fans = _safe_numeric(df["粉丝数"])
    scores = pd.Series(50.0, index=df.index)
    scores = scores.where(fans < 100000, 65.0)
    scores = scores.where(fans < 150000, 80.0)
    scores = scores.where(fans < 300000, 90.0)
    scores = scores.where(fans < 1000000, 100.0)
    return scores


def score_keyword_combo(df: pd.DataFrame, content_kw: List[str]) -> Tuple[pd.Series, pd.Series]:
    if not content_kw:
        return pd.Series(50.0, index=df.index), pd.Series([""] * len(df), index=df.index)

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


def score_korea_brand(df: pd.DataFrame, korea_kw: List[str], brand_kw: List[str]) -> Tuple[pd.Series, pd.Series, pd.Series]:
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
        scores += _percentile_rank(korea_counts) * 0.30
    elif korea_counts.sum() == 0:
        scores += 10.0

    brand_counts = combined_text.map(lambda t: _count_matches(t, brand_kw))
    hit_brand = combined_text.map(lambda t: ",".join(_match_keywords(t, brand_kw)))
    if brand_counts.max() > 0:
        scores += _percentile_rank(brand_counts) * 0.30
    elif brand_counts.sum() == 0:
        scores += 10.0

    return scores.clip(0, 100), hit_korea, hit_brand


def score_cooperation_potential(df: pd.DataFrame) -> pd.Series:
    fans = _safe_numeric(df["粉丝数"])
    coop_interact = _safe_numeric(df["互动中位数_合作"])
    match_notes = _safe_numeric(df["匹配笔记数"])

    fans_pct = _percentile_rank(fans)
    coop_pct = _percentile_rank(coop_interact)
    notes_pct = _percentile_rank(match_notes)

    return (fans_pct * 0.40 + coop_pct * 0.35 + notes_pct * 0.25).clip(0, 100)


def score_performance(df: pd.DataFrame) -> pd.Series:
    read_median = _safe_numeric(df["阅读中位数_日常"])
    interact_daily = _safe_numeric(df["互动中位数_日常"])

    # 用原始数值做百分位排名
    if "日常笔记ER_raw" in df.columns:
        daily_er = _safe_numeric(df["日常笔记ER_raw"])
    else:
        daily_er = df["日常笔记ER"].map(_parse_er)

    read_pct = _percentile_rank(read_median)
    interact_pct = _percentile_rank(interact_daily)
    daily_er_pct = _percentile_rank(daily_er)

    # 蒲公英无合作ER，用日常ER替代，权重分配调整
    return (read_pct * 0.35 + interact_pct * 0.35 + daily_er_pct * 0.30).clip(0, 100)


def score_cost_effectiveness(df: pd.DataFrame) -> pd.Series:
    fans = _safe_numeric(df["粉丝数"])
    price = _safe_numeric(df["全部报价"])

    cpm = pd.Series(np.where(fans > 0, price / fans * 1000, np.nan), index=df.index)
    valid = cpm.notna() & (cpm > 0)
    scores = pd.Series(30.0, index=df.index)

    if valid.any():
        cpm_valid = cpm[valid]
        cpm_ranked = cpm_valid.rank(pct=True)
        scores.loc[valid] = ((1 - cpm_ranked) * 100).clip(0, 100)

    return scores


def score_risk_deduction(df: pd.DataFrame, exclude_kw: List[str]) -> Tuple[pd.Series, pd.Series, pd.Series]:
    deductions = pd.Series(0.0, index=df.index, dtype=float)
    reasons = pd.Series([""] * len(df), index=df.index, dtype=str)

    def add_reason(idx, reason: str):
        current = reasons.loc[idx]
        reasons.loc[idx] = reason if current == "" else current + ";" + reason

    # 标签缺失 → -2
    identity = df["身份|人设"].map(_normalize_text)
    mask_id = identity == ""
    deductions -= mask_id.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_id].index:
        add_reason(idx, "标签画像缺失")

    # 内容标签缺失 → -2
    content = df["内容类目|标签"].map(_normalize_text)
    mask_ct = content == ""
    deductions -= mask_ct.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_ct].index:
        add_reason(idx, "内容标签缺失")

    # 互动中位数_日常 == 0 → -2
    daily_interact = _safe_numeric(df["互动中位数_日常"])
    mask_ci = daily_interact == 0
    deductions -= mask_ci.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_ci].index:
        add_reason(idx, "日常互动为零")

    # 日常笔记ER < 1% → -2
    if "日常笔记ER_raw" in df.columns:
        daily_er = _safe_numeric(df["日常笔记ER_raw"])
    else:
        daily_er = df["日常笔记ER"].map(_parse_er)
    mask_er = daily_er < 1.0
    deductions -= mask_er.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_er].index:
        add_reason(idx, "日常ER<1%")

    # CPM 极端高（前5%）→ -2
    fans = _safe_numeric(df["粉丝数"])
    price = _safe_numeric(df["全部报价"])
    cpm = pd.Series(np.where(fans > 0, price / fans * 1000, np.nan), index=df.index)
    cpm_threshold = cpm.quantile(0.95) if cpm.notna().any() else float("inf")
    mask_cpm = cpm.notna() & (cpm >= cpm_threshold) & (cpm > 0)
    deductions -= mask_cpm.map(lambda x: 2.0 if x else 0.0)
    for idx in deductions[mask_cpm].index:
        add_reason(idx, "CPM极端高")

    # 排除关键词
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


def determine_grade(final_score: float) -> Tuple[str, str]:
    for threshold, label, short in GRADE_THRESHOLDS:
        if final_score >= threshold:
            return label, short
    return "D级(不推荐)", "D"

# ======================== DeepSeek AI ========================

def _build_ai_prompt(creator: dict) -> str:
    lines = []
    lines.append("你是韩国品牌（服饰、美妆、生活方式）小红书达人筛选顾问。")
    lines.append("请根据以下达人信息，给出合作复核意见。")
    lines.append("注意：规则评分已经筛选出该达人，你的任务是复核风险并给出最终合作建议。")
    lines.append("不要仅根据单一指标（如 ER）一票否决，要综合粉丝量、内容匹配度、品牌关键词、报价合理性、风险扣分等多维度判断。")
    lines.append("")
    lines.append("【达人信息】")
    lines.append(f"昵称: {creator.get('昵称', '-')}")
    lines.append(f"地域: {creator.get('地域', '-')}")
    lines.append(f"标签: {creator.get('内容类目|标签', '-')}")
    fans = creator.get('粉丝数', 0)
    try:
        fans_str = f"{float(fans)/10000:.1f}万" if float(fans) >= 10000 else str(int(float(fans)))
    except (ValueError, TypeError):
        fans_str = "-"
    lines.append(f"粉丝数: {fans_str}")
    price = creator.get('全部报价', 0)
    try:
        price_str = f"{float(price):,.0f}元"
    except (ValueError, TypeError):
        price_str = "-"
    lines.append(f"报价(取较高): {price_str}")
    lines.append(f"阅读中位数(日常): {creator.get('阅读中位数_日常', '-')}")
    lines.append(f"互动中位数(日常): {creator.get('互动中位数_日常', '-')}")
    lines.append(f"日常笔记ER: {creator.get('日常笔记ER', '-')}")
    lines.append(f"过往合作品牌: {creator.get('过往合作品牌', '-')}")
    lines.append(f"邀约回复率: {creator.get('邀约48小时回复率', '-')}")
    lines.append("")
    lines.append("【六维评分（满分100，规则引擎计算）】")
    dims = [
        ("分层筛选", "score_layered_match"),
        ("关键词组合", "score_keyword_combo"),
        ("韩国品牌", "score_korea_brand"),
        ("潜力合作", "score_cooperation_potential"),
        ("表现", "score_performance"),
        ("性价比", "score_cost_effectiveness"),
    ]
    for label, key in dims:
        val = creator.get(key)
        if val is not None:
            try:
                lines.append(f"{label}: {float(val):.1f}")
            except (ValueError, TypeError):
                lines.append(f"{label}: -")
    lines.append(f"风险扣分: {creator.get('score_risk_deduction', 0)}")
    lines.append(f"规则最终分: {creator.get('score_final', 0)}")
    lines.append(f"规则推荐等级: {creator.get('recommend_grade', '?')}")
    lines.append(f"命中内容词: {creator.get('hit_content_keywords', '-')}")
    lines.append(f"命中韩国词: {creator.get('hit_korea_keywords', '-')}")
    lines.append(f"命中品牌词: {creator.get('hit_brand_keywords', '-')}")
    lines.append(f"风险原因: {creator.get('risk_reasons', '-')}")
    lines.append("")
    lines.append("【输出要求】请严格按以下 JSON 格式返回（不要包含其他文字）：")
    lines.append("{")
    lines.append('  "ai_decision": "recommend" / "cautious" / "reject",')
    lines.append('  "summary": "30字以内一句话复核总结",')
    lines.append('  "reasons": ["正向理由1", "正向理由2"],')
    lines.append('  "risks": ["风险点1", "风险点2"],')
    lines.append('  "collab_suggestions": ["适合合作方向1", "合作方向2"],')
    lines.append('  "priority_contact": true/false,')
    lines.append('  "review_hint": "人工审核提示"')
    lines.append("}")
    lines.append("")
    lines.append("决策标准：")
    lines.append("- recommend: 综合评估优秀，建议优先合作")
    lines.append("- cautious: 有可取之处但存在明显风险，建议谨慎小预算试水")
    lines.append("- reject: 多项关键指标与品牌方向不匹配，不建议合作")
    lines.append("- priority_contact: 是否建议优先联系该达人")
    return "\n".join(lines)


def _parse_ai_response(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


def _generate_fallback(creator: dict) -> dict:
    score = float(creator.get("score_final", 50))
    risks_str = creator.get("risk_reasons", "")

    if score >= 65:
        ai_decision = "cautious"
        summary = "规则评分较高但有风险项，建议谨慎试水后评估"
    elif score >= 50:
        ai_decision = "cautious"
        summary = "中等评分，可作为备选观察"
    elif score >= 35:
        ai_decision = "reject"
        summary = "多项指标偏低，不建议优先合作"
    else:
        ai_decision = "reject"
        summary = "评分过低，不适合合作"

    reasons = []
    fans = float(creator.get("粉丝数") or 0)
    if fans > 300000:
        reasons.append("粉丝基数大，品牌曝光潜力强")
    if creator.get("hit_content_keywords"):
        reasons.append("内容关键词匹配品牌方向")
    if creator.get("hit_korea_keywords"):
        reasons.append("韩国相关内容匹配")
    if creator.get("hit_brand_keywords"):
        reasons.append("已命中目标品牌关键词")
    if score >= 65:
        reasons.append("六维综合评价较好")
    if not reasons:
        reasons.append("数据完整度尚可，可进一步观察")

    risks_out = []
    if risks_str:
        for item in str(risks_str).split(";"):
            item = item.strip()
            if item:
                risks_out.append(item)
    if not risks_out:
        risks_out.append("暂无显著风险项")

    return {
        "ai_decision": ai_decision,
        "summary": summary,
        "reasons": reasons[:4],
        "risks": risks_out[:4],
        "collab_suggestions": ["建议先发私信建联测试回复率", "可参考日常互动数据评估性价比"],
        "priority_contact": score >= 65,
        "review_hint": "[FALLBACK] 以上为模板生成建议（DeepSeek API 不可用），请结合实际情况人工判断",
        "status": "fallback",
    }


async def _call_deepseek(prompt: str, api_key: str) -> str | None:
    url = f"{DEEPSEEK_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": "你是一个专业的品牌达人筛选顾问。请严格按 JSON 格式输出。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 600,
    }
    async with httpx.AsyncClient(timeout=DEEPSEEK_TIMEOUT) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
        print(f"  [DeepSeek] API error {resp.status_code}: {resp.text[:200]}")
        return None


async def run_ai_review(df: pd.DataFrame) -> Tuple[dict, int, int]:
    """对所有达人执行 AI 复核。返回 (结果字典, 成功数, fallback数)。"""
    api_key = _get_api_key()
    results = {}
    success_count = 0
    fallback_count = 0

    for idx, row in df.iterrows():
        creator = row.to_dict()
        rank = int(creator.get("rank", idx + 1))
        name = creator.get("昵称", f"row_{idx}")

        if api_key:
            try:
                prompt = _build_ai_prompt(creator)
                raw = await _call_deepseek(prompt, api_key)
                if raw:
                    parsed = _parse_ai_response(raw)
                    if parsed:
                        parsed["status"] = "success"
                        results[rank] = parsed
                        success_count += 1
                        print(f"  [{rank}] {name}: AI 复核成功")
                        continue
            except Exception as exc:
                print(f"  [{rank}] {name}: AI 调用异常 - {exc}")

            fb = _generate_fallback(creator)
            results[rank] = fb
            fallback_count += 1
            print(f"  [{rank}] {name}: AI 失败，使用 fallback")
        else:
            fb = _generate_fallback(creator)
            results[rank] = fb
            fallback_count += 1
            print(f"  [{rank}] {name}: 无 API Key，使用 fallback")

    return results, success_count, fallback_count

# ======================== AI 结果中文映射 ========================

AI_DECISION_MAP = {
    "recommend": "推荐",
    "cautious": "谨慎推荐",
    "reject": "不优先推荐",
}

# ======================== Excel 输出 ========================

def _fmt_price(val) -> int:
    """报价格式化为整数，避免浮点问题。"""
    try:
        return int(round(float(val)))
    except (ValueError, TypeError):
        return 0


def _sanitize_ai_text(text: str, score: float) -> str:
    """修正 AI 文案中明显矛盾的表述。"""
    if not text:
        return text
    # 修正"性价比评分仅XX"这类不合理的表述
    text = re.sub(r"性价比评分仅\d+", "性价比维度评分偏低", text)
    text = re.sub(r"评分仅\d+分", "综合评分偏低", text)
    # 修正"系统分XX"到更合理的表述
    text = re.sub(r"系统分\d+\.?\d*", "综合评估", text)
    return text


def _three_level_contact(ai_decision: str, score: float, priority_contact: bool) -> str:
    """将建议优先联系改为三级：优先联系 / 小预算试投 / 暂缓联系。"""
    if ai_decision == "recommend" and score >= 65:
        return "优先联系"
    if ai_decision == "recommend" or (ai_decision == "cautious" and score >= 50):
        return "小预算试投"
    return "暂缓联系"


def build_report(scored_df: pd.DataFrame, ai_results: dict, raw_df: pd.DataFrame,
                 ai_success: int, ai_fallback: int) -> None:
    """生成 5 个 sheet 的最终交付版 Excel 报告。"""

    # 合并 AI 结果到 scored_df
    scored_df = scored_df.copy()
    scored_df["AI结论"] = scored_df["rank"].map(
        lambda r: AI_DECISION_MAP.get(ai_results.get(r, {}).get("ai_decision", ""), "未评估")
    )
    scored_df["AI总结"] = scored_df["rank"].map(
        lambda r: _sanitize_ai_text(
            ai_results.get(r, {}).get("summary", ""),
            scored_df.loc[scored_df["rank"] == r, "score_final"].values[0] if r in scored_df["rank"].values else 0
        )
    )
    scored_df["AI推荐理由"] = scored_df["rank"].map(
        lambda r: " | ".join(ai_results.get(r, {}).get("reasons", []))
    )
    scored_df["AI风险点"] = scored_df["rank"].map(
        lambda r: " | ".join(ai_results.get(r, {}).get("risks", []))
    )
    scored_df["AI合作方向"] = scored_df["rank"].map(
        lambda r: " | ".join(ai_results.get(r, {}).get("collab_suggestions", []))
    )
    scored_df["AI建议联系"] = scored_df["rank"].map(
        lambda r: _three_level_contact(
            ai_results.get(r, {}).get("ai_decision", ""),
            scored_df.loc[scored_df["rank"] == r, "score_final"].values[0] if r in scored_df["rank"].values else 0,
            ai_results.get(r, {}).get("priority_contact", False),
        )
    )
    scored_df["AI人工提示"] = scored_df["rank"].map(
        lambda r: ai_results.get(r, {}).get("review_hint", "")
    )
    scored_df["AI数据来源"] = scored_df["rank"].map(
        lambda r: ai_results.get(r, {}).get("status", "")
    )

    # ---- Sheet 1: 分析总览 ----
    total = len(scored_df)
    grade_dist = scored_df["recommend_grade"].value_counts().to_dict()
    ai_dist = scored_df["AI结论"].value_counts().to_dict()

    # 统计覆盖情况
    covered_count = scored_df["客户提供分类（中文）"].apply(lambda x: x != "-" and x != "").sum() if "客户提供分类（中文）" in scored_df.columns else 0
    uncovered_total = len(CLIENT_CLASSIFICATION_MAP) - covered_count

    overview_rows = [
        ("分析时间", datetime.now().strftime("%Y-%m-%d %H:%M")),
        ("输入文件", INPUT_FILE.name),
        ("候选达人总数（蒲公英导出）", f"{total} 人"),
        ("客户原始名单链接数", f"{len(CLIENT_CLASSIFICATION_MAP)} 个"),
        ("已覆盖链接数", f"{covered_count} 个"),
        ("未覆盖链接数", f"{uncovered_total} 个（详见「5_未覆盖链接」）"),
        ("", ""),
        ("--- 对外说明 ---", ""),
        ("数据来源", "基于蒲公英(Pugongying)导出的达人数据"),
        ("覆盖说明", f"本报告基于当前蒲公英导出的 {total} 位达人数据；若原始名单中还有未覆盖账号，需补充导出或人工整理后追加分析"),
        ("AI复核说明", "AI 结论仅作合作筛选辅助参考，不构成最终决策依据"),
        ("免责声明", "最终合作仍需人工确认内容调性、报价合理性和品牌适配度"),
        ("", ""),
        ("--- 系统评分等级分布 ---", ""),
    ]

    for _, grade_label, _ in GRADE_THRESHOLDS:
        count = grade_dist.get(grade_label, 0)
        overview_rows.append((f"  {grade_label}", f"{count}人 ({count/total*100:.0f}%)"))

    overview_rows.append(("", ""))
    overview_rows.append(("--- AI 复核结论分布 ---", ""))
    for decision in ["推荐", "谨慎推荐", "不优先推荐"]:
        count = ai_dist.get(decision, 0)
        overview_rows.append((f"  {decision}", f"{count}人 ({count/total*100:.0f}%)"))

    overview_rows.append(("", ""))
    overview_rows.append(("--- AI 复核统计 ---", ""))
    overview_rows.append(("  AI 成功调用", str(ai_success)))
    overview_rows.append(("  Fallback 模板", str(ai_fallback)))
    overview_rows.append(("  DeepSeek 可用", "是" if ai_success > 0 else "否"))

    overview_rows.append(("", ""))
    overview_rows.append(("--- 六维评分均值 ---", ""))
    dim_keys = [
        ("score_layered_match", "分层筛选"),
        ("score_keyword_combo", "关键词组合"),
        ("score_korea_brand", "韩国品牌"),
        ("score_cooperation_potential", "潜力合作"),
        ("score_performance", "表现"),
        ("score_cost_effectiveness", "性价比"),
    ]
    for key, label in dim_keys:
        overview_rows.append((f"  {label}", f"{scored_df[key].mean():.1f}"))

    overview_df = pd.DataFrame(overview_rows, columns=["指标", "值"])

    # ---- Sheet 2: 推荐排序 ----
    rank_df = scored_df.copy()
    rank_df["达人标签_short"] = rank_df["内容类目|标签"].map(lambda x: str(x)[:40] + "..." if len(str(x)) > 40 else str(x))
    rank_df["粉丝数_万"] = (rank_df["粉丝数"] / 10000).round(1)
    rank_df["图文报价_int"] = rank_df["图文报价"].map(_fmt_price)
    rank_df["视频报价_int"] = rank_df["视频报价"].map(_fmt_price)
    rank_df["系统评分_fmt"] = rank_df["score_final"].map(lambda x: f"{x:.1f}")
    rank_df = rank_df.sort_values("rank")

    # 推荐优先级：基于系统分+AI结论综合判定
    def _priority(row):
        ai = row.get("AI结论", "")
        score = row.get("score_final", 0)
        if ai == "推荐" and score >= 65:
            return "高"
        if ai == "推荐" or (ai == "谨慎推荐" and score >= 55):
            return "中"
        return "低"

    rank_df["推荐优先级"] = rank_df.apply(_priority, axis=1)

    rank_output = rank_df[["rank", "推荐优先级", "昵称", "小红书号", "地域", "粉丝数_万",
                            "客户提供分类（韩文）", "客户提供分类（中文）", "内容分类(系统推断)",
                            "达人标签_short",
                            "系统评分_fmt", "recommend_grade", "AI结论", "AI总结",
                            "AI合作方向", "AI风险点", "AI建议联系",
                            "图文报价_int", "视频报价_int"]].copy()
    rank_output.columns = ["排名", "推荐优先级", "达人昵称", "小红书号", "所属城市", "粉丝数(万)",
                            "客户提供分类（韩文）", "客户提供分类（中文）", "内容分类(系统推断)",
                            "达人标签",
                            "系统评分", "系统等级", "AI结论", "AI总结",
                            "适合合作方向", "主要风险", "建议联系",
                            "图文报价(元)", "视频报价(元)"]

    # ---- Sheet 3: 达人详细分析 ----
    detail_cols = [
        "rank", "昵称", "小红书号", "小红书主页URL", "地域", "粉丝数",
        "客户提供分类（韩文）", "客户提供分类（中文）", "内容分类(系统推断)", "内容类目|标签", "过往合作品牌",
        "阅读中位数_日常", "互动中位数_日常", "日常笔记ER",
        "图文报价", "视频报价", "全部报价",
        "邀约48小时回复率", "最近发布笔记时间", "外溢进店中位数",
        "score_layered_match", "score_keyword_combo", "score_korea_brand",
        "score_cooperation_potential", "score_performance", "score_cost_effectiveness",
        "score_risk_deduction", "score_final", "recommend_grade",
        "hit_content_keywords", "hit_korea_keywords", "hit_brand_keywords",
        "risk_reasons", "exclude_flag",
        "AI结论", "AI总结", "AI推荐理由", "AI风险点", "AI合作方向",
        "AI建议联系", "AI人工提示", "AI数据来源",
        "蒲公英链接",
    ]
    detail_avail = [c for c in detail_cols if c in scored_df.columns]
    detail_df = scored_df[detail_avail].copy()
    detail_df["粉丝数(万)"] = (detail_df["粉丝数"] / 10000).round(1)

    # ---- Sheet 4: 原始数据 ----
    raw_out = raw_df.copy()

    # ---- Sheet 5: 未覆盖链接 ----
    uncovered_rows = []
    # 收集蒲公英导出中出现的 userId
    exported_user_ids = set()
    if "_user_id" in scored_df.columns:
        exported_user_ids = set(scored_df["_user_id"].dropna().tolist())

    for uid, (kr, cn) in CLIENT_CLASSIFICATION_MAP.items():
        in_export = uid in exported_user_ids
        # 构造原始主页链接
        profile_url = f"https://www.xiaohongshu.com/user/profile/{uid}" if not in_export else ""
        uncovered_rows.append({
            "客户提供分类（韩文）": kr,
            "客户提供分类（中文）": cn,
            "原始主页链接": profile_url if not in_export else f"（已覆盖）https://www.xiaohongshu.com/user/profile/{uid}",
            "是否出现在蒲公英导出表": "是" if in_export else "否",
            "备注": "" if in_export else "需补充导出或人工整理后追加分析",
        })
    uncovered_df = pd.DataFrame(uncovered_rows)

    # ---- 写入 Excel ----
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        overview_df.to_excel(writer, sheet_name="1_分析总览", index=False)
        rank_output.to_excel(writer, sheet_name="2_推荐排序", index=False)
        detail_df.to_excel(writer, sheet_name="3_达人详细分析", index=False)
        raw_out.to_excel(writer, sheet_name="4_原始数据", index=False)
        uncovered_df.to_excel(writer, sheet_name="5_未覆盖链接", index=False)

        # 格式美化
        try:
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side, numbers
            from openpyxl.utils import get_column_letter

            header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            header_font_white = Font(bold=True, size=11, color="FFFFFF")
            wrap_align = Alignment(wrap_text=True, vertical="top")
            thin_border = Border(bottom=Side(style="thin", color="D9D9D9"))

            for sheet_name in writer.sheets:
                ws = writer.sheets[sheet_name]
                # 表头样式
                for cell in ws[1]:
                    cell.font = header_font_white
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                # 列宽自适应
                for col_idx in range(1, ws.max_column + 1):
                    max_len = 0
                    for row_idx in range(1, min(ws.max_row + 1, 25)):
                        val = ws.cell(row=row_idx, column=col_idx).value
                        if val:
                            max_len = max(max_len, len(str(val)))
                    ws.column_dimensions[get_column_letter(col_idx)].width = min(max_len + 4, 45)
                # 数据行样式
                for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
                    for cell in row:
                        cell.alignment = wrap_align
                        cell.border = thin_border

            # 2_推荐排序：报价列千分位格式
            ws2 = writer.sheets["2_推荐排序"]
            # 图文报价(元) = col 18, 视频报价(元) = col 19
            for col_letter in ["R", "S"]:
                for row_idx in range(2, ws2.max_row + 1):
                    cell = ws2[f"{col_letter}{row_idx}"]
                    if isinstance(cell.value, (int, float)):
                        cell.number_format = '#,##0'

        except Exception as fmt_exc:
            print(f"  [格式美化] 跳过: {fmt_exc}")

    print(f"\n报告已生成: {OUTPUT_FILE}")


# ======================== 主流程 ========================

def main():
    print("=" * 60)
    print("朴代表候选达人 AI 分析")
    print("=" * 60)

    # 1. 读取 Excel
    print(f"\n[1] 读取输入文件: {INPUT_FILE}")
    raw_df = pd.read_excel(INPUT_FILE, sheet_name=SHEET_NAME)
    print(f"    识别到 sheet「{SHEET_NAME}」，共 {len(raw_df)} 个达人")

    # 2. 字段映射
    print("\n[2] 字段映射蒲公英 → 内部格式...")
    mapped = map_pugongying_fields(raw_df)
    print(f"    映射完成，共 {len(mapped)} 行")

    # 3. 加载评分配置
    print("\n[3] 加载评分配置...")
    keyword_config = _load_config("keyword_groups.json")
    exclude_config = _load_config("exclude_rules.json")

    content_kw = [k.lower() for k in keyword_config.get("content_keywords", [])]
    korea_kw = [k.lower() for k in keyword_config.get("korea_keywords", [])]
    brand_kw = [k.lower() for k in keyword_config.get("brand_keywords", [])]
    exclude_kw = [k.lower() for k in exclude_config.get("exclude_keywords", [])]
    print(f"    内容关键词: {len(content_kw)}个, 韩国关键词: {len(korea_kw)}个, 品牌关键词: {len(brand_kw)}个")

    # 4. 六维评分
    print("\n[4] 计算六维评分...")
    df = mapped.copy()

    df["score_layered_match"] = score_layered_match(df)
    print("    分层筛选 ✓")

    kw_scores, kw_hits = score_keyword_combo(df, content_kw)
    df["score_keyword_combo"] = kw_scores
    df["hit_content_keywords"] = kw_hits
    print("    关键词组合 ✓")

    kb_scores, kb_hit_korea, kb_hit_brand = score_korea_brand(df, korea_kw, brand_kw)
    df["score_korea_brand"] = kb_scores
    df["hit_korea_keywords"] = kb_hit_korea
    df["hit_brand_keywords"] = kb_hit_brand
    print("    韩国品牌 ✓")

    df["score_cooperation_potential"] = score_cooperation_potential(df)
    print("    潜力合作 ✓")

    df["score_performance"] = score_performance(df)
    print("    表现 ✓")

    df["score_cost_effectiveness"] = score_cost_effectiveness(df)
    print("    性价比 ✓")

    risk_ded, risk_reasons, exclude_flag = score_risk_deduction(df, exclude_kw)
    df["score_risk_deduction"] = risk_ded
    df["risk_reasons"] = risk_reasons
    df["exclude_flag"] = exclude_flag
    print("    风险扣分 ✓")

    # 最终分
    w = SCORE_WEIGHTS
    df["score_final"] = (
        df["score_layered_match"] * w["layered_match"]
        + df["score_keyword_combo"] * w["keyword_combo"]
        + df["score_korea_brand"] * w["korea_brand"]
        + df["score_cooperation_potential"] * w["cooperation_potential"]
        + df["score_performance"] * w["performance"]
        + df["score_cost_effectiveness"] * w["cost_effectiveness"]
        + df["score_risk_deduction"]
    ).clip(lower=0)

    grade_tuples = df["score_final"].map(determine_grade)
    df["recommend_grade"] = grade_tuples.map(lambda t: t[0])
    df["grade_short"] = grade_tuples.map(lambda t: t[1])

    df = df.sort_values("score_final", ascending=False).reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)

    print(f"    评分完成，最高分: {df['score_final'].max():.1f}，最低分: {df['score_final'].min():.1f}")

    # 5. AI 复核
    print("\n[5] DeepSeek AI 复核...")
    has_key = _get_api_key() is not None
    print(f"    API Key: {'可用' if has_key else '不可用，将使用 fallback 模板'}")

    ai_results, ai_success, ai_fallback = asyncio.run(run_ai_review(df))
    print(f"    AI 成功: {ai_success}, Fallback: {ai_fallback}")

    # 6. 生成报告
    print("\n[6] 生成 Excel 报告...")
    build_report(df, ai_results, raw_df, ai_success, ai_fallback)

    # 7. 汇总
    # 统计覆盖情况
    covered_uids = set()
    if "_user_id" in df.columns:
        covered_uids = set(df["_user_id"].dropna().tolist())
    uncovered = {uid: v for uid, v in CLIENT_CLASSIFICATION_MAP.items() if uid not in covered_uids}

    print("\n" + "=" * 60)
    print("分析完成！")
    print("=" * 60)
    print(f"  读取达人数: {len(raw_df)}")
    print(f"  客户原始名单链接数: {len(CLIENT_CLASSIFICATION_MAP)}")
    print(f"  已覆盖链接: {len(CLIENT_CLASSIFICATION_MAP) - len(uncovered)}")
    print(f"  未覆盖链接: {len(uncovered)}")
    print(f"  AI 成功/Fallback: {ai_success}/{ai_fallback}")
    print(f"  报告路径: {OUTPUT_FILE}")
    print()

    # Top3
    print("Top3 推荐达人:")
    for _, row in df.head(3).iterrows():
        print(f"  {int(row['rank'])}. {row['昵称']} - 系统分:{row['score_final']:.1f} {row['recommend_grade']} | AI:{AI_DECISION_MAP.get(ai_results.get(int(row['rank']), {}).get('ai_decision', ''), '未评估')}")
    print()

    # 未覆盖链接
    if uncovered:
        print("未覆盖的客户原始链接:")
        for uid, (kr, cn) in uncovered.items():
            print(f"  - {cn} ({kr}) : {uid}")

    # 需要人工确认的
    print("需要人工进一步确认的达人:")
    caution_list = []
    for _, row in df.iterrows():
        r = int(row["rank"])
        ai = ai_results.get(r, {})
        if ai.get("ai_decision") == "cautious" or ai.get("status") == "fallback":
            caution_list.append(row)
    if caution_list:
        for row in caution_list:
            r = int(row["rank"])
            ai = ai_results.get(r, {})
            reason = ai.get("review_hint", "模板生成")
            print(f"  {r}. {row['昵称']} (分:{row['score_final']:.1f}) - {reason}")
    else:
        print("  无")

    return df, ai_results


if __name__ == "__main__":
    ensure_runtime_dirs()
    main()
