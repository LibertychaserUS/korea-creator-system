/**
 * Who a creator is compared with, and where they stand.
 *
 * Group = source × window × content form (a missing source or form is its own
 * value). Inside a group, a metric whose value depends on a 口径 is only
 * compared with values of the same 口径 (合作 vs 日常 cost, 自然 vs 全部流量
 * reach; `metricBasisOf`). Each metric then has its own cohort: the creators nearest
 * in log10(followers) that have a value, widened until the target size is
 * reached but never wider than `spanDecades` (one decade, the width of one
 * follower tier). Snapshots older than `staleDays` are neither compared nor
 * ranked. Sample size decides how much is said:
 * - fewer than `BAND_MIN_SAMPLE` (10) → no rank;
 * - 10–29 → front / middle / back only;
 * - 30 or more → five bands.
 * The target size per source comes from a bootstrap (`calibrateSample`): the
 * smallest n whose 95% interval for a percentile is within ±10 points, never
 * below 30.
 *
 * Ratios with a small count behind them (爆文率 = 爆文数 ÷ 发文数) are ranked on
 * their Wilson lower bound, so 1 of 2 does not beat 20 of 100. A platform's
 * own 同类排位 (蒲公英 `*BeyondRate`) is preferred when present; ours stays next
 * to it as 「本库」.
 *
 * Everything here is pure and deterministic: the API precomputes it when a
 * creator is published or taken down, and tests replay it in memory.
 */
import {
  BAND_MIN_SAMPLE,
  FIVE_BAND_MIN_SAMPLE,
  RANKED_METRIC_KEYS,
  bandOf,
  directedPercentileTenths,
  metricField,
  tierOf,
  type CreatorMetrics,
  type CreatorTier,
  type MetricPercentile,
  type MetricPercentiles,
  type NumericMetricKey,
} from './metrics'
import { basisFamily, metricBasisOf, PREFERRED_BASIS } from './metric-basis'

export const COHORT_RULES = {
  spanDecades: 1,
  staleDays: 60,
  wilsonZ: 1.96,
  /** Normal approximation for p = 0.5: n ≥ 1.96² × 0.25 ÷ 0.10² → 97. Used until a source is calibrated. */
  analyticSample: 97,
  referenceMinSample: FIVE_BAND_MIN_SAMPLE,
  bootstrap: {
    resamples: 200,
    halfWidth: 10,
    probes: [0.25, 0.5, 0.75],
    candidates: [30, 40, 50, 60, 80, 100, 125, 150, 200, 300, 400],
    seed: 20_260_924,
    /** Metrics whose required sample decides the source's target. */
    metrics: ['cpe', 'engagementRate', 'readMedian', 'interactionMedian', 'cpr'] as NumericMetricKey[],
  },
} as const

export type CohortGroup = { source: string | null; window: number; contentForm: string | null }

export function cohortGroupKey(group: CohortGroup): string {
  return [group.source ?? '-', group.window, group.contentForm ?? '-'].join('|')
}

export function parseCohortGroupKey(key: string): CohortGroup {
  const [source, window, contentForm] = key.split('|')
  return {
    source: source === '-' ? null : source,
    window: Number(window) === 90 ? 90 : 30,
    contentForm: contentForm === '-' || contentForm == null ? null : contentForm,
  }
}

export type CohortMember = {
  id: string
  followers: number | null
  metrics: CreatorMetrics
  /** Snapshot older than `staleDays`: not compared, not ranked. */
  stale?: boolean
}

export type CohortOptions = {
  /** Neighbours to aim for (the target included). */
  target: number
  spanDecades?: number
  keys?: readonly NumericMetricKey[]
}

export function isStale(fetchedAt: Date | string | null | undefined, now: Date, days: number = COHORT_RULES.staleDays): boolean {
  if (!fetchedAt) return false
  const at = fetchedAt instanceof Date ? fetchedAt.getTime() : Date.parse(fetchedAt)
  return Number.isFinite(at) && now.getTime() - at > days * 86_400_000
}

export function wilsonLowerBound(successes: number, trials: number, z: number = COHORT_RULES.wilsonZ): number {
  if (trials <= 0) return 0
  const p = successes / trials
  const z2 = z * z
  const centre = p + z2 / (2 * trials)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)
  return Math.max(0, (centre - margin) / (1 + z2 / trials))
}

/** The number a metric is ranked on: its value, or the Wilson lower bound; null → not ranked. */
export function rankValue(key: NumericMetricKey, metrics: CreatorMetrics): number | null {
  const field = metricField(key)
  if (!field.better || field.hidden) return null
  const value = metrics[key]
  if (field.wilson) {
    const trials = metrics[field.wilson.denominator]
    if (trials == null || !Number.isFinite(trials) || trials < field.wilson.minTrials) return null
    const counted = metrics[field.wilson.numerator]
    const successes = counted ?? (value == null ? null : Math.round(value * trials))
    if (successes == null || !Number.isFinite(successes)) return null
    return wilsonLowerBound(Math.min(Math.max(successes, 0), trials), trials)
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function logFollowers(followers: number | null | undefined): number | null {
  return followers != null && Number.isFinite(followers) && followers > 0 ? Math.log10(followers) : null
}

type Point = { id: string; x: number; v: number; followers: number }

function lowerBound(xs: readonly number[], value: number): number {
  let lo = 0
  let hi = xs.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (xs[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

function upperBound(xs: readonly number[], value: number): number {
  let lo = 0
  let hi = xs.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (xs[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The cohort of point `i` in `xs` (sorted log followers): the `k` nearest,
 * ties broken towards smaller followers, then cut to ±half a span. Both ends
 * only move right as `i` does, which lets `rankGroup` slide one window.
 */
export function cohortWindow(xs: readonly number[], i: number, target: number, spanDecades: number): [number, number] {
  const m = xs.length
  const k = Math.max(1, Math.min(target, m))
  const moveRight = (l: number) => l + k < m && xs[l + k] - xs[i] < xs[i] - xs[l]
  let lo = Math.max(0, i - k + 1)
  let hi = Math.min(i, m - k)
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (moveRight(mid)) lo = mid + 1
    else hi = mid
  }
  const half = spanDecades / 2
  return [Math.max(lo, lowerBound(xs, xs[i] - half)), Math.min(lo + k - 1, upperBound(xs, xs[i] + half) - 1)]
}

function libraryEntry(
  key: NumericMetricKey,
  below: number,
  equal: number,
  n: number,
  followersMin?: number,
  followersMax?: number,
): MetricPercentile | undefined {
  const tenths = directedPercentileTenths(key, below, equal, n, BAND_MIN_SAMPLE)
  if (tenths == null) return undefined
  const percentile = tenths / 10
  const entry: MetricPercentile = { percentile, band: bandOf(percentile, n), n, scope: 'library' }
  if (followersMin != null) entry.followersMin = followersMin
  if (followersMax != null) entry.followersMax = followersMax
  return entry
}

class Fenwick {
  private readonly tree: Int32Array
  constructor(size: number) {
    this.tree = new Int32Array(size + 1)
  }
  add(index: number, delta: number) {
    for (let i = index + 1; i < this.tree.length; i += i & -i) this.tree[i] += delta
  }
  /** Count of positions < index. */
  prefix(index: number): number {
    let sum = 0
    for (let i = index; i > 0; i -= i & -i) sum += this.tree[i]
    return sum
  }
}

function points(members: readonly CohortMember[], key: NumericMetricKey) {
  const known: Point[] = []
  const unknown: Array<{ id: string; v: number }> = []
  for (const member of members) {
    if (member.stale) continue
    const v = rankValue(key, member.metrics)
    if (v == null) continue
    const x = logFollowers(member.followers)
    if (x == null) unknown.push({ id: member.id, v })
    else known.push({ id: member.id, x, v, followers: member.followers! })
  }
  known.sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { known, unknown }
}

/** Members split by the 口径 `key` was measured on; a scope-free key keeps one part. */
function byBasis(members: readonly CohortMember[], key: NumericMetricKey): CohortMember[][] {
  if (!basisFamily(key)) return [members as CohortMember[]]
  const parts = new Map<string, CohortMember[]>()
  for (const member of members) {
    const basis = metricBasisOf(key, member.metrics) ?? '-'
    const part = parts.get(basis)
    if (part) part.push(member)
    else parts.set(basis, [member])
  }
  return [...parts.values()]
}

function sameBasis(key: NumericMetricKey, a: CohortMember, b: CohortMember): boolean {
  return !basisFamily(key) || metricBasisOf(key, a.metrics) === metricBasisOf(key, b.metrics)
}

function countIn(sorted: readonly number[], value: number): [number, number] {
  const below = lowerBound(sorted, value)
  return [below, upperBound(sorted, value) - below]
}

function withPlatformRanks(
  members: readonly CohortMember[],
  keys: readonly NumericMetricKey[],
  out: Map<string, MetricPercentiles>,
) {
  for (const member of members) {
    if (member.stale) continue
    const ranks = member.metrics.platformRanks
    if (!ranks) continue
    const mine = out.get(member.id) ?? {}
    for (const key of keys) {
      const rank = ranks[key]
      if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < 0 || rank > 1) continue
      const percentile = Math.round(rank * 1000) / 10
      const library = mine[key]
      const entry: MetricPercentile = { percentile, band: bandOf(percentile), n: library?.n ?? 0, scope: 'platform' }
      if (library) entry.library = { percentile: library.percentile, band: library.band, n: library.n, followersMin: library.followersMin, followersMax: library.followersMax }
      mine[key] = entry
    }
    out.set(member.id, mine)
  }
}

/**
 * Percentiles of every member of one group, per metric. Cost per metric is
 * O(n log n): one sliding window over the members sorted by followers.
 */
export function rankGroup(members: readonly CohortMember[], options: CohortOptions): Map<string, MetricPercentiles> {
  const keys = (options.keys ?? RANKED_METRIC_KEYS).filter((key) => RANKED_METRIC_KEYS.includes(key))
  const span = options.spanDecades ?? COHORT_RULES.spanDecades
  const out = new Map<string, MetricPercentiles>()
  const put = (id: string, key: NumericMetricKey, entry: MetricPercentile | undefined) => {
    if (!entry) return
    const mine = out.get(id) ?? {}
    mine[key] = entry
    out.set(id, mine)
  }
  const rankPart = (part: readonly CohortMember[], key: NumericMetricKey) => {
    const { known, unknown } = points(part, key)
    if (known.length) {
      const xs = known.map((p) => p.x)
      const values = [...new Set(known.map((p) => p.v))].sort((a, b) => a - b)
      const rankOf = (v: number) => lowerBound(values, v)
      const tree = new Fenwick(values.length)
      let left = 0
      let right = -1
      for (let i = 0; i < known.length; i += 1) {
        const [lo, hi] = cohortWindow(xs, i, options.target, span)
        while (right < hi) tree.add(rankOf(known[++right].v), 1)
        while (left < lo) tree.add(rankOf(known[left++].v), -1)
        const r = rankOf(known[i].v)
        const below = tree.prefix(r)
        const equal = tree.prefix(r + 1) - below
        put(known[i].id, key, libraryEntry(key, below, equal, hi - lo + 1, known[lo].followers, known[hi].followers))
      }
    }
    if (unknown.length) {
      const sorted = unknown.map((p) => p.v).sort((a, b) => a - b)
      for (const p of unknown) {
        const [below, equal] = countIn(sorted, p.v)
        put(p.id, key, libraryEntry(key, below, equal, sorted.length))
      }
    }
  }
  for (const key of keys) for (const part of byBasis(members, key)) rankPart(part, key)
  withPlatformRanks(members, keys, out)
  return out
}

/**
 * Percentiles of someone who is not a member (e.g. taken down but still on a
 * shortlist) against the group as it stands, counted as if they were in it.
 * Same windows and counts as `rankGroup` would give them.
 */
export function rankAgainst(members: readonly CohortMember[], target: CohortMember, options: CohortOptions): MetricPercentiles {
  const keys = (options.keys ?? RANKED_METRIC_KEYS).filter((key) => RANKED_METRIC_KEYS.includes(key))
  const span = options.spanDecades ?? COHORT_RULES.spanDecades
  const others = members.filter((member) => member.id !== target.id)
  const out: MetricPercentiles = {}
  if (target.stale) return out
  for (const key of keys) {
    const peers = others.filter((member) => sameBasis(key, member, target))
    const { known, unknown } = points([...peers, target], key)
    const at = known.findIndex((p) => p.id === target.id)
    if (at >= 0) {
      const xs = known.map((p) => p.x)
      const [lo, hi] = cohortWindow(xs, at, options.target, span)
      let below = 0
      let equal = 0
      for (let j = lo; j <= hi; j += 1) {
        if (known[j].v < known[at].v) below += 1
        else if (known[j].v === known[at].v) equal += 1
      }
      const entry = libraryEntry(key, below, equal, hi - lo + 1, known[lo].followers, known[hi].followers)
      if (entry) out[key] = entry
      continue
    }
    const self = unknown.find((p) => p.id === target.id)
    if (self) {
      const [below, equal] = countIn(unknown.map((p) => p.v).sort((a, b) => a - b), self.v)
      const entry = libraryEntry(key, below, equal, unknown.length)
      if (entry) out[key] = entry
    }
  }
  const wrapped = new Map<string, MetricPercentiles>([[target.id, out]])
  withPlatformRanks([target], keys, wrapped)
  return wrapped.get(target.id) ?? {}
}

/** Linear-interpolated quantile of sorted values (Hyndman & Fan type 7). */
export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return Number.NaN
  const h = (sorted.length - 1) * q
  const lo = Math.floor(h)
  const hi = Math.min(sorted.length - 1, lo + 1)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

export type ReferenceLine = { tier: CreatorTier; key: NumericMetricKey; n: number; p25: number; p50: number; p75: number }

/**
 * The members one reference line is drawn from: for a metric with a 口径, the
 * basis with the most values (ties → the preferred one), never a mix.
 */
function referencePart(members: readonly CohortMember[], key: NumericMetricKey): readonly CohortMember[] {
  const family = basisFamily(key)
  if (!family) return members
  const counted = byBasis(members, key).map((part) => ({
    part,
    n: part.filter((member) => typeof member.metrics[key] === 'number').length,
    preferred: metricBasisOf(key, part[0]!.metrics) === PREFERRED_BASIS[family],
  }))
  counted.sort((a, b) => b.n - a.n || Number(b.preferred) - Number(a.preferred))
  return counted[0]?.part ?? []
}

/** 25 / 50 / 75 分位 of each metric per follower tier (one 口径 per line); only with at least 30 current values. */
export function referenceLines(members: readonly CohortMember[], keys: readonly NumericMetricKey[]): ReferenceLine[] {
  const byTier = new Map<CreatorTier, CohortMember[]>()
  for (const member of members) {
    if (member.stale) continue
    const tier = tierOf(member.followers)
    byTier.set(tier, [...(byTier.get(tier) ?? []), member])
  }
  const out: ReferenceLine[] = []
  for (const [tier, list] of byTier) {
    for (const key of keys) {
      const values = referencePart(list, key)
        .map((member) => member.metrics[key])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        .sort((a, b) => a - b)
      if (values.length < COHORT_RULES.referenceMinSample) continue
      out.push({ tier, key, n: values.length, p25: quantile(values, 0.25), p50: quantile(values, 0.5), p75: quantile(values, 0.75) })
    }
  }
  return out
}

/** mulberry32: small, seeded, the same sequence on every machine. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export type SampleCalibration = {
  /** Neighbours to aim for: max(30, required). */
  target: number
  /** Smallest candidate n meeting ±halfWidth, or null when no metric had enough data. */
  required: number | null
  method: 'bootstrap' | 'analytic'
  poolSize: number
  /** Per metric: the half width (percentage points) at each candidate n, and the n it needs. */
  metrics: Partial<Record<NumericMetricKey, { values: number; required: number | null; halfWidths: Record<number, number> }>>
  rules: { resamples: number; halfWidth: number; probes: readonly number[]; candidates: readonly number[]; seed: number }
}

/**
 * How many comparable creators a percentile needs in this source: resample n
 * values from the source's own data `resamples` times, and read the 95% range
 * of the percentile the pool's 25 / 50 / 75 分位 values would get. The first n
 * whose widest range is within ±halfWidth wins; the source needs the largest
 * n any core metric needs. With too little data, the normal approximation.
 */
export function calibrateSample(members: readonly CohortMember[]): SampleCalibration {
  const rules = COHORT_RULES.bootstrap
  const current = members.filter((member) => !member.stale)
  const result: SampleCalibration = {
    target: COHORT_RULES.analyticSample,
    required: null,
    method: 'analytic',
    poolSize: current.length,
    metrics: {},
    rules: { resamples: rules.resamples, halfWidth: rules.halfWidth, probes: rules.probes, candidates: rules.candidates, seed: rules.seed },
  }
  let required: number | null = null
  for (const key of rules.metrics) {
    const pool = current
      .map((member) => rankValue(key, member.metrics))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b)
    if (pool.length < FIVE_BAND_MIN_SAMPLE) continue
    const random = seeded(rules.seed)
    const probes = rules.probes.map((q) => quantile(pool, q))
    const halfWidths: Record<number, number> = {}
    let needed: number | null = null
    for (const n of rules.candidates) {
      let widest = 0
      for (const probe of probes) {
        const estimates: number[] = []
        for (let b = 0; b < rules.resamples; b += 1) {
          let below = 0
          let equal = 0
          for (let j = 0; j < n; j += 1) {
            const v = pool[Math.floor(random() * pool.length)]
            if (v < probe) below += 1
            else if (v === probe) equal += 1
          }
          estimates.push((100 * (below + equal / 2)) / n)
        }
        estimates.sort((a, b) => a - b)
        widest = Math.max(widest, (quantile(estimates, 0.975) - quantile(estimates, 0.025)) / 2)
      }
      halfWidths[n] = Math.round(widest * 10) / 10
      if (needed == null && widest <= rules.halfWidth) needed = n
    }
    const metricNeed = needed ?? rules.candidates[rules.candidates.length - 1]
    result.metrics[key] = { values: pool.length, required: needed, halfWidths }
    required = Math.max(required ?? 0, metricNeed)
  }
  if (required != null) {
    result.required = required
    result.method = 'bootstrap'
    result.target = Math.max(FIVE_BAND_MIN_SAMPLE, required)
  }
  return result
}
