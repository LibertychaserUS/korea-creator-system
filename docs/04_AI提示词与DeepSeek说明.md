# AI 提示词与 DeepSeek 说明

## 版本
- `v5-stage5-calibrated` / 2026-06-17（已完成校准验收）

## API 配置
- **接口地址**：`https://api.deepseek.com/v1/chat/completions`
- **模型**：`deepseek-chat`
- **调用方式**：FastAPI `async def` + `httpx.AsyncClient`
- **超时**：30 秒/请求
- **Temperature**：0.3
- **Max Tokens**：600

## API Key 配置（按优先级）
1. 环境变量：`DEEPSEEK_API_KEY`
2. 配置文件：`config/settings.json` → `deepseek_api_key`
3. Windows 注册表：`HKCU\Environment\DEEPSEEK_API_KEY`（自动读取）
4. 未配置时自动使用模板 fallback

## Prompt 设计（校准版）

### 核心原则
- AI 是 **复核角色**，不是替代规则评分
- 规则评分负责初筛，AI 负责风险审查
- AI 不参与排名，仅提供合作建议

### 系统提示词
```
你是一个专业的品牌达人筛选顾问。请严格按 JSON 格式输出。
```

### 用户提示词关键约束
1. **角色**：合作复核，不是重新排序
2. **禁止 ER 一票否决**：需综合粉丝量、内容匹配度、品牌关键词、报价合理性、风险扣分等多维判断
3. **三元决策**：recommend / cautious / reject
4. **冲突说明**：当与规则评分不一致时，必须解释原因

### 输出 JSON Schema（校准版）
```json
{
  "ai_decision": "recommend" / "cautious" / "reject",
  "summary": "30字以内一句话复核总结",
  "reasons": ["正向理由1", "正向理由2"],
  "risks": ["风险点1", "风险点2"],
  "collab_suggestions": ["合作建议1", "合作建议2"],
  "review_hint": "人工审核提示",
  "ai_conflict_with_rule": true/false,
  "conflict_reason": "与规则评分一致/不一致的原因",
  "status": "success"
}
```

### 决策标准
| 决策 | 含义 | 适用场景 |
|------|------|---------|
| `recommend` | 推荐合作 | 综合评估优秀，建议优先合作 |
| `cautious` | 谨慎试水 | 有可取之处但存在明显风险，建议小预算试水 |
| `reject` | 不推荐 | 多项关键指标与品牌方向不匹配 |

## 校准效果（Top10 验证）

| # | 昵称 | 规则分 | 规则等级 | AI决策 | 冲突 |
|---|------|--------|---------|--------|------|
| 1 | 居猫夫人 | 75.8 | A | cautious | ✅ |
| 2 | 清潭洞娜娜西 | 73.5 | A | cautious | ✅ |
| 3 | 鹿鹿不迷糊 | 72.5 | A | cautious | ✅ |
| 4-10 | (全部) | 70.7-71.7 | A | cautious | ✅ |

**分析**：Top10 全部获 `cautious`，与规则 A 级全部冲突。
- 共同风险：合作 ER 偏低（0.59%~3.9%）、匹配笔记数少（1-3篇）、数据完整度不足
- AI 一致性：提示了真实的合作风险，而非机械地套用规则分数
- 结论：校准有效——AI 从"一票否决 reject"转为"谨慎试水 cautious"，更符合品牌合作实际场景

## 智能缓存策略

| 条件 | 行为 |
|------|------|
| 有 Key + force=true | 忽略全部缓存，重新生成 |
| 有 Key + force=false | 复用 "success" 缓存，重新处理 "fallback" 缓存 |
| 无 Key + force=true | 忽略全部缓存，重新用模板生成 |
| 无 Key + force=false | 复用全部缓存 |

## 缓存文件
- 路径：`data/cache/ai_recommendations.json`（运行缓存，已加入 `.gitignore`）
- 建议：交付时保留含 Top10 success 的版本作为示例数据

## 2026-06-18 第八阶段 A.1 补充

### 1. AI 复核与翻译分离
- 规则不变：AI 复核只生成一次主结论，不重新评分、不改排名。
- 新增展示层翻译：切换语言时不重跑整套 AI 分析，只翻译自然语言字段。
- 结构化字段保持原值：
  - `ai_decision`
  - `status`
  - `grade`
  - 各项分数
  - ER、报价、排名

### 2. 翻译字段范围
- `summary`
- `reasons`
- `risks`
- `collab_suggestions`
- `review_hint`
- `conflict_reason`

### 3. 翻译缓存
- 缓存文件：`data/cache/ai_translation_cache.json`
- 缓存键：`creator_key + ":" + source_hash + ":" + target_language`
- `source_hash` 基于原始自然语言字段生成；原文变化后旧翻译自动失效。
- 当前实测：已生成英文、韩文各 1 条缓存，缓存命中状态为 `hit`。

### 4. 翻译调用策略
- 真实 `success` 结果：
  - 优先读翻译缓存
  - 未命中时调用现有 DeepSeek 兼容客户端做“仅翻译”
- `fallback` 结果：
  - 直接返回本地化规则模板
  - `cache_status = fallback_template`
  - 不调用 AI 翻译
- 无 API Key 或翻译失败：
  - 返回原文
  - `translated = false`
  - `used_original = true`
  - 页面展示“暂未翻译”，但不报错

### 5. 冲突解释口径
- `conflict_reason` 仅做说明文本展示。
- 真正的冲突分类统一以后端公共函数为准，前端不自行推断红黄绿状态。

## 2026-06-19 第八阶段 A.2 补充

### 1. AI 复核与 AI 翻译的区别
- **AI 复核**：调用 DeepSeek 对达人进行风险分析，生成决策（recommend/cautious/reject）和自然语言说明
  - 只执行一次，结果存入 `ai_recommendations.json`
  - 不修改评分、排名、等级
- **AI 翻译**：将已有的 AI 复核自然语言内容翻译为目标语言
  - 不重新分析，只翻译展示文本
  - 结果存入 `ai_translation_cache.json`
  - 结构化字段（decision、grade、score、rank）保持不变

### 2. 翻译缓存策略
- 缓存键：`creator_key + ":" + source_hash + ":" + target_language`
- `source_hash` 基于原始自然语言字段生成
- 原文变化后旧翻译自动失效（hash 不匹配）
- 缓存命中时直接返回，不调用 API

### 3. 翻译失败降级
- 无 API Key：返回原文，标记 `translated=false`
- API 调用失败：返回原文，标记 `cache_status=failed_original`
- 页面显示"暂未翻译"提示

### 4. 原文保留策略
- 翻译失败时显示原文，不隐藏内容
- 用户可点击"查看原文"按钮对比
- 不删除真实 AI 原始结果

### 5. fallback 本地化
- fallback 结果使用本地语言模板，不调用 AI 翻译
- 模板已预置中文、英文、韩文三语版本
- `cache_status=fallback_template`
