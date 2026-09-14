export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

export type AiDecision = 'recommend' | 'cautious' | 'reject'
export type AiSource = 'success' | 'fallback' | 'pending' | 'failed'
export type Alignment = 'hard_conflict' | 'soft_divergence' | 'consistent' | 'unknown'
export type ManualDecision = 'recommend' | 'reject' | 'pending' | 'reviewed'

export interface ScoreDimensions {
  screening: number
  keywords: number
  koreaBrand: number
  potential: number
  performance: number
  value: number
}

export interface Score {
  creatorKey: string
  final: number
  grade: Grade
  rank: number
  dimensions: ScoreDimensions
  riskDeduction: number
  ruleVersion: string
}

export interface Creator {
  creatorKey: string
  nickname: string
  xhsId: string
  region: string
  persona: string
  fans: number
  keywords: string[]
}

export interface AIReview {
  creatorKey: string
  decision: AiDecision
  source: AiSource
  alignment: Alignment
  reason: string
  riskNote: string
}

export interface ManualReview {
  creatorKey: string
  decision: ManualDecision | null
  note: string
}

export interface CreatorRow {
  creator: Creator
  score: Score
  aiReview: AIReview | null
  manualReview: ManualReview | null
}

export interface OverviewSnapshot {
  runId: string
  ruleVersion: string
  creatorCount: number
  reviewCount: number
  recommendCount: number
  cautiousCount: number
  rejectCount: number
  gradeMix: Record<Grade, number>
  top: CreatorRow[]
}
