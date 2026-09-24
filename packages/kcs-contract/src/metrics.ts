/**
 * CreatorMetrics — the canonical creator record after the transform layer.
 *
 * Every field maps to something a platform actually exposes (蒲公英 / 千瓜 /
 * 新红 / 星图 口径). We do not invent scores: derived fields are plain ratios,
 * and "how good" is always expressed as a percentile among comparable creators
 * in this library (see percentile.ts / cohort.ts). Null means the source did
 * not provide it. Field meanings and their evidence live in docs/03.
 */
import { percentileTenths } from './percentile'

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
  const n = Number(followers ?? 0)
  if (!Number.isFinite(n)) return 'unknown'
  for (const tier of CREATOR_TIERS) if (n >= tier.min) return tier.id
  return 'unknown'
}

/**
 * 蒲公英 健康等级 since 2024-09-01: 健康 / 异常, rated monthly (announced on the
 * 25th, effective on the 1st). 低活跃 is a separate flag (`lowActive`).
 */
export const HEALTH_GRADES = ['healthy', 'abnormal'] as const
/**
 * Two grades only. Values from before the rule (`excellent` / `normal`) were
 * rewritten on disk by migration 0021; `normalizeHealth` still reads them from
 * old query strings and hand-typed input.
 */
export type HealthGrade = (typeof HEALTH_GRADES)[number]

export type MetricWindow = 30 | 90

/** 主要内容形式 — part of the comparison group (图文 and 视频 are priced and read differently). */
export const CONTENT_FORMS = ['image', 'video'] as const
export type ContentForm = (typeof CONTENT_FORMS)[number]

export type AudienceProfile = {
  femaleRatio: number | null
  ageBands: { band: string; ratio: number }[]
  topRegions: { name: string; ratio: number }[]
  interests: { name: string; ratio: number }[]
}

export type VendorIndex = { name: string; value: number; max: number }

/**
 * 蒲公英「全部流量」(including paid boosts) reach, fetched about once a month next
 * to the organic numbers the metrics hold. Reference only: never ranked, sorted
 * or filtered on.
 */
export type AllTrafficReference = {
  impressionMedian: number | null
  readMedian: number | null
  interactionMedian: number | null
  engagementRate: number | null
  fetchedAt: string | null
}

export type CreatorMetrics = {
  window: MetricWindow
  // 规模
  followers: number | null
  followerGrowth: number | null
  followerGrowthRate: number | null
  /**
   * 阅读粉丝占比：近 30 天读过其笔记的粉丝 ÷ 粉丝总数（蒲公英 `readFansIn30` / `fansNum`）。
   * 不是「阅读里有多少来自粉丝」。只描述，不排位。
   */
  readFanRatio: number | null
  /** 活跃粉丝占比：近 28 天活跃的粉丝 ÷ 粉丝总数（蒲公英 `activeFansL28`）。 */
  activeFanRatio: number | null
  /** 互动粉丝占比：近 30 天点赞、收藏或评论过其笔记的粉丝 ÷ 粉丝总数（蒲公英 `engageFansL30`）。 */
  engagedFanRatio: number | null
  /** 新红「互动粉丝比」：口径无公开定义，单独存放、只描述。 */
  fanInteractionRatio: number | null
  // 传播（中位数；蒲公英默认仅自然流量，见 `SOURCE_SCOPE_DEFAULTS`）
  impressionMedian: number | null
  readMedian: number | null
  interactionMedian: number | null
  likeMedian: number | null
  collectMedian: number | null
  commentMedian: number | null
  coopReadMedian: number | null
  coopInteractionMedian: number | null
  engagementRate: number | null
  /** 视频完播率。 */
  completionRate: number | null
  /** 图文笔记 3 秒阅读率（蒲公英「3S 阅读率」）。 */
  read3sRate: number | null
  noteCount: number | null
  viralCount: number | null
  viralRate: number | null
  // 成本
  priceImage: number | null
  priceVideo: number | null
  /** 每次阅读成本（原 cpv）。 */
  cpr: number | null
  cpe: number | null
  /** 视频报价口径的 CPE，与图文分开。 */
  cpeVideo: number | null
  /** 千次曝光成本：只收曝光口径（蒲公英预估 CPM，或报价 ÷ 曝光中位数）。 */
  cpm: number | null
  /** 千次阅读成本：千瓜等按阅读计的「CPM」与自算值。 */
  cpmRead: number | null
  // 转化线索（投前信号，不等于成交）
  collectLikeRatio: number | null
  purchaseIntentCommentRatio: number | null
  trafficSearchRatio: number | null
  trafficRecommendRatio: number | null
  trafficFollowRatio: number | null
  readToFollowerRatio: number | null
  /** 蒲公英合作笔记「外溢进店 UV 中位数」。 */
  storeVisitUvMedian: number | null
  /** 蒲公英合作笔记「外溢进店单价」。 */
  storeVisitUnitPrice: number | null
  // 风控 / 真实性
  health: HealthGrade | null
  /** 蒲公英「低活跃」标记，与健康等级分开。 */
  lowActive: boolean | null
  authenticity: number | null
  // 历史 / 受众 / 平台指数
  /** 蒲公英：近 30 天合作笔记数。 */
  coopNoteCount: number | null
  coopBrands: string[]
  audience: AudienceProfile | null
  vendorIndex: VendorIndex | null
  /** 含投放的传播数字，只作对照（见 `AllTrafficReference`）。 */
  allTraffic: AllTrafficReference | null
  contentForm: ContentForm | null
  /**
   * 平台自带的同类排位（蒲公英 `*BeyondRate`：超过百分之几的同类博主），0..1。
   * Keyed by the metric it ranks. Preferred over our library rank when present.
   */
  platformRanks: Record<string, number> | null
  /** Metric keys this record computed itself (not read from the source). */
  derived: string[]
  /**
   * How each derived value was computed, e.g. `cpe: 'priceImage/interactionMedian'`; also
   * `trafficScope` / `businessScope` when the source fetched under a scope (see `SourceScope`).
   */
  basis: Record<string, string>
  /** When the image price came from a manual quote: its original currency and the rate used. */
  priceQuote: { amount: number; currency: string; fxToCny: number | null } | null
}

export type NumericMetricKey = Exclude<{
  [K in keyof CreatorMetrics]-?: CreatorMetrics[K] extends number | null ? (undefined extends CreatorMetrics[K] ? never : K) : never
}[keyof CreatorMetrics], 'window'>

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
  /** Not shown anywhere until a source provides it. */
  hidden?: boolean
  /**
   * Rank on a small-sample-safe value instead of the raw ratio: the Wilson
   * lower bound of `numerator / denominator`; fewer than `minTrials` → unranked.
   */
  wilson?: { numerator: NumericMetricKey; denominator: NumericMetricKey; minTrials: number }
}

/**
 * Single source of truth for the pool table, the query builder, and the
 * marketing "what we collect" section. Labels live in i18n under
 * `kcs.metric.<key>`; descriptions under `kcs.metricHelp.<key>`.
 *
 * Directions follow docs/03: 阅读粉丝占比 (healthy is a middle band), search /
 * recommend traffic shares (they add up to about 1) and 发文数 describe only.
 */
export const METRIC_FIELDS: readonly MetricField[] = [
  { key: 'followers', group: 'scale', unit: 'count', better: null, derived: false },
  { key: 'followerGrowth', group: 'scale', unit: 'count', better: 'high', derived: false },
  { key: 'followerGrowthRate', group: 'potential', unit: 'ratio', better: 'high', derived: true },
  { key: 'readFanRatio', group: 'reach', unit: 'ratio', better: null, derived: false },
  { key: 'activeFanRatio', group: 'trust', unit: 'ratio', better: 'high', derived: false },
  { key: 'engagedFanRatio', group: 'trust', unit: 'ratio', better: 'high', derived: false },
  { key: 'fanInteractionRatio', group: 'trust', unit: 'ratio', better: null, derived: false },
  { key: 'impressionMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'readMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'interactionMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'likeMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'collectMedian', group: 'conversion', unit: 'count', better: 'high', derived: false },
  { key: 'commentMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'coopReadMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'coopInteractionMedian', group: 'reach', unit: 'count', better: 'high', derived: false },
  { key: 'engagementRate', group: 'reach', unit: 'ratio', better: 'high', derived: true },
  { key: 'completionRate', group: 'reach', unit: 'ratio', better: 'high', derived: false },
  { key: 'read3sRate', group: 'reach', unit: 'ratio', better: 'high', derived: false },
  { key: 'noteCount', group: 'scale', unit: 'count', better: null, derived: false },
  { key: 'viralCount', group: 'potential', unit: 'count', better: 'high', derived: false },
  {
    key: 'viralRate', group: 'potential', unit: 'ratio', better: 'high', derived: true,
    wilson: { numerator: 'viralCount', denominator: 'noteCount', minTrials: 5 },
  },
  { key: 'priceImage', group: 'cost', unit: 'cny', better: null, derived: false },
  { key: 'priceVideo', group: 'cost', unit: 'cny', better: null, derived: false },
  { key: 'cpr', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'cpe', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'cpeVideo', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'cpm', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'cpmRead', group: 'cost', unit: 'cnyPerUnit', better: 'low', derived: true },
  { key: 'collectLikeRatio', group: 'conversion', unit: 'ratio', better: 'high', derived: true },
  { key: 'purchaseIntentCommentRatio', group: 'conversion', unit: 'ratio', better: 'high', derived: false, hidden: true },
  { key: 'trafficSearchRatio', group: 'conversion', unit: 'ratio', better: null, derived: false },
  { key: 'trafficRecommendRatio', group: 'potential', unit: 'ratio', better: null, derived: false },
  { key: 'trafficFollowRatio', group: 'reach', unit: 'ratio', better: null, derived: false },
  { key: 'readToFollowerRatio', group: 'potential', unit: 'ratio', better: 'high', derived: true },
  { key: 'storeVisitUvMedian', group: 'conversion', unit: 'count', better: 'high', derived: false },
  { key: 'storeVisitUnitPrice', group: 'conversion', unit: 'cnyPerUnit', better: null, derived: false },
  { key: 'authenticity', group: 'trust', unit: 'ratio', better: 'high', derived: false },
  { key: 'coopNoteCount', group: 'trust', unit: 'count', better: null, derived: false },
]

export const METRIC_KEYS = METRIC_FIELDS.map((f) => f.key) as readonly NumericMetricKey[]
/** Fields a person can see and pick (hidden ones wait for a source). */
export const VISIBLE_METRIC_KEYS = METRIC_FIELDS.filter((f) => !f.hidden).map((f) => f.key) as readonly NumericMetricKey[]

/** Keys no reader takes any more (now `cpr` / `completionRate`); dropped rather than passed through. */
const RETIRED_METRIC_KEYS = ['cpv', 'retentionRate'] as const

export function metricField(key: NumericMetricKey): MetricField {
  return METRIC_FIELDS.find((f) => f.key === key)!
}

export function isMetricKey(key: unknown): key is NumericMetricKey {
  return typeof key === 'string' && METRIC_KEYS.includes(key as NumericMetricKey)
}

/** Cost fields a service fee applies to (报价与按报价算的单价). */
export const COST_METRIC_KEYS = METRIC_FIELDS
  .filter((f) => f.group === 'cost' && (f.unit === 'cny' || f.unit === 'cnyPerUnit'))
  .map((f) => f.key) as readonly NumericMetricKey[]

/** 蒲公英 service fee: 普通 10%, 优效模式 20%. Costs are shown before fee unless chosen. */
export const SERVICE_FEE_RATES = [0, 0.1, 0.2] as const
export type ServiceFeeRate = (typeof SERVICE_FEE_RATES)[number]

export function withServiceFee(metrics: CreatorMetrics, fee: number): CreatorMetrics {
  if (!fee) return metrics
  const out = { ...metrics }
  for (const key of COST_METRIC_KEYS) {
    const value = out[key]
    if (value != null) out[key] = value * (1 + fee)
  }
  return out
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
    fanInteractionRatio: null,
    impressionMedian: null,
    readMedian: null,
    interactionMedian: null,
    likeMedian: null,
    collectMedian: null,
    commentMedian: null,
    coopReadMedian: null,
    coopInteractionMedian: null,
    engagementRate: null,
    completionRate: null,
    read3sRate: null,
    noteCount: null,
    viralCount: null,
    viralRate: null,
    priceImage: null,
    priceVideo: null,
    cpr: null,
    cpe: null,
    cpeVideo: null,
    cpm: null,
    cpmRead: null,
    collectLikeRatio: null,
    purchaseIntentCommentRatio: null,
    trafficSearchRatio: null,
    trafficRecommendRatio: null,
    trafficFollowRatio: null,
    readToFollowerRatio: null,
    storeVisitUvMedian: null,
    storeVisitUnitPrice: null,
    health: null,
    lowActive: null,
    authenticity: null,
    coopNoteCount: null,
    coopBrands: [],
    audience: null,
    vendorIndex: null,
    allTraffic: null,
    contentForm: null,
    platformRanks: null,
    derived: [],
    basis: {},
    priceQuote: null,
  }
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function div(a: number | null, b: number | null): number | null {
  if (!finite(a) || !finite(b) || b === 0) return null
  const q = a / b
  return Number.isFinite(q) ? q : null
}

type Derivation = {
  key: NumericMetricKey
  compute: (m: CreatorMetrics) => { value: number | null; basis: string } | null
  /** The pre-2026-09 formula with its rounding, to recognise values it stored. */
  legacy?: (m: Record<string, any>) => number | null
}

function legacyRound(n: number | null, digits: number): number | null {
  return n == null ? null : Number(n.toFixed(digits))
}

function legacyPrice(m: Record<string, any>): number | null {
  return m.priceImage ?? m.priceVideo ?? null
}

/**
 * Derived ratios at full precision (display rounds, storage never does).
 * Coop medians fall back to the daily ones and say so in `basis`; the image
 * price never falls back to the video price — video has its own `cpeVideo`.
 */
const DERIVATIONS: readonly Derivation[] = [
  {
    key: 'engagementRate',
    compute: (m) => ({ value: div(m.interactionMedian, m.readMedian), basis: 'interactionMedian/readMedian' }),
    legacy: (m) => legacyRound(div(m.interactionMedian, m.readMedian), 4),
  },
  {
    key: 'cpr',
    compute: (m) => m.coopReadMedian != null
      ? { value: div(m.priceImage, m.coopReadMedian), basis: 'priceImage/coopReadMedian' }
      : { value: div(m.priceImage, m.readMedian), basis: 'priceImage/readMedian' },
    legacy: (m) => legacyRound(div(legacyPrice(m), m.coopReadMedian ?? m.readMedian), 2),
  },
  {
    key: 'cpe',
    compute: (m) => m.coopInteractionMedian != null
      ? { value: div(m.priceImage, m.coopInteractionMedian), basis: 'priceImage/coopInteractionMedian' }
      : { value: div(m.priceImage, m.interactionMedian), basis: 'priceImage/interactionMedian' },
    legacy: (m) => legacyRound(div(legacyPrice(m), m.coopInteractionMedian ?? m.interactionMedian), 2),
  },
  {
    key: 'cpeVideo',
    compute: (m) => m.coopInteractionMedian != null
      ? { value: div(m.priceVideo, m.coopInteractionMedian), basis: 'priceVideo/coopInteractionMedian' }
      : { value: div(m.priceVideo, m.interactionMedian), basis: 'priceVideo/interactionMedian' },
  },
  {
    key: 'cpm',
    compute: (m) => ({
      value: m.priceImage == null ? null : div(m.priceImage * 1000, m.impressionMedian),
      basis: 'priceImage*1000/impressionMedian',
    }),
    // The old formula was per read; such a value is not a CPM and is dropped.
    legacy: (m) => {
      const price = legacyPrice(m)
      const read = m.coopReadMedian ?? m.readMedian
      return legacyRound(price == null || read == null ? null : div(price * 1000, read), 2)
    },
  },
  {
    key: 'cpmRead',
    compute: (m) => m.coopReadMedian != null
      ? { value: m.priceImage == null ? null : div(m.priceImage * 1000, m.coopReadMedian), basis: 'priceImage*1000/coopReadMedian' }
      : { value: m.priceImage == null ? null : div(m.priceImage * 1000, m.readMedian), basis: 'priceImage*1000/readMedian' },
    // Migration 0021 moved the old per-read 「cpm」 here with its rounding.
    legacy: (m) => {
      const price = legacyPrice(m)
      const read = m.coopReadMedian ?? m.readMedian
      return legacyRound(price == null || read == null ? null : div(price * 1000, read), 2)
    },
  },
  {
    key: 'collectLikeRatio',
    compute: (m) => ({ value: div(m.collectMedian, m.likeMedian), basis: 'collectMedian/likeMedian' }),
    legacy: (m) => legacyRound(div(m.collectMedian, m.likeMedian), 3),
  },
  {
    key: 'readToFollowerRatio',
    compute: (m) => ({ value: div(m.readMedian, m.followers), basis: 'readMedian/followers' }),
    legacy: (m) => legacyRound(div(m.readMedian, m.followers), 3),
  },
  {
    key: 'viralRate',
    compute: (m) => ({ value: div(m.viralCount, m.noteCount), basis: 'viralCount/noteCount' }),
    legacy: (m) => legacyRound(div(m.viralCount, m.noteCount), 3),
  },
  {
    key: 'followerGrowthRate',
    compute: (m) => {
      if (m.followers == null || m.followerGrowth == null) return { value: null, basis: '' }
      const before = m.followers - m.followerGrowth
      return { value: before > 0 ? div(m.followerGrowth, before) : null, basis: 'followerGrowth/(followers-followerGrowth)' }
    },
    legacy: (m) => legacyRound(
      div(m.followerGrowth, m.followers == null || m.followerGrowth == null ? null : m.followers - m.followerGrowth),
      4,
    ),
  },
]

const LEGACY_CPM = DERIVATIONS.find((d) => d.key === 'cpm')!.legacy!

/**
 * Fill derived ratios from platform fields. Never overwrites a value the
 * source provided (e.g. 蒲公英 gives CPE directly, 千瓜 gives 爆文率).
 * Idempotent: keys listed in `derived` are recomputed from scratch, and a
 * record from before the `derived` list is recognised by its old rounded
 * formula, so stored values move to full precision on the next read.
 */
export function deriveMetrics(input: CreatorMetrics): CreatorMetrics {
  const m: CreatorMetrics = { ...input, basis: { ...(input.basis ?? {}) } }
  const marked = Array.isArray(input.derived) ? new Set(input.derived) : null
  for (const d of DERIVATIONS) {
    const current = m[d.key]
    const wasDerived = marked
      ? marked.has(d.key)
      : current != null && d.legacy != null && sameNumber(current, d.legacy(input as Record<string, any>))
    if (wasDerived) m[d.key] = null
  }
  const derived: string[] = []
  for (const d of DERIVATIONS) {
    if (m[d.key] != null && finite(m[d.key])) {
      delete m.basis[d.key]
      continue
    }
    const result = d.compute(m)
    m[d.key] = result?.value ?? null
    if (m[d.key] != null) {
      derived.push(d.key)
      m.basis[d.key] = result!.basis
    } else delete m.basis[d.key]
  }
  m.derived = derived
  return m
}

function sameNumber(a: number, b: number | null): boolean {
  return b != null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
}

/**
 * One record in today's shape, whatever wrote it: fills missing keys, maps the
 * old three-grade health, keeps only finite numbers and re-derives. Renamed
 * keys (`cpv`, `retentionRate`) are dropped, not moved: adapters write `cpr` /
 * `completionRate`, and migrations 0021 / 0026 rewrote what was stored.
 * `source` matters for two legacy meanings:
 * - 「CPM」 from 千瓜 / 新红 is per read → `cpmRead` (新红 待核定);
 * - 蒲公英's old `health` was really the 低活跃 flag.
 */
export function normalizeMetrics(input: unknown, source?: string | null): CreatorMetrics {
  const raw: Record<string, any> = input && typeof input === 'object' ? { ...(input as Record<string, any>) } : {}
  for (const key of RETIRED_METRIC_KEYS) delete raw[key]
  if (Array.isArray(raw.derived)) raw.derived = [...raw.derived]
  if (source && source !== 'pugongying' && raw.cpm != null && !isMarkedDerived(raw, 'cpm')) {
    if (!sameNumber(raw.cpm, LEGACY_CPM(raw))) takeSourceValue(raw, 'cpmRead', raw.cpm)
    raw.cpm = null
  }
  const base = emptyMetrics(raw.window === 90 ? 90 : 30)
  const m = { ...base, ...raw } as CreatorMetrics
  for (const key of METRIC_KEYS) m[key] = finite(m[key]) ? m[key] : null
  // Records written since the two-grade health always carry the `lowActive` key.
  const health = 'lowActive' in raw
    ? normalizeHealth(raw.health, raw.lowActive ?? null, null)
    : normalizeHealth(raw.health, undefined, source)
  m.health = health.health
  m.lowActive = health.lowActive
  m.coopBrands = Array.isArray(m.coopBrands) ? m.coopBrands.map(String) : []
  m.contentForm = CONTENT_FORMS.includes(m.contentForm as ContentForm) ? m.contentForm : null
  m.platformRanks = cleanRanks(m.platformRanks)
  m.allTraffic = cleanAllTraffic(m.allTraffic)
  m.basis = m.basis && typeof m.basis === 'object' ? m.basis : {}
  if (!Array.isArray(raw.derived)) delete (m as Partial<CreatorMetrics>).derived
  return deriveMetrics(m)
}

function isMarkedDerived(raw: Record<string, any>, key: string): boolean {
  return Array.isArray(raw.derived) && raw.derived.includes(key)
}

/** A value the source gave wins over one we derived for the same key. */
function takeSourceValue(raw: Record<string, any>, key: string, value: unknown) {
  if (raw[key] != null && !isMarkedDerived(raw, key)) return
  raw[key] = value
  if (Array.isArray(raw.derived)) raw.derived = raw.derived.filter((k: string) => k !== key)
  if (raw.basis && typeof raw.basis === 'object') {
    raw.basis = { ...raw.basis }
    delete raw.basis[key]
  }
}

function cleanAllTraffic(value: unknown): AllTrafficReference | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const n = (x: unknown) => (finite(x) && x >= 0 ? x : null)
  const out: AllTrafficReference = {
    impressionMedian: n(v.impressionMedian),
    readMedian: n(v.readMedian),
    interactionMedian: n(v.interactionMedian),
    engagementRate: n(v.engagementRate),
    fetchedAt: typeof v.fetchedAt === 'string' ? v.fetchedAt : null,
  }
  return out.impressionMedian == null && out.readMedian == null && out.interactionMedian == null && out.engagementRate == null ? null : out
}

function cleanRanks(value: unknown): CreatorMetrics['platformRanks'] {
  if (!value || typeof value !== 'object') return null
  const out: Record<string, number> = {}
  for (const [key, rank] of Object.entries(value as Record<string, unknown>)) {
    if (isMetricKey(key) && finite(rank) && rank >= 0 && rank <= 1) out[key] = rank
  }
  return Object.keys(out).length ? out : null
}

export function normalizeHealth(
  health: unknown,
  lowActive: unknown,
  source?: string | null,
): { health: (typeof HEALTH_GRADES)[number] | null; lowActive: boolean | null } {
  const flag = typeof lowActive === 'boolean' ? lowActive : null
  const legacy = health === 'excellent' || health === 'normal' || health === 'abnormal'
  // Before the fix 蒲公英 wrote 低活跃 as 'abnormal' and "not 低活跃" as excellent / normal
  // without a `lowActive` field; its real 健康等级 was never read, so it is unknown.
  // Today's 蒲公英 records always carry `lowActive`.
  if (legacy && source === 'pugongying' && flag == null) return { health: null, lowActive: health === 'abnormal' }
  if (health === 'healthy' || health === 'abnormal') return { health, lowActive: flag }
  if (!legacy) return { health: null, lowActive: flag }
  return { health: 'healthy', lowActive: flag }
}

/** Cohort bands: five with ≥30 comparable creators, three with 10–29, none below 10. */
export type PercentileBand = 'top10' | 'top25' | 'upper' | 'lower' | 'bottom' | 'front' | 'middle' | 'back'

export const BAND_MIN_SAMPLE = 10
export const FIVE_BAND_MIN_SAMPLE = 30

export function bandOf(percentile: number, n: number = FIVE_BAND_MIN_SAMPLE): PercentileBand {
  if (n < FIVE_BAND_MIN_SAMPLE) {
    if (percentile >= 200 / 3) return 'front'
    if (percentile >= 100 / 3) return 'middle'
    return 'back'
  }
  if (percentile >= 90) return 'top10'
  if (percentile >= 75) return 'top25'
  if (percentile >= 50) return 'upper'
  if (percentile >= 25) return 'lower'
  return 'bottom'
}

export type MetricPercentile = {
  percentile: number
  band: PercentileBand
  /** Comparable creators with a value for this metric (the target included). */
  n: number
  /** Follower range of those creators. */
  followersMin?: number
  followersMax?: number
  /**
   * `library`: our own rank among similar creators in this library (「本库」).
   * `platform`: the platform's own 同类排位 (蒲公英 `*BeyondRate`), preferred when given;
   * our rank then stays next to it as `library`.
   */
  scope?: 'library' | 'platform'
  library?: Omit<MetricPercentile, 'library' | 'scope'>
}

export type MetricPercentiles = Partial<Record<NumericMetricKey, MetricPercentile>>

/** Only metrics with a "better" direction are ranked. */
export const RANKED_METRIC_KEYS = METRIC_FIELDS.filter((f) => f.better && !f.hidden).map((f) => f.key) as readonly NumericMetricKey[]

/**
 * Directed percentile from cohort counts, in tenths: higher is always better.
 * For low-is-better metrics the creators counted "below" are those with a
 * *higher* value (worse), then the same half-up rounding — so a value and its
 * mirror image land on symmetric percentiles. `below` / `equal` are counts of
 * strictly lower / tied values (the target included) among `n`. `null` when
 * the key is not ranked or the cohort is smaller than `minSample`.
 */
export function directedPercentileTenths(
  key: NumericMetricKey,
  below: number,
  equal: number,
  n: number,
  minSample = 2,
): number | null {
  const field = metricField(key)
  if (!field.better || n < Math.max(2, minSample)) return null
  const worse = field.better === 'low' ? n - below - equal : below
  return percentileTenths(worse, equal, n)
}

export function percentileFromCounts(
  key: NumericMetricKey,
  below: number,
  equal: number,
  n: number,
  minSample = 2,
): MetricPercentile | undefined {
  const tenths = directedPercentileTenths(key, below, equal, n, minSample)
  if (tenths == null) return undefined
  const percentile = tenths / 10
  return { percentile, band: bandOf(percentile, n), n }
}

/**
 * Percentile of each rankable metric against an explicit cohort (the caller
 * picks it; the pool uses cohort.ts). Kept for small in-memory checks.
 */
export function cohortPercentiles(
  target: CreatorMetrics,
  cohort: readonly CreatorMetrics[],
  keys: readonly NumericMetricKey[] = METRIC_KEYS,
): MetricPercentiles {
  const out: MetricPercentiles = {}
  for (const key of keys) {
    const value = target[key]
    if (value == null) continue
    const values = cohort.map((c) => c[key]).filter((v): v is number => v != null)
    const below = values.filter((v) => v < value).length
    const equal = values.filter((v) => v === value).length
    const entry = percentileFromCounts(key, below, equal, values.length)
    if (entry) out[key] = entry
  }
  return out
}
