/**
 * Which 口径 a single metric value was measured on, so values measured
 * differently are never compared with each other (排位 and 参考线 are formed
 * per basis, see cohort.ts).
 *
 *   cost  (CPE, CPM, 阅读单价 …): `coop` 合作笔记 | `daily` 日常笔记
 *   reach (曝光 / 阅读 / 互动中位数, 互动率 …): `organic` 仅自然流量 | `all` 全部流量
 *
 * Records written before a scope was recorded were fetched with the platform's
 * own defaults (全部流量 · 日常笔记), so a missing `basis` reads as `all` / `daily`.
 */
import type { CreatorMetrics, NumericMetricKey } from './metrics'
import { SCOPED_METRIC_KEYS } from './source-adapter'

export type CostBasis = 'coop' | 'daily'
export type ReachBasis = 'organic' | 'all'
export type MetricBasis = CostBasis | ReachBasis

export const COST_BASIS_KEYS: readonly NumericMetricKey[] = ['cpr', 'cpe', 'cpeVideo', 'cpm', 'cpmRead']
export const REACH_BASIS_KEYS: readonly NumericMetricKey[] = SCOPED_METRIC_KEYS.filter((key) => !COST_BASIS_KEYS.includes(key))

/** The basis each family ranks and sorts on by default. */
export const PREFERRED_BASIS = { cost: 'coop', reach: 'organic' } as const satisfies { cost: CostBasis; reach: ReachBasis }

export function basisFamily(key: NumericMetricKey): 'cost' | 'reach' | null {
  if (COST_BASIS_KEYS.includes(key)) return 'cost'
  if (REACH_BASIS_KEYS.includes(key)) return 'reach'
  return null
}

type BasisInput = Pick<CreatorMetrics, 'basis'> & Partial<Pick<CreatorMetrics, 'derived'>>

/**
 * A derived cost is 合作 only when its denominator is a 合作 median
 * (`priceImage/coopInteractionMedian`); a source value follows the record's
 * `businessScope`. `null` for keys whose value does not depend on a scope.
 */
export function metricBasisOf(key: NumericMetricKey, metrics: BasisInput): MetricBasis | null {
  const basis = metrics.basis ?? {}
  const family = basisFamily(key)
  if (family === 'cost') {
    if (Array.isArray(metrics.derived) && metrics.derived.includes(key)) return /coop/i.test(basis[key] ?? '') ? 'coop' : 'daily'
    return basis.businessScope === 'coop' ? 'coop' : 'daily'
  }
  if (family === 'reach') return basis.trafficScope === 'organic' ? 'organic' : 'all'
  return null
}

/** The record's cost side fell back from 合作 to 日常 because the creator had no 合作 data. */
export function costFellBack(metrics: BasisInput): boolean {
  return metrics.basis?.costFallback === 'noCoopData'
}
