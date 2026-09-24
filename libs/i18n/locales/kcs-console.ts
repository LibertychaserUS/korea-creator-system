/**
 * Copy for the ops console pages, storage card, shortlist and display notes.
 * Kept apart from the big locale files so other work on those files merges cleanly;
 * each locale spreads its part into `kcs`.
 */
const zhCN = {
  display: {
    quoteMissing: "{n} 位还没报价，未计入合计",
    trendBySource: "各来源分开画，口径不同不连成一条",
    platformBeyond: "小红书官方显示超过 {pct} 同类博主",
  },
}

const en = {
  display: {
    quoteMissing: "{n} without a quote, not counted",
    trendBySource: "One line per source; sources measure differently, so they are never joined",
    platformBeyond: "Xiaohongshu shows this is above {pct} of similar creators",
  },
}

const ko = {
  display: {
    quoteMissing: "견적 없는 {n}명은 합계에서 제외",
    trendBySource: "출처마다 기준이 달라 따로 그립니다",
    platformBeyond: "샤오홍슈 공식 기준 비슷한 크리에이터의 {pct}보다 높음",
  },
}

export const kcsConsoleCopy = { 'zh-CN': zhCN, en, ko }
