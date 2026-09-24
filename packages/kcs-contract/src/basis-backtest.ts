/**
 * Offline check of which 口径 predicts outcomes better, so a default can be
 * changed on evidence rather than taste. Advisory only: nothing reads the
 * result to change a setting, and nothing here is a score — it says how well
 * one plain metric, measured two ways, tells apart creators that were later
 * used from those that were not.
 *
 * Outcome (from `creator_events`): a published creator counts as used when
 * they were assigned to a project and not taken off again (assign − unassign
 * > 0), or exported. Everyone else who was published counts as not used.
 *
 * For each metric and 口径 the value is the latest snapshot on that 口径 taken
 * before the first use (or before now, for creators never used). Only
 * creators with a value on both 口径 are compared (paired), and the AUC is
 * pooled within follower tiers so a big account does not win on size alone.
 * With fewer than `minRecords` labelled creators the report says 样本不足 and
 * gives no numbers.
 */
import { metricField, tierOf, type CreatorTier, type NumericMetricKey } from './metrics'
import { PREFERRED_BASIS, type MetricBasis } from './metric-basis'

export const BASIS_BACKTEST_RULES = {
  /** Labelled creators (used + not used) needed before anything is said. */
  minRecords: 300,
  /** Used creators needed inside one paired comparison. */
  minPositives: 30,
  /** Creators with a value on both 口径 needed for one comparison. */
  minPaired: 100,
  z: 1.96,
  comparisons: [
    { family: 'reach', bases: ['organic', 'all'], keys: ['readMedian', 'interactionMedian', 'engagementRate'] },
    { family: 'cost', bases: ['coop', 'daily'], keys: ['cpe', 'cpr'] },
  ],
} as const

export type BasisBacktestRules = typeof BASIS_BACKTEST_RULES

export type BacktestRow = {
  creatorId: string
  followers: number | null
  used: boolean
  /** metric → 口径 → value. */
  values: Partial<Record<NumericMetricKey, Partial<Record<MetricBasis, number>>>>
}

export type BasisScore = {
  basis: MetricBasis
  /** Area under the ROC curve, 0.5 = no better than chance; null when the sample is too small. */
  auc: number | null
  se: number | null
  /** Spearman rank correlation between the (direction-adjusted) value and being used. */
  spearman: number | null
}

export type BasisVerdict = 'insufficient' | 'no_difference' | 'prefer'

export type BasisComparison = {
  family: 'reach' | 'cost'
  key: NumericMetricKey
  current: MetricBasis
  paired: number
  positives: number
  scores: BasisScore[]
  verdict: BasisVerdict
  /** Set only when `verdict === 'prefer'`. */
  better: MetricBasis | null
}

export type BasisBacktestReport = {
  status: 'insufficient' | 'ok'
  records: number
  positives: number
  rules: { minRecords: number; minPositives: number; minPaired: number }
  comparisons: BasisComparison[]
}

/** Average ranks (1-based), ties share the mean rank. */
function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array<number>(values.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j += 1
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) out[order[k]![1]] = rank
    i = j + 1
  }
  return out
}

/** Mann–Whitney U of positives over negatives, i.e. AUC × n1 × n0. */
function mannWhitney(scores: readonly number[], labels: readonly boolean[]): { u: number; n1: number; n0: number } {
  const r = ranks(scores)
  let n1 = 0
  let sum = 0
  labels.forEach((label, i) => {
    if (label) {
      n1 += 1
      sum += r[i]!
    }
  })
  const n0 = labels.length - n1
  return { u: sum - (n1 * (n1 + 1)) / 2, n1, n0 }
}

/** Hanley & McNeil (1982) standard error of an AUC. */
function hanleyMcNeil(auc: number, n1: number, n0: number): number {
  const q1 = auc / (2 - auc)
  const q2 = (2 * auc * auc) / (1 + auc)
  const variance = (auc * (1 - auc) + (n1 - 1) * (q1 - auc * auc) + (n0 - 1) * (q2 - auc * auc)) / (n1 * n0)
  return Math.sqrt(Math.max(0, variance))
}

function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i]! - mx) * (ys[i]! - my)
    sxx += (xs[i]! - mx) ** 2
    syy += (ys[i]! - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

/** AUC pooled within follower tiers (Σ U ÷ Σ n1·n0) with its standard error, plus Spearman. */
export function stratifiedAuc(
  points: readonly { tier: CreatorTier; score: number; used: boolean }[],
): { auc: number | null; se: number | null; spearman: number | null } {
  const byTier = new Map<CreatorTier, { scores: number[]; labels: boolean[] }>()
  for (const p of points) {
    const bucket = byTier.get(p.tier) ?? { scores: [], labels: [] }
    bucket.scores.push(p.score)
    bucket.labels.push(p.used)
    byTier.set(p.tier, bucket)
  }
  let u = 0
  let pairs = 0
  let n1 = 0
  let n0 = 0
  for (const bucket of byTier.values()) {
    const m = mannWhitney(bucket.scores, bucket.labels)
    u += m.u
    pairs += m.n1 * m.n0
    n1 += m.n1
    n0 += m.n0
  }
  const spearman = pearson(ranks(points.map((p) => p.score)), ranks(points.map((p) => (p.used ? 1 : 0))))
  if (!pairs) return { auc: null, se: null, spearman }
  const auc = u / pairs
  return { auc, se: hanleyMcNeil(auc, n1, n0), spearman }
}

export function basisBacktest(rows: readonly BacktestRow[], rules: BasisBacktestRules = BASIS_BACKTEST_RULES): BasisBacktestReport {
  const positives = rows.filter((row) => row.used).length
  const status = rows.length >= rules.minRecords && positives >= rules.minPositives ? 'ok' : 'insufficient'
  const comparisons: BasisComparison[] = []
  for (const group of rules.comparisons) {
    for (const key of group.keys as readonly NumericMetricKey[]) {
      const sign = metricField(key).better === 'low' ? -1 : 1
      const paired = rows.filter((row) => group.bases.every((basis) => typeof row.values[key]?.[basis] === 'number'))
      const pairedPositives = paired.filter((row) => row.used).length
      const enough = status === 'ok' && paired.length >= rules.minPaired && pairedPositives >= rules.minPositives
        && paired.length - pairedPositives >= rules.minPositives
      const scores: BasisScore[] = group.bases.map((basis) => {
        if (!enough) return { basis, auc: null, se: null, spearman: null }
        return {
          basis,
          ...stratifiedAuc(paired.map((row) => ({ tier: tierOf(row.followers), score: sign * row.values[key]![basis]!, used: row.used }))),
        }
      })
      let verdict: BasisVerdict = 'insufficient'
      let better: MetricBasis | null = null
      const [a, b] = scores
      if (enough && a?.auc != null && b?.auc != null && a.se != null && b.se != null) {
        const diff = a.auc - b.auc
        // Treats the two AUCs as independent, which overstates the error for paired data: errs towards "no difference".
        const se = Math.sqrt(a.se ** 2 + b.se ** 2)
        if (Math.abs(diff) > rules.z * se) {
          verdict = 'prefer'
          better = diff > 0 ? a.basis : b.basis
        } else verdict = 'no_difference'
      }
      comparisons.push({
        family: group.family,
        key,
        current: PREFERRED_BASIS[group.family],
        paired: paired.length,
        positives: pairedPositives,
        scores,
        verdict,
        better,
      })
    }
  }
  return {
    status,
    records: rows.length,
    positives,
    rules: { minRecords: rules.minRecords, minPositives: rules.minPositives, minPaired: rules.minPaired },
    comparisons,
  }
}
