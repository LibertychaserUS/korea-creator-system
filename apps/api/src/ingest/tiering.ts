import type { AppEnv } from '../http/types'
import { outcomeEvents, type OutcomeEvent } from './outcome-events'

/**
 * Value tiers for snapshots (`creator_metrics_history`) and raw fetches
 * (`creator_raw`). Labels only: nothing reads a tier to delete anything.
 * See migration 0046 for what each tier means.
 */
export const VALUE_TIERS = ['pinned', 'change_point', 'downsample', 'cold'] as const
export type ValueTier = (typeof VALUE_TIERS)[number]

export type PinReason = 'latest' | 'publish' | 'assign' | 'shortlist' | 'remove' | 'export' | 'view' | 'audit' | 'anomaly'

/** Metrics the change-point test watches, with their relative tolerance. */
export const DEFAULT_TIER_TOLERANCES: Readonly<Record<string, number>> = {
  followers: 0.02,
  impressionMedian: 0.1,
  readMedian: 0.1,
  interactionMedian: 0.1,
  engagementRate: 0.1,
  noteCount: 0.1,
  priceImage: 0.05,
  priceVideo: 0.05,
  cpe: 0.1,
  activeFanRatio: 0.1,
}

export type TierConfig = {
  /** metric → relative tolerance of the swinging door (0.1 = ±10% of the last kept value). */
  tolerances: Record<string, number>
  /** Older than this (days) and not pinned / a change point → `cold`. */
  coldAfterDays: number
  /** A step this large (relative) between two snapshots of one source is an anomaly; both ends are pinned. */
  anomalyRatio: number
  /** Metrics the anomaly test looks at. */
  anomalyMetrics: string[]
}

export const DEFAULT_TIER_CONFIG: TierConfig = {
  tolerances: { ...DEFAULT_TIER_TOLERANCES },
  coldAfterDays: 180,
  anomalyRatio: 0.5,
  anomalyMetrics: ['followers', 'readMedian', 'interactionMedian'],
}

export function tierConfig(source: NodeJS.ProcessEnv = process.env): TierConfig {
  const config: TierConfig = { ...DEFAULT_TIER_CONFIG, tolerances: { ...DEFAULT_TIER_CONFIG.tolerances } }
  if (source.TIER_TOLERANCES) {
    try {
      const parsed = JSON.parse(source.TIER_TOLERANCES) as Record<string, unknown>
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) config.tolerances[key] = value
        else if (value === null) delete config.tolerances[key]
      }
    } catch {
      // Keep the defaults when the override is not JSON.
    }
  }
  const cold = Number(source.TIER_COLD_AFTER_DAYS)
  if (Number.isFinite(cold) && cold > 0) config.coldAfterDays = cold
  const anomaly = Number(source.TIER_ANOMALY_RATIO)
  if (Number.isFinite(anomaly) && anomaly > 0) config.anomalyRatio = anomaly
  return config
}

export type Point = { t: number; v: number }

/**
 * Swinging-door compression (Bristol 1990). Keeps the first and last point and
 * every point where no single straight line from the last kept point stays
 * within ±E of everything since; E = `tolerance(lastKept.v)`. Returns the
 * indices kept, in order.
 */
export function swingingDoor(points: readonly Point[], tolerance: (anchor: number) => number): number[] {
  if (points.length <= 2) return points.map((_, i) => i)
  const kept = [0]
  let anchor = points[0]!
  let upper = -Infinity
  let lower = Infinity
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i]!
    const e = Math.max(0, tolerance(anchor.v))
    const dt = Math.max(p.t - anchor.t, 1e-9)
    upper = Math.max(upper, (p.v - anchor.v - e) / dt)
    lower = Math.min(lower, (p.v - anchor.v + e) / dt)
    if (upper > lower) {
      // The doors crossed: the previous point closes the segment.
      const prevIndex = i - 1
      if (prevIndex !== kept[kept.length - 1]) kept.push(prevIndex)
      anchor = points[prevIndex]!
      const e2 = Math.max(0, tolerance(anchor.v))
      const dt2 = Math.max(p.t - anchor.t, 1e-9)
      upper = (p.v - anchor.v - e2) / dt2
      lower = (p.v - anchor.v + e2) / dt2
    }
  }
  if (kept[kept.length - 1] !== points.length - 1) kept.push(points.length - 1)
  return kept
}

export type Snapshot = {
  id: string
  source: string
  fetchedAt: Date
  metrics: Record<string, unknown>
}

export type TierFeatures = {
  reasons: PinReason[]
  /** Metrics on which this snapshot is a swinging-door change point. */
  changed: string[]
  /** Relative change against the previous snapshot of the same source. */
  deltas: Record<string, number>
  ageDays: number
}

export type TierDecision = { id: string; tier: ValueTier; features: TierFeatures }

function metricValue(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics?.[key]
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

export function relativeChange(previous: number | null, current: number | null): number | null {
  if (previous == null || current == null) return null
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / Math.abs(previous)
}

/**
 * One creator's snapshots → a tier per snapshot. `pins` are outside facts
 * (events, audit) already attached to a snapshot id.
 */
export function decideTiers(
  snapshots: readonly Snapshot[],
  pins: ReadonlyMap<string, readonly PinReason[]>,
  now: Date,
  config: TierConfig = DEFAULT_TIER_CONFIG,
): TierDecision[] {
  const features = new Map<string, TierFeatures>()
  for (const s of snapshots) {
    features.set(s.id, {
      reasons: [...(pins.get(s.id) ?? [])],
      changed: [],
      deltas: {},
      ageDays: Math.max(0, Math.floor((now.getTime() - s.fetchedAt.getTime()) / 86_400_000)),
    })
  }
  const bySource = new Map<string, Snapshot[]>()
  for (const s of snapshots) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s])

  for (const series of bySource.values()) {
    series.sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime() || a.id.localeCompare(b.id))
    features.get(series[series.length - 1]!.id)!.reasons.push('latest')
    for (let i = 1; i < series.length; i += 1) {
      const f = features.get(series[i]!.id)!
      for (const key of new Set([...Object.keys(config.tolerances), ...config.anomalyMetrics])) {
        const delta = relativeChange(metricValue(series[i - 1]!.metrics, key), metricValue(series[i]!.metrics, key))
        if (delta != null && delta !== 0) f.deltas[key] = Math.round(delta * 10_000) / 10_000
        if (delta != null && config.anomalyMetrics.includes(key) && Math.abs(delta) >= config.anomalyRatio) {
          if (!f.reasons.includes('anomaly')) f.reasons.push('anomaly')
          const before = features.get(series[i - 1]!.id)!
          if (!before.reasons.includes('anomaly')) before.reasons.push('anomaly')
        }
      }
    }
    for (const [key, tol] of Object.entries(config.tolerances)) {
      const present = series
        .map((s) => ({ s, v: metricValue(s.metrics, key) }))
        .filter((x): x is { s: Snapshot; v: number } => x.v != null)
      if (present.length < 3) continue
      const points = present.map((x) => ({ t: x.s.fetchedAt.getTime() / 86_400_000, v: x.v }))
      const kept = swingingDoor(points, (anchor) => Math.abs(anchor) * tol)
      // The ends are kept by construction; only interior points say "something changed here".
      for (const index of kept) {
        if (index === 0 || index === present.length - 1) continue
        features.get(present[index]!.s.id)!.changed.push(key)
      }
    }
  }

  return snapshots.map((s) => {
    const f = features.get(s.id)!
    const tier: ValueTier = f.reasons.length
      ? 'pinned'
      : f.changed.length
        ? 'change_point'
        : f.ageDays > config.coldAfterDays
          ? 'cold'
          : 'downsample'
    return { id: s.id, tier, features: f }
  })
}

/** Events land on the newest snapshot taken at or before them (the numbers the decision saw). */
export function pinsFromEvents(
  snapshots: readonly Snapshot[],
  events: readonly { at: Date; reason: PinReason }[],
): Map<string, PinReason[]> {
  const ordered = [...snapshots].sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime())
  const pins = new Map<string, PinReason[]>()
  for (const event of events) {
    let hit: Snapshot | null = null
    for (const s of ordered) {
      if (s.fetchedAt.getTime() <= event.at.getTime()) hit = s
      else break
    }
    if (!hit) continue
    const list = pins.get(hit.id) ?? []
    if (!list.includes(event.reason)) list.push(event.reason)
    pins.set(hit.id, list)
  }
  return pins
}

export type TierRunResult = {
  creators: number
  snapshots: Record<ValueTier, number>
  raw: Record<ValueTier, number>
}

const BATCH = 200

function emptyCounts(): Record<ValueTier, number> {
  return { pinned: 0, change_point: 0, downsample: 0, cold: 0 }
}

/**
 * Daily task `value-tiers`: recomputes every label from scratch (cheap enough
 * per creator, and a fresh publish or assignment can re-pin an old snapshot).
 * A raw fetch takes its snapshot's tier (same creator, source, time); a fetch
 * with no snapshot of its own (a same-day repeat) is `downsample` / `cold`.
 */
export async function runValueTiers(env: AppEnv, config: TierConfig = tierConfig()): Promise<TierRunResult> {
  const now = env.now()
  const result: TierRunResult = { creators: 0, snapshots: emptyCounts(), raw: emptyCounts() }
  let after = ''
  for (;;) {
    const batch = await env.db.query(
      `SELECT id FROM creators WHERE id > $1 AND (
         EXISTS (SELECT 1 FROM creator_metrics_history h WHERE h.creator_id = creators.id)
         OR EXISTS (SELECT 1 FROM creator_raw r WHERE r.creator_id = creators.id))
       ORDER BY id COLLATE "C" LIMIT $2`,
      [after, BATCH],
    )
    const ids = batch.rows.map((row) => row.id as string)
    if (!ids.length) break
    after = ids[ids.length - 1]!
    await tierBatch(env, ids, now, config, result)
    result.creators += ids.length
    if (ids.length < BATCH) break
  }
  return result
}

async function tierBatch(env: AppEnv, ids: string[], now: Date, config: TierConfig, result: TierRunResult) {
  const [history, raw, audits, events] = await Promise.all([
    env.db.query(
      `SELECT id, creator_id, source, fetched_at, metrics FROM creator_metrics_history
        WHERE creator_id = ANY($1::text[])`,
      [ids],
    ),
    env.db.query('SELECT id, creator_id, source, fetched_at FROM creator_raw WHERE creator_id = ANY($1::text[])', [ids]),
    env.db.query(
      `SELECT entity_id AS creator_id, created_at FROM audit_logs
        WHERE entity_type = 'creator' AND entity_id = ANY($1::text[])`,
      [ids],
    ),
    outcomeEvents(env.db, { creatorIds: ids }),
  ])
  const snapshotsOf = new Map<string, Snapshot[]>()
  for (const row of history.rows) {
    const list = snapshotsOf.get(row.creator_id) ?? []
    list.push({ id: row.id, source: row.source, fetchedAt: new Date(row.fetched_at), metrics: row.metrics ?? {} })
    snapshotsOf.set(row.creator_id, list)
  }
  const eventsOf = new Map<string, { at: Date; reason: PinReason }[]>()
  const addEvent = (creatorId: string, at: Date, reason: PinReason) =>
    eventsOf.set(creatorId, [...(eventsOf.get(creatorId) ?? []), { at, reason }])
  for (const event of events as OutcomeEvent[]) addEvent(event.creatorId, event.at, event.kind)
  for (const row of audits.rows) addEvent(row.creator_id, new Date(row.created_at), 'audit')

  const decisions: TierDecision[] = []
  const snapshotKey = new Map<string, TierDecision>()
  for (const [creatorId, snapshots] of snapshotsOf) {
    const decided = decideTiers(snapshots, pinsFromEvents(snapshots, eventsOf.get(creatorId) ?? []), now, config)
    decisions.push(...decided)
    const byId = new Map(snapshots.map((s) => [s.id, s]))
    for (const d of decided) {
      const s = byId.get(d.id)!
      snapshotKey.set(`${creatorId}|${s.source}|${s.fetchedAt.getTime()}`, d)
    }
  }
  const rawDecisions: TierDecision[] = raw.rows.map((row) => {
    const at = new Date(row.fetched_at)
    const match = snapshotKey.get(`${row.creator_id}|${row.source}|${at.getTime()}`)
    if (match) return { id: row.id, tier: match.tier, features: match.features }
    const ageDays = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 86_400_000))
    return {
      id: row.id,
      tier: ageDays > config.coldAfterDays ? 'cold' : 'downsample',
      features: { reasons: [], changed: [], deltas: {}, ageDays },
    }
  })
  await writeTiers(env, 'creator_metrics_history', decisions, now)
  await writeTiers(env, 'creator_raw', rawDecisions, now)
  for (const d of decisions) result.snapshots[d.tier] += 1
  for (const d of rawDecisions) result.raw[d.tier] += 1
}

async function writeTiers(env: AppEnv, table: 'creator_metrics_history' | 'creator_raw', decisions: TierDecision[], now: Date) {
  if (!decisions.length) return
  await env.db.query(
    `UPDATE ${table} t SET value_tier = v.tier, tier_features = v.features, tiered_at = $4
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS tier, unnest($3::jsonb[]) AS features) v
      WHERE t.id = v.id`,
    [decisions.map((d) => d.id), decisions.map((d) => d.tier), decisions.map((d) => JSON.stringify(d.features)), now],
  )
}
