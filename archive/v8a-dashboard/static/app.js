const translations = {
  "zh-CN": {
    "app.title": "全球达人情报系统",
    "brand.title": "全球达人情报系统",
    "brand.subtitle": "真实评分、AI复核与人工确认",
    "project.name": "韩国品牌 Demo",
    "nav.overview": "概览",
    "nav.creators": "达人库",
    "nav.ai": "AI复核",
    "nav.manual": "人工复核",
    "nav.outreach": "邮件触达",
    "nav.exports": "数据与导出",
    "nav.rules": "规则复盘",
    "toolbar.country": "当前国家/地区",
    "toolbar.platform": "当前平台",
    "toolbar.updated": "数据更新时间",
    "toolbar.searchPlaceholder": "搜索昵称 / 关键词",
    "toolbar.user": "当前项目",
    "page.overview.title": "全球达人情报概览",
    "page.overview.desc": "基于真实评分、真实 DeepSeek 复核和人工标注结果的展示面板。",
    "page.creators.title": "达人库",
    "page.creators.desc": "支持 Top10 / Top50 / 全量浏览、筛选、排序、下载与详情抽屉。",
    "page.ai.title": "AI复核中心",
    "page.ai.desc": "只对真实 DeepSeek 结果统计决策比例，fallback 只作模板参考。",
    "page.rules.title": "规则复盘",
    "page.rules.desc": "查看当前规则版本、分析批次、人工复核分歧与优化建议。",
    "page.placeholder.title": "下一阶段完善",
    "page.placeholder.desc": "该页面已保留入口，本轮不开发第八阶段 B 功能。",
    "page.import.title": "数据导入",
    "page.import.desc": "上传 CSV 文件导入达人数据，支持字段检测与完整率分析。",
    "import.uploadArea": "拖拽 CSV 文件到此处或点击上传",
    "import.uploadBtn": "选择 CSV 文件",
    "import.detectFields": "字段检测",
    "import.requiredFields": "必含字段",
    "import.optionalFields": "可选字段",
    "import.rowsFound": "检测到 {count} 行数据",
    "import.confirmImport": "确认导入",
    "import.importing": "导入中...",
    "import.success": "导入成功：{count} 条达人记录",
    "import.batchList": "已有批次",
    "import.noBatches": "暂无批次",
    "import.completeness": "完整率",
    "import.fieldReport": "字段检测报告",
    "toolbar.batch": "当前批次",
    "metric.totalCreators": "达人总数",
    "metric.top50": "Top50数量",
    "metric.avgScore": "最终分平均值",
    "metric.aiReal": "真实 DeepSeek 结果",
    "metric.manualPending": "人工待确认数量",
    "metric.hardConflict": "强冲突数量",
    "metric.softDivergence": "谨慎复核数量",
    "metric.aiCoverage": "AI真实覆盖率",
    "metric.realBase": "真实决策样本数",
    "metric.fallback": "Fallback数量",
    "metric.pendingAi": "待生成数量",
    "metric.consistent": "结论一致数量",
    "metric.avgScoreHint": "基于全量评分结果",
    "metric.aiRealHint": "真实 DeepSeek 成功结果或其缓存",
    "metric.hardConflictHint": "只统计真实 success 结果",
    "metric.softHint": "建议人工再确认",
    "panel.top10": "Top10最终分横向柱状图",
    "panel.gradeDistribution": "等级分布",
    "panel.keywordTop10": "内容关键词Top10",
    "panel.regionDistribution": "地区 / 国家分布",
    "panel.aiStatus": "AI覆盖率与来源",
    "panel.manualRecent": "最近人工复核记录",
    "panel.aiRecent": "最近AI复核记录",
    "panel.aiReviewCoverage": "AI覆盖率",
    "panel.aiDecisionDistribution": "AI决策分布",
    "panel.pendingReview": "待复核达人列表",
    "panel.dataNote": "数据与AI说明",
    "panel.terms": "指标说明 / 术语说明",
    "panel.drawerOverview": "达人概览",
    "panel.drawerScoring": "评分依据",
    "panel.drawerAi": "AI复核",
    "panel.drawerManual": "人工复核",
    "panel.realDecisionBase": "基于 {count} 条真实 DeepSeek 复核结果",
    "table.rank": "排名",
    "table.nickname": "昵称",
    "table.platform": "平台",
    "table.country": "国家/地区",
    "table.grade": "等级",
    "table.score": "最终分",
    "table.fans": "粉丝数",
    "table.price": "报价",
    "table.er": "合作ER",
    "table.aiStatus": "AI来源",
    "table.aiDecision": "AI结论",
    "table.alignment": "规则口径",
    "table.manualStatus": "人工状态",
    "table.updatedAt": "更新时间",
    "field.rank": "排名",
    "field.score_final": "最终评分",
    "field.grade_short": "等级",
    "field.nickname": "昵称",
    "field.creator_key": "达人标识",
    "field.platform": "平台",
    "field.follower_count": "粉丝数",
    "field.quote_price": "平台报价",
    "field.engagement_rate": "合作笔记ER",
    "field.score_layered_match": "分层匹配分",
    "field.score_keyword_combo": "关键词组合分",
    "field.score_korea_brand": "韩国品牌分",
    "field.score_cooperation_potential": "合作潜力分",
    "field.score_performance": "传播表现分",
    "field.score_cost_effectiveness": "性价比分",
    "field.recommend_grade": "推荐等级",
    "field.country": "国家/地区",
    "common.creators": "达人",
    "common.unknown": "未知来源",
    "common.not_found": "未找到匹配列",
    "common.data_quality": "数据质量",
    "common.complete": "完整",
    "common.partial": "部分缺失",
    "common.missing": "严重缺失",
    "common.required_fields": "必含字段",
    "common.required_complete": "✅ 完整",
    "common.required_missing": "❌ 缺失:",
    "compare.batch": "批次",
    "compare.source": "来源",
    "compare.avg_score": "均分",
    "compare.grade_dist": "等级分布",
    "compare.field_completeness": "字段完整率",
    "compare.created_at": "创建时间",
    "filter.scope": "数据范围",
    "filter.country": "国家/地区",
    "filter.platform": "平台",
    "filter.grade": "等级",
    "filter.aiStatus": "AI来源",
    "filter.aiDecision": "AI结论",
    "filter.alignment": "冲突口径",
    "filter.manualStatus": "人工状态",
    "filter.search": "昵称 / 关键词",
    "filter.sort": "排序字段",
    "filter.order": "排序方向",
    "filter.all": "全部",
    "filter.top10": "Top10",
    "filter.top50": "Top50",
    "filter.full": "全量",
    "filter.asc": "升序",
    "filter.desc": "降序",
    "filter.viewAll": "全部",
    "filter.viewPending": "待人工复核",
    "filter.viewSuccess": "仅真实AI",
    "filter.viewFallback": "仅Fallback",
    "filter.viewHard": "仅强冲突",
    "filter.viewSoft": "仅谨慎复核",
    "filter.viewConsistent": "仅结论一致",
    "button.refresh": "刷新",
    "button.runAi": "批量生成AI复核",
    "button.running": "处理中…",
    "button.downloadExcel": "下载 Excel",
    "button.downloadCsv": "下载 CSV",
    "button.save": "保存",
    "button.close": "关闭",
    "button.prev": "上一页",
    "button.next": "下一页",
    "button.search": "搜索",
    "button.viewOriginal": "查看原文",
    "button.hideOriginal": "收起原文",
    "button.retryTranslate": "重试翻译",
    "status.loading": "加载中…",
    "status.empty": "暂无数据",
    "status.apiError": "接口加载失败",
    "status.noDataNote": "暂无可展示数据，页面不会伪造演示数字。",
    "status.notTranslated": "暂未翻译，已显示原文",
    "status.translationLoading": "翻译加载中…",
    "status.translationFallback": "当前为规则模板，直接使用本地化模板，不调用AI翻译",
    "status.saved": "已保存",
    "status.failed": "失败",
    "status.pending": "待处理",
    "status.unknown": "未知",
    "drawer.title": "达人详情",
    "drawer.close": "关闭详情",
    "drawer.tab.overview": "概览",
    "drawer.tab.scoring": "评分依据",
    "drawer.tab.ai": "AI复核",
    "drawer.tab.manual": "人工复核",
    "drawer.ruleNote": "规则评分负责排序，AI仅负责风险复核，不修改评分与排名。",
    "drawer.weights": "实际权重",
    "drawer.hitKeywords": "命中关键词",
    "drawer.riskReasons": "风险扣分原因",
    "drawer.aiSource": "AI来源",
    "drawer.aiConflict": "规则口径",
    "drawer.manualNote": "人工备注",
    "drawer.manualHint": "人工标注只保存状态与备注，不直接改分。",
    "drawer.saveSuccess": "人工标注已保存",
    "drawer.saveError": "人工标注保存失败",
    "drawer.translationNote": "翻译只处理自然语言说明，不改变结论、等级、分数和排名。",
    "drawer.aiUnavailable": "当前达人尚未生成 AI复核。",
    "drawer.original": "原文",
    "drawer.translated": "翻译",
    "drawer.termSource": "数据来源说明",
    "drawer.scoreFormula": "最终分结果",
    "drawer.identity": "达人标识",
    "drawer.profile": "主页信息",
    "ai.reanalyze": "重新分析",
    "ai.versionLabel": "版本",
    "ai.reanalyzing": "分析中...",
    "group.title": "达人分组",
    "group.desc": "管理自定义达人分组，可跨批次组合达人",
    "group.empty": "暂无分组",
    "group.create": "新建分组",
    "group.moveTo": "移入分组",
    "group.name": "分组名称",
    "group.count": "达人数量",
    "group.actions": "操作",
    "group.confirmDelete": "确认删除分组？",
    "group.batchAiReview": "AI复核选中",
    "group.selectTop": "快捷选择",
    "group.top10": "前10名",
    "group.top50": "前50名",
    "group.top100": "前100名",
    "group.manualN": "手动输入...",
    "group.selectAll": "全选",
    "group.deselect": "取消选择",
    "group.checked": "已选",
    "group.progress": "进度",
    "group.taskDone": "AI复核任务完成",
    "dimension.layered_match": "分层筛选",
    "dimension.keyword_combo": "关键词组合",
    "dimension.korea_brand": "韩国品牌",
    "dimension.cooperation_potential": "潜力合作",
    "dimension.performance": "表现",
    "dimension.cost_effectiveness": "性价比",
    "dimension.risk_deduction": "风险扣分",
    "decision.recommend": "推荐",
    "decision.cautious": "谨慎试投",
    "decision.reject": "不建议",
    "decision.unknown": "无法判断",
    "decision.reviewed": "已复核",
    "decision.pending": "待确认",
    "source.success": "DeepSeek真实结果",
    "source.fallback": "规则模板，非AI结论",
    "source.pending": "待生成",
    "source.failed": "调用失败",
    "alignment.consistent": "结论一致",
    "alignment.soft_divergence": "谨慎复核",
    "alignment.hard_conflict": "强冲突",
    "alignment.unknown": "无法判断",
    "manual.recommend": "推荐",
    "manual.cautious": "待确认",
    "manual.reject": "不推荐",
    "manual.reviewed": "已复核",
    "manual.pending": "未处理",
    "common.unknownRegion": "未知地区",
    "common.unknown": "未知",
    "common.page": "页",
    "common.of": "/",
    "common.records": "条",
    "common.updated": "更新于",
    "common.platform.xhs": "小红书",
    "common.realAiOnly": "仅统计真实 DeepSeek success 结果",
    "common.fallbackExcluded": "fallback 不计入真实决策比例与强冲突率",
    "tooltip.weightCode": "内部字段：{code}",
    "sort.rank": "排名",
    "sort.nickname": "昵称",
    "sort.country": "国家/地区",
    "sort.grade": "等级",
    "sort.score": "最终分",
    "sort.fans": "粉丝数",
    "sort.price": "报价",
    "sort.cooperation_er": "合作ER",
    "sort.ai_status": "AI来源",
    "sort.ai_decision": "AI结论",
    "sort.alignment": "规则口径",
    "sort.manual_status": "人工状态",
    "placeholder.manual": "人工复核独立页将在第八阶段 B 完善。",
    "placeholder.outreach": "邮件触达页将在第八阶段 B 完善。",
    "placeholder.exports": "数据与导出页将在第八阶段 B 完善。",
    "placeholder.rules": "规则复盘页将在本阶段逐步完善。",
    "rules.currentVersion": "当前规则版本",
    "rules.currentBatch": "当前分析批次",
    "rules.totalReviews": "人工复核总数",
    "rules.alignedCount": "AI 与人工一致",
    "rules.disagreedCount": "AI 与人工分歧",
    "rules.latestRun": "最新分析运行",
    "rules.ruleVersionList": "规则版本列表",
    "rules.batchList": "批次列表",
    "rules.disagreementTypes": "分歧类型统计",
    "rules.reasonTags": "分歧原因标签",
    "rules.suggestions": "规则优化建议",
    "rules.recentLogs": "最近复核记录",
    "rules.emptySuggestions": "当前还没有足够分歧样本，建议继续积累人工复核历史。",
    "rules.emptyLogs": "暂无 V2 复核历史记录",
    "terms.coverage": "AI覆盖率：真实 DeepSeek 成功结果数 ÷ 全部达人数量。",
    "terms.success": "success：真实 DeepSeek 结果或其缓存。",
    "terms.fallback": "fallback：规则模板，不代表真实 AI 调用。",
    "terms.recommend": "recommend：建议合作。",
    "terms.cautious": "cautious：建议小预算测试或人工复核。",
    "terms.reject": "reject：当前不建议合作。",
    "terms.hard": "强冲突：规则评分与 AI 结论方向明显相反。",
    "terms.soft": "谨慎复核：不属于强冲突，但需要人工确认。",
    "terms.freeze": "AI不修改评分和排名。",
    "note.data_source": "评分与排序来自真实项目数据，共 {total} 位达人，读取自 scores_full.csv。",
    "note.ai_source": "真实 DeepSeek 成功结果 {success_count} 条，fallback 模板 {fallback_count} 条。fallback 不参与真实 AI 决策分布与强冲突率统计。",
    "note.no_data": "暂无评分数据",
    "note.no_ai_data": "暂无 AI 复核数据",
  },
  "en": {
    "app.title": "Global Creator Intelligence System",
    "brand.title": "Global Creator Intelligence",
    "brand.subtitle": "Real scoring, AI review and human confirmation",
    "project.name": "K-Brand Demo",
    "nav.overview": "Overview",
    "nav.creators": "Creator Library",
    "nav.ai": "AI Review",
    "nav.manual": "Manual Review",
    "nav.outreach": "Email Outreach",
    "nav.exports": "Data & Export",
    "nav.rules": "Rule Replay",
    "toolbar.country": "Current Region",
    "toolbar.platform": "Current Platform",
    "toolbar.updated": "Data Updated",
    "toolbar.searchPlaceholder": "Search nickname / keywords",
    "toolbar.user": "Project",
    "page.overview.title": "Global Creator Intelligence Overview",
    "page.overview.desc": "A real-data dashboard combining rule scores, DeepSeek reviews and manual annotations.",
    "page.creators.title": "Creator Library",
    "page.creators.desc": "Browse Top10 / Top50 / full records with filters, sorting, export and a side drawer.",
    "page.ai.title": "AI Review Center",
    "page.ai.desc": "Only real DeepSeek success results are used for decision ratios. Fallback is reference only.",
    "page.rules.title": "Rule Replay",
    "page.rules.desc": "Track active rules, batches, review disagreements and optimization hints.",
    "page.placeholder.title": "Next Phase",
    "page.placeholder.desc": "Navigation is ready. Stage 8B pages are not implemented in this round.",
    "page.import.title": "Data Import",
    "page.import.desc": "Upload CSV files to import creator data, with field detection and completeness analysis.",
    "import.uploadArea": "Drag CSV file here or click to upload",
    "import.uploadBtn": "Choose CSV File",
    "import.detectFields": "Field Detection",
    "import.requiredFields": "Required Fields",
    "import.optionalFields": "Optional Fields",
    "import.rowsFound": "{count} rows detected",
    "import.confirmImport": "Confirm Import",
    "import.importing": "Importing...",
    "import.success": "Import successful: {count} creator records",
    "import.batchList": "Existing Batches",
    "import.noBatches": "No batches yet",
    "import.completeness": "Completeness",
    "import.fieldReport": "Field Detection Report",
    "toolbar.batch": "Current Batch",
    "metric.totalCreators": "Total Creators",
    "metric.top50": "Top 50",
    "metric.avgScore": "Average Final Score",
    "metric.aiReal": "Real DeepSeek Results",
    "metric.manualPending": "Pending Manual Review",
    "metric.hardConflict": "Strong Conflicts",
    "metric.softDivergence": "Review Needed",
    "metric.aiCoverage": "Real AI Coverage",
    "metric.realBase": "Real Decision Base",
    "metric.fallback": "Fallback Count",
    "metric.pendingAi": "Pending AI",
    "metric.consistent": "Consistent Results",
    "metric.avgScoreHint": "Based on all scored creators",
    "metric.aiRealHint": "Real DeepSeek results or cached success results",
    "metric.hardConflictHint": "Success results only",
    "metric.softHint": "Needs manual confirmation",
    "panel.top10": "Top 10 Final Scores",
    "panel.gradeDistribution": "Grade Distribution",
    "panel.keywordTop10": "Top 10 Content Keywords",
    "panel.regionDistribution": "Region / Country Distribution",
    "panel.aiStatus": "AI Coverage & Source",
    "panel.manualRecent": "Recent Manual Reviews",
    "panel.aiRecent": "Recent AI Records",
    "panel.aiReviewCoverage": "AI Coverage",
    "panel.aiDecisionDistribution": "AI Decision Distribution",
    "panel.pendingReview": "Creators Pending Review",
    "panel.dataNote": "Data & AI Notes",
    "panel.terms": "Metric & Term Notes",
    "panel.drawerOverview": "Creator Overview",
    "panel.drawerScoring": "Scoring Evidence",
    "panel.drawerAi": "AI Review",
    "panel.drawerManual": "Manual Review",
    "panel.realDecisionBase": "Based on {count} real DeepSeek review results",
    "table.rank": "Rank",
    "table.nickname": "Nickname",
    "table.platform": "Platform",
    "table.country": "Country / Region",
    "table.grade": "Grade",
    "table.score": "Final Score",
    "table.fans": "Followers",
    "table.price": "Price",
    "table.er": "Coop ER",
    "table.aiStatus": "AI Source",
    "table.aiDecision": "AI Decision",
    "table.alignment": "Alignment",
    "table.manualStatus": "Manual Status",
    "table.updatedAt": "Updated At",
    "filter.scope": "Dataset",
    "filter.country": "Country / Region",
    "filter.platform": "Platform",
    "filter.grade": "Grade",
    "filter.aiStatus": "AI Source",
    "filter.aiDecision": "AI Decision",
    "filter.alignment": "Alignment",
    "filter.manualStatus": "Manual Status",
    "filter.search": "Nickname / Keyword",
    "filter.sort": "Sort By",
    "filter.order": "Order",
    "filter.all": "All",
    "filter.top10": "Top10",
    "filter.top50": "Top50",
    "filter.full": "Full",
    "filter.asc": "Asc",
    "filter.desc": "Desc",
    "filter.viewAll": "All",
    "filter.viewPending": "Pending manual",
    "filter.viewSuccess": "Real AI only",
    "filter.viewFallback": "Fallback only",
    "filter.viewHard": "Strong conflict",
    "filter.viewSoft": "Review needed",
    "filter.viewConsistent": "Consistent only",
    "button.refresh": "Refresh",
    "button.runAi": "Run AI Reviews",
    "button.running": "Processing…",
    "button.downloadExcel": "Download Excel",
    "button.downloadCsv": "Download CSV",
    "button.save": "Save",
    "button.close": "Close",
    "button.prev": "Prev",
    "button.next": "Next",
    "button.search": "Search",
    "button.viewOriginal": "View original",
    "button.hideOriginal": "Hide original",
    "button.retryTranslate": "Retry translation",
    "status.loading": "Loading…",
    "status.empty": "No data",
    "status.apiError": "API request failed",
    "status.noDataNote": "No data is available. The UI does not fabricate demo numbers.",
    "status.notTranslated": "Translation unavailable. Original text is shown.",
    "status.translationLoading": "Loading translation…",
    "status.translationFallback": "This is a rule fallback template. No live AI translation is used.",
    "status.saved": "Saved",
    "status.failed": "Failed",
    "status.pending": "Pending",
    "status.unknown": "Unknown",
    "drawer.title": "Creator Detail",
    "drawer.close": "Close detail drawer",
    "drawer.tab.overview": "Overview",
    "drawer.tab.scoring": "Scoring Evidence",
    "drawer.tab.ai": "AI Review",
    "drawer.tab.manual": "Manual Review",
    "drawer.ruleNote": "Rule scoring controls ranking. AI only reviews risk and never changes score or rank.",
    "drawer.weights": "Actual Weights",
    "drawer.hitKeywords": "Matched Keywords",
    "drawer.riskReasons": "Risk Penalty Reasons",
    "drawer.aiSource": "AI Source",
    "drawer.aiConflict": "Alignment",
    "drawer.manualNote": "Manual Note",
    "drawer.manualHint": "Manual review only saves status and notes. It does not change the final score.",
    "drawer.saveSuccess": "Manual review saved",
    "drawer.saveError": "Failed to save manual review",
    "drawer.translationNote": "Translation only affects natural-language explanations. Decision, grade, scores and ranking stay unchanged.",
    "drawer.aiUnavailable": "No AI review is available for this creator yet.",
    "drawer.original": "Original",
    "drawer.translated": "Translation",
    "drawer.termSource": "Source Note",
    "drawer.scoreFormula": "Final Score Breakdown",
    "drawer.identity": "Creator ID",
    "drawer.profile": "Profile",
    "ai.reanalyze": "Reanalyze",
    "ai.versionLabel": "Version",
    "ai.reanalyzing": "Analyzing...",
    "group.title": "Creator Groups",
    "group.desc": "Manage custom creator groups across batches",
    "group.empty": "No groups",
    "group.create": "New Group",
    "group.moveTo": "Move to Group",
    "group.name": "Group Name",
    "group.count": "Creator Count",
    "group.actions": "Actions",
    "group.confirmDelete": "Delete this group?",
    "group.batchAiReview": "AI Review Selected",
    "group.selectTop": "Quick Select",
    "group.top10": "Top 10",
    "group.top50": "Top 50",
    "group.top100": "Top 100",
    "group.manualN": "Manual...",
    "group.selectAll": "Select All",
    "group.deselect": "Deselect",
    "group.checked": "Selected",
    "group.progress": "Progress",
    "group.taskDone": "AI review task completed",
    "dimension.layered_match": "Layer Match",
    "dimension.keyword_combo": "Keyword Match",
    "dimension.korea_brand": "Korea Brand",
    "dimension.cooperation_potential": "Cooperation Potential",
    "dimension.performance": "Performance",
    "dimension.cost_effectiveness": "Cost Efficiency",
    "dimension.risk_deduction": "Risk Deduction",
    "decision.recommend": "Recommend",
    "decision.cautious": "Cautious trial",
    "decision.reject": "Not recommended",
    "decision.unknown": "Unknown",
    "decision.reviewed": "Reviewed",
    "decision.pending": "Pending",
    "source.success": "DeepSeek result",
    "source.fallback": "Rule fallback, not AI",
    "source.pending": "Pending",
    "source.failed": "Failed",
    "alignment.consistent": "Consistent",
    "alignment.soft_divergence": "Review needed",
    "alignment.hard_conflict": "Strong conflict",
    "alignment.unknown": "Unknown",
    "manual.recommend": "Recommend",
    "manual.cautious": "Pending review",
    "manual.reject": "Reject",
    "manual.reviewed": "Reviewed",
    "manual.pending": "Not reviewed",
    "common.unknownRegion": "Unknown region",
    "common.unknown": "Unknown",
    "common.page": "Page",
    "common.of": "/",
    "common.records": "records",
    "common.updated": "Updated",
    "common.platform.xhs": "Xiaohongshu",
    "common.realAiOnly": "Only real DeepSeek success results are counted",
    "common.fallbackExcluded": "Fallback is excluded from real decision ratios and strong-conflict rate",
    "tooltip.weightCode": "Internal key: {code}",
    "sort.rank": "Rank",
    "sort.nickname": "Nickname",
    "sort.country": "Country / Region",
    "sort.grade": "Grade",
    "sort.score": "Final Score",
    "sort.fans": "Followers",
    "sort.price": "Price",
    "sort.cooperation_er": "Coop ER",
    "sort.ai_status": "AI Source",
    "sort.ai_decision": "AI Decision",
    "sort.alignment": "Alignment",
    "sort.manual_status": "Manual Status",
    "placeholder.manual": "The dedicated manual-review page will be built in Stage 8B.",
    "placeholder.outreach": "The outreach page will be built in Stage 8B.",
    "placeholder.exports": "The data and export page will be built in Stage 8B.",
    "placeholder.rules": "The rule replay page is being expanded in this stage.",
    "rules.currentVersion": "Current Rule Version",
    "rules.currentBatch": "Current Batch",
    "rules.totalReviews": "Total Manual Reviews",
    "rules.alignedCount": "AI and Manual Aligned",
    "rules.disagreedCount": "AI and Manual Disagreed",
    "rules.latestRun": "Latest Analysis Run",
    "rules.ruleVersionList": "Rule Versions",
    "rules.batchList": "Batches",
    "rules.disagreementTypes": "Disagreement Types",
    "rules.reasonTags": "Reason Tags",
    "rules.suggestions": "Rule Suggestions",
    "rules.recentLogs": "Recent Review Logs",
    "rules.emptySuggestions": "Not enough disagreement samples yet. Keep collecting review history.",
    "rules.emptyLogs": "No V2 review logs yet",
    "terms.coverage": "AI coverage = real DeepSeek success results ÷ all creators.",
    "terms.success": "success = real DeepSeek result or its reusable success cache.",
    "terms.fallback": "fallback = rule template only, not a live AI call.",
    "terms.recommend": "recommend = cooperation is recommended.",
    "terms.cautious": "cautious = try with a small budget or send to manual review.",
    "terms.reject": "reject = not recommended at the moment.",
    "terms.hard": "Strong conflict = the rule direction and AI direction clearly oppose each other.",
    "terms.soft": "Review needed = not a strong conflict, but still requires manual confirmation.",
    "terms.freeze": "AI never changes scoring or ranking.",
    "note.data_source": "Scoring and ranking are based on real project data, {total} creators total, read from scores_full.csv.",
    "note.ai_source": "Real DeepSeek success results: {success_count} records, fallback templates: {fallback_count} records. Fallback is excluded from real AI decision ratios and strong-conflict rate.",
    "note.no_data": "No scoring data available",
    "note.no_ai_data": "No AI review data available",
    "field.rank": "Rank",
    "field.score_final": "Final Score",
    "field.grade_short": "Grade",
    "field.nickname": "Nickname",
    "field.creator_key": "Creator ID",
    "field.platform": "Platform",
    "field.follower_count": "Followers",
    "field.quote_price": "Platform Price",
    "field.engagement_rate": "Engagement Rate",
    "field.score_layered_match": "Layered Match",
    "field.score_keyword_combo": "Keyword Combo",
    "field.score_korea_brand": "Korea Brand",
    "field.score_cooperation_potential": "Cooperation Potential",
    "field.score_performance": "Performance",
    "field.score_cost_effectiveness": "Cost-Effectiveness",
    "field.recommend_grade": "Recommend Grade",
    "field.country": "Country / Region",
    "common.creators": "Creators",
    "common.unknown": "Unknown",
    "common.not_found": "No matching column",
    "common.data_quality": "Data Quality",
    "common.complete": "Complete",
    "common.partial": "Partial",
    "common.missing": "Missing",
    "common.required_fields": "Required Fields",
    "common.required_complete": "✅ Complete",
    "common.required_missing": "❌ Missing:",
    "compare.batch": "Batch",
    "compare.source": "Source",
    "compare.avg_score": "Avg Score",
    "compare.grade_dist": "Grade Dist",
    "compare.field_completeness": "Field Completeness",
    "compare.created_at": "Created",
  },
  "ko": {
    "app.title": "글로벌 크리에이터 인텔리전스 시스템",
    "brand.title": "글로벌 크리에이터 인텔리전스",
    "brand.subtitle": "실제 점수, AI 검토, 사람 확인",
    "project.name": "K-Brand Demo",
    "nav.overview": "개요",
    "nav.creators": "크리에이터 DB",
    "nav.ai": "AI 검토",
    "nav.manual": "수동 검토",
    "nav.outreach": "메일 아웃리치",
    "nav.exports": "데이터 및 내보내기",
    "nav.rules": "규칙 설정",
    "toolbar.country": "현재 국가/지역",
    "toolbar.platform": "현재 플랫폼",
    "toolbar.updated": "데이터 업데이트",
    "toolbar.searchPlaceholder": "닉네임 / 키워드 검색",
    "toolbar.user": "현재 프로젝트",
    "page.overview.title": "글로벌 크리에이터 인텔리전스 개요",
    "page.overview.desc": "실제 규칙 점수, 실제 DeepSeek 검토, 수동 표기 결과를 함께 보여줍니다.",
    "page.creators.title": "크리에이터 DB",
    "page.creators.desc": "Top10 / Top50 / 전체 데이터를 필터, 정렬, 다운로드, 상세 패널로 탐색합니다.",
    "page.ai.title": "AI 검토 센터",
    "page.ai.desc": "실제 DeepSeek success 결과만 AI 판단 비율에 반영하며 fallback은 참고용입니다.",
    "page.placeholder.title": "다음 단계 보완",
    "page.placeholder.desc": "탐색 진입점만 준비되었고, 이번 라운드에서는 8단계 B 페이지를 개발하지 않습니다.",
    "page.import.title": "데이터 가져오기",
    "page.import.desc": "CSV 파일을 업로드하여 크리에이터 데이터를 가져오고 필드 감지 및 완성도 분석을 수행합니다.",
    "import.uploadArea": "CSV 파일을 여기로 드래그하거나 클릭하여 업로드",
    "import.uploadBtn": "CSV 파일 선택",
    "import.detectFields": "필드 감지",
    "import.requiredFields": "필수 필드",
    "import.optionalFields": "선택 필드",
    "import.rowsFound": "{count}개 행 감지됨",
    "import.confirmImport": "가져오기 확인",
    "import.importing": "가져오는 중...",
    "import.success": "가져오기 성공: {count}개 크리에이터 레코드",
    "import.batchList": "기존 배치",
    "import.noBatches": "배치 없음",
    "import.completeness": "완성도",
    "import.fieldReport": "필드 감지 보고서",
    "toolbar.batch": "현재 배치",
    "metric.totalCreators": "총 크리에이터 수",
    "metric.top50": "Top50 수",
    "metric.avgScore": "최종 점수 평균",
    "metric.aiReal": "실제 DeepSeek 결과",
    "metric.manualPending": "수동 확인 대기",
    "metric.hardConflict": "강한 충돌 수",
    "metric.softDivergence": "신중 검토 수",
    "metric.aiCoverage": "실제 AI 커버리지",
    "metric.realBase": "실제 판단 표본 수",
    "metric.fallback": "Fallback 수",
    "metric.pendingAi": "생성 대기 수",
    "metric.consistent": "판단 일치 수",
    "metric.avgScoreHint": "전체 점수 결과 기준",
    "metric.aiRealHint": "실제 DeepSeek 결과 또는 success 캐시",
    "metric.hardConflictHint": "success 결과만 집계",
    "metric.softHint": "수동 확인 필요",
    "panel.top10": "Top10 최종 점수",
    "panel.gradeDistribution": "등급 분포",
    "panel.keywordTop10": "콘텐츠 키워드 Top10",
    "panel.regionDistribution": "지역 / 국가 분포",
    "panel.aiStatus": "AI 커버리지 및 출처",
    "panel.manualRecent": "최근 수동 검토 기록",
    "panel.aiRecent": "최근 AI 검토 기록",
    "panel.aiReviewCoverage": "AI 커버리지",
    "panel.aiDecisionDistribution": "AI 판단 분포",
    "panel.pendingReview": "검토 대기 크리에이터",
    "panel.dataNote": "데이터 및 AI 설명",
    "panel.terms": "지표 / 용어 설명",
    "panel.drawerOverview": "크리에이터 개요",
    "panel.drawerScoring": "점수 근거",
    "panel.drawerAi": "AI 검토",
    "panel.drawerManual": "수동 검토",
    "panel.realDecisionBase": "실제 DeepSeek 검토 {count}건 기준",
    "table.rank": "순위",
    "table.nickname": "닉네임",
    "table.platform": "플랫폼",
    "table.country": "국가/지역",
    "table.grade": "등급",
    "table.score": "최종 점수",
    "table.fans": "팔로워",
    "table.price": "단가",
    "table.er": "협업 ER",
    "table.aiStatus": "AI 출처",
    "table.aiDecision": "AI 판단",
    "table.alignment": "판단 관계",
    "table.manualStatus": "수동 상태",
    "table.updatedAt": "업데이트",
    "filter.scope": "데이터 범위",
    "filter.country": "국가/지역",
    "filter.platform": "플랫폼",
    "filter.grade": "등급",
    "filter.aiStatus": "AI 출처",
    "filter.aiDecision": "AI 판단",
    "filter.alignment": "충돌 기준",
    "filter.manualStatus": "수동 상태",
    "filter.search": "닉네임 / 키워드",
    "filter.sort": "정렬 기준",
    "filter.order": "정렬 방향",
    "filter.all": "전체",
    "filter.top10": "Top10",
    "filter.top50": "Top50",
    "filter.full": "전체",
    "filter.asc": "오름차순",
    "filter.desc": "내림차순",
    "filter.viewAll": "전체",
    "filter.viewPending": "수동 대기",
    "filter.viewSuccess": "실제 AI만",
    "filter.viewFallback": "Fallback만",
    "filter.viewHard": "강한 충돌만",
    "filter.viewSoft": "신중 검토만",
    "filter.viewConsistent": "일치만",
    "button.refresh": "새로고침",
    "button.runAi": "AI 검토 생성",
    "button.running": "처리 중…",
    "button.downloadExcel": "Excel 다운로드",
    "button.downloadCsv": "CSV 다운로드",
    "button.save": "저장",
    "button.close": "닫기",
    "button.prev": "이전",
    "button.next": "다음",
    "button.search": "검색",
    "button.viewOriginal": "원문 보기",
    "button.hideOriginal": "원문 숨기기",
    "button.retryTranslate": "번역 다시 시도",
    "status.loading": "불러오는 중…",
    "status.empty": "데이터 없음",
    "status.apiError": "API 요청 실패",
    "status.noDataNote": "표시할 데이터가 없어 임의 예시 수치를 사용하지 않습니다.",
    "status.notTranslated": "번역이 없어 원문을 표시합니다.",
    "status.translationLoading": "번역 불러오는 중…",
    "status.translationFallback": "현재는 규칙 fallback 템플릿으로, AI 번역을 호출하지 않습니다.",
    "status.saved": "저장됨",
    "status.failed": "실패",
    "status.pending": "대기",
    "status.unknown": "알 수 없음",
    "drawer.title": "크리에이터 상세",
    "drawer.close": "상세 패널 닫기",
    "drawer.tab.overview": "개요",
    "drawer.tab.scoring": "점수 근거",
    "drawer.tab.ai": "AI 검토",
    "drawer.tab.manual": "수동 검토",
    "drawer.ruleNote": "규칙 점수가 순위를 결정하고, AI는 리스크만 검토하며 점수와 순위를 바꾸지 않습니다.",
    "drawer.weights": "실제 가중치",
    "drawer.hitKeywords": "적중 키워드",
    "drawer.riskReasons": "리스크 감점 사유",
    "drawer.aiSource": "AI 출처",
    "drawer.aiConflict": "판단 관계",
    "drawer.manualNote": "수동 메모",
    "drawer.manualHint": "수동 표기는 상태와 메모만 저장하며 점수를 직접 바꾸지 않습니다.",
    "drawer.saveSuccess": "수동 검토가 저장되었습니다",
    "drawer.saveError": "수동 검토 저장 실패",
    "drawer.translationNote": "번역은 자연어 설명만 바꾸며 판단, 등급, 점수, 순위는 유지됩니다.",
    "drawer.aiUnavailable": "아직 AI 검토가 생성되지 않았습니다.",
    "drawer.original": "원문",
    "drawer.translated": "번역",
    "drawer.termSource": "출처 설명",
    "drawer.scoreFormula": "최종 점수 구성",
    "drawer.identity": "크리에이터 식별자",
    "drawer.profile": "프로필",
    "ai.reanalyze": "재분석",
    "ai.versionLabel": "버전",
    "ai.reanalyzing": "분석 중...",
    "group.title": "크리에이터 그룹",
    "group.desc": "배치 간 크리에이터 그룹 관리",
    "group.empty": "그룹 없음",
    "group.create": "새 그룹",
    "group.moveTo": "그룹으로 이동",
    "group.name": "그룹 이름",
    "group.count": "크리에이터 수",
    "group.actions": "작업",
    "group.confirmDelete": "그룹을 삭제하시겠습니까?",
    "group.batchAiReview": "선택 AI 검토",
    "group.selectTop": "빠른 선택",
    "group.top10": "상위 10명",
    "group.top50": "상위 50명",
    "group.top100": "상위 100명",
    "group.manualN": "직접 입력...",
    "group.selectAll": "전체 선택",
    "group.deselect": "선택 해제",
    "group.checked": "선택됨",
    "group.progress": "진행률",
    "group.taskDone": "AI 검토 작업 완료",
    "dimension.layered_match": "층화 선별",
    "dimension.keyword_combo": "키워드 조합",
    "dimension.korea_brand": "한국 브랜드",
    "dimension.cooperation_potential": "협업 잠재력",
    "dimension.performance": "퍼포먼스",
    "dimension.cost_effectiveness": "가성비",
    "dimension.risk_deduction": "리스크 감점",
    "decision.recommend": "추천",
    "decision.cautious": "신중한 테스트",
    "decision.reject": "비추천",
    "decision.unknown": "판단 불가",
    "decision.reviewed": "검토 완료",
    "decision.pending": "대기",
    "source.success": "DeepSeek 실제 결과",
    "source.fallback": "규칙 템플릿, AI 결과 아님",
    "source.pending": "생성 대기",
    "source.failed": "실패",
    "alignment.consistent": "판단 일치",
    "alignment.soft_divergence": "신중 검토",
    "alignment.hard_conflict": "강한 충돌",
    "alignment.unknown": "판단 불가",
    "manual.recommend": "추천",
    "manual.cautious": "확인 필요",
    "manual.reject": "비추천",
    "manual.reviewed": "검토 완료",
    "manual.pending": "미처리",
    "common.unknownRegion": "미확인 지역",
    "common.unknown": "알 수 없음",
    "common.page": "페이지",
    "common.of": "/",
    "common.records": "건",
    "common.updated": "업데이트",
    "common.platform.xhs": "샤오홍슈",
    "common.realAiOnly": "실제 DeepSeek success 결과만 집계",
    "common.fallbackExcluded": "fallback은 실제 판단 비율과 강한 충돌률에서 제외",
    "tooltip.weightCode": "내부 키: {code}",
    "sort.rank": "순위",
    "sort.nickname": "닉네임",
    "sort.country": "국가/지역",
    "sort.grade": "등급",
    "sort.score": "최종 점수",
    "sort.fans": "팔로워",
    "sort.price": "단가",
    "sort.cooperation_er": "협업 ER",
    "sort.ai_status": "AI 출처",
    "sort.ai_decision": "AI 판단",
    "sort.alignment": "판단 관계",
    "sort.manual_status": "수동 상태",
    "placeholder.manual": "수동 검토 전용 페이지는 8단계 B에서 개발합니다.",
    "placeholder.outreach": "메일 아웃리치 페이지는 8단계 B에서 개발합니다.",
    "placeholder.exports": "데이터 및 내보내기 페이지는 8단계 B에서 개발합니다.",
    "placeholder.rules": "규칙 설정 페이지는 8단계 B에서 개발합니다.",
    "terms.coverage": "AI 커버리지 = 실제 DeepSeek 성공 결과 수 ÷ 전체 크리에이터 수.",
    "terms.success": "success = 실제 DeepSeek 결과 또는 그 success 캐시.",
    "terms.fallback": "fallback = 규칙 템플릿이며 실제 AI 호출이 아닙니다.",
    "terms.recommend": "recommend = 협업 추천.",
    "terms.cautious": "cautious = 소규모 테스트 또는 수동 검토 권장.",
    "terms.reject": "reject = 현재는 협업 비추천.",
    "terms.hard": "강한 충돌 = 규칙 방향과 AI 방향이 명확히 반대인 경우.",
    "terms.soft": "신중 검토 = 강한 충돌은 아니지만 수동 확인이 필요한 경우.",
    "terms.freeze": "AI는 점수와 순위를 바꾸지 않습니다.",
    "note.data_source": "점수와 순위는 실제 프로젝트 데이터 기반, 총 {total}명 크리에이터, scores_full.csv에서 읽어옴.",
    "note.ai_source": "실제 DeepSeek 성공 결과 {success_count}건, fallback 템플릿 {fallback_count}건. fallback은 실제 AI 판단 비율과 강한 충돌률에서 제외.",
    "note.no_data": "점수 데이터 없음",
    "note.no_ai_data": "AI 검토 데이터 없음",
    "field.rank": "순위",
    "field.score_final": "최종 점수",
    "field.grade_short": "등급",
    "field.nickname": "닉네임",
    "field.creator_key": "크리에이터 ID",
    "field.platform": "플랫폼",
    "field.follower_count": "팔로워",
    "field.quote_price": "플랫폼 가격",
    "field.engagement_rate": "엔게이지먼트 레이트",
    "field.score_layered_match": "레이어드 매치",
    "field.score_keyword_combo": "키워드 콤보",
    "field.score_korea_brand": "한국 브랜드",
    "field.score_cooperation_potential": "협업 잠재력",
    "field.score_performance": "퍼포먼스",
    "field.score_cost_effectiveness": "성능 대비 비용",
    "field.recommend_grade": "추천 등급",
    "field.country": "국가/지역",
    "common.creators": "크리에이터",
    "common.unknown": "알 수 없음",
    "common.not_found": "매칭 열 없음",
    "common.data_quality": "데이터 품질",
    "common.complete": "완전",
    "common.partial": "일부 누락",
    "common.missing": "심각 누락",
    "common.required_fields": "필수 필드",
    "common.required_complete": "✅ 완전",
    "common.required_missing": "❌ 누락:",
    "compare.batch": "배치",
    "compare.source": "출처",
    "compare.avg_score": "평균 점수",
    "compare.grade_dist": "등급 분포",
    "compare.field_completeness": "필드 완성도",
    "compare.created_at": "생성일",
  }
};

const REGION_I18N = {
  "中国": { en: "China", ko: "중국" },
  "韩国": { en: "South Korea", ko: "한국" },
  "日本": { en: "Japan", ko: "일본" },
  "美国": { en: "United States", ko: "미국" },
  "英国": { en: "United Kingdom", ko: "영국" },
  "法国": { en: "France", ko: "프랑스" },
  "德国": { en: "Germany", ko: "독일" },
  "意大利": { en: "Italy", ko: "이탈리아" },
  "西班牙": { en: "Spain", ko: "스페인" },
  "加拿大": { en: "Canada", ko: "캐나다" },
  "澳大利亚": { en: "Australia", ko: "호주" },
  "新加坡": { en: "Singapore", ko: "싱가포르" },
  "泰国": { en: "Thailand", ko: "태국" },
  "马来西亚": { en: "Malaysia", ko: "말레이시아" },
  "菲律宾": { en: "Philippines", ko: "필리핀" },
  "印度尼西亚": { en: "Indonesia", ko: "인도네시아" },
  "香港": { en: "Hong Kong", ko: "홍콩" },
  "澳门": { en: "Macau", ko: "마카오" },
  "台湾": { en: "Taiwan", ko: "대만" },
  "北京": { en: "Beijing", ko: "베이징" },
  "上海": { en: "Shanghai", ko: "상하이" },
  "天津": { en: "Tianjin", ko: "톈진" },
  "重庆": { en: "Chongqing", ko: "충칭" },
  "河北": { en: "Hebei", ko: "허베이" },
  "山西": { en: "Shanxi", ko: "산시" },
  "辽宁": { en: "Liaoning", ko: "랴오닝" },
  "吉林": { en: "Jilin", ko: "지린" },
  "黑龙江": { en: "Heilongjiang", ko: "헤이룽장" },
  "江苏": { en: "Jiangsu", ko: "장쑤" },
  "浙江": { en: "Zhejiang", ko: "저장" },
  "安徽": { en: "Anhui", ko: "안후이" },
  "福建": { en: "Fujian", ko: "푸젠" },
  "江西": { en: "Jiangxi", ko: "장시" },
  "山东": { en: "Shandong", ko: "산둥" },
  "河南": { en: "Henan", ko: "허난" },
  "湖北": { en: "Hubei", ko: "후베이" },
  "湖南": { en: "Hunan", ko: "후난" },
  "广东": { en: "Guangdong", ko: "광둥" },
  "海南": { en: "Hainan", ko: "하이난" },
  "四川": { en: "Sichuan", ko: "쓰촨" },
  "贵州": { en: "Guizhou", ko: "구이저우" },
  "云南": { en: "Yunnan", ko: "윈난" },
  "陕西": { en: "Shaanxi", ko: "산시" },
  "甘肃": { en: "Gansu", ko: "간쑤" },
  "青海": { en: "Qinghai", ko: "칭하이" },
  "内蒙古": { en: "Inner Mongolia", ko: "네이멍구" },
  "广西": { en: "Guangxi", ko: "광시" },
  "西藏": { en: "Tibet", ko: "티베트" },
  "宁夏": { en: "Ningxia", ko: "닝샤" },
  "新疆": { en: "Xinjiang", ko: "신장" }
};

const SUPPORTED_LOCALES = new Set(["zh-CN", "en", "ko"]);

function resolveInitialLocale() {
  const params = new URLSearchParams(window.location.search);
  const queryLocale = params.get("lang");
  if (SUPPORTED_LOCALES.has(queryLocale)) return queryLocale;
  const storedLocale = localStorage.getItem("dashboard-locale");
  if (SUPPORTED_LOCALES.has(storedLocale)) return storedLocale;
  return "zh-CN";
}

function syncLocaleQueryParam() {
  const url = new URL(window.location.href);
  url.searchParams.set("lang", state.locale);
  window.history.replaceState({}, "", url);
}

const state = {
  locale: resolveInitialLocale(),
  page: "overview",
  dashboard: null,
  filterOptions: null,
  creators: {
    view: "all",
    country: "",
    platform: "",
    grade: "",
    aiStatus: "",
    manualStatus: "",
    search: "",
    page: 1,
    perPage: 20,
    sortBy: "rank",
    sortOrder: "asc",
    data: null
  },
  checked: new Set(),
  groups: { items: [], loaded: false },
  aiVersionCache: {},
  aiPage: {
    view: "pending",
    search: "",
    page: 1,
    perPage: 12,
    data: null
  },
  contactPage: {
    data: null
  },
  reportPage: {
    data: null,
    exportResult: null
  },
  importPage: {
    data: null,
    fieldReport: null,
    uploading: false,
    importTab: "csv"
  },
  batches: {
    current: null,
    all: []
  },
  rulesPage: {
    data: null
  },
  drawer: {
    open: false,
    detail: null,
    tab: "overview",
    saving: false,
    latestSavedDecision: "pending",
    latestReasonTags: [],
    translations: {},
    translationLoading: false,
    showOriginal: false
  },
  charts: {}
};

const pageElements = {
  overview: document.getElementById("page-overview"),
  creators: document.getElementById("page-creators"),
  ai: document.getElementById("page-ai"),
  import: document.getElementById("page-import"),
  batchCompare: document.getElementById("page-batch-compare"),
  outreach: document.getElementById("page-outreach"),
  exports: document.getElementById("page-exports"),
  rules: document.getElementById("page-rules"),
  groups: document.getElementById("page-groups")
};

function t(key, vars = {}) {
  const template = translations[state.locale]?.[key] || translations["zh-CN"][key] || key;
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), template);
}

function setStatus(message = "", isError = false) {
  const el = document.getElementById("app-status");
  if (!message) {
    el.className = "page-status hidden";
    el.textContent = "";
    return;
  }
  el.className = `page-status ${isError ? "is-error" : ""}`;
  el.textContent = message;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat(state.locale).format(num);
}

function formatScore(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num.toFixed(digits);
}

function formatPercentValue(value, digits = 2) {
  const num = Number(value || 0);
  return Number.isNaN(num) ? "0%" : `${num.toFixed(digits)}%`;
}

function formatPercentText(value) {
  if (value === null || value === undefined || value === "") return "-";
  const text = String(value);
  if (text.includes("%")) return text;
  const num = Number(value);
  return Number.isNaN(num) ? text : `${num.toFixed(2)}%`;
}

function formatFollowers(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat(state.locale, { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  if (state.locale === "ko") return `${formatNumber(num)} CNY`;
  if (state.locale === "en") return `CNY ${formatNumber(num)}`;
  return `¥${formatNumber(num)}`;
}

function formatMoneyValue(value, currency = "CNY") {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${currency} ${formatNumber(num)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(state.locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function localizeRegionToken(token) {
  if (!token) return "";
  if (state.locale === "zh-CN") return token;
  const mapped = REGION_I18N[token];
  if (mapped) return mapped[state.locale] || mapped.en || token;
  if (/[\u4e00-\u9fff]/.test(token)) return "";
  return token;
}

function localizeCountryName(name) {
  if (!name) return t("common.unknownRegion");
  const localized = localizeRegionToken(name);
  return localized || name;
}

function localizeRegionLabel(value, fallbackCountry = "") {
  if (!value) return localizeCountryName(fallbackCountry || t("common.unknownRegion"));
  if (state.locale === "zh-CN") return String(value);
  const tokens = String(value).split(/\s+/).map((item) => item.trim()).filter(Boolean);
  const localizedTokens = tokens.map(localizeRegionToken).filter(Boolean);
  if (localizedTokens.length) return localizedTokens.join(" / ");
  return localizeCountryName(fallbackCountry || tokens[0] || t("common.unknownRegion"));
}

function setActivePage(page) {
  state.page = page;
  Object.entries(pageElements).forEach(([key, element]) => {
    if (!element) return;
    element.classList.toggle("is-active", key === page);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === page);
  });
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function badge(className, text) {
  return `<span class="badge ${className}">${escapeHtml(text)}</span>`;
}

function gradeBadge(grade) {
  const key = String(grade || "D").toUpperCase();
  return badge(`badge-grade-${key}`, key);
}

function sourceBadge(status) {
  const map = {
    success: "badge-ai-success",
    fallback: "badge-ai-pending",
    pending: "badge-ai-pending",
    failed: "badge-manual-reject"
  };
  return badge(map[status] || "badge-ai-pending", t(`source.${status || "pending"}`));
}

function decisionBadge(decision) {
  const map = {
    recommend: "badge-ai-success",
    cautious: "badge-ai-fallback",
    reject: "badge-manual-reject",
    unknown: "badge-ai-pending"
  };
  return badge(map[decision] || "badge-ai-pending", t(`decision.${decision || "unknown"}`));
}

function manualStatusBadge(decision) {
  const map = {
    recommend: "badge-manual-recommend",
    cautious: "badge-manual-cautious",
    reject: "badge-manual-reject",
    reviewed: "badge-manual-reviewed",
    pending: "badge-manual-pending"
  };
  const key = decision || "pending";
  return badge(map[key] || "badge-manual-pending", t(`manual.${key}`));
}

const REVIEW_REASON_TAGS = [
  { value: "价格偏高", labels: { "zh-CN": "价格偏高", en: "High price", ko: "가격 높음" } },
  { value: "韩国关联弱", labels: { "zh-CN": "韩国关联弱", en: "Weak Korea relevance", ko: "한국 연관성 약함" } },
  { value: "内容不匹配", labels: { "zh-CN": "内容不匹配", en: "Content mismatch", ko: "콘텐츠 부적합" } },
  { value: "数据不完整", labels: { "zh-CN": "数据不完整", en: "Incomplete data", ko: "데이터 불완전" } },
  { value: "缺少报价", labels: { "zh-CN": "缺少报价", en: "Missing quoted price", ko: "견적 누락" } },
  { value: "报价待确认", labels: { "zh-CN": "报价待确认", en: "Price pending confirmation", ko: "견적 확인 필요" } },
  { value: "平台报价与真实报价可能不同", labels: { "zh-CN": "平台报价与真实报价可能不同", en: "Platform price may differ from actual quote", ko: "플랫폼 견적과 실제 견적 차이 가능" } },
  { value: "粉丝/互动异常", labels: { "zh-CN": "粉丝/互动异常", en: "Fan or engagement risk", ko: "팔로워/반응 이상" } },
  { value: "关键词未覆盖", labels: { "zh-CN": "关键词未覆盖", en: "Keyword coverage missing", ko: "키워드 미포함" } },
  { value: "小而优达人", labels: { "zh-CN": "小而优达人", en: "Small but strong creator", ko: "작지만 우수한 크리에이터" } },
  { value: "建议人工联系", labels: { "zh-CN": "建议人工联系", en: "Recommend manual contact", ko: "수동 연락 권장" } },
  { value: "暂不适合当前品牌", labels: { "zh-CN": "暂不适合当前品牌", en: "Not suitable for current brand", ko: "현재 브랜드와 부적합" } }
];

function reasonTagLabel(item) {
  return item.labels[state.locale] || item.labels["zh-CN"] || item.value;
}

const CONTACT_STATUS_OPTIONS = [
  { value: "not_contacted", labels: { "zh-CN": "未联系", en: "Not contacted", ko: "미연락" } },
  { value: "to_contact", labels: { "zh-CN": "待联系", en: "To contact", ko: "연락 예정" } },
  { value: "contacted", labels: { "zh-CN": "已联系", en: "Contacted", ko: "연락 완료" } },
  { value: "waiting_reply", labels: { "zh-CN": "等待回复", en: "Waiting reply", ko: "답변 대기" } },
  { value: "replied", labels: { "zh-CN": "已回复", en: "Replied", ko: "답변 완료" } },
  { value: "quote_received", labels: { "zh-CN": "报价已获取", en: "Quote received", ko: "견적 확보" } },
  { value: "price_too_high", labels: { "zh-CN": "价格过高", en: "Price too high", ko: "가격 과다" } },
  { value: "shortlisted", labels: { "zh-CN": "进入候选", en: "Shortlisted", ko: "후보 진입" } },
  { value: "rejected", labels: { "zh-CN": "暂不合作", en: "Not now", ko: "협업 보류" } },
  { value: "completed", labels: { "zh-CN": "合作完成", en: "Completed", ko: "협업 완료" } }
];

const CONTACT_CHANNEL_OPTIONS = [
  { value: "", labels: { "zh-CN": "待确认", en: "TBD", ko: "미정" } },
  { value: "小红书私信", labels: { "zh-CN": "小红书私信", en: "Xiaohongshu DM", ko: "샤오홍슈 DM" } },
  { value: "微信", labels: { "zh-CN": "微信", en: "WeChat", ko: "위챗" } },
  { value: "邮箱", labels: { "zh-CN": "邮箱", en: "Email", ko: "이메일" } },
  { value: "经纪人", labels: { "zh-CN": "经纪人", en: "Agent", ko: "에이전트" } },
  { value: "其他", labels: { "zh-CN": "其他", en: "Other", ko: "기타" } }
];

const CURRENCY_OPTIONS = ["CNY", "KRW", "USD"];

function localizedOptionLabel(item) {
  return item.labels[state.locale] || item.labels["zh-CN"] || item.value;
}

function alignmentBadge(level) {
  const map = {
    consistent: "badge-ai-success",
    soft_divergence: "badge-ai-fallback",
    hard_conflict: "badge-conflict",
    unknown: "badge-ai-pending"
  };
  const key = level || "unknown";
  return badge(map[key] || "badge-ai-pending", t(`alignment.${key}`));
}

function drawerItem(label, value, title = "") {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `
    <div class="drawer-grid-item">
      <label${titleAttr}>${escapeHtml(label)}</label>
      <strong>${escapeHtml(String(value ?? "-"))}</strong>
    </div>
  `;
}

function keywordsToBadges(rawValue, className = "badge-grade-B") {
  const values = String(rawValue || "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length) return `<span class="helper-text">-</span>`;
  return values.map((item) => badge(className, item)).join("");
}

function renderPageHeader(titleKey, descKey, actionsHtml = "") {
  return `
    <div class="page-titlebar">
      <div>
        <h1>${t(titleKey)}</h1>
        <p>${t(descKey)}</p>
      </div>
      <div class="page-actions">${actionsHtml}</div>
    </div>
  `;
}

function updateLocaleUi() {
  document.documentElement.lang = state.locale;
  document.title = t("app.title");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.locale === state.locale);
  });
  document.querySelector(".brand-title").textContent = t("brand.title");
  document.getElementById("sidebar-project-name").textContent = t("brand.subtitle");
  document.getElementById("toolbar-project-name").textContent = t("project.name");
  document.getElementById("drawer-close").setAttribute("aria-label", t("drawer.close"));
  syncLocaleQueryParam();
  syncTopbarContext();
}

function syncTopbarContext() {
  const dashboard = state.dashboard;
  document.getElementById("toolbar-country").textContent = dashboard
    ? localizeCountryName(dashboard.countries?.[0] || t("common.unknownRegion"))
    : t("common.unknownRegion");
  document.getElementById("toolbar-platform").textContent = t("common.platform.xhs");
  document.getElementById("toolbar-updated").textContent = dashboard ? formatDateTime(dashboard.last_data_updated) : "-";
}

async function loadBootstrap() {
  setStatus(t("status.loading"));
  try {
    const [dashboard, filterOptions] = await Promise.all([
      fetchJson("/api/dashboard"),
      fetchJson("/api/filter-options")
    ]);
    state.dashboard = dashboard;
    state.filterOptions = filterOptions;
    syncTopbarContext();
    setStatus("");
  } catch (error) {
    setStatus(`${t("status.apiError")}: ${error.message}`, true);
  }
}

function metricCard(label, value, meta = "", metaClass = "") {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(String(value))}</div>
      <div class="metric-meta ${metaClass}">${escapeHtml(meta)}</div>
    </div>
  `;
}

function renderFieldCompletenessPanel(completeness) {
  const entries = Object.entries(completeness || {});
  if (entries.length === 0) return "";
  const rows = entries.slice(0, 6).map(([label, rate]) => {
    const pct = (rate * 100).toFixed(0);
    const cls = rate < 0.5 ? "bad" : rate < 0.7 ? "warn" : "good";
    return `<div class="quality-row">
      <span class="quality-label">${escapeHtml(label)}</span>
      <span class="quality-bar ${cls}"><span style="width:${pct}%"></span></span>
      <span class="quality-value ${cls}">${pct}%</span>
    </div>`;
  }).join("");
  return `<div class="panel" style="grid-column: span 4;">
    <div class="panel-head"><div><h3>${t("compare.field_completeness")}</h3><p>${t("common.data_quality")}</p></div></div>
    <div class="quality-list">${rows}</div>
  </div>`;
}

// ── Overview Page ─────────────────────────────────────────────────────────

function renderOverviewPage() {
  const root = pageElements.overview;
  const dashboard = state.dashboard;
  if (!dashboard) {
    root.innerHTML = `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div>`;
    return;
  }

  const ai = dashboard.ai_status_overview;
  root.innerHTML = `
    ${renderPageHeader("page.overview.title", "page.overview.desc", `
      <button class="button-secondary" id="overview-refresh">${t("button.refresh")}</button>
    `)}
    <div class="metric-grid">
      ${metricCard(t("metric.totalCreators"), formatNumber(dashboard.total_creators), t("metric.avgScoreHint"))}
      ${metricCard(t("metric.top50"), formatNumber(dashboard.top50_count), t("metric.realBase"), "positive")}
      ${metricCard(t("metric.avgScore"), formatScore(dashboard.final_score_avg, 2), t("metric.avgScoreHint"))}
      ${metricCard(t("metric.aiReal"), formatNumber(dashboard.ai_real_review_count), `${formatPercentValue(dashboard.ai_real_coverage)} · ${t("metric.aiRealHint")}`, "positive")}
      ${metricCard(t("metric.manualPending"), formatNumber(dashboard.pending_manual_count), t("metric.softHint"), "warning")}
      ${metricCard(t("metric.hardConflict"), formatNumber(dashboard.hard_conflict_count), t("metric.hardConflictHint"))}
      ${metricCard(t("metric.softDivergence"), formatNumber(dashboard.soft_divergence_count), t("metric.softHint"), "warning")}
      ${metricCard(t("metric.fallback"), formatNumber(ai.fallback), t("common.fallbackExcluded"))}
      ${metricCard(t("metric.pendingAi"), formatNumber(ai.pending), t("source.pending"))}
      ${metricCard(t("metric.consistent"), formatNumber(ai.consistent_count), t("alignment.consistent"), "positive")}
    </div>

    <div class="grid-12">
      <div class="panel" style="grid-column: span 6;">
        <div class="panel-head"><div><h3>${t("panel.top10")}</h3><p>${t("common.realAiOnly")}</p></div></div>
        <div class="chart-box" id="chart-top10"></div>
      </div>
      <div class="panel" style="grid-column: span 3;">
        <div class="panel-head"><div><h3>${t("panel.gradeDistribution")}</h3><p>${t("metric.totalCreators")}</p></div></div>
        <div class="chart-box" id="chart-grade"></div>
      </div>
      <div class="panel" style="grid-column: span 3;">
        <div class="panel-head"><div><h3>${t("panel.aiStatus")}</h3><p>${t("common.fallbackExcluded")}</p></div></div>
        <div class="chart-box" id="chart-ai-status-overview"></div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("panel.keywordTop10")}</h3><p>${t("panel.dataNote")}</p></div></div>
        <div class="chart-box tall" id="chart-keywords"></div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("panel.regionDistribution")}</h3><p>${t("table.country")}</p></div></div>
        <div class="chart-box tall" id="chart-region"></div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("panel.dataNote")}</h3><p>${t("common.updated")}: ${formatDateTime(dashboard.last_data_updated)}</p></div></div>
        <div class="mini-list">
          <div class="record-sub">${escapeHtml(t(dashboard.data_source_note_key || "note.no_data", dashboard.data_source_note_vars || {}))}</div>
          <div class="record-sub">${escapeHtml(t(dashboard.ai_source_note_key || "note.no_ai_data", dashboard.ai_source_note_vars || {}))}</div>
        </div>
      </div>
      ${renderFieldCompletenessPanel(dashboard.field_completeness || {})}
      <div class="panel" style="grid-column: span 6;">
        <div class="panel-head"><div><h3>${t("panel.manualRecent")}</h3><p>${t("common.updated")}</p></div></div>
        <div class="record-list">${renderRecentManualList(dashboard.recent_manual_reviews || [])}</div>
      </div>
      <div class="panel" style="grid-column: span 6;">
        <div class="panel-head"><div><h3>${t("panel.aiRecent")}</h3><p>${t("panel.realDecisionBase", { count: formatNumber(ai.decision_base_count || 0) })}</p></div></div>
        <div class="record-list">${renderRecentAiList(dashboard.recent_ai_records || [])}</div>
      </div>
    </div>
  `;

  document.getElementById("overview-refresh")?.addEventListener("click", refreshDashboardOnly);
  renderOverviewCharts();
  lucide.createIcons();
}

function renderRecentManualList(items) {
  if (!items.length) {
    return `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div>`;
  }
  return items.map((item) => `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">#${item.rank} · ${escapeHtml(item.nickname || "-")}</div>
        <div class="record-sub">${escapeHtml(localizeCountryName(item.region || ""))} · ${formatDateTime(item.updated_at)}</div>
      </div>
      ${manualStatusBadge(item.decision)}
    </div>
  `).join("");
}

function renderRecentAiList(items) {
  if (!items.length) {
    return `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div>`;
  }
  return items.map((item) => `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title"><a class="table-link" data-open-detail="${item.rank}">#${item.rank} · ${escapeHtml(item.nickname || "-")}</a></div>
        <div class="record-sub">${escapeHtml(localizeCountryName(item.region || ""))} · ${t("table.score")} ${formatScore(item.score_final)}</div>
      </div>
      <div class="badge-row">
        ${sourceBadge(item.ai_status)}
        ${decisionBadge(item.ai_decision)}
        ${alignmentBadge(item.ai_alignment_level)}
      </div>
    </div>
  `).join("");
}

function localizedChartItems(items, mode = "country") {
  return (items || []).map((item) => ({
    name: mode === "keyword" ? String(item.name) : localizeCountryName(item.name),
    value: item.value,
    rawName: item.name
  }));
}

function renderOverviewCharts() {
  const dashboard = state.dashboard;
  if (!dashboard) return;
  createChart("chart-top10", {
    color: ["#38BDF8"],
    grid: { left: 110, right: 18, top: 12, bottom: 20 },
    xAxis: {
      type: "value",
      axisLabel: { color: "#9099A5" },
      splitLine: { lineStyle: { color: "#2B3540" } }
    },
    yAxis: {
      type: "category",
      data: (dashboard.charts.top10_scores || []).map((item) => item.name),
      axisLabel: { color: "#F3F5F7" }
    },
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const item = params?.[0];
        if (!item) return "";
        return `${escapeHtml(item.name)}<br/>${t("table.score")}: ${formatScore(item.value)}`;
      }
    },
    series: [{
      type: "bar",
      data: (dashboard.charts.top10_scores || []).map((item) => item.value),
      borderRadius: [0, 6, 6, 0]
    }]
  });

  createChart("chart-grade", {
    color: ["#F5B942", "#32D583", "#38BDF8", "#9099A5", "#FF5968"],
    tooltip: {
      trigger: "item",
      formatter: (item) => `${item.name}: ${formatNumber(item.value)}`
    },
    series: [{
      type: "pie",
      radius: ["48%", "72%"],
      label: { color: "#F3F5F7" },
      data: dashboard.charts.grade_distribution || []
    }]
  });

  createChart("chart-ai-status-overview", {
    color: ["#38BDF8", "#9099A5", "#FF5968"],
    tooltip: {
      trigger: "item",
      formatter: (item) => `${t(`source.${item.data.key}`)}: ${formatNumber(item.value)}`
    },
    series: [{
      type: "pie",
      radius: ["44%", "72%"],
      label: { color: "#F3F5F7", formatter: ({ data }) => t(`source.${data.key}`) },
      data: [
        { key: "success", name: t("source.success"), value: dashboard.ai_status_overview.success },
        { key: "fallback", name: t("source.fallback"), value: dashboard.ai_status_overview.fallback },
        { key: "pending", name: t("source.pending"), value: dashboard.ai_status_overview.pending + dashboard.ai_status_overview.failed }
      ]
    }]
  });

  const keywordData = localizedChartItems(dashboard.charts.keyword_top10 || [], "keyword");
  createChart("chart-keywords", {
    color: ["#F5B942"],
    grid: { left: 80, right: 18, top: 12, bottom: 32 },
    xAxis: {
      type: "value",
      axisLabel: { color: "#9099A5" },
      splitLine: { lineStyle: { color: "#2B3540" } }
    },
    yAxis: {
      type: "category",
      data: keywordData.map((item) => item.name),
      axisLabel: { color: "#F3F5F7" }
    },
    tooltip: { trigger: "axis" },
    series: [{ type: "bar", data: keywordData.map((item) => item.value), borderRadius: [0, 6, 6, 0] }]
  });

  renderRegionChart();
}

async function renderRegionChart() {
  const dashboard = state.dashboard;
  const mapData = (dashboard?.charts?.map_distribution || []).map((item) => ({
    name: item.name,
    value: item.value
  }));

  if (!mapData.length) {
    renderRegionFallbackChart();
    return;
  }

  try {
    const response = await fetch("/static/world.json");
    if (!response.ok) throw new Error("map load failed");
    const geoJson = await response.json();
    echarts.registerMap("world-stage8a", geoJson);
    createChart("chart-region", {
      visualMap: {
        min: 0,
        max: Math.max(...mapData.map((item) => item.value), 1),
        left: 10,
        bottom: 10,
        textStyle: { color: "#9099A5" },
        inRange: { color: ["#203040", "#38BDF8"] }
      },
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const value = params.value || 0;
          return `${params.name}<br/>${formatNumber(value)}`;
        }
      },
      series: [{
        type: "map",
        map: "world-stage8a",
        roam: false,
        label: { show: false },
        itemStyle: { borderColor: "#2B3540", areaColor: "#1B222A" },
        emphasis: { label: { show: false }, itemStyle: { areaColor: "#38BDF8" } },
        data: mapData
      }]
    });
  } catch (error) {
    renderRegionFallbackChart();
  }
}

function renderRegionFallbackChart() {
  const dashboard = state.dashboard;
  const regionData = localizedChartItems(dashboard.charts.region_distribution || []);
  createChart("chart-region", {
    color: ["#38BDF8"],
    grid: { left: 80, right: 18, top: 12, bottom: 32 },
    xAxis: {
      type: "value",
      axisLabel: { color: "#9099A5" },
      splitLine: { lineStyle: { color: "#2B3540" } }
    },
    yAxis: {
      type: "category",
      data: regionData.map((item) => item.name),
      axisLabel: { color: "#F3F5F7" }
    },
    tooltip: { trigger: "axis" },
    series: [{ type: "bar", data: regionData.map((item) => item.value), borderRadius: [0, 6, 6, 0] }]
  });
}

function createSelect(labelKey, id, options, value = "") {
  return `
    <div class="field">
      <label for="${id}">${t(labelKey)}</label>
      <select id="${id}">
        ${options.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
    </div>
  `;
}

function creatorsSortOptions() {
  return [
    { value: "rank", label: t("sort.rank") },
    { value: "nickname", label: t("sort.nickname") },
    { value: "country", label: t("sort.country") },
    { value: "grade", label: t("sort.grade") },
    { value: "score", label: t("sort.score") },
    { value: "fans", label: t("sort.fans") },
    { value: "price", label: t("sort.price") },
    { value: "cooperation_er", label: t("sort.cooperation_er") },
    { value: "ai_status", label: t("sort.ai_status") },
    { value: "ai_decision", label: t("sort.ai_decision") },
    { value: "alignment", label: t("sort.alignment") },
    { value: "manual_status", label: t("sort.manual_status") }
  ];
}

function aiStatusOptions() {
  return [
    { value: "", label: t("filter.all") },
    { value: "success", label: t("source.success") },
    { value: "fallback", label: t("source.fallback") },
    { value: "pending", label: t("source.pending") },
    { value: "failed", label: t("source.failed") }
  ];
}

function manualStatusOptions() {
  return [
    { value: "", label: t("filter.all") },
    { value: "recommend", label: t("manual.recommend") },
    { value: "cautious", label: t("manual.cautious") },
    { value: "reject", label: t("manual.reject") },
    { value: "reviewed", label: t("manual.reviewed") },
    { value: "pending", label: t("manual.pending") }
  ];
}

function renderCreatorsPage() {
  const root = pageElements.creators;
  const filterOptions = state.filterOptions || { countries: [], platforms: [], grades: [] };
  root.innerHTML = `
    ${renderPageHeader("page.creators.title", "page.creators.desc", `
      <button class="button-secondary" id="creators-refresh">${t("button.refresh")}</button>
      <button class="button-secondary" id="download-excel">${t("button.downloadExcel")}</button>
      <button class="button-secondary" id="download-csv">${t("button.downloadCsv")}</button>
    `)}
    <div class="batch-actions-bar">
      <label class="checkbox-label"><input type="checkbox" id="select-all-checkbox"> ${t("table.rank")}</label>
      <span class="checked-count" id="checked-count" style="display:none;">${t("group.checked")}: <strong>0</strong></span>
      <div class="batch-actions-group">
        <select id="quick-select">
          <option value="">${t("group.selectTop")}</option>
          <option value="10">${t("group.top10")}</option>
          <option value="50">${t("group.top50")}</option>
          <option value="100">${t("group.top100")}</option>
          <option value="all">${t("group.selectAll")}</option>
          <option value="manual">${t("group.manualN")}</option>
          <option value="deselect">${t("group.deselect")}</option>
        </select>
        <select id="move-to-group-select">
          <option value="">${t("group.moveTo")}</option>
        </select>
        <button class="button-secondary" id="btn-create-group">+ ${t("group.create")}</button>
        <button class="button-secondary" id="btn-ai-review-checked">${t("group.batchAiReview")}</button>
      </div>
    </div>
    <div class="filters-row">
      ${createSelect("filter.scope", "creator-view", [
        { value: "all", label: t("filter.full") },
        { value: "top50", label: t("filter.top50") },
        { value: "top10", label: t("filter.top10") }
      ], state.creators.view)}
      ${createSelect("filter.country", "creator-country", [{ value: "", label: t("filter.all") }].concat((filterOptions.countries || []).map((item) => ({ value: item, label: localizeCountryName(item) }))), state.creators.country)}
      ${createSelect("filter.platform", "creator-platform", [{ value: "", label: t("filter.all") }].concat((filterOptions.platforms || []).map((item) => ({ value: item, label: t("common.platform.xhs") }))), state.creators.platform)}
      ${createSelect("filter.grade", "creator-grade", [{ value: "", label: t("filter.all") }].concat((filterOptions.grades || []).map((item) => ({ value: item, label: item }))), state.creators.grade)}
      ${createSelect("filter.aiStatus", "creator-ai-status", aiStatusOptions(), state.creators.aiStatus)}
      ${createSelect("filter.manualStatus", "creator-manual-status", manualStatusOptions(), state.creators.manualStatus)}
      <div class="field">
        <label for="creator-search">${t("filter.search")}</label>
        <input id="creator-search" type="search" value="${escapeHtml(state.creators.search)}" placeholder="${escapeHtml(t("toolbar.searchPlaceholder"))}">
      </div>
      ${createSelect("filter.sort", "creator-sort", creatorsSortOptions(), state.creators.sortBy)}
      ${createSelect("filter.order", "creator-order", [
        { value: "asc", label: t("filter.asc") },
        { value: "desc", label: t("filter.desc") }
      ], state.creators.sortOrder)}
    </div>
    <div class="panel table-panel">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th style="width:40px;"></th>
              <th>${t("table.rank")}</th>
              <th>${t("table.nickname")}</th>
              <th>${t("table.platform")}</th>
              <th>${t("table.country")}</th>
              <th>${t("table.grade")}</th>
              <th>${t("table.score")}</th>
              <th>${t("table.fans")}</th>
              <th>${t("table.price")}</th>
              <th>${t("table.er")}</th>
              <th>${t("table.aiStatus")}</th>
              <th>${t("table.aiDecision")}</th>
              <th>${t("table.alignment")}</th>
              <th>${t("table.manualStatus")}</th>
            </tr>
          </thead>
          <tbody id="creators-table-body">
            <tr><td colspan="14"><div class="empty-state"><div><h3>${t("status.loading")}</h3></div></div></td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" id="creators-pagination"></div>
    </div>
  `;

  bindCreatorsFilters();
  bindBatchActions();
  document.getElementById("creators-refresh")?.addEventListener("click", loadCreatorsData);
  document.getElementById("download-excel")?.addEventListener("click", () => downloadFile("excel"));
  document.getElementById("download-csv")?.addEventListener("click", () => downloadFile("full_csv"));
  if (state.creators.data) renderCreatorsTable();
}

function bindCreatorsFilters() {
  const bindings = [
    ["creator-view", "view"],
    ["creator-country", "country"],
    ["creator-platform", "platform"],
    ["creator-grade", "grade"],
    ["creator-ai-status", "aiStatus"],
    ["creator-manual-status", "manualStatus"],
    ["creator-sort", "sortBy"],
    ["creator-order", "sortOrder"]
  ];
  bindings.forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener("change", async (event) => {
      state.creators[key] = event.target.value;
      state.creators.page = 1;
      await loadCreatorsData();
    });
  });
  document.getElementById("creator-search")?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    state.creators.search = event.target.value.trim();
    state.creators.page = 1;
    await loadCreatorsData();
  });
}

async function loadCreatorsData() {
  setStatus(t("status.loading"));
  const params = new URLSearchParams({
    view: state.creators.view,
    country: state.creators.country,
    platform: state.creators.platform,
    grade: state.creators.grade,
    ai_status: state.creators.aiStatus,
    manual_status: state.creators.manualStatus,
    search: state.creators.search,
    page: String(state.creators.page),
    per_page: String(state.creators.perPage),
    sort_by: state.creators.sortBy,
    sort_order: state.creators.sortOrder
  });
  try {
    state.creators.data = await fetchJson(`/api/creators?${params.toString()}`);
    renderCreatorsTable();
    setStatus("");
  } catch (error) {
    setStatus(`${t("status.apiError")}: ${error.message}`, true);
    const tbody = document.getElementById("creators-table-body");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="14"><div class="empty-state"><div><h3>${t("status.apiError")}</h3><p>${escapeHtml(error.message)}</p><button class="button-secondary" onclick="loadCreatorsData()">重试 / Retry</button></div></div></td></tr>`;
    }
  }
}

function renderCreatorsTable() {
  const tbody = document.getElementById("creators-table-body");
  const pagination = document.getElementById("creators-pagination");
  const data = state.creators.data;
  if (!tbody || !pagination) return;
  if (!data || !data.creators?.length) {
    tbody.innerHTML = `<tr><td colspan="14"><div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div></td></tr>`;
    pagination.innerHTML = "";
    return;
  }

  tbody.innerHTML = data.creators.map((item) => `
    <tr>
      <td><input type="checkbox" class="creator-checkbox" data-rank="${item.rank}" data-creator-key="${escapeHtml(item.creator_key || "")}" ${state.checked.has(String(item.rank)) ? "checked" : ""}></td>
      <td>#${item.rank}</td>
      <td><a class="table-link" data-open-detail="${item.rank}">${escapeHtml(item["昵称"] || "-")}</a></td>
      <td>${t("common.platform.xhs")}</td>
      <td>${escapeHtml(localizeCountryName(item.country_label || item.region_display || ""))}</td>
      <td>${gradeBadge(item.grade_short)}</td>
      <td>${formatScore(item.score_final)}</td>
      <td>${formatFollowers(item["粉丝数"])}</td>
      <td>${formatPrice(item["全部报价"])}</td>
      <td>${formatPercentText(item["合作笔记ER"])}</td>
      <td>${sourceBadge(item.ai_status)}</td>
      <td>${decisionBadge(item.ai_decision)}</td>
      <td>${alignmentBadge(item.ai_alignment_level)}</td>
      <td>${manualStatusBadge(item.manual_status)}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".creator-checkbox").forEach(cb => {
    cb.addEventListener("change", () => {
      const rank = cb.dataset.rank;
      if (cb.checked) state.checked.add(rank);
      else state.checked.delete(rank);
      updateCheckedCount();
    });
  });

  renderPagination(
    pagination,
    data.total,
    data.page,
    data.per_page,
    async (nextPage) => {
      state.creators.page = nextPage;
      await loadCreatorsData();
    }
  );
}

function renderPagination(container, total, page, perPage, onChange) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  container.innerHTML = `
    <div class="pagination-info">${t("common.page")} ${page} ${t("common.of")} ${totalPages} · ${formatNumber(total)} ${t("common.records")}</div>
    <div class="pagination-actions">
      <button class="button-secondary" id="${container.id}-prev" ${page <= 1 ? "disabled" : ""}>${t("button.prev")}</button>
      <button class="button-secondary" id="${container.id}-next" ${page >= totalPages ? "disabled" : ""}>${t("button.next")}</button>
    </div>
  `;
  document.getElementById(`${container.id}-prev`)?.addEventListener("click", () => onChange(page - 1));
  document.getElementById(`${container.id}-next`)?.addEventListener("click", () => onChange(page + 1));
}

function updateCheckedCount() {
  const countEl = document.getElementById("checked-count");
  const strongEl = countEl?.querySelector("strong");
  if (countEl && strongEl) {
    const count = state.checked.size;
    countEl.style.display = count > 0 ? "" : "none";
    strongEl.textContent = count;
  }
  const selectAll = document.getElementById("select-all-checkbox");
  if (selectAll) {
    const total = (state.creators.data?.creators || []).length;
    if (total > 0 && state.checked.size >= total) selectAll.checked = true;
    else if (state.checked.size === 0) selectAll.checked = false;
  }
}

async function bindBatchActions() {
  // select all
  document.getElementById("select-all-checkbox")?.addEventListener("change", () => {
    const checked = document.getElementById("select-all-checkbox").checked;
    document.querySelectorAll(".creator-checkbox").forEach(cb => {
      cb.checked = checked;
      if (checked) state.checked.add(cb.dataset.rank);
      else state.checked.delete(cb.dataset.rank);
    });
    updateCheckedCount();
  });

  // quick select
  document.getElementById("quick-select")?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;
    const rows = Array.from(document.querySelectorAll(".creator-checkbox"));
    let toSelect = [];

    if (val === "all") {
      toSelect = rows;
    } else if (val === "deselect") {
      rows.forEach(cb => { cb.checked = false; state.checked.delete(cb.dataset.rank); });
      updateCheckedCount();
      e.target.value = "";
      return;
    } else if (val === "manual") {
      const n = parseInt(prompt(t("group.manualN") + ":", "10"));
      if (isNaN(n) || n <= 0) { e.target.value = ""; return; }
      toSelect = rows.slice(0, Math.min(n, rows.length));
    } else {
      const n = parseInt(val);
      toSelect = rows.slice(0, Math.min(n, rows.length));
    }

    state.checked.clear();
    toSelect.forEach(cb => {
      cb.checked = true;
      state.checked.add(cb.dataset.rank);
    });
    updateCheckedCount();
    e.target.value = "";
  });

  // load groups into move-to-group dropdown
  await loadGroupsForDropdown();

  // create group button
  document.getElementById("btn-create-group")?.addEventListener("click", async () => {
    const name = prompt(t("group.name") + ":");
    if (!name || !name.trim()) return;
    const checkedKeys = Array.from(state.checked);
    const creatorKeys = checkedKeys.map(r => {
      const cb = document.querySelector(`.creator-checkbox[data-rank="${r}"]`);
      return cb ? cb.dataset.creatorKey : "";
    }).filter(Boolean);
    const resp = await fetchJson("/api/v2/groups", {
      method: "POST",
      body: JSON.stringify({name: name.trim(), creator_keys: creatorKeys}),
      headers: {"Content-Type": "application/json"}
    });
    if (resp && resp.ok) {
      alert("Group created: " + name);
      await loadGroupsForDropdown();
    }
  });

  // move to group
  document.getElementById("move-to-group-select")?.addEventListener("change", async (e) => {
    const groupId = e.target.value;
    if (!groupId) return;
    const checkedKeys = Array.from(state.checked);
    const creatorKeys = checkedKeys.map(r => {
      const cb = document.querySelector(`.creator-checkbox[data-rank="${r}"]`);
      return cb ? cb.dataset.creatorKey : "";
    }).filter(Boolean);
    const resp = await fetchJson(`/api/v2/groups/${groupId}/add`, {
      method: "POST",
      body: JSON.stringify({creator_keys: creatorKeys}),
      headers: {"Content-Type": "application/json"}
    });
    if (resp && resp.ok) {
      alert(`Added ${resp.added || creatorKeys.length} creators to group`);
    }
    e.target.value = "";
  });

  // AI review checked
  document.getElementById("btn-ai-review-checked")?.addEventListener("click", async () => {
    const count = state.checked.size;
    if (count === 0) { alert("No creators selected"); return; }
    if (!confirm(`Run AI review for ${count} selected creators?`)) return;
    const checkedKeys = Array.from(state.checked);
    const creatorKeys = checkedKeys.map(r => {
      const cb = document.querySelector(`.creator-checkbox[data-rank="${r}"]`);
      return cb ? cb.dataset.creatorKey : "";
    }).filter(Boolean);

    // Create a temp group and run ai-review
    const grpResp = await fetchJson("/api/v2/groups", {
      method: "POST",
      body: JSON.stringify({name: `临时-${new Date().toISOString().slice(0,10)}`, creator_keys: creatorKeys}),
      headers: {"Content-Type": "application/json"}
    });
    if (!grpResp || !grpResp.ok) return;
    const groupId = grpResp.group.group_id;
    const taskResp = await fetchJson(`/api/v2/groups/${groupId}/ai-review`, {method: "POST"});
    if (taskResp && taskResp.task_id) {
      showProgressOverlay(taskResp.task_id);
    }
  });
}

async function showProgressOverlay(taskId) {
  const overlay = document.getElementById("task-progress-overlay");
  const bar = document.getElementById("task-progress-bar");
  const text = document.getElementById("task-progress-text");
  if (!overlay) return;
  overlay.style.display = "flex";
  const poll = async () => {
    const resp = await fetchJson(`/api/v2/tasks/${taskId}`);
    if (!resp) return;
    const pct = resp.total > 0 ? Math.round((resp.completed / resp.total) * 100) : 0;
    if (bar) bar.style.width = pct + "%";
    if (text) text.textContent = `${resp.completed}/${resp.total} - ${resp.status}`;
    if (resp.status === "done") {
      if (bar) bar.style.width = "100%";
      if (text) text.textContent = t("group.taskDone");
      setTimeout(() => { overlay.style.display = "none"; }, 2000);
      return;
    }
    setTimeout(poll, 2000);
  };
  poll();
}

async function loadGroupsForDropdown() {
  const sel = document.getElementById("move-to-group-select");
  if (!sel) return;
  try {
    const resp = await fetchJson("/api/v2/groups");
    if (resp && resp.items) {
      state.groups.items = resp.items;
      state.groups.loaded = true;
      sel.innerHTML = `<option value="">${t("group.moveTo")}</option>` +
        resp.items.map(g => `<option value="${g.group_id}">${escapeHtml(g.name)} (${(g.creator_keys||[]).length})</option>`).join("");
    }
  } catch(e) {}
}

// ── Groups Page ──

function renderGroupsPage() {
  const root = pageElements.groups || document.getElementById("page-groups");
  if (!root) return;
  root.innerHTML = `
    ${renderPageHeader("group.title", "group.desc", `
      <button class="button-primary" id="groups-refresh">${t("button.refresh")}</button>
    `)}
    <div id="groups-list" class="groups-list"><p>Loading...</p></div>
  `;
  document.getElementById("groups-refresh")?.addEventListener("click", loadGroupsPageData);
  loadGroupsPageData();
}

async function loadGroupsPageData() {
  const listEl = document.getElementById("groups-list");
  if (!listEl) return;
  try {
    const resp = await fetchJson("/api/v2/groups");
    if (!resp || !resp.items) {
      listEl.innerHTML = `<div class="empty-state"><div><h3>${t("group.empty")}</h3></div></div>`;
      return;
    }
    state.groups.items = resp.items;
    state.groups.loaded = true;
    listEl.innerHTML = resp.items.length === 0
      ? `<div class="empty-state"><div><h3>${t("group.empty")}</h3></div></div>`
      : resp.items.map(g => `
      <div class="group-card" data-group-id="${g.group_id}">
        <div class="group-card-header">
          <h3><a class="table-link" data-nav-group="${g.group_id}">${escapeHtml(g.name)}</a></h3>
          <span class="group-card-count">${(g.creator_keys||[]).length} ${t("group.count")}</span>
        </div>
        <div class="group-card-meta">${g.created_at ? g.created_at.slice(0,16).replace("T"," ") : ""}</div>
        <div class="group-card-actions">
          <button class="button-secondary btn-group-delete" data-group-id="${g.group_id}">Delete</button>
        </div>
      </div>
    `).join("");

    // bind navigation
    listEl.querySelectorAll("[data-nav-group]").forEach(a => {
      a.addEventListener("click", () => {
        state.temp = { groupId: a.dataset.navGroup };
        state.page = "group-detail";
        disposeCharts();
        renderCurrentPage();
        updateLocaleUi();
      });
    });
    // bind delete
    listEl.querySelectorAll(".btn-group-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(t("group.confirmDelete"))) return;
        await fetchJson(`/api/v2/groups/${btn.dataset.groupId}`, {method: "DELETE"});
        loadGroupsPageData();
      });
    });
  } catch(e) {
    listEl.innerHTML = `<div class="empty-state"><div><h3>${t("status.apiError")}</h3><p>${escapeHtml(e.message)}</p><button class="button-secondary" onclick="loadGroupsPageData()">重试 / Retry</button></div></div>`;
  }
}

function renderGroupDetailPage() {
  const root = pageElements.groups || document.getElementById("page-groups");
  const groupId = state.temp?.groupId;
  const group = (state.groups.items || []).find(g => g.group_id === groupId);
  if (!root || !group) return;

  root.innerHTML = `
    ${renderPageHeader(group.name, `Group · ${(group.creator_keys||[]).length} creators`, `
      <button class="button-secondary" id="group-detail-back">Back</button>
      <button class="button-secondary" id="group-detail-ai-review">${t("group.batchAiReview")}</button>
    `)}
    <div id="group-detail-content"><p>Loading...</p></div>
  `;

  document.getElementById("group-detail-back")?.addEventListener("click", () => {
    state.page = "groups";
    disposeCharts();
    renderCurrentPage();
    updateLocaleUi();
  });
  document.getElementById("group-detail-ai-review")?.addEventListener("click", async () => {
    if (!confirm(`Run AI review for all ${group.creator_keys.length} creators?`)) return;
    const taskResp = await fetchJson(`/api/v2/groups/${groupId}/ai-review`, {method: "POST"});
    if (taskResp && taskResp.task_id) showProgressOverlay(taskResp.task_id);
  });

  // Load creator details from current batch
  loadGroupDetailData(group);
}

async function loadGroupDetailData(group) {
  const container = document.getElementById("group-detail-content");
  if (!container) return;

  const creatorsResp = await fetchJson("/api/v2/creators?view=all&per_page=200");
  const allCreators = creatorsResp?.creators || [];
  const creatorMap = {};
  allCreators.forEach(c => { creatorMap[c.creator_key || String(c.rank)] = c; });

  const rows = (group.creator_keys || []).map((ck, idx) => {
    const c = creatorMap[ck];
    if (!c) return `<tr><td>#${idx+1}</td><td>${escapeHtml(ck)}</td><td colspan="11">Not found in current batch</td></tr>`;
    return `<tr>
      <td>#${c.rank}</td>
      <td>${escapeHtml(c["昵称"] || "-")}</td>
      <td>${t("common.platform.xhs")}</td>
      <td>${escapeHtml(localizeCountryName(c.country_label || c.region_display || ""))}</td>
      <td>${gradeBadge(c.grade_short)}</td>
      <td>${formatScore(c.score_final)}</td>
      <td>${formatFollowers(c["粉丝数"])}</td>
      <td>${formatPrice(c["全部报价"])}</td>
      <td>${formatPercentText(c["合作笔记ER"])}</td>
      <td>${sourceBadge(c.ai_status)}</td>
      <td>${decisionBadge(c.ai_decision)}</td>
      <td>${alignmentBadge(c.ai_alignment_level)}</td>
      <td>${manualStatusBadge(c.manual_status)}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `<div class="panel table-panel"><div class="table-scroll"><table class="table">
    <thead><tr>
      <th>${t("table.rank")}</th><th>${t("table.nickname")}</th><th>${t("table.platform")}</th><th>${t("table.country")}</th>
      <th>${t("table.grade")}</th><th>${t("table.score")}</th><th>${t("table.fans")}</th><th>${t("table.price")}</th>
      <th>${t("table.er")}</th><th>${t("table.aiStatus")}</th><th>${t("table.aiDecision")}</th><th>${t("table.alignment")}</th>
      <th>${t("table.manualStatus")}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div></div>`;
}

function glossaryBlock() {
  return `
    <details class="drawer-section" open>
      <summary style="cursor:pointer; font-weight:600; margin-bottom:10px;">${t("panel.terms")}</summary>
      <div class="mini-list">
        <div class="record-sub">${t("terms.coverage")}</div>
        <div class="record-sub">${t("terms.success")}</div>
        <div class="record-sub">${t("terms.fallback")}</div>
        <div class="record-sub">${t("terms.recommend")}</div>
        <div class="record-sub">${t("terms.cautious")}</div>
        <div class="record-sub">${t("terms.reject")}</div>
        <div class="record-sub">${t("terms.hard")}</div>
        <div class="record-sub">${t("terms.soft")}</div>
        <div class="record-sub">${t("terms.freeze")}</div>
      </div>
    </details>
  `;
}

function renderAiPage() {
  const root = pageElements.ai;
  const dashboard = state.dashboard;
  const ai = dashboard?.ai_status_overview || {};
  root.innerHTML = `
    ${renderPageHeader("page.ai.title", "page.ai.desc", `
      <button class="button" id="ai-run-btn">${t("button.runAi")}</button>
      <button class="button-secondary" id="ai-refresh-btn">${t("button.refresh")}</button>
    `)}
    <div class="metric-grid">
      ${metricCard(t("metric.aiCoverage"), formatPercentValue(dashboard?.ai_real_coverage || 0), `${t("panel.realDecisionBase", { count: formatNumber(ai.decision_base_count || 0) })}`, "positive")}
      ${metricCard(t("metric.aiReal"), formatNumber(ai.success || 0), t("source.success"), "positive")}
      ${metricCard(t("metric.fallback"), formatNumber(ai.fallback || 0), t("source.fallback"))}
      ${metricCard(t("metric.pendingAi"), formatNumber(ai.pending || 0), t("source.pending"))}
      ${metricCard(t("metric.hardConflict"), formatNumber(ai.hard_conflict_count || 0), t("alignment.hard_conflict"))}
      ${metricCard(t("metric.softDivergence"), formatNumber(ai.soft_divergence_count || 0), t("alignment.soft_divergence"), "warning")}
    </div>

    <div class="grid-12">
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("panel.aiReviewCoverage")}</h3><p>${t("common.fallbackExcluded")}</p></div></div>
        <div class="chart-box" id="chart-ai-coverage"></div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("panel.aiDecisionDistribution")}</h3><p>${t("panel.realDecisionBase", { count: formatNumber(ai.decision_base_count || 0) })}</p></div></div>
        <div class="chart-box" id="chart-ai-decision"></div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("panel.dataNote")}</h3><p>${t("common.realAiOnly")}</p></div></div>
        <div class="mini-list">
          ${(ai.decision_distribution || []).map((item) => `<div class="record-item"><div class="record-main"><div class="record-title">${t(`decision.${item.name}`)}</div><div class="record-sub">${formatNumber(item.value)} · ${formatPercentValue(item.pct || 0)}</div></div>${decisionBadge(item.name)}</div>`).join("")}
          <div class="record-item"><div class="record-main"><div class="record-title">${t("alignment.hard_conflict")}</div><div class="record-sub">${formatNumber(ai.hard_conflict_count || 0)}</div></div>${alignmentBadge("hard_conflict")}</div>
          <div class="record-item"><div class="record-main"><div class="record-title">${t("alignment.soft_divergence")}</div><div class="record-sub">${formatNumber(ai.soft_divergence_count || 0)}</div></div>${alignmentBadge("soft_divergence")}</div>
          <div class="record-item"><div class="record-main"><div class="record-title">${t("source.fallback")}</div><div class="record-sub">${formatNumber(ai.fallback || 0)}</div></div>${sourceBadge("fallback")}</div>
          <div class="record-item"><div class="record-main"><div class="record-title">${t("source.pending")}</div><div class="record-sub">${formatNumber(ai.pending || 0)}</div></div>${sourceBadge("pending")}</div>
        </div>
      </div>
      <div style="grid-column: span 12;">${glossaryBlock()}</div>
    </div>

    <div class="filters-row" style="margin-top:16px;">
      ${createSelect("filter.scope", "ai-view", [
        { value: "all", label: t("filter.viewAll") },
        { value: "pending", label: t("filter.viewPending") },
        { value: "success", label: t("filter.viewSuccess") },
        { value: "fallback", label: t("filter.viewFallback") },
        { value: "hard_conflict", label: t("filter.viewHard") },
        { value: "soft_divergence", label: t("filter.viewSoft") },
        { value: "consistent", label: t("filter.viewConsistent") }
      ], state.aiPage.view)}
      <div class="field">
        <label for="ai-search">${t("filter.search")}</label>
        <input id="ai-search" type="search" value="${escapeHtml(state.aiPage.search)}" placeholder="${escapeHtml(t("toolbar.searchPlaceholder"))}">
      </div>
    </div>

    <div class="panel table-panel">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>${t("table.rank")}</th>
              <th>${t("table.nickname")}</th>
              <th>${t("table.platform")}</th>
              <th>${t("table.country")}</th>
              <th>${t("table.score")}</th>
              <th>${t("table.aiStatus")}</th>
              <th>${t("table.aiDecision")}</th>
              <th>${t("table.alignment")}</th>
              <th>${t("table.manualStatus")}</th>
            </tr>
          </thead>
          <tbody id="ai-table-body">
            <tr><td colspan="9"><div class="empty-state"><div><h3>${t("status.loading")}</h3></div></div></td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" id="ai-pagination"></div>
    </div>
  `;

  bindAiControls();
  if (state.aiPage.data) renderAiTable();
  renderAiCharts();
}

function bindAiControls() {
  document.getElementById("ai-run-btn")?.addEventListener("click", runAiGeneration);
  document.getElementById("ai-refresh-btn")?.addEventListener("click", async () => {
    await Promise.all([refreshDashboardOnly(), loadAiPageData()]);
  });
  document.getElementById("ai-view")?.addEventListener("change", async (event) => {
    state.aiPage.view = event.target.value;
    state.aiPage.page = 1;
    await loadAiPageData();
  });
  document.getElementById("ai-search")?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    state.aiPage.search = event.target.value.trim();
    state.aiPage.page = 1;
    await loadAiPageData();
  });
}

function renderAiCharts() {
  const ai = state.dashboard?.ai_status_overview;
  if (!ai) return;

  createChart("chart-ai-coverage", {
    color: ["#38BDF8", "#9099A5", "#FF5968"],
    tooltip: {
      trigger: "item",
      formatter: (item) => `${item.name}: ${formatNumber(item.value)}`
    },
    series: [{
      type: "pie",
      radius: ["48%", "72%"],
      label: { color: "#F3F5F7" },
      data: [
        { name: t("source.success"), value: ai.success },
        { name: t("source.fallback"), value: ai.fallback },
        { name: t("source.pending"), value: ai.pending + ai.failed }
      ]
    }]
  });

  createChart("chart-ai-decision", {
    color: ["#32D583", "#F5B942", "#FF5968"],
    tooltip: {
      trigger: "item",
      formatter: (item) => `${item.name}: ${formatNumber(item.value)} (${formatPercentValue(item.data.pct || 0)})`
    },
    series: [{
      type: "pie",
      radius: ["48%", "72%"],
      label: { color: "#F3F5F7" },
      data: (ai.decision_distribution || []).map((item) => ({
        name: t(`decision.${item.name}`),
        value: item.value,
        pct: item.pct
      }))
    }]
  });
}

async function loadAiPageData() {
  setStatus(t("status.loading"));
  const params = new URLSearchParams({
    view: state.aiPage.view,
    page: String(state.aiPage.page),
    per_page: String(state.aiPage.perPage),
    search: state.aiPage.search
  });
  try {
    state.aiPage.data = await fetchJson(`/api/ai/reviews?${params.toString()}`);
    renderAiTable();
    setStatus("");
  } catch (error) {
    setStatus(`${t("status.apiError")}: ${error.message}`, true);
  }
}

function renderAiTable() {
  const tbody = document.getElementById("ai-table-body");
  const pagination = document.getElementById("ai-pagination");
  const data = state.aiPage.data;
  if (!tbody || !pagination) return;
  if (!data || !data.records?.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div></td></tr>`;
    pagination.innerHTML = "";
    return;
  }

  tbody.innerHTML = data.records.map((item) => `
    <tr>
      <td>#${item.rank}</td>
      <td><a class="table-link" data-open-detail="${item.rank}">${escapeHtml(item["昵称"] || "-")}</a></td>
      <td>${t("common.platform.xhs")}</td>
      <td>${escapeHtml(localizeCountryName(item.country_label || item.region_display || ""))}</td>
      <td>${formatScore(item.score_final)}</td>
      <td>${sourceBadge(item.ai_status)}</td>
      <td>${decisionBadge(item.ai_decision)}</td>
      <td>${alignmentBadge(item.ai_alignment_level)}</td>
      <td>${manualStatusBadge(item.manual_status)}</td>
    </tr>
  `).join("");

  renderPagination(
    pagination,
    data.total,
    data.page,
    data.per_page,
    async (nextPage) => {
      state.aiPage.page = nextPage;
      await loadAiPageData();
    }
  );
}

// ── Batch Management ──────────────────────────────────────────────────────

async function loadBatches() {
  try {
    const resp = await fetch("/api/v2/batches/current");
    const data = await resp.json();
    state.batches.current = data.current;
    state.batches.all = data.all;
    updateBatchSelector();
  } catch (e) {
    console.error("loadBatches failed", e);
  }
}

function formatBatchTime(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${MM}/${DD} ${HH}:${mm}`;
  } catch { return ""; }
}

function updateBatchSelector() {
  const select = document.getElementById("batch-selector");
  const chip = document.getElementById("batch-selector-chip");
  if (!select || !chip) return;

  select.innerHTML = "";
  const all = state.batches.all || [];
  const currentId = (state.batches.current && state.batches.current.batch_id) || "";

  // Sort: favorites first, then by created_at desc
  const sorted = [...all].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  sorted.forEach((b) => {
    const option = document.createElement("option");
    const star = b.is_favorite ? "⭐ " : "";
    const time = formatBatchTime(b.created_at || b.updated_at);
    option.value = b.batch_id || "";
    option.textContent = `${star}${b.name || b.batch_id} (${b.creator_count || 0}) | ${time}`;
    if (b.batch_id === currentId) option.selected = true;
    select.appendChild(option);
  });

  if (!currentId && sorted.length > 0) {
    select.value = sorted[0].batch_id || "";
  }

  chip.style.display = all.length > 0 ? "flex" : "none";
}

async function switchBatch(batchId) {
  try {
    const resp = await fetch("/api/v2/batches/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId }),
    });
    if (!resp.ok) throw new Error("切换失败");
    const data = await resp.json();
    state.batches.current = data.batch;
    state.dashboard = null;
    state.creators.data = null;
    state.aiPage.data = null;
    state.contactPage.data = null;
    state.reportPage.data = null;
    state.rulesPage.data = null;
    renderCurrentPage();
    setStatus(t("import.success", { count: data.batch.creator_count || 0 }));
  } catch (e) {
    setStatus(`批次切换失败: ${e.message}`, true);
  }
}

// ── Batch Manager ─────────────────────────────────────────────────────────────

function showBatchManager() {
  const modal = document.getElementById("batch-manager-modal");
  if (!modal) return;
  renderBatchManager();
  modal.style.display = "flex";
  bindBatchManagerEvents();
}

function hideBatchManager() {
  const modal = document.getElementById("batch-manager-modal");
  if (modal) modal.style.display = "none";
}

function renderBatchManager() {
  const listEl = document.getElementById("bm-list");
  const footerEl = document.getElementById("bm-footer");
  if (!listEl || !footerEl) return;

  const all = state.batches.all || [];
  const currentId = (state.batches.current && state.batches.current.batch_id) || "";

  const sorted = [...all].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  listEl.innerHTML = sorted.length === 0
    ? `<div class="bm-empty">暂无批次</div>`
    : sorted.map((b) => {
        const isActive = b.batch_id === currentId;
        const favStar = b.is_favorite ? "⭐" : "☆";
        const time = formatBatchTime(b.created_at || b.updated_at);
        const sourceLabel = { csv_import: "CSV", excel_import: "Excel", case_excel: "默认" }[b.source_type] || b.source_type || "-";
        return `<div class="bm-row${isActive ? " is-active" : ""}" data-batch-id="${escapeHtml(b.batch_id)}">
          <button class="bm-fav-btn" data-action="favorite" data-batch-id="${escapeHtml(b.batch_id)}" data-is-fav="${b.is_favorite ? "1" : "0"}">${favStar}</button>
          <span class="bm-name" data-batch-id="${escapeHtml(b.batch_id)}" title="点击重命名">${escapeHtml(b.name || b.batch_id)}</span>
          <span class="bm-source">${sourceLabel}</span>
          <span class="bm-count">${b.creator_count || 0} 达人</span>
          <span class="bm-time">${time}</span>
          <span class="bm-active-tag">${isActive ? "当前" : ""}</span>
          <button class="bm-rename-btn" data-action="rename" data-batch-id="${escapeHtml(b.batch_id)}" title="重命名">✏️</button>
          <button class="bm-del-btn" data-action="delete" data-batch-id="${escapeHtml(b.batch_id)}" title="删除" ${isActive ? "disabled" : ""}>🗑️</button>
        </div>`;
      }).join("");

  const favCount = sorted.filter((b) => b.is_favorite).length;
  footerEl.textContent = `已收藏 ${favCount} 个 | 共 ${sorted.length} 个批次`;
  bindBatchManagerEvents();
}

function bindBatchManagerEvents() {
  const modal = document.getElementById("batch-manager-modal");
  if (!modal) return;

  // close button
  const closeBtn = document.getElementById("bm-close");
  if (closeBtn) {
    closeBtn.onclick = hideBatchManager;
  }

  // click overlay to close
  modal.onclick = (e) => {
    if (e.target === modal) hideBatchManager();
  };

  // row buttons
  modal.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const batchId = btn.dataset.batchId;
      if (!batchId) return;

      if (action === "favorite") {
        const isFav = btn.dataset.isFav === "1";
        await toggleFavorite(batchId, !isFav);
      } else if (action === "rename") {
        promptRename(batchId);
      } else if (action === "delete") {
        confirmDelete(batchId);
      }
    });
  });
}

async function toggleFavorite(batchId, isFavorite) {
  try {
    const resp = await fetch("/api/v2/batches/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId, is_favorite: isFavorite }),
    });
    if (!resp.ok) throw new Error("收藏失败");
    await loadBatches();
    renderBatchManager();
    updateBatchSelector();
  } catch (e) {
    setStatus(`收藏操作失败: ${e.message}`, true);
  }
}

async function renameBatch(batchId, newName) {
  try {
    const resp = await fetch("/api/v2/batches/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId, name: newName }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.detail || "重命名失败");
    }
    await loadBatches();
    renderBatchManager();
    updateBatchSelector();
  } catch (e) {
    setStatus(`重命名失败: ${e.message}`, true);
  }
}

function promptRename(batchId) {
  const batch = (state.batches.all || []).find((b) => b.batch_id === batchId);
  const oldName = batch ? (batch.name || batchId) : batchId;
  const newName = prompt("请输入新名称:", oldName);
  if (newName && newName.trim() && newName.trim() !== oldName) {
    renameBatch(batchId, newName.trim());
  }
}

async function deleteBatch(batchId) {
  try {
    const resp = await fetch("/api/v2/batches/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.detail || "删除失败");
    }
    await loadBatches();
    renderBatchManager();
    updateBatchSelector();
    setStatus("批次已删除");
  } catch (e) {
    setStatus(`删除失败: ${e.message}`, true);
  }
}

function confirmDelete(batchId) {
  const batch = (state.batches.all || []).find((b) => b.batch_id === batchId);
  const name = batch ? (batch.name || batchId) : batchId;
  if (confirm(`确定删除"${name}"？\n将同时标记该批次的复核、联系、报价记录为已删除。`)) {
    deleteBatch(batchId);
  }
}

function renderCleaningSummary(summary) {
  if (!summary) return "";
  const q = summary.quality_distribution || {};
  const total = summary.total_rows || 0;
  return `<div class="cleaning-summary">
    <div class="cleaning-title">${t("common.data_quality")}</div>
    <div class="cleaning-bars">
      <div class="cleaning-bar"><span class="cleaning-label">${t("common.complete")}</span><span class="cleaning-bar-track"><span class="cleaning-bar-fill good" style="width:${total ? (q['完整'] || 0) / total * 100 : 0}%"></span></span><span>${q['完整'] || 0}</span></div>
      <div class="cleaning-bar"><span class="cleaning-label">${t("common.partial")}</span><span class="cleaning-bar-track"><span class="cleaning-bar-fill warn" style="width:${total ? (q['部分缺失'] || 0) / total * 100 : 0}%"></span></span><span>${q['部分缺失'] || 0}</span></div>
      <div class="cleaning-bar"><span class="cleaning-label">${t("common.missing")}</span><span class="cleaning-bar-track"><span class="cleaning-bar-fill bad" style="width:${total ? (q['严重缺失'] || 0) / total * 100 : 0}%"></span></span><span>${q['严重缺失'] || 0}</span></div>
    </div>
  </div>`;
}

// ── Import Page Content ───────────────────────────────────────────────────────────

function renderImportPage() {
  const root = pageElements["import"];
  if (!root) return;

  loadBatches().then(() => {
    root.innerHTML = renderImportPageContent();
    bindImportEvents(root);
    lucide.createIcons();
  });
}

function renderImportPageContent() {
  const batches = state.batches.all || [];
  const current = state.batches.current;
  const fieldReport = state.importPage.fieldReport;
  const uploading = state.importPage.uploading;

  let batchListHtml = "";
  if (batches.length === 0) {
    batchListHtml = `<div class="placeholder-muted">${t("import.noBatches")}</div>`;
  } else {
    batchListHtml = batches.map((b) => {
      const isActive = current && current.batch_id === b.batch_id;
      return `<div class="batch-item${isActive ? " is-active" : ""}" data-batch-id="${escapeHtml(b.batch_id)}">
        <div class="batch-item-name">${escapeHtml(b.name || b.batch_id)}</div>
        <div class="batch-item-meta">${b.creator_count || 0} ${t("common.creators")} · ${escapeHtml(b.source_type || t("common.unknown"))} · ${b.created_at ? b.created_at.slice(0, 10) : ""}</div>
      </div>`;
    }).join("");
  }

  let fieldReportHtml = "";
  if (fieldReport) {
    const fields = fieldReport.fields || {};
    const requiredHtml = Object.entries(fields)
      .filter(([, v]) => v.required)
      .map(([k, v]) => {
        const statusIcon = v.found ? "✅" : "❌";
        const extra = v.found ? `→ ${escapeHtml(v.mapped_from || k)}` : `<span class="field-err-detail">${t("common.not_found")}</span>`;
        const pct = (v.completeness * 100).toFixed(0);
        const pctClass = pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";
        return `<tr class="${v.found ? "" : "row-err"}"><td>${t(v.label) || escapeHtml(v.label)}</td><td>${statusIcon}</td><td class="field-mapped">${extra}</td><td class="quality-value ${pctClass}">${pct}%</td></tr>`;
      })
      .join("");
    const optionalHtml = Object.entries(fields)
      .filter(([, v]) => !v.required)
      .map(([k, v]) => {
        const statusIcon = v.found ? "✅" : "⚠️";
        const extra = v.found ? `→ ${escapeHtml(v.mapped_from || k)}` : `<span class="field-err-detail">${t("common.not_found")}</span>`;
        const pct = (v.completeness * 100).toFixed(0);
        const pctClass = pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";
        return `<tr class="${v.found ? "" : "row-warn"}"><td>${t(v.label) || escapeHtml(v.label)}</td><td>${statusIcon}</td><td class="field-mapped">${extra}</td><td class="quality-value ${pctClass}">${pct}%</td></tr>`;
      })
      .join("");

    const missingDetail = fieldReport.required_missing && fieldReport.required_missing.length > 0
      ? `<div class="field-err-block">❌ 必含字段缺失：${fieldReport.required_missing.map(escapeHtml).join("、")}</div>`
      : "";

    fieldReportHtml = `
      <div class="field-report">
        <h3>${t("import.fieldReport")}</h3>
        <div class="field-summary">
          <span class="field-stat">${t("import.rowsFound", { count: fieldReport.total_rows })}</span>
          <span class="field-stat ${fieldReport.valid ? "ok" : "err"}">${t("common.required_fields")}: ${fieldReport.valid ? t("common.required_complete") : t("common.required_missing") + (fieldReport.required_missing || []).join(", ")}</span>
          <span class="field-stat">可选字段覆盖: ${(fieldReport.overall_optional_completeness * 100).toFixed(0)}%</span>
        </div>
        ${missingDetail}
        ${renderCleaningSummary(fieldReport.cleaning_summary)}
        <table class="field-table">
          <thead><tr><th>字段</th><th>状态</th><th>映射来源</th><th>${t("import.completeness")}</th></tr></thead>
          <tbody>${requiredHtml}${optionalHtml}</tbody>
        </table>
      </div>`;
  }

  const uploadDisabled = uploading ? "disabled" : "";
  const importTab = state.importPage.importTab || "csv";
  const hasPendingFile = _pendingCsvFile && fieldReport;

  return `
    ${renderPageHeader("page.import.title", "page.import.desc")}
    <div class="import-layout">
      <div class="import-upload-section">
        <div class="import-tabs">
          <button class="import-tab ${importTab === 'csv' ? 'active' : ''}" data-import-tab="csv">CSV (已评分)</button>
          <button class="import-tab ${importTab === 'excel' ? 'active' : ''}" data-import-tab="excel">Excel (原始数据→自动评分)</button>
        </div>
        ${hasPendingFile ? `
        <div class="pending-file-card">
          <i data-lucide="file-text" class="pending-file-icon"></i>
          <div class="pending-file-info">
            <span class="pending-file-name">${escapeHtml(_pendingCsvFile.name)}</span>
            <span class="pending-file-size">${formatFileSize(_pendingCsvFile.size)}</span>
          </div>
          <span class="pending-file-badge" data-i18n="import.detected">已检测</span>
        </div>` : `
        <div class="upload-zone" id="upload-zone">
          <div class="upload-zone-inner">
            <i data-lucide="upload-cloud" class="upload-icon"></i>
            <p>${t("import.uploadArea")}</p>
            <label class="btn btn-primary ${uploadDisabled ? 'disabled' : ''}" id="upload-label">
              ${uploading ? `<span class="spinner"></span> ${t("import.importing")}` : t("import.uploadBtn")}
              <input type="file" id="csv-file-input" accept="${importTab === 'csv' ? '.csv' : '.xlsx,.xls'}" hidden ${uploadDisabled}>
            </label>
            ${importTab === 'excel' ? '<p class="import-hint">上传原始Excel后将自动触发六维评分，请耐心等待。</p>' : ''}
          </div>
        </div>`}
        ${fieldReport ? `<div class="import-actions">
          <div class="import-name-row">
            <label class="import-name-label">批次名称</label>
            <input type="text" id="batch-name-input" class="batch-name-input" value="${escapeHtml(_pendingCsvFile ? _pendingCsvFile.name.replace(/\.csv$/i, "") : "")}" placeholder="建议用品牌+日期命名，如：梨花女大_0707">
          </div>
          <button class="btn btn-primary" id="confirm-import-btn" ${uploadDisabled}>${t("import.confirmImport")}</button>
          <button class="btn btn-secondary" id="reset-import-btn">重新选择</button>
        </div>` : ""}
      </div>
      <div class="import-batch-section">
        <h3>${t("import.batchList")}</h3>
        ${batchListHtml}
      </div>
    </div>
  `;
}

function bindImportEvents(root) {
  const fileInput = document.getElementById("csv-file-input");
  const uploadZone = document.getElementById("upload-zone");
  const resetBtn = document.getElementById("reset-import-btn");
  const confirmBtn = document.getElementById("confirm-import-btn");

  // Tab切换
  root.querySelectorAll(".import-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.importPage.importTab = tab.dataset.importTab || "csv";
      state.importPage.fieldReport = null;
      state.importPage.uploading = false;
      _pendingCsvFile = null;
      if (fileInput) fileInput.value = "";
      renderImportPage();
    });
  });

  // 文件选择
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
      if (isExcel) {
        handleExcelFile(file);
      } else {
        handleCsvFile(file);
      }
    });
  }

  // 拖拽上传
  if (uploadZone) {
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    });
    uploadZone.addEventListener("dragleave", () => {
      uploadZone.classList.remove("dragover");
    });
    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
      if (isExcel) {
        handleExcelFile(file);
      } else {
        handleCsvFile(file);
      }
    });
  }

  // 确认导入
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      await doImportCsv();
    });
  }

  // 重置
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state.importPage.fieldReport = null;
      state.importPage.uploading = false;
      if (fileInput) fileInput.value = "";
      renderImportPage();
    });
  }

  // 批次切换
  root.querySelectorAll(".batch-item").forEach((item) => {
    item.addEventListener("click", () => {
      switchBatch(item.dataset.batchId);
    });
  });
}

let _pendingCsvFile = null;

function handleCsvFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    setStatus("只支持 CSV 文件", true);
    return;
  }
  _pendingCsvFile = file;
  state.importPage.uploading = true;
  renderImportPage();
  detectCsvFields(file);
}

async function handleExcelFile(file) {
  state.importPage.uploading = true;
  renderImportPage();
  try {
    const formData = new FormData();
    formData.append("file", file);
    const resp = await fetch("/api/v2/batches/import-excel", {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || "上传失败");
    state.importPage.uploading = false;
    await loadBatches();
    renderImportPage();
    setStatus(data.message || "Excel 已上传，后台评分中...");
  } catch (e) {
    state.importPage.uploading = false;
    renderImportPage();
    setStatus(`Excel 上传失败: ${e.message}`, true);
  }
}

async function detectCsvFields(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const resp = await fetch("/api/v2/batches/preview-csv", {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || "字段检测失败");

    state.importPage.fieldReport = data.field_report;
    state.importPage.uploading = false;
    renderImportPage();
  } catch (e) {
    state.importPage.uploading = false;
    state.importPage.fieldReport = null;
    renderImportPage();
    setStatus(`字段检测失败: ${e.message}`, true);
  }
}

async function doImportCsv() {
  if (!_pendingCsvFile) return;
  state.importPage.uploading = true;
  renderImportPage();

  try {
    const formData = new FormData();
    formData.append("file", _pendingCsvFile);
    const nameInput = document.getElementById("batch-name-input");
    const batchName = (nameInput && nameInput.value ? nameInput.value.trim() : _pendingCsvFile.name.replace(/\.csv$/i, ""));
    formData.append("batch_name", batchName);
    const resp = await fetch("/api/v2/batches/import-csv", {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || "导入失败");

    state.importPage.fieldReport = null;
    state.importPage.uploading = false;
    _pendingCsvFile = null;

    await loadBatches();
    state.dashboard = null;
    state.creators.data = null;
    state.aiPage.data = null;
    state.contactPage.data = null;
    state.reportPage.data = null;
    state.rulesPage.data = null;

    renderImportPage();
    setStatus(data.message || t("import.success", { count: data.batch.creator_count }));
  } catch (e) {
    state.importPage.uploading = false;
    renderImportPage();
    setStatus(`导入失败: ${e.message}`, true);
  }
}

// ── Batch Compare Page ────────────────────────────────────────────────────

async function renderBatchComparePage() {
  const root = pageElements.batchCompare;
  if (!root) return;
  try {
    const resp = await fetch("/api/v2/batches/compare");
    const data = await resp.json();
    root.innerHTML = renderBatchCompareContent(data);
    lucide.createIcons();
  } catch (e) {
    root.innerHTML = `<div class="placeholder-muted">对比数据加载失败: ${e.message}</div>`;
  }
}

function renderBatchCompareContent(data) {
  const batches = data.batches || [];
  const comparison = data.comparison || {};
  if (batches.length < 2) {
    return `<div class="placeholder-muted">至少需要 2 个批次才能对比。</div>`;
  }

  const tableRows = batches.map((b) => {
    const grades = b.grade_distribution || {};
    const gradeStr = ["S", "A", "B", "C", "D"].map((g) => `${g}:${grades[g] || 0}`).join(" ");
    return `<tr>
      <td>${escapeHtml(b.name || b.batch_id)}</td>
      <td>${b.source_type || ""}</td>
      <td>${b.creator_count}</td>
      <td>${b.avg_final_score.toFixed(1)}</td>
      <td>${gradeStr}</td>
      <td>${((b.field_completeness || 0) * 100).toFixed(0)}%</td>
      <td>${(b.created_at || "").slice(0, 10)}</td>
    </tr>`;
  }).join("");

  let changeHtml = "";
  if (comparison.count_change !== undefined) {
    const sign = comparison.count_change >= 0 ? "+" : "";
    changeHtml = `<div class="compare-change">
      最新批次 vs 上一批次：
      <span class="${comparison.count_change >= 0 ? 'text-green' : 'text-red'}">${sign}${comparison.count_change} 人</span>
      ${comparison.avg_score_change != null ? `| 均分: <span class="${comparison.avg_score_change >= 0 ? 'text-green' : 'text-red'}">${comparison.avg_score_change >= 0 ? '+' : ''}${comparison.avg_score_change.toFixed(1)}</span>` : ""}
    </div>`;
  }

  return `
    ${renderPageHeader("page.import.title", "批次对比")}
    <div class="compare-section">
      ${changeHtml}
      <table class="compare-table">
        <thead><tr>
          <th>${t("compare.batch")}</th><th>${t("compare.source")}</th><th>${t("common.creators")}</th><th>${t("compare.avg_score")}</th><th>${t("compare.grade_dist")}</th><th>${t("compare.field_completeness")}</th><th>${t("compare.created_at")}</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}
function renderPlaceholderPage(root, textKey) {
  root.innerHTML = `
    ${renderPageHeader("page.placeholder.title", "page.placeholder.desc")}
    <div class="empty-state">
      <div>
        <h3>${t("page.placeholder.title")}</h3>
        <p>${t(textKey)}</p>
      </div>
    </div>
  `;
}

async function loadRulesPageData() {
  const [batches, runs, versions, disagreements] = await Promise.all([
    fetchJson("/api/v2/batches"),
    fetchJson("/api/v2/analysis-runs"),
    fetchJson("/api/v2/rule-versions"),
    fetchJson("/api/v2/review-disagreements")
  ]);
  state.rulesPage.data = {
    batches: batches.items || [],
    runs: runs.items || [],
    versions: versions.items || [],
    disagreements
  };
}

async function loadContactPageData() {
  const [summary, contacts, quotes] = await Promise.all([
    fetchJson("/api/v2/contact-summary"),
    fetchJson("/api/v2/contact-records"),
    fetchJson("/api/v2/quote-records")
  ]);
  state.contactPage.data = {
    summary,
    contacts: contacts.items || [],
    quotes: quotes.items || []
  };
}

async function loadReportPageData() {
  state.reportPage.data = await fetchJson("/api/v2/report-data");
}

async function exportReport() {
  const result = await fetchJson("/api/v2/export-report", { method: "POST" });
  state.reportPage.exportResult = result;
  state.reportPage.data = await fetchJson("/api/v2/report-data");
}

function renderRuleReplayList(items, emptyText) {
  if (!items?.length) {
    return `<div class="empty-state compact"><div><p>${escapeHtml(emptyText)}</p></div></div>`;
  }
  return items.map((item) => `<div class="record-sub">${escapeHtml(item)}</div>`).join("");
}

function renderKeyValueRows(entries, formatter = null) {
  if (!entries.length) {
    return `<div class="empty-state compact"><div><p>${escapeHtml(t("status.empty"))}</p></div></div>`;
  }
  return entries.map(([key, value]) => `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">${escapeHtml(formatter ? formatter(key) : key)}</div>
      </div>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `).join("");
}

function renderRulesPage() {
  const root = pageElements.rules;
  const data = state.rulesPage.data;
  if (!data) {
    root.innerHTML = `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div>`;
    return;
  }

  const currentVersion = data.versions[data.versions.length - 1] || {};
  const currentBatch = data.batches[data.batches.length - 1] || {};
  const latestRun = data.runs[data.runs.length - 1] || {};
  const disagreements = data.disagreements || {};
  const disagreementEntries = Object.entries(disagreements.disagreement_types || {}).sort((a, b) => b[1] - a[1]);
  const reasonTagEntries = Object.entries(disagreements.reason_tag_counts || {}).sort((a, b) => b[1] - a[1]);
  const recentLogs = disagreements.recent_reviews || [];

  root.innerHTML = `
    ${renderPageHeader("page.rules.title", "page.rules.desc", `
      <button class="button-secondary" id="rules-refresh">${t("button.refresh")}</button>
    `)}
    <div class="metric-grid">
      ${metricCard(t("rules.currentVersion"), currentVersion.rule_version || "-", currentVersion.name || "")}
      ${metricCard(t("rules.currentBatch"), currentBatch.name || currentBatch.batch_id || "-", formatNumber(currentBatch.creator_count || 0))}
      ${metricCard(t("rules.latestRun"), latestRun.run_id || "-", latestRun.compare_scope || "-")}
      ${metricCard(t("rules.totalReviews"), formatNumber(disagreements.total_reviews || 0))}
      ${metricCard(t("rules.alignedCount"), formatNumber(disagreements.aligned_count || 0), "", "positive")}
      ${metricCard(t("rules.disagreedCount"), formatNumber(disagreements.disagreed_count || 0), "", "warning")}
    </div>
    <div class="grid-12">
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("rules.ruleVersionList")}</h3><p>${t("rules.currentVersion")}</p></div></div>
        <div class="record-list">
          ${(data.versions || []).map((item) => `
            <div class="record-item">
              <div class="record-main">
                <div class="record-title">${escapeHtml(item.rule_version || "-")}</div>
                <div class="record-sub">${escapeHtml(item.note || item.name || "-")}</div>
              </div>
              ${badge("badge-grade-B", item.status || "active")}
            </div>
          `).join("")}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("rules.batchList")}</h3><p>${t("rules.currentBatch")}</p></div></div>
        <div class="record-list">
          ${(data.batches || []).map((item) => `
            <div class="record-item">
              <div class="record-main">
                <div class="record-title">${escapeHtml(item.name || item.batch_id || "-")}</div>
                <div class="record-sub">${escapeHtml(item.source_file || "-")}</div>
              </div>
              <strong>${escapeHtml(String(item.creator_count || 0))}</strong>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("rules.suggestions")}</h3><p>${t("panel.dataNote")}</p></div></div>
        <div class="mini-list">
          ${renderRuleReplayList(disagreements.rule_suggestions || [], t("rules.emptySuggestions"))}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("rules.disagreementTypes")}</h3><p>${t("rules.disagreedCount")}</p></div></div>
        <div class="record-list">${renderKeyValueRows(disagreementEntries)}</div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("rules.reasonTags")}</h3><p>${t("panel.manualRecent")}</p></div></div>
        <div class="record-list">${renderKeyValueRows(reasonTagEntries)}</div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${t("rules.latestRun")}</h3><p>${t("common.updated")}</p></div></div>
        <div class="mini-list">
          <div class="record-sub">${escapeHtml(latestRun.run_id || "-")}</div>
          <div class="record-sub">${escapeHtml(latestRun.rule_version || "-")}</div>
          <div class="record-sub">${escapeHtml(latestRun.input_file || "-")}</div>
        </div>
      </div>
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-head"><div><h3>${t("rules.recentLogs")}</h3><p>${t("common.updated")}</p></div></div>
        <div class="record-list">
          ${recentLogs.length ? recentLogs.map((item) => `
            <div class="record-item">
              <div class="record-main">
                <div class="record-title">#${escapeHtml(String(item.rank || "-"))} 路 ${escapeHtml(item.creator_name || item.creator_key || "-")}</div>
                <div class="record-sub">${escapeHtml(item.disagreement_type || "aligned")} 路 ${escapeHtml(item.created_at || "-")}</div>
              </div>
              <div class="badge-row">
                ${decisionBadge(item.ai_decision)}
                ${manualStatusBadge(item.manual_decision)}
              </div>
            </div>
          `).join("") : `<div class="empty-state"><div><p>${t("rules.emptyLogs")}</p></div></div>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById("rules-refresh")?.addEventListener("click", async () => {
    setStatus(t("status.loading"));
    try {
      await loadRulesPageData();
      renderRulesPage();
      setStatus("");
    } catch (error) {
      setStatus(`${t("status.apiError")}: ${error.message}`, true);
    }
  });
}

function reportUiText() {
  if (state.locale === "en") {
    return {
      title: "V2 Batch Report Export",
      desc: "Preview the current V2 batch summary and export Markdown or JSON report files.",
      overview: "Report Overview",
      screening: "Top Creator Summary",
      aiSummary: "AI Summary",
      review: "Manual Review & Disagreements",
      contact: "Contact & Quote Summary",
      shortlist: "Shortlisted Creators",
      files: "Generated Files",
      exportMd: "Export Markdown",
      exportJson: "Export JSON",
      empty: "No shortlisted creators yet",
      recent: "Latest export result"
    };
  }
  if (state.locale === "ko") {
    return {
      title: "V2 배치 보고서 내보내기",
      desc: "현재 V2 배치 요약을 미리 보고 Markdown 또는 JSON 보고서를 생성합니다.",
      overview: "보고서 개요",
      screening: "상위 크리에이터 요약",
      aiSummary: "AI 요약",
      review: "수동 검토 및 불일치",
      contact: "연락 및 견적 요약",
      shortlist: "후보 크리에이터",
      files: "생성 파일",
      exportMd: "Markdown 내보내기",
      exportJson: "JSON 내보내기",
      empty: "후보 크리에이터가 없습니다",
      recent: "최근 내보내기 결과"
    };
  }
  return {
    title: "V2 批次报告导出",
    desc: "预览当前 V2 批次汇总，并导出 Markdown / JSON 报告文件。",
    overview: "报告概览",
    screening: "达人筛选摘要",
    aiSummary: "AI 辅助分析摘要",
    review: "人工复核与分歧统计",
    contact: "联系与报价统计",
    shortlist: "候选达人清单",
    files: "生成文件",
    exportMd: "导出 Markdown",
    exportJson: "导出 JSON",
    empty: "暂无候选达人",
    recent: "最近导出结果"
  };
}

function contactStatusLabel(value) {
  const matched = CONTACT_STATUS_OPTIONS.find((item) => item.value === value);
  return matched ? localizedOptionLabel(matched) : (value || (state.locale === "en" ? "Not contacted" : state.locale === "ko" ? "미연락" : "未联系"));
}

function renderContactPage() {
  const root = pageElements.outreach;
  const data = state.contactPage.data;
  if (!data) {
    root.innerHTML = `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div>`;
    return;
  }

  const summary = data.summary || {};
  const contacts = data.contacts || [];
  const quotes = data.quotes || [];
  root.innerHTML = `
    ${renderPageHeader("page.placeholder.title", "page.placeholder.desc", `
      <button class="button-secondary" id="contact-refresh">${t("button.refresh")}</button>
    `).replace(t("page.placeholder.title"), state.locale === "en" ? "Contact Follow-up" : state.locale === "ko" ? "연락 추적" : "联系跟进").replace(t("page.placeholder.desc"), state.locale === "en" ? "Manual contact status and quote records only. No automation is involved." : state.locale === "ko" ? "자동화 없이 수동 연락 상태와 견적 기록만 관리합니다." : "仅管理人工联系状态与报价记录，不涉及自动触达。")}
    <div class="metric-grid">
      ${metricCard(state.locale === "en" ? "Contact Records" : state.locale === "ko" ? "연락记录" : "联系记录数", formatNumber(summary.total || 0))}
      ${metricCard(state.locale === "en" ? "Shortlisted" : state.locale === "ko" ? "후보 수" : "候选达人数量", formatNumber(summary.shortlisted_count || 0), "", "positive")}
      ${metricCard(state.locale === "en" ? "Quote Received" : state.locale === "ko" ? "견적 확보" : "已获取报价数量", formatNumber(summary.quote_received_count || 0))}
      ${metricCard(state.locale === "en" ? "Avg Platform Price" : state.locale === "ko" ? "평균 플랫폼가" : "平均平台参考报价", formatMoneyValue(summary.avg_platform_reference_price))}
      ${metricCard(state.locale === "en" ? "Avg Inquiry Price" : state.locale === "ko" ? "평균 문의가" : "平均询价报价", formatMoneyValue(summary.avg_inquiry_price))}
      ${metricCard(state.locale === "en" ? "Avg Final Price" : state.locale === "ko" ? "평균 최종가" : "平均最终报价", formatMoneyValue(summary.avg_final_price))}
    </div>
    <div class="grid-12">
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${state.locale === "en" ? "Status Counts" : state.locale === "ko" ? "상태 통계" : "联系状态统计"}</h3><p>${state.locale === "en" ? "Current contact progress" : state.locale === "ko" ? "현재 진행 상태" : "当前联系进度"}</p></div></div>
        <div class="record-list">
          ${renderKeyValueRows(Object.entries(summary.status_counts || {}).sort((a, b) => b[1] - a[1]), contactStatusLabel)}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${state.locale === "en" ? "Recent Contact Records" : state.locale === "ko" ? "최근 연락 기록" : "最近联系记录"}</h3><p>${t("common.updated")}</p></div></div>
        <div class="record-list">
          ${contacts.length ? contacts.slice(0, 8).map((item) => `
            <div class="record-item">
              <div class="record-main">
                <div class="record-title">#${escapeHtml(String(item.rank || "-"))} · ${escapeHtml(contactStatusLabel(item.contact_status))}</div>
                <div class="record-sub">${escapeHtml(item.contact_channel || "-")} · ${escapeHtml(item.owner || "-")}</div>
              </div>
              <strong>${escapeHtml(item.next_follow_up_at || "-")}</strong>
            </div>
          `).join("") : `<div class="empty-state"><div><p>${t("status.empty")}</p></div></div>`}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${state.locale === "en" ? "Recent Quote Records" : state.locale === "ko" ? "최근 견적 기록" : "最近报价记录"}</h3><p>${t("common.updated")}</p></div></div>
        <div class="record-list">
          ${quotes.length ? quotes.slice(0, 8).map((item) => `
            <div class="record-item">
              <div class="record-main">
                <div class="record-title">#${escapeHtml(String(item.rank || "-"))} · ${escapeHtml(item.currency || "CNY")}</div>
                <div class="record-sub">${escapeHtml(item.price_note || "-")}</div>
              </div>
              <strong>${escapeHtml(formatMoneyValue(item.final_price, item.currency || "CNY"))}</strong>
            </div>
          `).join("") : `<div class="empty-state"><div><p>${t("status.empty")}</p></div></div>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById("contact-refresh")?.addEventListener("click", async () => {
    setStatus(t("status.loading"));
    try {
      await loadContactPageData();
      renderContactPage();
      setStatus("");
    } catch (error) {
      setStatus(`${t("status.apiError")}: ${error.message}`, true);
    }
  });
}

function renderReportPage() {
  const root = pageElements.exports;
  const data = state.reportPage.data;
  const text = reportUiText();
  if (!data) {
    root.innerHTML = `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("status.noDataNote")}</p></div></div>`;
    return;
  }

  const summary = data.summary || {};
  const batch = data.batch || {};
  const analysisRun = data.analysis_run || {};
  const ruleVersion = data.rule_version || {};
  const manualReview = data.manual_review || {};
  const contactSummary = data.contact_summary || {};
  const aiSummary = data.ai_summary || {};
  const shortlisted = data.shortlisted_creators || [];
  const top10 = data.screening?.top10 || [];
  const exportResult = state.reportPage.exportResult;

  root.innerHTML = `
    ${renderPageHeader("page.placeholder.title", "page.placeholder.desc", `
      <button class="button-secondary" id="report-refresh">${t("button.refresh")}</button>
      <button class="button" id="report-export-md">${escapeHtml(text.exportMd)}</button>
      <button class="button-secondary" id="report-export-json">${escapeHtml(text.exportJson)}</button>
    `).replace(t("page.placeholder.title"), text.title).replace(t("page.placeholder.desc"), text.desc)}
    <div class="metric-grid">
      ${metricCard(batch.name || batch.batch_id || "-", ruleVersion.rule_version || "-", text.overview)}
      ${metricCard(state.locale === "en" ? "Creators" : state.locale === "ko" ? "크리에이터 수" : "达人总数", formatNumber(summary.creator_count || 0))}
      ${metricCard(state.locale === "en" ? "Reviews" : state.locale === "ko" ? "검토 수" : "已复核数量", formatNumber(summary.review_count || 0))}
      ${metricCard(state.locale === "en" ? "Contacts" : state.locale === "ko" ? "연락 수" : "已联系数量", formatNumber(contactSummary.total || 0))}
      ${metricCard(state.locale === "en" ? "Quotes" : state.locale === "ko" ? "견적数" : "报价记录数", formatNumber(summary.quote_count || 0))}
      ${metricCard(state.locale === "en" ? "Shortlisted" : state.locale === "ko" ? "후보 수" : "候选达人数", formatNumber(summary.shortlisted_count || 0), "", "positive")}
    </div>
    <div class="grid-12">
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${escapeHtml(text.overview)}</h3><p>${escapeHtml(data.generated_at || "-")}</p></div></div>
        <div class="mini-list">
          <div class="record-sub">Batch: ${escapeHtml(batch.name || batch.batch_id || "-")}</div>
          <div class="record-sub">Run: ${escapeHtml(analysisRun.run_id || "-")}</div>
          <div class="record-sub">Rule: ${escapeHtml(ruleVersion.rule_version || "-")}</div>
          <div class="record-sub">Grade: ${escapeHtml(JSON.stringify(summary.grade_distribution || {}))}</div>
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${escapeHtml(text.screening)}</h3><p>Top 10</p></div></div>
        <div class="record-list">
          ${top10.length ? top10.slice(0, 10).map((item) => `
            <div class="record-item">
              <div class="record-main">
                <div class="record-title">#${escapeHtml(String(item.rank || "-"))} 路 ${escapeHtml(item.creator_name || "-")}</div>
                <div class="record-sub">${escapeHtml(item.grade_short || "-")}</div>
              </div>
              <strong>${escapeHtml(formatScore(item.score_final, 1))}</strong>
            </div>
          `).join("") : `<div class="empty-state compact"><div><p>${t("status.empty")}</p></div></div>`}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${escapeHtml(text.aiSummary)}</h3><p>${t("panel.dataNote")}</p></div></div>
        <div class="mini-list">
          ${renderRuleReplayList((aiSummary.top_reasons || []).slice(0, 5).map((item) => `${item.name} (${item.count})`), t("status.empty"))}
          ${renderRuleReplayList((aiSummary.top_risks || []).slice(0, 5).map((item) => `${item.name} (${item.count})`), t("status.empty"))}
          ${renderRuleReplayList((aiSummary.review_hints || []).slice(0, 5), t("status.empty"))}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${escapeHtml(text.review)}</h3><p>${escapeHtml(String(manualReview.total_reviews || 0))}</p></div></div>
        <div class="record-list">
          ${renderKeyValueRows(Object.entries(manualReview.disagreement_types || {}).sort((a, b) => b[1] - a[1]))}
        </div>
        <div class="mini-list" style="margin-top:12px;">
          ${renderRuleReplayList((manualReview.rule_suggestions || []).slice(0, 5), t("rules.emptySuggestions"))}
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${escapeHtml(text.contact)}</h3><p>${escapeHtml(String(contactSummary.total || 0))}</p></div></div>
        <div class="record-list">
          ${renderKeyValueRows(Object.entries(contactSummary.status_counts || {}).sort((a, b) => b[1] - a[1]), contactStatusLabel)}
        </div>
        <div class="mini-list" style="margin-top:12px;">
          <div class="record-sub">Avg Platform: ${escapeHtml(formatMoneyValue(contactSummary.avg_platform_reference_price))}</div>
          <div class="record-sub">Avg Inquiry: ${escapeHtml(formatMoneyValue(contactSummary.avg_inquiry_price))}</div>
          <div class="record-sub">Avg Final: ${escapeHtml(formatMoneyValue(contactSummary.avg_final_price))}</div>
        </div>
      </div>
      <div class="panel" style="grid-column: span 4;">
        <div class="panel-head"><div><h3>${escapeHtml(text.files)}</h3><p>${escapeHtml(text.recent)}</p></div></div>
        <div class="mini-list">
          <div class="record-sub">Markdown: ${escapeHtml(exportResult?.files?.markdown || "-")}</div>
          <div class="record-sub">JSON: ${escapeHtml(exportResult?.files?.json || "-")}</div>
        </div>
      </div>
      <div class="panel" style="grid-column: span 12;">
        <div class="panel-head"><div><h3>${escapeHtml(text.shortlist)}</h3><p>${escapeHtml(String(shortlisted.length))}</p></div></div>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>${t("table.rank")}</th>
                <th>${t("table.nickname")}</th>
                <th>${t("table.grade")}</th>
                <th>${state.locale === "en" ? "Manual" : state.locale === "ko" ? "수동 판단" : "人工判断"}</th>
                <th>${state.locale === "en" ? "Contact" : state.locale === "ko" ? "연락状态" : "联系状态"}</th>
                <th>${state.locale === "en" ? "Final Price" : state.locale === "ko" ? "최종 견적" : "最终报价"}</th>
                <th>${state.locale === "en" ? "Note" : state.locale === "ko" ? "备注" : "备注"}</th>
              </tr>
            </thead>
            <tbody>
              ${shortlisted.length ? shortlisted.map((item) => `
                <tr>
                  <td>${escapeHtml(String(item.rank || "-"))}</td>
                  <td>${escapeHtml(item.creator_name || "-")}</td>
                  <td>${escapeHtml(item.recommend_grade || "-")}</td>
                  <td>${escapeHtml(item.manual_decision || "-")}</td>
                  <td>${escapeHtml(contactStatusLabel(item.contact_status || "not_contacted"))}</td>
                  <td>${escapeHtml(formatMoneyValue(item.final_price, item.currency || "CNY"))}</td>
                  <td>${escapeHtml(item.note || "-")}</td>
                </tr>
              `).join("") : `<tr><td colspan="7"><div class="empty-state compact"><div><p>${escapeHtml(text.empty)}</p></div></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("report-refresh")?.addEventListener("click", async () => {
    setStatus(t("status.loading"));
    try {
      await loadReportPageData();
      renderReportPage();
      setStatus("");
    } catch (error) {
      setStatus(`${t("status.apiError")}: ${error.message}`, true);
    }
  });

  const bindExport = (id) => {
    document.getElementById(id)?.addEventListener("click", async () => {
      setStatus(t("status.loading"));
      try {
        await exportReport();
        renderReportPage();
        setStatus(state.locale === "en" ? "Report exported" : state.locale === "ko" ? "보고서를 생성했습니다" : "报告已导出");
      } catch (error) {
        setStatus(`${t("status.apiError")}: ${error.message}`, true);
      }
    });
  };
  bindExport("report-export-md");
  bindExport("report-export-json");
}

function renderCurrentPage() {
  setActivePage(state.page);
  if (state.page === "overview") renderOverviewPage();
  if (state.page === "creators") renderCreatorsPage();
  if (state.page === "ai") renderAiPage();
  if (state.page === "import") renderImportPage();
  if (state.page === "batch-compare") renderBatchComparePage();
  if (state.page === "outreach") renderContactPage();
  if (state.page === "exports") renderReportPage();
  if (state.page === "rules") renderRulesPage();
  if (state.page === "groups") renderGroupsPage();
  if (state.page === "group-detail") renderGroupDetailPage();
  lucide.createIcons();
}

function createChart(id, option) {
  const element = document.getElementById(id);
  if (!element || !window.echarts) return;
  if (state.charts[id]) state.charts[id].dispose();
  const chart = echarts.init(element, null, { renderer: "canvas" });
  chart.setOption(option);
  state.charts[id] = chart;
}

function disposeCharts() {
  Object.values(state.charts).forEach((chart) => chart?.dispose?.());
  state.charts = {};
}

async function refreshDashboardOnly() {
  setStatus(t("status.loading"));
  state.dashboard = await fetchJson("/api/dashboard");
  syncTopbarContext();
  if (state.page === "outreach") await loadContactPageData();
  if (state.page === "exports") await loadReportPageData();
  if (state.page === "rules") await loadRulesPageData();
  renderCurrentPage();
  updateLocaleUi();
  if (state.page === "ai") await loadAiPageData();
  if (state.page === "creators") await loadCreatorsData();
  setStatus("");
}

async function runAiGeneration() {
  const button = document.getElementById("ai-run-btn");
  if (button) {
    button.disabled = true;
    button.textContent = t("button.running");
  }
  try {
    await fetchJson("/api/ai/run?limit=50&force_refresh=true", { method: "POST" });
    await Promise.all([refreshDashboardOnly(), loadAiPageData(), loadCreatorsData()]);
  } catch (error) {
    setStatus(`${t("status.apiError")}: ${error.message}`, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = t("button.runAi");
    }
  }
}

async function openDetail(rank) {
  setStatus(t("status.loading"));
  try {
    state.drawer.detail = await fetchJson(`/api/creator/${rank}`);
    const drawerRank = state.drawer.detail.rank || state.drawer.detail["序号"] || "";
    fetchJson(`/api/v2/creators/${drawerRank}/ai-history`).then(resp => {
      if (resp && resp.versions) state.aiVersionCache[drawerRank] = resp.versions;
    }).catch(() => {});
    state.drawer.tab = "overview";
    state.drawer.open = true;
    state.drawer.saving = false;
    state.drawer.translations = {};
    state.drawer.translationLoading = false;
    state.drawer.showOriginal = false;
    state.drawer.latestSavedDecision = state.drawer.detail.manual_review?.decision || "pending";
    state.drawer.latestReasonTags = Array.isArray(state.drawer.detail.manual_review?.reason_tags)
      ? [...state.drawer.detail.manual_review.reason_tags]
      : [];
    renderDrawer();
    if (state.locale !== "zh-CN" && state.drawer.detail.ai_recommendation) {
      await ensureDrawerTranslation(state.locale);
    }
    setStatus("");
  } catch (error) {
    setStatus(`${t("status.apiError")}: ${error.message}`, true);
  }
}

function closeDrawer() {
  state.drawer.open = false;
  state.drawer.detail = null;
  document.getElementById("detail-drawer").classList.remove("is-open");
  document.getElementById("detail-drawer").setAttribute("aria-hidden", "true");
  document.getElementById("drawer-overlay").classList.add("hidden");
}

async function ensureDrawerTranslation(locale) {
  const detail = state.drawer.detail;
  if (!detail?.ai_recommendation || locale === "zh-CN") return;
  if (state.drawer.translations[locale]) return;
  state.drawer.translationLoading = true;
  renderDrawer();
  try {
    const translation = await fetchJson("/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank: detail.rank, target_language: locale })
    });
    state.drawer.translations[locale] = translation;
  } catch (error) {
    state.drawer.translations[locale] = {
      language: locale,
      translated: false,
      used_original: true,
      cache_status: "failed_original",
      payload: {
        summary: detail.ai_recommendation.summary || "",
        reasons: detail.ai_recommendation.reasons || [],
        risks: detail.ai_recommendation.risks || [],
        collab_suggestions: detail.ai_recommendation.collab_suggestions || [],
        review_hint: detail.ai_recommendation.review_hint || "",
        conflict_reason: detail.ai_recommendation.conflict_reason || ""
      },
      original: {
        summary: detail.ai_recommendation.summary || "",
        reasons: detail.ai_recommendation.reasons || [],
        risks: detail.ai_recommendation.risks || [],
        collab_suggestions: detail.ai_recommendation.collab_suggestions || [],
        review_hint: detail.ai_recommendation.review_hint || "",
        conflict_reason: detail.ai_recommendation.conflict_reason || ""
      },
      meta: {
        decision: detail.ai_recommendation.ai_decision,
        status: detail.ai_recommendation.status,
        alignment_level: detail.ai_recommendation.alignment_level
      }
    };
  } finally {
    state.drawer.translationLoading = false;
    renderDrawer();
  }
}

function renderDrawer() {
  const overlay = document.getElementById("drawer-overlay");
  const drawer = document.getElementById("detail-drawer");
  const tabs = document.getElementById("drawer-tabs");
  const body = document.getElementById("drawer-body");
  const detail = state.drawer.detail;
  if (!detail) return;

  document.getElementById("drawer-name").textContent = detail["昵称"] || "-";
  overlay.classList.remove("hidden");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");

  const tabsList = ["overview", "scoring", "ai", "manual", "contact"];
  tabs.innerHTML = tabsList.map((tab) => `
    <button class="drawer-tab ${state.drawer.tab === tab ? "is-active" : ""}" data-drawer-tab="${tab}">${tab === "contact" ? (state.locale === "en" ? "Contact & Quote" : state.locale === "ko" ? "연락 및 견적" : "联系与报价") : t(`drawer.tab.${tab}`)}</button>
  `).join("");

  if (state.drawer.tab === "overview") body.innerHTML = renderDrawerOverview(detail);
  if (state.drawer.tab === "scoring") body.innerHTML = renderDrawerScoring(detail);
  if (state.drawer.tab === "ai") body.innerHTML = renderDrawerAi(detail);
  if (state.drawer.tab === "manual") body.innerHTML = renderDrawerManual(detail);
  if (state.drawer.tab === "contact") body.innerHTML = renderDrawerContact(detail);

  tabs.querySelectorAll("[data-drawer-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.drawer.tab = button.dataset.drawerTab;
      renderDrawer();
      if (state.drawer.tab === "ai" && state.locale !== "zh-CN") await ensureDrawerTranslation(state.locale);
    });
  });

  if (state.drawer.tab === "manual") bindManualReview(detail);
  if (state.drawer.tab === "contact") bindDrawerContact(detail);
  if (state.drawer.tab === "scoring") renderDrawerCharts(detail);
  if (state.drawer.tab === "ai") bindDrawerAiActions(detail);
  lucide.createIcons();
}

function renderDrawerOverview(detail) {
  return `
    <div class="drawer-section">
      <div class="badge-row" style="margin-bottom: 12px;">
        ${gradeBadge(detail.grade_short)}
        ${sourceBadge(detail.ai_status)}
        ${decisionBadge(detail.ai_decision)}
        ${alignmentBadge(detail.ai_alignment_level)}
        ${manualStatusBadge(detail.manual_status)}
      </div>
      <div class="drawer-grid">
        ${drawerItem(t("table.platform"), t("common.platform.xhs"))}
        ${drawerItem(t("table.country"), localizeRegionLabel(detail.region_display || detail.country_label, detail.country_label))}
        ${drawerItem(t("table.score"), formatScore(detail.score_final))}
        ${drawerItem(t("table.fans"), formatFollowers(detail["粉丝数"]))}
        ${drawerItem(t("table.price"), formatPrice(detail["全部报价"]))}
        ${drawerItem(t("table.er"), formatPercentText(detail["合作笔记ER"]))}
        ${drawerItem(t("drawer.identity"), detail.creator_key || detail.userId || "-")}
        ${drawerItem(t("drawer.profile"), detail["小红书号"] || "-")}
      </div>
    </div>
    <div class="drawer-section">
      <h3>${t("drawer.hitKeywords")}</h3>
      <div class="keyword-list">
        ${keywordsToBadges(detail.hit_content_keywords)}
        ${keywordsToBadges(detail.hit_korea_keywords)}
        ${keywordsToBadges(detail.hit_brand_keywords)}
      </div>
    </div>
    <div class="drawer-section">
      <h3>${t("drawer.riskReasons")}</h3>
      <div class="keyword-list">${keywordsToBadges(detail.risk_reasons, "badge-manual-reject")}</div>
    </div>
    <div class="drawer-section">
      <h3>${t("drawer.termSource")}</h3>
      <div class="drawer-note">${t(detail.rule_note_key || "drawer.ruleNote")}</div>
    </div>
  `;
}

function renderDrawerScoring(detail) {
  const weights = detail.weights || {};
  const weightItems = Object.entries(weights).map(([key, value]) => {
    const labelKey = `dimension.${key}`;
    const label = t(labelKey);
    return drawerItem(label, `${Number(value * 100).toFixed(0)}%`, t("tooltip.weightCode", { code: key }));
  }).join("");

  return `
    <div class="drawer-section">
      <h3>${t("drawer.weights")}</h3>
      <div class="drawer-grid">
        ${weightItems}
        ${drawerItem(t("dimension.risk_deduction"), formatScore(detail.score_risk_deduction || 0), t("tooltip.weightCode", { code: "score_risk_deduction" }))}
      </div>
    </div>
    <div class="drawer-section">
      <h3>${t("panel.drawerScoring")}</h3>
      <div class="score-bars">
        ${(detail.score_dimensions || []).map((item) => `
          <div class="score-row">
            <span title="${escapeHtml(t("tooltip.weightCode", { code: item.key }))}">${escapeHtml(t(item.label) || t(`dimension.${item.key.replace("score_", "")}`))}</span>
            <div class="score-track"><div class="score-fill" style="width:${Math.max(2, Number(item.value || 0))}%;"></div></div>
            <strong>${formatScore(item.value)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="drawer-chart" id="drawer-radar-chart"></div>
      <div class="drawer-note" style="margin-top:12px;">${t("drawer.scoreFormula")}: ${formatScore(detail.score_final)} / ${t("dimension.risk_deduction")} ${formatScore(detail.score_risk_deduction || 0)}</div>
    </div>
    <div class="drawer-section">
      <h3>${t("drawer.hitKeywords")}</h3>
      <div class="keyword-list">${keywordsToBadges(detail.hit_content_keywords)}${keywordsToBadges(detail.hit_korea_keywords)}${keywordsToBadges(detail.hit_brand_keywords)}</div>
    </div>
    <div class="drawer-section">
      <h3>${t("drawer.riskReasons")}</h3>
      <div class="keyword-list">${keywordsToBadges(detail.risk_reasons, "badge-manual-reject")}</div>
    </div>
  `;
}

function currentAiText(detail) {
  const ai = detail.ai_recommendation;
  if (!ai) return null;
  if (state.locale === "zh-CN") {
    return {
      translated: false,
      used_original: true,
      cache_status: "original",
      payload: {
        summary: ai.summary || "",
        reasons: ai.reasons || [],
        risks: ai.risks || [],
        collab_suggestions: ai.collab_suggestions || [],
        review_hint: ai.review_hint || "",
        conflict_reason: ai.conflict_reason || ""
      },
      original: {
        summary: ai.summary || "",
        reasons: ai.reasons || [],
        risks: ai.risks || [],
        collab_suggestions: ai.collab_suggestions || [],
        review_hint: ai.review_hint || "",
        conflict_reason: ai.conflict_reason || ""
      }
    };
  }
  return state.drawer.translations[state.locale] || null;
}

function renderDrawerAi(detail) {
  const ai = detail.ai_recommendation;
  const rank = detail.rank || detail["序号"] || "";
  const cachedVersions = state.aiVersionCache[rank];

  // --- version toolbar ---
  let versionToolbar = "";
  const versions = cachedVersions || (ai ? [{version: ai.version || 1, created_at: ai.created_at || "", ai_decision: ai.ai_decision || "", summary: (ai.summary || "").slice(0, 60)}] : []);
  if (versions.length > 0) {
    versionToolbar = `<div class="ai-version-toolbar">
      <div class="ai-version-selector">
        <label>${t("ai.versionLabel")}:</label>
        <select id="ai-version-select">${versions.map(v => `<option value="${v.version}" ${v.version === ai?.version || v.version === (ai?.current_version || 1) ? "selected" : ""}>v${v.version} ${v.created_at ? v.created_at.slice(0,16).replace("T"," ") : ""} - ${v.ai_decision || ""}</option>`).join("")}</select>
      </div>
      <button class="button-secondary btn-reanalyze" id="btn-reanalyze-ai" data-rank="${rank}">${t("ai.reanalyze")}</button>
    </div>`;
  }

  if (!ai) {
    // for creators with no AI record, still show reanalyze button
    const hasScores = detail.score_final != null && detail.score_final !== undefined;
    versionToolbar = hasScores ? `<div class="ai-version-toolbar"><div class="ai-version-selector"></div><button class="button-secondary btn-reanalyze" id="btn-reanalyze-ai" data-rank="${rank}">${t("ai.reanalyze")}</button></div>` : "";
    if (hasScores) {
      return versionToolbar + `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("drawer.aiUnavailable")}</p></div></div>`;
    }
    return `<div class="empty-state"><div><h3>${t("status.empty")}</h3><p>${t("drawer.aiUnavailable")}</p></div></div>`;
  }

  const localizedText = currentAiText(detail);
  const payload = localizedText?.payload || {
    summary: ai.summary || "",
    reasons: ai.reasons || [],
    risks: ai.risks || [],
    collab_suggestions: ai.collab_suggestions || [],
    review_hint: ai.review_hint || "",
    conflict_reason: ai.conflict_reason || ""
  };
  const original = localizedText?.original || payload;
  const sourceNote = t(`source.${ai.status || "pending"}`);
  const translationNotice = state.locale !== "zh-CN"
    ? (state.drawer.translationLoading
      ? `<div class="drawer-note">${t("status.translationLoading")}</div>`
      : localizedText?.translated
        ? `<div class="drawer-note">${t("drawer.translationNote")}</div>`
        : `<div class="drawer-note">${ai.status === "fallback" ? t("status.translationFallback") : t("status.notTranslated")}</div>`)
    : "";

  return versionToolbar + `
    <div class="drawer-section">
      <div class="badge-row" style="margin-bottom: 12px;">
        ${decisionBadge(ai.ai_decision)}
        ${sourceBadge(ai.status)}
        ${alignmentBadge(ai.alignment_level)}
      </div>
      <div class="drawer-grid">
        ${drawerItem(t("drawer.aiSource"), sourceNote)}
        ${drawerItem(t("table.grade"), detail.recommend_grade || detail.grade_short || "-")}
      </div>
      <div class="drawer-note" style="margin-top:12px;">${escapeHtml(payload.summary || "-")}</div>
      <div class="note-box" style="margin-top:12px;">${t("drawer.ruleNote")}</div>
      <div style="margin-top:12px;">${translationNotice}</div>
      ${state.locale !== "zh-CN" ? `<div class="page-actions" style="margin-top:12px;"><button class="button-secondary" id="toggle-original-btn">${t(state.drawer.showOriginal ? "button.hideOriginal" : "button.viewOriginal")}</button></div>` : ""}
    </div>
    <div class="drawer-section">
      <h3>${t("decision.recommend")} / ${t("decision.cautious")} / ${t("decision.reject")}</h3>
      <div class="keyword-list">${(payload.reasons || []).length ? payload.reasons.map((item) => badge("badge-ai-success", item)).join("") : `<span class="helper-text">-</span>`}</div>
    </div>
    <div class="drawer-section">
      <h3>${t("drawer.riskReasons")}</h3>
      <div class="keyword-list">${(payload.risks || []).length ? payload.risks.map((item) => badge("badge-manual-reject", item)).join("") : `<span class="helper-text">-</span>`}</div>
    </div>
    <div class="drawer-section">
      <h3>${t("panel.dataNote")}</h3>
      <div class="keyword-list">${(payload.collab_suggestions || []).length ? payload.collab_suggestions.map((item) => badge("badge-grade-B", item)).join("") : `<span class="helper-text">-</span>`}</div>
      <div class="note-box" style="margin-top:12px;">${escapeHtml(payload.conflict_reason || t("alignment.unknown"))}</div>
      <div class="drawer-note" style="margin-top:12px;">${escapeHtml(payload.review_hint || "")}</div>
    </div>
    ${state.locale !== "zh-CN" && state.drawer.showOriginal ? `
      <div class="drawer-section">
        <h3>${t("drawer.original")}</h3>
        <div class="drawer-note">${escapeHtml(original.summary || "-")}</div>
        <div class="keyword-list" style="margin-top:12px;">${(original.reasons || []).map((item) => badge("badge-ai-success", item)).join("")}</div>
        <div class="keyword-list" style="margin-top:12px;">${(original.risks || []).map((item) => badge("badge-manual-reject", item)).join("")}</div>
        <div class="keyword-list" style="margin-top:12px;">${(original.collab_suggestions || []).map((item) => badge("badge-grade-B", item)).join("")}</div>
      </div>
    ` : ""}
  `;
}

function bindDrawerAiActions(detail) {
  document.getElementById("toggle-original-btn")?.addEventListener("click", () => {
    state.drawer.showOriginal = !state.drawer.showOriginal;
    renderDrawer();
  });
  document.getElementById("retry-translate-btn")?.addEventListener("click", async () => {
    state.drawer.translations[state.locale] = null;
    await ensureDrawerTranslation(state.locale);
  });

  // version selector
  document.getElementById("ai-version-select")?.addEventListener("change", async (e) => {
    const version = parseInt(e.target.value);
    const rank = detail.rank || "";
    const resp = await fetchJson(`/api/v2/creators/${rank}/ai-history/${version}`);
    if (resp && resp.result) {
      // Temporarily mutate detail.ai_recommendation for re-render
      detail.ai_recommendation = {...detail.ai_recommendation, ...resp.result, version: version};
      renderDrawer();
    }
  });

  // reanalyze button
  document.getElementById("btn-reanalyze-ai")?.addEventListener("click", async (e) => {
    const btn = e.target;
    const rank = btn.dataset.rank || detail.rank || "";
    btn.disabled = true;
    btn.textContent = t("ai.reanalyzing");
    try {
      const resp = await fetchJson(`/api/v2/creators/${rank}/reanalyze`, {method: "POST"});
      if (resp && resp.ok) {
        detail.ai_recommendation = {...resp.result, version: resp.version};
        // reload versions
        const historyResp = await fetchJson(`/api/v2/creators/${rank}/ai-history`);
        if (historyResp && historyResp.versions) {
          state.aiVersionCache[rank] = historyResp.versions;
        }
        renderDrawer();
      }
    } catch (err) {
      console.error("Reanalyze error:", err);
    } finally {
      btn.disabled = false;
      btn.textContent = t("ai.reanalyze");
    }
  });
}

function renderDrawerManual(detail) {
  const review = detail.manual_review || {};
  const activeDecision = state.drawer.latestSavedDecision || review.decision || "pending";
  const activeReasonTags = Array.isArray(state.drawer.latestReasonTags)
    ? state.drawer.latestReasonTags
    : (Array.isArray(review.reason_tags) ? review.reason_tags : []);
  return `
    <div class="drawer-section">
      <h3>${t("drawer.tab.manual")}</h3>
      <div class="review-actions">
        ${["recommend", "cautious", "reject", "reviewed"].map((decision) => `
          <button class="review-btn ${activeDecision === decision ? "is-active" : ""}" data-review-decision="${decision}">
            ${t(`manual.${decision}`)}
          </button>
        `).join("")}
      </div>
      <div class="field">
        <label>复核原因标签 / Review Reason Tags</label>
        <div class="review-actions">
          ${REVIEW_REASON_TAGS.map((item) => `
            <button
              type="button"
              class="review-btn ${activeReasonTags.includes(item.value) ? "is-active" : ""}"
              data-reason-tag="${escapeHtml(item.value)}"
            >
              ${escapeHtml(reasonTagLabel(item))}
            </button>
          `).join("")}
        </div>
        <div class="helper-text">可多选；不选时保存空数组。 / Multiple choice; saves an empty array when none are selected.</div>
      </div>
      <div class="field">
        <label for="drawer-manual-note">${t("drawer.manualNote")}</label>
        <textarea id="drawer-manual-note">${escapeHtml(review.note || detail.manual_note_safe || "")}</textarea>
      </div>
      <div class="page-actions" style="margin-top:12px;">
        <button class="button" id="drawer-save-review" ${state.drawer.saving ? "disabled" : ""}>${state.drawer.saving ? t("button.running") : t("button.save")}</button>
      </div>
      <div class="drawer-note" style="margin-top:10px;">${t("drawer.manualHint")}</div>
      <div class="helper-text" id="drawer-save-status">${review.updated_at ? `${t("common.updated")}: ${formatDateTime(review.updated_at)}` : ""}</div>
    </div>
  `;
}

function renderDrawerContact(detail) {
  const contact = detail.contact_record || {};
  const quote = detail.quote_record || {};
  const contactStatus = contact.contact_status || "not_contacted";
  const contactChannel = contact.contact_channel || "";
  const owner = contact.owner || "";
  const contactNote = contact.contact_note || "";
  const nextFollowUpAt = contact.next_follow_up_at || "";
  const isShortlisted = Boolean(contact.is_shortlisted);
  const platformReferencePrice = quote.platform_reference_price ?? "";
  const inquiryPrice = quote.inquiry_price ?? "";
  const finalPrice = quote.final_price ?? "";
  const currency = quote.currency || "CNY";
  const priceNote = quote.price_note || "";

  return `
    <div class="drawer-section">
      <h3>${state.locale === "en" ? "Contact Tracking" : state.locale === "ko" ? "연락 추적" : "联系跟进"}</h3>
      <div class="drawer-grid">
        <div class="field">
          <label>${state.locale === "en" ? "Contact Status" : state.locale === "ko" ? "연락 상태" : "联系状态"}</label>
          <select id="drawer-contact-status">
            ${CONTACT_STATUS_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === contactStatus ? "selected" : ""}>${escapeHtml(localizedOptionLabel(item))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>${state.locale === "en" ? "Contact Channel" : state.locale === "ko" ? "연락 채널" : "联系渠道"}</label>
          <select id="drawer-contact-channel">
            ${CONTACT_CHANNEL_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === contactChannel ? "selected" : ""}>${escapeHtml(localizedOptionLabel(item))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>${state.locale === "en" ? "Owner" : state.locale === "ko" ? "담당자" : "联系人/负责人"}</label>
          <input id="drawer-contact-owner" value="${escapeHtml(owner)}" />
        </div>
        <div class="field">
          <label>${state.locale === "en" ? "Next Follow-up" : state.locale === "ko" ? "다음 후속일" : "下次跟进时间"}</label>
          <input id="drawer-next-follow-up-at" type="date" value="${escapeHtml(nextFollowUpAt)}" />
        </div>
      </div>
      <div class="field" style="margin-top:12px;">
        <label>${state.locale === "en" ? "Contact Note" : state.locale === "ko" ? "연락 메모" : "联系备注"}</label>
        <textarea id="drawer-contact-note">${escapeHtml(contactNote)}</textarea>
      </div>
      <div class="field" style="margin-top:12px;">
        <label for="drawer-is-shortlisted">${state.locale === "en" ? "Add to shortlist" : state.locale === "ko" ? "후보 풀 편입" : "是否进入候选合作池"}</label>
        <input id="drawer-is-shortlisted" type="checkbox" ${isShortlisted ? "checked" : ""} style="width:auto; min-height:auto; padding:0; accent-color:#38BDF8;" />
      </div>
    </div>
    <div class="drawer-section">
      <h3>${state.locale === "en" ? "Quote Record" : state.locale === "ko" ? "견적 기록" : "报价记录"}</h3>
      <div class="drawer-grid">
        <div class="field">
          <label>${state.locale === "en" ? "Platform Reference Price" : state.locale === "ko" ? "플랫폼 참고가" : "平台参考报价"}</label>
          <input id="drawer-platform-reference-price" type="number" step="0.01" value="${escapeHtml(platformReferencePrice)}" />
        </div>
        <div class="field">
          <label>${state.locale === "en" ? "Inquiry Price" : state.locale === "ko" ? "최초 문의가" : "首次询价报价"}</label>
          <input id="drawer-inquiry-price" type="number" step="0.01" value="${escapeHtml(inquiryPrice)}" />
        </div>
        <div class="field">
          <label>${state.locale === "en" ? "Final Price" : state.locale === "ko" ? "최종가" : "最终报价"}</label>
          <input id="drawer-final-price" type="number" step="0.01" value="${escapeHtml(finalPrice)}" />
        </div>
        <div class="field">
          <label>${state.locale === "en" ? "Currency" : state.locale === "ko" ? "통화" : "报价币种"}</label>
          <select id="drawer-quote-currency">
            ${CURRENCY_OPTIONS.map((item) => `<option value="${item}" ${item === currency ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field" style="margin-top:12px;">
        <label>${state.locale === "en" ? "Quote Note" : state.locale === "ko" ? "견적 메모" : "报价备注"}</label>
        <textarea id="drawer-price-note">${escapeHtml(priceNote)}</textarea>
      </div>
      <div class="page-actions" style="margin-top:12px;">
        <button class="button" id="drawer-save-contact" ${state.drawer.saving ? "disabled" : ""}>${state.drawer.saving ? t("button.running") : (state.locale === "en" ? "Save Contact & Quote" : state.locale === "ko" ? "연락/견적 저장" : "保存联系与报价")}</button>
      </div>
      <div class="helper-text" id="drawer-contact-save-status">${contact.updated_at || quote.updated_at ? `${t("common.updated")}: ${formatDateTime(contact.updated_at || quote.updated_at)}` : ""}</div>
    </div>
  `;
}

function bindManualReview(detail) {
  document.querySelectorAll("[data-review-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      state.drawer.latestSavedDecision = button.dataset.reviewDecision;
      renderDrawer();
    });
  });
  document.querySelectorAll("[data-reason-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.reasonTag;
      const nextTags = Array.isArray(state.drawer.latestReasonTags) ? [...state.drawer.latestReasonTags] : [];
      const existingIndex = nextTags.indexOf(tag);
      if (existingIndex >= 0) {
        nextTags.splice(existingIndex, 1);
      } else {
        nextTags.push(tag);
      }
      state.drawer.latestReasonTags = nextTags;
      renderDrawer();
    });
  });
  document.getElementById("drawer-save-review")?.addEventListener("click", async () => {
    if (state.drawer.saving) return;
    state.drawer.saving = true;
    renderDrawer();
    try {
      const note = document.getElementById("drawer-manual-note")?.value || "";
      const reasonTags = Array.isArray(state.drawer.latestReasonTags) ? state.drawer.latestReasonTags : [];
      await fetchJson("/api/manual/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rank: detail.rank,
          decision: state.drawer.latestSavedDecision || "pending",
          note,
          reason_tags: reasonTags,
          updated_at: new Date().toISOString()
        })
      });
      state.drawer.detail = await fetchJson(`/api/creator/${detail.rank}`);
      state.drawer.latestSavedDecision = state.drawer.detail.manual_review?.decision || state.drawer.latestSavedDecision;
      state.drawer.latestReasonTags = Array.isArray(state.drawer.detail.manual_review?.reason_tags)
        ? [...state.drawer.detail.manual_review.reason_tags]
        : [];
      state.drawer.saving = false;
      renderDrawer();
      setStatus(t("drawer.saveSuccess"));
      await Promise.all([refreshDashboardOnly(), loadCreatorsData(), loadAiPageData()]);
    } catch (error) {
      state.drawer.saving = false;
      renderDrawer();
      setStatus(t("drawer.saveError"), true);
    }
  });
}

function bindDrawerContact(detail) {
  document.getElementById("drawer-save-contact")?.addEventListener("click", async () => {
    if (state.drawer.saving) return;
    state.drawer.saving = true;
    renderDrawer();
    try {
      const updatedAt = new Date().toISOString();
      const contactPayload = {
        creator_key: detail.creator_key || String(detail.rank),
        rank: detail.rank,
        contact_status: document.getElementById("drawer-contact-status")?.value || "not_contacted",
        contact_channel: document.getElementById("drawer-contact-channel")?.value || "",
        owner: document.getElementById("drawer-contact-owner")?.value || "",
        contact_note: document.getElementById("drawer-contact-note")?.value || "",
        next_follow_up_at: document.getElementById("drawer-next-follow-up-at")?.value || "",
        is_shortlisted: Boolean(document.getElementById("drawer-is-shortlisted")?.checked),
        updated_at: updatedAt
      };
      const quotePayload = {
        creator_key: detail.creator_key || String(detail.rank),
        rank: detail.rank,
        platform_reference_price: document.getElementById("drawer-platform-reference-price")?.value || "",
        inquiry_price: document.getElementById("drawer-inquiry-price")?.value || "",
        final_price: document.getElementById("drawer-final-price")?.value || "",
        currency: document.getElementById("drawer-quote-currency")?.value || "CNY",
        price_note: document.getElementById("drawer-price-note")?.value || "",
        updated_at: updatedAt
      };
      await Promise.all([
        fetchJson("/api/v2/contact-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactPayload)
        }),
        fetchJson("/api/v2/quote-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quotePayload)
        })
      ]);
      state.drawer.detail = await fetchJson(`/api/creator/${detail.rank}`);
      state.drawer.saving = false;
      renderDrawer();
      setStatus(state.locale === "en" ? "Contact and quote saved" : state.locale === "ko" ? "연락/견적 저장 완료" : "联系与报价已保存");
      await Promise.all([
        refreshDashboardOnly(),
        loadContactPageData()
      ]);
    } catch (error) {
      state.drawer.saving = false;
      renderDrawer();
      setStatus(state.locale === "en" ? "Failed to save contact and quote" : state.locale === "ko" ? "연락/견적 저장 실패" : "联系与报价保存失败", true);
    }
  });
}

function renderDrawerCharts(detail) {
  const dimensionLabels = (detail.score_dimensions || []).map((item) => {
    const labelKey = item.label;
    const dimensionKey = `dimension.${item.key.replace("score_", "")}`;
    return {
      name: t(labelKey) || t(dimensionKey),
      max: 100
    };
  });
  createChart("drawer-radar-chart", {
    radar: {
      indicator: dimensionLabels,
      splitArea: { areaStyle: { color: ["rgba(32,40,50,0.18)", "rgba(27,34,42,0.06)"] } },
      axisName: { color: "#9099A5" },
      splitLine: { lineStyle: { color: "#2B3540" } },
      axisLine: { lineStyle: { color: "#2B3540" } }
    },
    series: [{
      type: "radar",
      data: [{
        value: (detail.score_dimensions || []).map((item) => Number(item.value || 0)),
        areaStyle: { color: "rgba(56,189,248,0.18)" },
        lineStyle: { color: "#38BDF8" },
        itemStyle: { color: "#38BDF8" }
      }]
    }]
  });
}

function downloadFile(type) {
  window.open(`/api/download/${type}`, "_blank");
}

function bindSharedActions() {
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("drawer-overlay").addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawer.open) closeDrawer();
  });

  document.getElementById("sidebar-nav").addEventListener("click", async (event) => {
    const button = event.target.closest(".nav-item");
    if (!button) return;
    disposeCharts();
    setActivePage(button.dataset.page);
    if (button.dataset.page === "outreach") await loadContactPageData();
    if (button.dataset.page === "exports") await loadReportPageData();
    if (button.dataset.page === "rules") await loadRulesPageData();
    renderCurrentPage();
    updateLocaleUi();
    if (button.dataset.page === "creators") await loadCreatorsData();
    if (button.dataset.page === "ai") await loadAiPageData();
  });

  document.body.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-open-detail]");
    if (link) await openDetail(link.dataset.openDetail);
  });

  document.getElementById("lang-switch").addEventListener("click", async (event) => {
    const button = event.target.closest(".lang-btn");
    if (!button) return;
    state.locale = button.dataset.locale;
    localStorage.setItem("dashboard-locale", state.locale);
    updateLocaleUi();
    disposeCharts();
    renderCurrentPage();
    if (state.page === "creators" && !state.creators.data) await loadCreatorsData();
    if (state.page === "ai" && !state.aiPage.data) await loadAiPageData();
    if (state.page === "outreach" && !state.contactPage.data) await loadContactPageData();
    if (state.page === "exports" && !state.reportPage.data) await loadReportPageData();
    if (state.page === "rules" && !state.rulesPage.data) await loadRulesPageData();
    if (state.drawer.open) {
      renderDrawer();
      if (state.drawer.tab === "ai" && state.locale !== "zh-CN") await ensureDrawerTranslation(state.locale);
    }
  });

  document.getElementById("global-search").addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    state.creators.search = event.target.value.trim();
    state.creators.page = 1;
    disposeCharts();
    state.page = "creators";
    renderCurrentPage();
    updateLocaleUi();
    await loadCreatorsData();
  });
}

async function init() {
  await loadBootstrap();
  await loadBatches();
  await loadContactPageData();
  await loadReportPageData();
  await loadRulesPageData();
  bindSharedActions();
  renderCurrentPage();
  updateLocaleUi();

  // batch selector change
  document.getElementById("batch-selector")?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val) switchBatch(val);
  });

  // batch manager button
  document.getElementById("batch-manager-btn")?.addEventListener("click", () => {
    showBatchManager();
  });
}

window.__dashboardState = state;
window.__openDetail = openDetail;
window.__closeDetail = closeDrawer;
window.__renderCurrentPage = renderCurrentPage;
window.__ensureDrawerTranslation = ensureDrawerTranslation;

window.addEventListener("resize", () => {
  Object.values(state.charts).forEach((chart) => chart?.resize?.());
});

init().catch((error) => {
  setStatus(`${t("status.apiError")}: ${error.message}`, true);
});
