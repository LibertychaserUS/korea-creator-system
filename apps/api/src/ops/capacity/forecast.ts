import type { CapacityForecast, CapacityLevel, CapacityReason, ThresholdEta } from '@kcs/contract'

/**
 * Storage growth forecasting on short daily series (a few weeks of readings).
 * Pure functions, no I/O. Time is in days, values in bytes.
 *
 * - Theil–Sen slope with Sen's distribution-free 90% interval, robust to a
 *   noisy day. One-off jumps (bulk import, restore) are taken out first: they
 *   move the level, not the growth speed.
 * - Holt linear exponential smoothing for the next seven days; the forecast
 *   takes whichever of Holt and Theil–Sen predicts more usage.
 * - CUSUM on the day-to-day increments finds a change in growth speed; when
 *   there is one, only the readings after it are used.
 * - "Days until 70% / 90%" uses the upper end of the slope interval, so the
 *   estimate errs early.
 */

export const DAY_MS = 86_400_000
export const FORECAST_WINDOW_DAYS = 28
export const MIN_FORECAST_POINTS = 7
export const HOLT_HORIZON_DAYS = 7
/** Two-sided 90%: z = 1.645. */
const Z90 = 1.6448536269514722
/** 95% point of sup|Brownian bridge| (Kolmogorov). */
const CUSUM_CRITICAL = 1.358
/** A growth-speed change smaller than this share of the old speed is not reported. */
const MIN_RELATIVE_SHIFT = 0.25
const MIN_SEGMENT_INCREMENTS = 3

export type SeriesPoint = { t: number; y: number }

export function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
}

export function dayString(t: number): string {
  return new Date(t * DAY_MS).toISOString().slice(0, 10)
}

export function median(values: readonly number[]): number {
  if (!values.length) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Value at a 1-based, possibly fractional rank in a sorted list (linear between neighbours). */
function atRank(sorted: readonly number[], rank: number): number {
  const r = Math.min(Math.max(rank, 1), sorted.length)
  const lo = Math.floor(r)
  const hi = Math.ceil(r)
  if (lo === hi) return sorted[lo - 1]!
  return sorted[lo - 1]! + (sorted[hi - 1]! - sorted[lo - 1]!) * (r - lo)
}

export type TheilSen = {
  slope: number
  intercept: number
  lower: number
  upper: number
  n: number
}

/**
 * Median of pairwise slopes; the interval is Sen (1968) / Gilbert (1987):
 * ranks (N ∓ z·√Var(S)) / 2 in the sorted slopes, with the tie correction in
 * Var(S) so a flat series gets a zero-width interval.
 */
export function theilSen(points: readonly SeriesPoint[], z = Z90): TheilSen | null {
  const n = points.length
  if (n < 2) return null
  const slopes: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dt = points[j]!.t - points[i]!.t
      if (dt !== 0) slopes.push((points[j]!.y - points[i]!.y) / dt)
    }
  }
  if (!slopes.length) return null
  slopes.sort((a, b) => a - b)
  const slope = median(slopes)
  const intercept = median(points.map((p) => p.y - slope * p.t))

  const ties = new Map<number, number>()
  for (const p of points) ties.set(p.y, (ties.get(p.y) ?? 0) + 1)
  let tieTerm = 0
  for (const g of ties.values()) tieTerm += g * (g - 1) * (2 * g + 5)
  const varS = Math.max(0, (n * (n - 1) * (2 * n + 5) - tieTerm) / 18)
  const c = z * Math.sqrt(varS)
  const N = slopes.length
  const lower = atRank(slopes, (N - c) / 2)
  const upper = atRank(slopes, (N + c) / 2 + 1)
  return { slope, intercept, lower: Math.min(lower, slope), upper: Math.max(upper, slope), n }
}

/** Linear interpolation onto whole days from the first to the last reading. */
export function dailyGrid(points: readonly SeriesPoint[]): number[] {
  if (!points.length) return []
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const out: number[] = []
  let k = 0
  for (let t = sorted[0]!.t; t <= sorted.at(-1)!.t; t++) {
    while (k < sorted.length - 2 && sorted[k + 1]!.t < t) k++
    const a = sorted[k]!
    const b = sorted[Math.min(k + 1, sorted.length - 1)]!
    out.push(b.t === a.t ? a.y : a.y + ((b.y - a.y) * (t - a.t)) / (b.t - a.t))
  }
  return out
}

export type Holt = { alpha: number; beta: number; level: number; trend: number; sse: number }

/** Holt's linear method, α and β picked on a 0.1 grid by one-step-ahead squared error. */
export function holt(values: readonly number[]): Holt | null {
  if (values.length < 3) return null
  let best: Holt | null = null
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const alpha = a / 10
      const beta = b / 10
      let level = values[0]!
      let trend = values[1]! - values[0]!
      let sse = 0
      for (let i = 1; i < values.length; i++) {
        const predicted = level + trend
        const err = values[i]! - predicted
        sse += err * err
        const nextLevel = alpha * values[i]! + (1 - alpha) * predicted
        trend = beta * (nextLevel - level) + (1 - beta) * trend
        level = nextLevel
      }
      if (!best || sse < best.sse - 1e-9) best = { alpha, beta, level, trend, sse }
    }
  }
  return best
}

export type ChangePoint = {
  /** Day number where the new growth speed starts. */
  t: number
  /** Index in the input points of the first reading of the new regime. */
  index: number
  before: number
  after: number
  statistic: number
}

export type Increments = {
  /** Per-day increment ending at points[i + 1]. */
  values: number[]
  /** Indexes (into `values`) treated as one-off jumps. */
  jumps: number[]
}

/**
 * Day-to-day increments with isolated outliers marked as one-off jumps: far
 * from the median increment while both neighbours are ordinary. A run of
 * unusual increments is a new growth speed, not a jump.
 */
export function increments(points: readonly SeriesPoint[]): Increments {
  const values: number[] = []
  for (let i = 1; i < points.length; i++) {
    const dt = points[i]!.t - points[i - 1]!.t
    values.push(dt > 0 ? (points[i]!.y - points[i - 1]!.y) / dt : 0)
  }
  const center = median(values)
  const spread = 1.4826 * median(values.map((v) => Math.abs(v - center)))
  const scale = Math.max(spread, 0.05 * Math.abs(center), 1)
  const far = (v: number | undefined, k: number) => v !== undefined && Math.abs(v - center) > k * scale
  // At least a normal day's growth on top, so ordinary day-to-day wobble is not a jump.
  const big = (v: number) => far(v, 6) && Math.abs(v - center) > Math.abs(center)
  const jumps = values
    .map((v, i) => (big(v) && !far(values[i - 1], 3) && !far(values[i + 1], 3) ? i : -1))
    .filter((i) => i >= 0)
  return { values, jumps }
}

/**
 * Offline CUSUM on the increments (jumps replaced by the median): the split
 * that maximises |Σ(e − ē)|, kept when it clears the Brownian-bridge 95%
 * point, both sides have at least three increments, and the speed moved by at
 * least a quarter. Noise is estimated from successive differences so the
 * shift itself does not inflate it.
 */
export function detectChange(points: readonly SeriesPoint[]): ChangePoint | null {
  const { values, jumps } = increments(points)
  const m = values.length
  if (m < 2 * MIN_SEGMENT_INCREMENTS) return null
  const center = median(values)
  const e = values.map((v, i) => (jumps.includes(i) ? center : v))
  const mean = e.reduce((s, v) => s + v, 0) / m
  const diffs = e.slice(1).map((v, i) => Math.abs(v - e[i]!))
  const sigma = Math.max((1.4826 * median(diffs)) / Math.SQRT2, 0.02 * Math.abs(mean), 1)
  let best = -1
  let bestAbs = 0
  let s = 0
  for (let k = 0; k < m - 1; k++) {
    s += e[k]! - mean
    const size = k + 1
    if (size < MIN_SEGMENT_INCREMENTS || m - size < MIN_SEGMENT_INCREMENTS) continue
    if (Math.abs(s) > bestAbs) {
      bestAbs = Math.abs(s)
      best = size
    }
  }
  if (best < 0) return null
  const statistic = bestAbs / (sigma * Math.sqrt(m))
  const before = median(e.slice(0, best))
  const after = median(e.slice(best))
  const base = Math.max(Math.abs(before), Math.abs(after), 1)
  if (statistic < CUSUM_CRITICAL || Math.abs(after - before) < MIN_RELATIVE_SHIFT * base) return null
  // Increment `best` ends at points[best + 1]; the new regime starts at points[best].
  return { t: points[best]!.t, index: best, before, after, statistic }
}

/** The same readings with every one-off jump's excess taken out of what follows it. */
export function withoutJumps(points: readonly SeriesPoint[]): SeriesPoint[] {
  const { values, jumps } = increments(points)
  if (!jumps.length) return [...points]
  const center = median(values)
  let offset = 0
  return points.map((p, i) => {
    if (i > 0 && jumps.includes(i - 1)) offset += (values[i - 1]! - center) * (p.t - points[i - 1]!.t)
    return { t: p.t, y: p.y - offset }
  })
}

export type ForecastInput = {
  /** Daily readings, any order; one per day (the latest wins on duplicates). */
  series: readonly { day: string; used: number; capacity?: number | null }[]
  /** Worst-case growth in bytes per day (the quota ceiling), if known. */
  worstCasePerDay?: number | null
  thresholds?: readonly number[]
}

export const CAPACITY_THRESHOLDS = [0.7, 0.9] as const
const RANK: Record<CapacityLevel, number> = { ok: 0, notice: 1, warning: 2, critical: 3 }

function worse(a: CapacityLevel, b: CapacityLevel): CapacityLevel {
  return RANK[b] > RANK[a] ? b : a
}

function daysAt(target: number, from: number, rate: number | null | undefined): number | null {
  if (from >= target) return 0
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null
  return (target - from) / rate
}

/**
 * Alert rules: usage above 70% warns and above 90% is critical; reaching 70%
 * within 30 days warns, reaching 90% within 7 days is critical; a change in
 * growth speed is a notice.
 */
export function forecastCapacity(input: ForecastInput): CapacityForecast {
  const thresholds = input.thresholds ?? CAPACITY_THRESHOLDS
  const byDay = new Map<number, { used: number; capacity: number | null }>()
  for (const row of input.series) {
    if (!Number.isFinite(row.used)) continue
    byDay.set(dayNumber(row.day), { used: row.used, capacity: row.capacity ?? null })
  }
  const all = [...byDay.entries()].sort((a, b) => a[0] - b[0])
  const empty: CapacityForecast = {
    status: 'empty', lastDay: null, used: null, capacity: null, usage: null, points: 0, window: null,
    slope: null, holt: null, next7: [], changePoint: null, jumps: [], worstCasePerDay: input.worstCasePerDay ?? null,
    etas: [], level: 'ok', reasons: [],
  }
  if (!all.length) return empty

  const [lastT, last] = all.at(-1)!
  const recent = all.filter(([t]) => t > lastT - FORECAST_WINDOW_DAYS)
  const points = recent.map(([t, v]) => ({ t, y: v.used }))
  const capacity = last.capacity && last.capacity > 0 ? last.capacity : null
  const usage = capacity ? last.used / capacity : null
  const reasons: CapacityReason[] = []
  let level: CapacityLevel = 'ok'
  if (usage != null) {
    for (const threshold of thresholds) {
      if (usage > threshold) {
        level = worse(level, threshold >= 0.9 ? 'critical' : 'warning')
        reasons.push({ kind: 'usage', threshold, usage })
      }
    }
  }
  const base: CapacityForecast = {
    ...empty,
    status: 'insufficient',
    lastDay: dayString(lastT),
    used: last.used,
    capacity,
    usage,
    points: points.length,
    window: { from: dayString(points[0]!.t), to: dayString(lastT) },
    level,
    reasons,
  }
  if (points.length < MIN_FORECAST_POINTS) return base

  const change = detectChange(points)
  const fit = change ? points.slice(change.index) : points
  const { jumps } = increments(points)
  const anchor = last.used
  // Both fits see the window with one-off jumps taken out and project from
  // the latest reading: a restore moves the level, not the growth speed.
  const cleaned = withoutJumps(fit)
  const ts = theilSen(cleaned)!
  const smooth = holt(dailyGrid(cleaned))
  const holtStart = smooth ? anchor + (smooth.level - cleaned.at(-1)!.y) : null

  const next7 = Array.from({ length: HOLT_HORIZON_DAYS }, (_, i) => {
    const h = i + 1
    const sen = anchor + ts.slope * h
    const holtValue = smooth && holtStart != null ? holtStart + smooth.trend * h : sen
    return { day: dayString(lastT + h), used: Math.max(sen, holtValue) }
  })

  const etas: ThresholdEta[] = capacity
    ? thresholds.map((threshold) => {
        const target = threshold * capacity
        let days = daysAt(target, anchor, ts.upper)
        const holtDays = smooth && holtStart != null ? daysAt(target, holtStart, smooth.trend) : null
        if (holtDays != null && holtDays <= HOLT_HORIZON_DAYS && (days == null || holtDays < days)) days = holtDays
        return {
          threshold,
          days,
          daysLikely: daysAt(target, anchor, ts.slope),
          daysWorstCase: daysAt(target, anchor, input.worstCasePerDay),
        }
      })
    : []
  for (const eta of etas) {
    if (eta.days == null || eta.days === 0) continue
    if (eta.threshold >= 0.9 && eta.days <= 7) {
      level = worse(level, 'critical')
      reasons.push({ kind: 'eta', threshold: eta.threshold, days: eta.days, within: 7 })
    } else if (eta.threshold >= 0.7 && eta.threshold < 0.9 && eta.days <= 30) {
      level = worse(level, 'warning')
      reasons.push({ kind: 'eta', threshold: eta.threshold, days: eta.days, within: 30 })
    }
  }
  const changePoint = change
    ? { day: dayString(change.t), beforePerDay: change.before, afterPerDay: change.after }
    : null
  if (changePoint) {
    level = worse(level, 'notice')
    reasons.push({ kind: 'change', ...changePoint })
  }

  return {
    ...base,
    status: capacity ? 'ok' : 'no_capacity',
    slope: { perDay: ts.slope, lower: ts.lower, upper: ts.upper },
    holt: smooth ? { level: smooth.level, trendPerDay: smooth.trend, alpha: smooth.alpha, beta: smooth.beta } : null,
    next7,
    changePoint,
    jumps: jumps.map((i) => dayString(points[i + 1]!.t)),
    etas,
    level,
    reasons,
  }
}

/** Fastest-growing series by Theil–Sen slope over the forecast window. */
export function fastestGrowing(
  series: ReadonlyMap<string, readonly { day: string; bytes: number }[]>,
  limit = 3,
): { name: string; perDay: number; bytes: number }[] {
  const out: { name: string; perDay: number; bytes: number }[] = []
  for (const [name, rows] of series) {
    if (!rows.length) continue
    const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day))
    const lastT = dayNumber(sorted.at(-1)!.day)
    const points = sorted
      .map((r) => ({ t: dayNumber(r.day), y: r.bytes }))
      .filter((p) => p.t > lastT - FORECAST_WINDOW_DAYS)
    const ts = points.length >= 2 ? theilSen(points) : null
    out.push({ name, perDay: ts?.slope ?? 0, bytes: sorted.at(-1)!.bytes })
  }
  return out
    .filter((row) => row.perDay > 0)
    .sort((a, b) => b.perDay - a.perDay || b.bytes - a.bytes)
    .slice(0, limit)
}
