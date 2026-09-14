/**
 * CreatorMetrics — the canonical creator record after the transform layer.
 *
 * Every field maps to something a platform actually exposes (蒲公英 / 千瓜 /
 * 新红 / 星图 口径). We do not invent scores: derived fields are plain ratios,
 * and "how good" is always expressed as a percentile inside the same follower
 * tier (see percentile.ts). Null means the source did not provide it.
 */
import { percentileRank } from './percentile'

export type Platform = 'xhs'

/** Follower tiers, 千瓜 口径. */
export const CREATOR_TIERS = [
  { id: 'head', min: 500_000 },
  { id: 'mid', min: 50_000 },
  { id: 'junior', min: 5_000 },
  { id: 'amateur', min: 300 },
  { id: 'unknown', min: 0 },
] as const
export type CreatorTier = (typeof CREATOR_TIERS)[number]['id']

export function tierOf(followers: number | null | undefined): CreatorTier {
  const n = followers ?? 0
  for (const tier of CREATOR_TIERS) if (n >= tier.min) return tier.id
  return 'unknown'
}

/** 蒲公英 健康等级 (monthly). */
export type HealthGrade = 'excellent' | 'normal' | 'abnormal'

export type MetricWindow = 30 | 90

export type AudienceProfile = {
  femaleRatio: number | null
  ageBands: { band: string; ratio: number }[]
  topRegions: { name: string; ratio: number }[]
  interests: { name: string; ratio: number }[]
}

export type VendorIndex = { name: string; value: number; max: number }

export type CreatorMetrics = {
  window: MetricWindow
  // 规模
  followers: number | null
  followerGrowth: number | null
  followerGrowthRate: number | null
  readFanRatio: number | null
  activeFanRatio: number | null
  engagedFanRatio: number | null
  // 传播（自然流量、中位数）
  impressionMedian: number | null
  readMedian: number | null
  interactionMedian: number | null
  likeMedian: number | null
  collectMedian: number | null
  commentMedian: number | null
  coopReadMedian: number | null
  coopInteractionMedian: number | null
  engagementRate: number | null
  retentionRate: number | null
  noteCount: number | null
  viralCount: number | null
  viralRate: number | null
  // 成本
  priceImage: number | null
  priceVideo: number | null
  cpv: number | null
  cpe: number | null
  cpm: number | null
  // 转化信号
  collectLikeRatio: number | null
  purchaseIntentCommentRatio: number | null
  trafficSearchRatio: number | null
  trafficRecommendRatio: number | null
  trafficFollowRatio: number | null
  readToFollowerRatio: number | null
  // 风控 / 真实性
  health: HealthGrade | null
  authenticity: number | null
  // 历史 / 受众 / 平台指数
  coopNoteCount: number | null
  coopBrands: string[]
  audience: AudienceProfile | null
  vendorIndex: VendorIndex | null
}

export type NumericMetricKey = {
  [K in keyof CreatorMetrics]: CreatorMetrics[K] extends number | null ? K : never
}[keyof CreatorMetrics]

export type MetricGroup = 'scale' | 'reach' | 'cost' | 'conversion' | 'potential' | 'trust'

export type MetricUnit = 'count' | 'ratio' | 'cny' | 'cnyPerUnit' | 'days'

export type MetricField = {
  key: NumericMetricKey
  group: MetricGroup
  unit: MetricUnit
  /** Which direction is better. `null` = descriptive only, never ranked. */
  better: 'high' | 'low' | null
  /** Derived by us (a plain ratio of platform fields) vs read straight from the source. */
  derived: boolean
}

/**
 * Single source of truth for the pool table, the query builder, and the
 * marketing "what we collect" section. Labels live in i18n under
 * `kcs.metric.<key>`; descriptions under `kcs.metricHelp.<key>`.
 */
export const METRIC_FIELDS: readonly MetricField[] = [
  { key: 'followers', group: 'scale', unit: 'count', better: null, derived: false },
  { key: 'followerGrowth', group: 'scale', unit: 'count', better: 'high', derived: false },
  { key: 'followerGrowthRate', group: 'potential', unit: 'ratio', better: 'high', derived: true },
  { key: 'readFanRatio', group: 'reach', unit: 'ratio', better: 'low', derived: false },
  { key: 'activeFanRatio', group: 'trust', unit: 'ratio', better: 'high', derived: false },
  { key: 'engagedFanRatio', group: 'trust', unit: 'ratio', better: 'high', derived: false },
  { key: 'impressionMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'readMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'interactionMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'likeMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'collectMedian', group: 'conversion', unit: 'count', better: 'high', derived: false },
  { key: 'commentMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'coopReadMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'coopInteractionMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'engagementRate', group: 'reach', unit: 'ratio', better: 'high', derived: true },
  { key: 'retentionRate', group: 'reach', unit: 'ratio', better: 'high', derived: false },
  { key: 'noteCount', group: 'scale', unit: 'count', better: 'high', derived: false },
  { key: 'viralCount', group: 'potential', unit: 'count', better: 'high', derived: false },
  { key: 'viralRate', group: 'potential', unit: 'ratio', better: 'high', derived: true },
  { key: 'priceImage', group: 'cost', unit: 'cny', better: null, derived: false },
  { key: 'priceVideo', group: 'cost', unit: 'cny', better: null, derived: false },
  { key: 'cpv', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'cpe', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'cpm', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'collectLikeRatio', group: 'conversion', unit: 'ratio', better: 'high', derived: true },
  { key: 'purchaseIntentCommentRatio', group: 'conversion', unit: 'ratio', better: 'high', derived: false },
  { key: 'trafficSearchRatio', group: 'conversion', unit: 'ratio', better: 'high', derived: false },
  { key: 'trafficRecommendRatio', group: 'potential', unit: 'ratio', better: 'high', derived: false },
  { key: 'trafficFollowRatio', group: 'reach', unit: 'ratio', better: null, derived: false },
  { key: 'readToFollowerRatio', group: 'potential', unit: 'ratio', better: 'high', derived: true },
  { key: 'authenticity', group: 'trust', unit: 'ratio', better: 'high', derived: false },
  { key: 'coopNoteCount', group: 'trust', unit: 'count', better: null, derived: false },
]

export const METRIC_KEYS = METRIC_FIELDS.map((f) => f.key) as readonly NumericMetricKey[]

export function metricField(key: NumericMetricKey): MetricField {
  return METRIC_FIELDS.find((f) => f.key === key)!
}

export function emptyMetrics(window: MetricWindow = 30): CreatorMetrics {
  return {
    window,
    followers: null,
    followerGrowth: null,
    followerGrowthRate: null,
    readFanRatio: null,
    activeFanRatio: null,
    engagedFanRatio: null,
    impressionMedian: null,
    readMedian: null,
    interactionMedian: null,
    likeMedian: null,
    collectMedian: null,
    commentMedian: null,
    coopReadMedian: null,
    coopInteractionMedian: null,
    engagementRate: null,
    retentionRate: null,
    noteCount: null,
    viralCount: null,
    viralRate: null,
    priceImage: null,
    priceVideo: null,
    cpv: null,
    cpe: null,
    cpm: null,
    collectLikeRatio: null,
    purchaseIntentCommentRatio: null,
    trafficSearchRatio: null,
    trafficRecommendRatio: null,
    trafficFollowRatio: null,
    readToFollowerRatio: null,
    health: null,
    authenticity: null,
    coopNoteCount: null,
    coopBrands: [],
    audience: null,
    vendorIndex: null,
  }
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  return a / b
}

function round(n: number | null, digits: number): number | null {
  return n == null ? null : Number(n.toFixed(digits))
}

/**
 * Fill derived ratios from platform fields. Never overwrites a value the
 * source already provided (e.g. 蒲公英 gives CPE directly, 千瓜 gives 爆文率).
 * Price basis for cost ratios is the image-note quote; video is kept as-is.
 */
export function deriveMetrics(input: CreatorMetrics): CreatorMetrics {
  const m = { ...input }
  const price = m.priceImage ?? m.priceVideo
  const coopRead = m.coopReadMedian ?? m.readMedian
  const coopInteraction = m.coopInteractionMedian ?? m.interactionMedian

  m.engagementRate ??= round(div(m.interactionMedian, m.readMedian), 4)
  m.cpv ??= round(div(price, coopRead), 2)
  m.cpe ??= round(div(price, coopInteraction), 2)
  m.cpm ??= round(div(price == null || coopRead == null ? null : price * 1000, coopRead), 2)
  m.collectLikeRatio ??= round(div(m.collectMedian, m.likeMedian), 3)
  m.readToFollowerRatio ??= round(div(m.readMedian, m.followers), 3)
  m.viralRate ??= round(div(m.viralCount, m.noteCount), 3)
  m.followerGrowthRate ??= round(
    div(m.followerGrowth, m.followers == null || m.followerGrowth == null ? null : m.followers - m.followerGrowth),
    4,
  )
  return m
}

export type PercentileBand = 'top10' | 'top25' | 'upper' | 'lower' | 'bottom'

export function bandOf(percentile: number): PercentileBand {
  if (percentile >= 90) return 'top10'
  if (percentile >= 75) return 'top25'
  if (percentile >= 50) return 'upper'
  if (percentile >= 25) return 'lower'
  return 'bottom'
}

export type MetricPercentiles = Partial<Record<NumericMetricKey, { percentile: number; band: PercentileBand }>>

/**
 * Percentile of each rankable metric inside its follower-tier cohort.
 * `better: 'low'` metrics are inverted so higher percentile is always better.
 */
export function cohortPercentiles(
  target: CreatorMetrics,
  cohort: readonly CreatorMetrics[],
  keys: readonly NumericMetricKey[] = METRIC_KEYS,
): MetricPercentiles {
  const out: MetricPercentiles = {}
  for (const key of keys) {
    const field = metricField(key)
    if (!field.better) continue
    const value = target[key]
    if (value == null) continue
    const values = cohort.map((c) => c[key]).filter((v): v is number => v != null)
    if (values.length < 2) continue
    let pct = percentileRank(value, values)
    if (field.better === 'low') pct = Number((100 - pct).toFixed(1))
    out[key] = { percentile: pct, band: bandOf(pct) }
  }
  return out
}
