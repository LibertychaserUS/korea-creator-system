import {
  BASIS_BACKTEST_RULES,
  basisBacktest,
  basisFamily,
  metricBasisOf,
  normalizeMetrics,
  type BacktestRow,
  type BasisBacktestReport,
  type MetricBasis,
  type NumericMetricKey,
} from '@kcs/contract'
import type { Queryable } from '../db'

/** Snapshots read per run, newest first; enough for a pool of tens of thousands. */
const SNAPSHOT_LIMIT = 200_000

const KEYS = BASIS_BACKTEST_RULES.comparisons.flatMap((c) => [...c.keys]) as NumericMetricKey[]
const REFERENCE_KEYS = new Set<NumericMetricKey>(['impressionMedian', 'readMedian', 'interactionMedian', 'engagementRate'])

type Outcome = { used: boolean; cutoff: Date | null }

/**
 * Who was published, and whether they were used afterwards (see
 * `basisBacktest`). Publishes from before the events table are the creators
 * whose snapshot is locked.
 */
async function outcomes(db: Queryable): Promise<Map<string, Outcome>> {
  const { rows } = await db.query(
    `SELECT creator_id, kind, occurred_at FROM creator_events
      WHERE kind IN ('publish', 'unpublish', 'assign', 'unassign', 'export')
     UNION ALL
     SELECT id, 'publish', metrics_locked_at FROM creators WHERE metrics_locked_at IS NOT NULL
     ORDER BY occurred_at`,
  )
  const tally = new Map<string, { published: boolean; assigned: number; exported: boolean; firstUse: Date | null }>()
  for (const row of rows as { creator_id: string; kind: string; occurred_at: Date | string }[]) {
    const t = tally.get(row.creator_id) ?? { published: false, assigned: 0, exported: false, firstUse: null }
    const at = new Date(row.occurred_at)
    if (row.kind === 'publish') t.published = true
    if (row.kind === 'assign') t.assigned += 1
    if (row.kind === 'unassign') t.assigned -= 1
    if (row.kind === 'export') t.exported = true
    if ((row.kind === 'assign' || row.kind === 'export') && !t.firstUse) t.firstUse = at
    tally.set(row.creator_id, t)
  }
  const out = new Map<string, Outcome>()
  for (const [id, t] of tally) {
    if (!t.published) continue
    const used = t.assigned > 0 || t.exported
    out.set(id, { used, cutoff: used ? t.firstUse : null })
  }
  return out
}

/**
 * One row per published creator of `source`: for each compared metric and 口径,
 * the latest 30-day snapshot value on that 口径 before the first use. The 全部流量
 * reference inside an organic snapshot counts as an `all` value.
 */
export async function backtestRows(db: Queryable, source = 'pugongying'): Promise<BacktestRow[]> {
  const labels = await outcomes(db)
  if (!labels.size) return []
  const { rows } = await db.query(
    `SELECT creator_id, fetched_at, metrics FROM creator_metrics_history
      WHERE source = $1 AND "window" = 30 AND creator_id = ANY($2::text[])
      ORDER BY fetched_at DESC LIMIT ${SNAPSHOT_LIMIT}`,
    [source, [...labels.keys()]],
  )
  const byCreator = new Map<string, BacktestRow>()
  for (const row of rows as { creator_id: string; fetched_at: Date | string; metrics: unknown }[]) {
    const label = labels.get(row.creator_id)!
    if (label.cutoff && new Date(row.fetched_at).getTime() > label.cutoff.getTime()) continue
    const metrics = normalizeMetrics(row.metrics, source)
    let entry = byCreator.get(row.creator_id)
    if (!entry) {
      entry = { creatorId: row.creator_id, followers: metrics.followers, used: label.used, values: {} }
      byCreator.set(row.creator_id, entry)
    }
    const put = (key: NumericMetricKey, basis: MetricBasis | null, value: number | null | undefined) => {
      if (basis == null || typeof value !== 'number' || !Number.isFinite(value)) return
      const slot = (entry!.values[key] ??= {})
      if (slot[basis] === undefined) slot[basis] = value
    }
    for (const key of KEYS) {
      put(key, metricBasisOf(key, metrics), metrics[key])
      if (basisFamily(key) === 'reach' && REFERENCE_KEYS.has(key) && metrics.allTraffic) {
        put(key, 'all', metrics.allTraffic[key as keyof typeof metrics.allTraffic] as number | null)
      }
    }
  }
  return [...byCreator.values()]
}

export async function runBasisBacktest(db: Queryable, source = 'pugongying'): Promise<BasisBacktestReport> {
  return basisBacktest(await backtestRows(db, source))
}
