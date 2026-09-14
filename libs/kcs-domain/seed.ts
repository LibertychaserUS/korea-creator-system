import { freezeScore } from './score'
import type { CreatorRow, OverviewSnapshot } from './types'

const RULE_VERSION = 'kcs-seed-v1'
const RUN_ID = 'seed-pgy-fixture'

const rows: CreatorRow[] = [
  {
    creator: {
      creatorKey: 'xhs_park_seoul',
      nickname: '서울살림노트',
      xhsId: 'parkseoulnote',
      region: '서울',
      persona: '生活 / 家居',
      fans: 428000,
      keywords: ['韩国生活', '韩系家居', '首尔探店'],
    },
    score: freezeScore({
      creatorKey: 'xhs_park_seoul',
      final: 91.4,
      grade: 'S',
      rank: 1,
      dimensions: { screening: 23, keywords: 13, koreaBrand: 24, potential: 18, performance: 9, value: 4.4 },
      riskDeduction: 0,
      ruleVersion: RULE_VERSION,
    }),
    aiReview: {
      creatorKey: 'xhs_park_seoul',
      decision: 'recommend',
      source: 'fallback',
      alignment: 'unknown',
      reason: '韩国生活与家居词密、粉丝质量稳，适合品牌试水。',
      riskNote: '报价未核，先按中位合作。',
    },
    manualReview: { creatorKey: 'xhs_park_seoul', decision: null, note: '' },
  },
  {
    creator: {
      creatorKey: 'xhs_kim_beauty',
      nickname: '김눈빛',
      xhsId: 'kimnunbit',
      region: '부산',
      persona: '美妆 / 护肤',
      fans: 312000,
      keywords: ['韩妆', 'Olive Young', '敏感肌'],
    },
    score: freezeScore({
      creatorKey: 'xhs_kim_beauty',
      final: 86.2,
      grade: 'A',
      rank: 2,
      dimensions: { screening: 21, keywords: 14, koreaBrand: 22, potential: 16, performance: 8.2, value: 5 },
      riskDeduction: -2,
      ruleVersion: RULE_VERSION,
    }),
    aiReview: {
      creatorKey: 'xhs_kim_beauty',
      decision: 'cautious',
      source: 'fallback',
      alignment: 'unknown',
      reason: '美妆词准，但近期广告密度偏高。',
      riskNote: '先看一条联名再谈档期。',
    },
    manualReview: { creatorKey: 'xhs_kim_beauty', decision: 'pending', note: '等报价回函' },
  },
  {
    creator: {
      creatorKey: 'xhs_lee_food',
      nickname: '리식당일기',
      xhsId: 'leesikdang',
      region: '서울',
      persona: '美食 / 探店',
      fans: 198000,
      keywords: ['韩食', '弘大', '小酒馆'],
    },
    score: freezeScore({
      creatorKey: 'xhs_lee_food',
      final: 79.8,
      grade: 'A',
      rank: 3,
      dimensions: { screening: 18, keywords: 12, koreaBrand: 20, potential: 17, performance: 8, value: 4.8 },
      riskDeduction: 0,
      ruleVersion: RULE_VERSION,
    }),
    aiReview: {
      creatorKey: 'xhs_lee_food',
      decision: 'recommend',
      source: 'fallback',
      alignment: 'unknown',
      reason: '探店节奏清楚，适合餐饮或酒水试投放。',
      riskNote: '地域偏首尔西边，外地露出弱。',
    },
    manualReview: { creatorKey: 'xhs_lee_food', decision: null, note: '' },
  },
  {
    creator: {
      creatorKey: 'xhs_choi_travel',
      nickname: '최주말열차',
      xhsId: 'choiwkend',
      region: '강원',
      persona: '旅行 / 周末',
      fans: 156000,
      keywords: ['江原道', '周末旅行', '韩系穿搭'],
    },
    score: freezeScore({
      creatorKey: 'xhs_choi_travel',
      final: 71.5,
      grade: 'B',
      rank: 4,
      dimensions: { screening: 16, keywords: 10, koreaBrand: 18, potential: 15, performance: 7.5, value: 5 },
      riskDeduction: 0,
      ruleVersion: RULE_VERSION,
    }),
    aiReview: {
      creatorKey: 'xhs_choi_travel',
      decision: 'cautious',
      source: 'fallback',
      alignment: 'unknown',
      reason: '旅行内容稳，品牌词偏少。',
      riskNote: '更适合目的地合作，不是货盘达人。',
    },
    manualReview: { creatorKey: 'xhs_choi_travel', decision: null, note: '' },
  },
  {
    creator: {
      creatorKey: 'xhs_jung_fit',
      nickname: '정러닝클럽',
      xhsId: 'jungrunclub',
      region: '인천',
      persona: '运动 / 跑步',
      fans: 89000,
      keywords: ['跑步', '运动内衣', '汉江'],
    },
    score: freezeScore({
      creatorKey: 'xhs_jung_fit',
      final: 64.1,
      grade: 'B',
      rank: 5,
      dimensions: { screening: 14, keywords: 9, koreaBrand: 15, potential: 14, performance: 7.1, value: 5 },
      riskDeduction: 0,
      ruleVersion: RULE_VERSION,
    }),
    aiReview: {
      creatorKey: 'xhs_jung_fit',
      decision: 'recommend',
      source: 'fallback',
      alignment: 'unknown',
      reason: '垂直运动盘，试水成本低。',
      riskNote: '粉丝规模偏中腰。',
    },
    manualReview: { creatorKey: 'xhs_jung_fit', decision: null, note: '' },
  },
  {
    creator: {
      creatorKey: 'xhs_han_promo',
      nickname: '한딜폭탄',
      xhsId: 'handealbomb',
      region: '경기',
      persona: '带货 / 折扣',
      fans: 540000,
      keywords: ['折扣', '直播', '清仓'],
    },
    score: freezeScore({
      creatorKey: 'xhs_han_promo',
      final: 52.0,
      grade: 'C',
      rank: 6,
      dimensions: { screening: 10, keywords: 6, koreaBrand: 8, potential: 12, performance: 9, value: 7 },
      riskDeduction: -8,
      ruleVersion: RULE_VERSION,
    }),
    aiReview: {
      creatorKey: 'xhs_han_promo',
      decision: 'reject',
      source: 'fallback',
      alignment: 'unknown',
      reason: '折扣号，品牌调性冲突。',
      riskNote: '硬广痕迹重，不进第一轮试水。',
    },
    manualReview: { creatorKey: 'xhs_han_promo', decision: 'reject', note: '调性不合' },
  },
]

export function listCreatorRows(): CreatorRow[] {
  return rows.map(row => ({
    creator: { ...row.creator, keywords: [...row.creator.keywords] },
    score: freezeScore({ ...row.score, dimensions: { ...row.score.dimensions } }),
    aiReview: row.aiReview ? { ...row.aiReview } : null,
    manualReview: row.manualReview ? { ...row.manualReview } : null,
  }))
}

export function getOverview(): OverviewSnapshot {
  const list = listCreatorRows()
  const gradeMix = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  for (const row of list) {
    gradeMix[row.score.grade] += 1
  }
  return {
    runId: RUN_ID,
    ruleVersion: RULE_VERSION,
    creatorCount: list.length,
    reviewCount: list.filter(row => row.aiReview).length,
    recommendCount: list.filter(row => row.aiReview?.decision === 'recommend').length,
    cautiousCount: list.filter(row => row.aiReview?.decision === 'cautious').length,
    rejectCount: list.filter(row => row.aiReview?.decision === 'reject').length,
    gradeMix,
    top: list.slice(0, 3),
  }
}
