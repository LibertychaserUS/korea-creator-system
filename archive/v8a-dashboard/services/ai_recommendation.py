"""第五阶段：DeepSeek 复核与翻译服务。

对 Top N 达人生成 AI 复核意见，不参与评分和排名。
支持 API Key 读取、失败 fallback、结果缓存，以及“分析一次，按需翻译”的多语言缓存。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import httpx

from core.paths import CACHE_DIR, CONFIG_DIR, OUTPUT_DIR, ensure_runtime_dirs

DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_TIMEOUT = 30

AI_CACHE_FILE = CACHE_DIR / "ai_recommendations.json"
AI_TRANSLATION_CACHE_FILE = CACHE_DIR / "ai_translation_cache.json"

TOP_N = 50
SUPPORTED_TRANSLATION_LANGUAGES = {"zh-CN", "en", "ko"}


def _get_api_key() -> str | None:
    """读取 DEEPSEEK_API_KEY，优先级：环境变量 > settings.json > Windows 注册表。"""
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


def has_deepseek_api_key() -> bool:
    return bool(_get_api_key())


def _fmt_num(val: Any) -> str:
    if val is None:
        return "-"
    try:
        n = float(val)
        if n >= 10000:
            return f"{n/10000:.1f}万"
        return str(int(n))
    except (ValueError, TypeError):
        return str(val)


def _fmt_price(val: Any) -> str:
    if val is None:
        return "-"
    try:
        n = float(val)
        return f"{n/10000:.1f}万"
    except (ValueError, TypeError):
        return str(val)


def _fmt_val(val: Any) -> str:
    if val is None:
        return "-"
    try:
        return f"{float(val):.1f}"
    except (ValueError, TypeError):
        return str(val)


def _build_prompt(creator: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("你是韩国品牌（服饰、美妆、生活方式）小红书达人筛选顾问。")
    lines.append("请根据以下达人信息，给出合作复核意见。")
    lines.append("注意：规则评分已经筛选出该达人，你的任务是复核风险并给出最终合作建议。")
    lines.append("不要仅根据单一指标（如 ER）一票否决，要综合粉丝量、内容匹配度、品牌关键词、报价合理性、风险扣分等多维度判断。")
    lines.append("")
    lines.append("【达人信息】")
    lines.append(f"昵称: {creator.get('昵称', '-')}")
    lines.append(f"地域: {creator.get('地域', '-')}")
    lines.append(f"身份/人设: {creator.get('身份|人设', '-')}")
    lines.append(f"内容标签: {creator.get('内容类目|标签', '-')}")
    lines.append(f"粉丝数: {_fmt_num(creator.get('粉丝数'))}")
    lines.append(f"全部报价: {_fmt_price(creator.get('全部报价'))}")
    lines.append(f"匹配笔记数: {creator.get('匹配笔记数', '-')}")
    lines.append(f"合作笔记ER: {creator.get('合作笔记ER', '-')}")
    lines.append(f"日常笔记ER: {creator.get('日常笔记ER', '-')}")
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
            lines.append(f"{label}: {val:.1f}")
    grade = creator.get("recommend_grade", creator.get("grade_short", "?"))
    lines.append(f"风险扣分: {_fmt_val(creator.get('score_risk_deduction'))}")
    lines.append(f"规则最终分: {_fmt_val(creator.get('score_final'))}")
    lines.append(f"规则推荐等级: {grade}")
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
    lines.append('  "collab_suggestions": ["合作建议1", "合作建议2"],')
    lines.append('  "review_hint": "人工审核提示",')
    lines.append('  "ai_conflict_with_rule": true/false,')
    lines.append('  "conflict_reason": "如果与规则评分不一致，说明原因；如果一致，说明为什么认可规则评分"')
    lines.append("}")
    lines.append("")
    lines.append("决策标准：")
    lines.append("- recommend: 综合评估优秀，建议优先合作")
    lines.append("- cautious: 有可取之处但存在明显风险，建议谨慎小预算试水")
    lines.append("- reject: 多项关键指标与品牌方向不匹配，不建议合作")
    lines.append("")
    lines.append("关于 ai_conflict_with_rule：")
    lines.append("- 规则高分段(>=65)但你给 cautious/reject，说明你不完全认可规则评分，需解释原因")
    lines.append("- 规则低分段(<50)但你给 recommend，也需要解释原因")
    lines.append("- 判断一致时，简要说明为什么认可规则评分")
    return "\n".join(lines)


def _ensure_native(obj: Any) -> Any:
    import numpy as np
    import pandas as pd

    if pd.isna(obj) if isinstance(obj, (float, int)) or obj is None else False:
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.ndarray,)):
        return [_ensure_native(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _ensure_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_ensure_native(v) for v in obj]
    return obj


def _parse_ai_response(text: str | None) -> dict[str, Any] | None:
    if not text:
        return None
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


def _generate_fallback(creator: dict[str, Any]) -> dict[str, Any]:
    score = float(creator.get("score_final", 50))
    risks_str = creator.get("risk_reasons", "")

    if score >= 65:
        ai_decision = "cautious"
        summary = "规则评分较高但有风险项，建议谨慎试水后评估"
        conflict = True
        conflict_reason = "规则评分≥65推荐，但模板检测到风险扣分项，建议复核后再决定"
    elif score >= 50:
        ai_decision = "cautious"
        summary = "中等评分，可作为备选观察"
        conflict = False
        conflict_reason = "中等评分与谨慎态度一致"
    elif score >= 35:
        ai_decision = "reject"
        summary = "多项指标偏低，不建议优先合作"
        conflict = False
        conflict_reason = "低评分与不推荐判断一致"
    else:
        ai_decision = "reject"
        summary = "评分过低，不适合合作"
        conflict = False
        conflict_reason = "低评分与不推荐判断一致"

    reasons: list[str] = []
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

    risks_out: list[str] = []
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
        "collab_suggestions": ["建议先发私信建联测试回复率", "可参考合作笔记ER评估性价比"],
        "review_hint": "以上为模板生成建议，请结合实际情况人工判断",
        "ai_conflict_with_rule": conflict,
        "conflict_reason": conflict_reason,
        "status": "fallback",
    }


async def _call_deepseek(
    *,
    prompt: str,
    api_key: str,
    system_prompt: str,
    max_tokens: int,
    temperature: float,
) -> str | None:
    url = f"{DEEPSEEK_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=DEEPSEEK_TIMEOUT) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return None
        print(f"[DeepSeek] API error {resp.status_code}: {resp.text[:200]}")
        return None


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _normalize_translation_payload(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": str(data.get("summary", "") or ""),
        "reasons": [str(item) for item in (data.get("reasons") or []) if str(item).strip()],
        "risks": [str(item) for item in (data.get("risks") or []) if str(item).strip()],
        "collab_suggestions": [str(item) for item in (data.get("collab_suggestions") or data.get("suggestions") or []) if str(item).strip()],
        "review_hint": str(data.get("review_hint", "") or ""),
        "conflict_reason": str(data.get("conflict_reason", "") or data.get("conflict_explanation", "") or ""),
    }


def _extract_translation_source(ai_record: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": ai_record.get("summary", "") or "",
        "reasons": ai_record.get("reasons", []) or [],
        "risks": ai_record.get("risks", []) or [],
        "collab_suggestions": ai_record.get("collab_suggestions", []) or [],
        "review_hint": ai_record.get("review_hint", "") or "",
        "conflict_reason": ai_record.get("conflict_reason", "") or "",
    }


def _compute_text_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_translation_prompt(source_payload: dict[str, Any], target_language: str) -> str:
    language_map = {
        "en": "English",
        "ko": "Korean",
        "zh-CN": "Simplified Chinese",
    }
    target_label = language_map.get(target_language, target_language)
    return "\n".join(
        [
            f"请把下面 JSON 中的自然语言内容翻译成 {target_label}。",
            "只翻译自然语言文本，不要改动数值、百分比、货币、品牌名、等级、决策代码。",
            "保留字段结构，严格输出 JSON，不要添加解释。",
            json.dumps(source_payload, ensure_ascii=False, indent=2),
        ]
    )


async def translate_ai_texts(
    *,
    creator_key: str,
    ai_record: dict[str, Any],
    target_language: str,
) -> dict[str, Any]:
    ensure_runtime_dirs()

    source_payload = _extract_translation_source(ai_record)
    source_hash = _compute_text_hash(source_payload)
    normalized_source = _normalize_translation_payload(source_payload)

    if target_language == "zh-CN":
        return {
            "language": target_language,
            "creator_key": creator_key,
            "source_hash": source_hash,
            "cache_status": "original",
            "translated": False,
            "used_original": True,
            "payload": normalized_source,
            "original": normalized_source,
        }

    if target_language not in SUPPORTED_TRANSLATION_LANGUAGES:
        return {
            "language": target_language,
            "creator_key": creator_key,
            "source_hash": source_hash,
            "cache_status": "unsupported",
            "translated": False,
            "used_original": True,
            "payload": normalized_source,
            "original": normalized_source,
        }

    cache = _read_json(AI_TRANSLATION_CACHE_FILE, {})
    cache_key = f"{creator_key}:{source_hash}:{target_language}"
    if cache_key in cache:
        payload = _normalize_translation_payload(cache[cache_key].get("payload", {}))
        return {
            "language": target_language,
            "creator_key": creator_key,
            "source_hash": source_hash,
            "cache_status": "hit",
            "translated": True,
            "used_original": False,
            "payload": payload,
            "original": normalized_source,
        }

    api_key = _get_api_key()
    if not api_key:
        return {
            "language": target_language,
            "creator_key": creator_key,
            "source_hash": source_hash,
            "cache_status": "no_api_key",
            "translated": False,
            "used_original": True,
            "payload": normalized_source,
            "original": normalized_source,
        }

    try:
        raw = await _call_deepseek(
            prompt=_build_translation_prompt(source_payload, target_language),
            api_key=api_key,
            system_prompt="你是一个专业翻译助手。只输出 JSON，保持字段结构不变，不解释。",
            max_tokens=900,
            temperature=0.1,
        )
        if raw:
            parsed = _parse_ai_response(raw)
            if parsed:
                normalized = _normalize_translation_payload(parsed)
                cache[cache_key] = {
                    "creator_key": creator_key,
                    "language": target_language,
                    "source_hash": source_hash,
                    "payload": normalized,
                }
                AI_TRANSLATION_CACHE_FILE.write_text(
                    json.dumps(cache, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                return {
                    "language": target_language,
                    "creator_key": creator_key,
                    "source_hash": source_hash,
                    "cache_status": "miss_saved",
                    "translated": True,
                    "used_original": False,
                    "payload": normalized,
                    "original": normalized_source,
                }
    except Exception as exc:
        print(f"[DeepSeek][translate] creator={creator_key} lang={target_language} error: {exc}")

    return {
        "language": target_language,
        "creator_key": creator_key,
        "source_hash": source_hash,
        "cache_status": "failed_original",
        "translated": False,
        "used_original": True,
        "payload": normalized_source,
        "original": normalized_source,
    }


async def run_ai_recommendations(limit: int = 50, force: bool = False) -> dict[str, Any]:
    limit = min(max(limit, 1), 50)
    ensure_runtime_dirs()

    scores_csv = OUTPUT_DIR / "scores_full.csv"
    if not scores_csv.exists():
        return {"error": "scores_full.csv not found, run python -m app.main first"}

    import pandas as pd

    df = pd.read_csv(scores_csv, encoding="utf-8-sig")
    top_n = df.head(limit)

    cache: dict[str, dict[str, Any]] = _read_json(AI_CACHE_FILE, {})
    api_key = _get_api_key()
    results: dict[str, dict[str, Any]] = {}
    success_count = 0
    fail_count = 0
    fallback_count = 0
    cached_count = 0

    for _, row in top_n.iterrows():
        rank = str(int(row["rank"]))
        creator_data = _ensure_native(row.to_dict())

        skip_because_cached = False
        if not force and rank in cache:
            existing = cache[rank]
            existing_status = existing.get("status")
            if not api_key:
                if existing_status in ("success", "fallback"):
                    skip_because_cached = True
            else:
                if existing_status == "success":
                    skip_because_cached = True

        if skip_because_cached:
            results[rank] = cache[rank]
            cached_count += 1
            continue

        if api_key:
            try:
                raw = await _call_deepseek(
                    prompt=_build_prompt(creator_data),
                    api_key=api_key,
                    system_prompt="你是一个专业的品牌达人筛选顾问。请严格按 JSON 格式输出。",
                    max_tokens=600,
                    temperature=0.3,
                )
                if raw:
                    parsed = _parse_ai_response(raw)
                    if parsed:
                        parsed["status"] = "success"
                        results[rank] = parsed
                        success_count += 1
                        continue
            except Exception as exc:
                print(f"[DeepSeek] rank={rank} exception: {exc}")

            fallback = _generate_fallback(creator_data)
            fallback["status"] = "fallback"
            results[rank] = fallback
            fail_count += 1
        else:
            fallback = _generate_fallback(creator_data)
            fallback["status"] = "fallback"
            results[rank] = fallback
            fallback_count += 1

    cache.update(results)
    AI_CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

    all_results = _read_json(AI_CACHE_FILE, {})
    total_success = sum(1 for value in all_results.values() if value.get("status") == "success")
    total_fallback = sum(1 for value in all_results.values() if value.get("status") == "fallback")

    return {
        "has_api_key": bool(api_key),
        "total": limit,
        "success": success_count,
        "fail": fail_count,
        "fallback": fallback_count,
        "cached": cached_count,
        "total_cached": len(all_results),
        "total_success_cached": total_success,
        "total_fallback_cached": total_fallback,
        "recommendations": all_results,
    }
