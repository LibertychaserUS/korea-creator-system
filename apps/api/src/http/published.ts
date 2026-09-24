/**
 * `creator_published`: the select pool as a narrow table (migration 0023).
 *
 * One row per released creator with the publish snapshot as typed columns and
 * the percentiles precomputed (contract `cohort.ts`). Rows are written when a
 * creator is published or taken down, inside that transaction, and the whole
 * group (source × window × content form) is re-ranked under an advisory lock;
 * only rows whose ranks changed are updated. Nothing on a read path writes.
 *
 * `refreshPublished` rebuilds from `creators` (startup, seed, and the daily
 * job, since snapshots go stale with time). The table is a projection: every
 * row can be rebuilt, so removing one loses nothing.
 */
import {
  COHORT_RULES,
  METRIC_KEYS,
  RANKED_METRIC_KEYS,
  VISIBLE_METRIC_KEYS,
  calibrateSample,
  cohortGroupKey,
  isStale,
  parseCohortGroupKey,
  rankAgainst,
  rankGroup,
  referenceLines,
  tierOf,
  toMinorUnits,
  type CohortMember,
  type CreatorMetrics,
  type MetricPercentiles,
  type NumericMetricKey,
  type SampleCalibration,
} from '@kcs/contract'
import type pg from 'pg'
import type { Db, Queryable } from '../db'
import { asPublished, attachCreatorMeta } from './creators'

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

export function metricColumn(key: NumericMetricKey | 'followers'): string {
  if (!METRIC_KEYS.includes(key as NumericMetricKey)) throw new Error(`unknown metric ${key}`)
  return `m_${snake(key)}`
}

export function rankColumn(key: NumericMetricKey): string {
  if (!RANKED_METRIC_KEYS.includes(key)) throw new Error(`unranked metric ${key}`)
  return `p_${snake(key)}`
}

const METRIC_COLUMNS = METRIC_KEYS.map(metricColumn)
const RANK_COLUMNS = RANKED_METRIC_KEYS.map(rankColumn)
/** Advisory lock namespace for one group's recompute (the migration lock is 4_912_734). */
const COHORT_LOCK = 4_912_735
const CHUNK = 1_000

export function sourceKey(source: string | null | undefined): string {
  return source ?? '-'
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function num(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function lockGroups(q: Queryable, keys: Iterable<string>) {
  for (const key of [...new Set(keys)].sort()) {
    await q.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [COHORT_LOCK, key])
  }
}

type Built = { groupKey: string; record: Record<string, unknown> }

/** A published row from a `creators` row (+ its meta), or null when it is not in the pool. */
function buildRecord(row: Record<string, any>, item: Record<string, any>): Built | null {
  if (row.status !== 'released') return null
  const published = asPublished(item)
  const metrics = published.metrics as CreatorMetrics
  const group = { source: item.source ?? null, window: metrics.window, contentForm: metrics.contentForm ?? null }
  const groupKey = cohortGroupKey(group)
  const price = item.price as { amountMin: number | null; amountMax: number | null; currency: string; unit: string; fxToCny: number | null } | null
  const lockedAt = row.metrics_locked_at ?? row.updated_at ?? new Date()
  const record: Record<string, unknown> = {
    creator_id: row.id,
    group_key: groupKey,
    source: group.source,
    window: group.window,
    content_form: group.contentForm,
    tier: tierOf(metrics.followers),
    health: metrics.health ?? null,
    low_active: metrics.lowActive ?? null,
    display_name: item.displayName,
    creator_key: item.creatorKey,
    xhs_id: item.xhsId,
    avatar_key: item.avatarKey,
    external_id: item.externalId,
    followers_unknown: Boolean(item.followersUnknown),
    regions: item.regions ?? [],
    verticals: item.verticals ?? [],
    categories: [...(item.categories ?? [])].sort(),
    blacklisted: (item.categories ?? []).includes('blacklist'),
    collab_count: item.collabCount ?? 0,
    collab_brands: item.collabBrands ?? [],
    coop_brands: metrics.coopBrands ?? [],
    price_currency: price?.currency ?? null,
    price_min_minor: price ? toMinorUnits(price.amountMin, price.currency) : null,
    price_max_minor: price ? toMinorUnits(price.amountMax, price.currency) : null,
    price_fx: price?.fxToCny ?? null,
    price_unit: price?.unit ?? null,
    metrics,
    fetched_at: row.metrics_locked_fetched_at ?? lockedAt,
    latest_fetched_at: row.metrics_fetched_at ?? null,
    published_at: lockedAt,
  }
  for (const key of METRIC_KEYS) record[metricColumn(key)] = metrics[key] ?? null
  return { groupKey, record }
}

const UPSERT_COLUMNS = [
  'creator_id', 'group_key', 'source', 'window', 'content_form', 'tier', 'health', 'low_active',
  'display_name', 'creator_key', 'xhs_id', 'avatar_key', 'external_id', 'followers_unknown',
  'regions', 'verticals', 'categories', 'blacklisted', 'collab_count', 'collab_brands', 'coop_brands',
  'price_currency', 'price_min_minor', 'price_max_minor', 'price_fx', 'price_unit',
  'metrics', 'fetched_at', 'latest_fetched_at', 'published_at', ...METRIC_COLUMNS,
]
const quoted = (column: string) => (column === 'window' ? '"window"' : column)

async function upsertRecords(q: Queryable, records: Array<Record<string, unknown>>) {
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    await q.query(
      `INSERT INTO creator_published (${UPSERT_COLUMNS.map(quoted).join(', ')})
       SELECT ${UPSERT_COLUMNS.map(quoted).join(', ')}
         FROM jsonb_populate_recordset(NULL::creator_published, $1::jsonb)
       ON CONFLICT (creator_id) DO UPDATE SET
         ${UPSERT_COLUMNS.slice(1).map((c) => `${quoted(c)} = EXCLUDED.${quoted(c)}`).join(',\n         ')}`,
      [JSON.stringify(chunk)],
    )
  }
}

/**
 * Bring the published rows of `ids` in line with `creators`: released → written,
 * anything else → removed. Returns the groups whose ranks may have moved: a row
 * came, went, changed group, blacklist or snapshot. The caller re-ranks them in
 * the same transaction (`recomputeGroups`).
 */
export async function syncPublished(q: Queryable, ids: string[]): Promise<Set<string>> {
  const moved = new Set<string>()
  if (!ids.length) return moved
  const before = await q.query(
    'SELECT creator_id, group_key, blacklisted, published_at FROM creator_published WHERE creator_id = ANY($1)',
    [ids],
  )
  const was = new Map(before.rows.map((row) => [String(row.creator_id), row]))
  const { rows } = await q.query('SELECT * FROM creators WHERE id = ANY($1)', [ids])
  const items = new Map((await attachCreatorMeta(q as Db, rows, false)).map((item) => [item.id, item]))
  const built = rows.map((row) => buildRecord(row, items.get(row.id)!)).filter((b): b is Built => b != null)
  const now = new Map(built.map((b) => [String(b.record.creator_id), b]))
  for (const [id, row] of was) {
    const next = now.get(id)
    const at = (value: unknown) => (value instanceof Date ? value.getTime() : value == null ? null : Date.parse(String(value)))
    if (!next || next.groupKey !== row.group_key || Boolean(next.record.blacklisted) !== Boolean(row.blacklisted)
      || at(next.record.published_at) !== at(row.published_at)) {
      moved.add(row.group_key)
      if (next) moved.add(next.groupKey)
    }
  }
  for (const [id, b] of now) if (!was.has(id)) moved.add(b.groupKey)
  await lockGroups(q, [...was.values()].map((row) => String(row.group_key)).concat(built.map((b) => b.groupKey)))
  await upsertRecords(q, built.map((b) => b.record))
  await q.query(
    'DELETE FROM creator_published WHERE creator_id = ANY($1) AND NOT (creator_id = ANY($2))',
    [ids, [...now.keys()]],
  )
  return moved
}

/** Sync `ids` and re-rank what moved, in one transaction. */
export async function republish(db: Db, ids: string[], now = new Date()) {
  return inTransaction(db, async (client) => {
    const moved = await syncPublished(client, ids)
    // Triggers already applied a blacklist change and marked the group dirty.
    const dirty = await client.query(
      `SELECT d.group_key FROM cohort_dirty_groups d
        WHERE d.group_key IN (SELECT group_key FROM creator_published WHERE creator_id = ANY($1))`,
      [ids],
    )
    for (const row of dirty.rows) moved.add(String(row.group_key))
    return moved.size ? recomputeGroups(client, moved, { now }) : { groups: 0, changed: 0 }
  })
}

export async function loadTargets(q: Queryable): Promise<Map<string, number>> {
  const { rows } = await q.query('SELECT source_key, target FROM cohort_calibration')
  return new Map(rows.map((row) => [String(row.source_key), Number(row.target)]))
}

function targetFor(targets: Map<string, number>, source: string | null): number {
  return targets.get(sourceKey(source)) ?? COHORT_RULES.analyticSample
}

function memberFromRow(row: Record<string, any>, now: Date): CohortMember {
  const metrics: Record<string, unknown> = { platformRanks: row.platform_ranks ?? null }
  for (const key of METRIC_KEYS) metrics[key] = num(row[metricColumn(key)])
  return {
    id: String(row.creator_id),
    followers: metrics.followers as number | null,
    metrics: metrics as CreatorMetrics,
    stale: isStale(row.fetched_at, now),
  }
}

const MEMBER_COLUMNS = `creator_id, source, fetched_at, metrics->'platformRanks' AS platform_ranks, ${METRIC_COLUMNS.join(', ')}`

async function groupMembers(q: Queryable, groupKey: string, now: Date, extra = '') {
  const { rows } = await q.query(
    `SELECT ${MEMBER_COLUMNS}${extra} FROM creator_published WHERE group_key = $1 AND NOT blacklisted`,
    [groupKey],
  )
  return { rows, members: rows.map((row) => memberFromRow(row, now)) }
}

function rankColumnsOf(ranks: MetricPercentiles): Array<number | null> {
  return RANKED_METRIC_KEYS.map((key) => (ranks[key] ? Math.round(ranks[key]!.percentile * 10) : null))
}

/**
 * Re-rank whole groups and refresh their reference lines. Must run inside a
 * transaction: the group's advisory lock is held until commit.
 */
export async function recomputeGroups(
  q: Queryable,
  groupKeys: Iterable<string>,
  options: { now?: Date; targets?: Map<string, number> } = {},
): Promise<{ groups: number; changed: number }> {
  const now = options.now ?? new Date()
  const keys = [...new Set(groupKeys)].sort()
  await lockGroups(q, keys)
  const targets = options.targets ?? await loadTargets(q)
  let changed = 0
  for (const groupKey of keys) {
    const { source } = parseCohortGroupKey(groupKey)
    const { rows, members } = await groupMembers(q, groupKey, now, `, ranks, ${RANK_COLUMNS.join(', ')}`)
    const ranked = rankGroup(members, { target: targetFor(targets, source) })
    const updates: Array<Record<string, unknown>> = []
    for (const row of rows) {
      const ranks = ranked.get(String(row.creator_id)) ?? {}
      const columns = rankColumnsOf(ranks)
      const same = stableJson(row.ranks ?? {}) === stableJson(ranks)
        && columns.every((value, i) => num(row[RANK_COLUMNS[i]]) === value)
      if (same) continue
      const update: Record<string, unknown> = { creator_id: row.creator_id, ranks }
      RANK_COLUMNS.forEach((column, i) => { update[column] = columns[i] })
      updates.push(update)
    }
    for (let i = 0; i < updates.length; i += CHUNK) {
      await q.query(
        `UPDATE creator_published p SET ranks = u.ranks, ranked_at = $2,
           ${RANK_COLUMNS.map((c) => `${c} = u.${c}`).join(', ')}
         FROM jsonb_to_recordset($1::jsonb) AS u(creator_id text, ranks jsonb, ${RANK_COLUMNS.map((c) => `${c} smallint`).join(', ')})
         WHERE p.creator_id = u.creator_id`,
        [JSON.stringify(updates.slice(i, i + CHUNK)), now],
      )
    }
    changed += updates.length
    await q.query(
      `UPDATE creator_published SET ranks = '{}'::jsonb, ranked_at = $2, ${RANK_COLUMNS.map((c) => `${c} = NULL`).join(', ')}
        WHERE group_key = $1 AND blacklisted AND ranks <> '{}'::jsonb`,
      [groupKey, now],
    )
    const lines = referenceLines(members, VISIBLE_METRIC_KEYS)
    await q.query(
      `WITH incoming AS (
         SELECT * FROM jsonb_to_recordset($2::jsonb) AS l(tier text, key text, n integer, p25 float8, p50 float8, p75 float8)
       ), gone AS (
         DELETE FROM cohort_reference_lines r
          WHERE r.group_key = $1 AND NOT EXISTS (SELECT 1 FROM incoming i WHERE i.tier = r.tier AND i.key = r.metric)
       )
       INSERT INTO cohort_reference_lines (group_key, tier, metric, n, p25, p50, p75, computed_at)
       SELECT $1, tier, key, n, p25, p50, p75, $3 FROM incoming
       ON CONFLICT (group_key, tier, metric) DO UPDATE SET
         n = EXCLUDED.n, p25 = EXCLUDED.p25, p50 = EXCLUDED.p50, p75 = EXCLUDED.p75, computed_at = EXCLUDED.computed_at`,
      [groupKey, JSON.stringify(lines), now],
    )
    await q.query('DELETE FROM cohort_dirty_groups WHERE group_key = $1', [groupKey])
  }
  return { groups: keys.length, changed }
}

export async function inTransaction<T>(db: Db, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Groups marked by triggers (blacklist change, removed row): re-rank each in its own transaction. */
export async function recomputeDirtyGroups(db: Db, now = new Date()): Promise<number> {
  const { rows } = await db.query('SELECT group_key FROM cohort_dirty_groups ORDER BY group_key')
  for (const row of rows) await inTransaction(db, (client) => recomputeGroups(client, [row.group_key], { now }))
  return rows.length
}

export type Calibration = SampleCalibration & { source: string | null; computedAt: string }

/** Bootstrap each source's needed sample from its current published rows and store it with its basis. */
export async function calibrateSources(db: Db, now = new Date()): Promise<Calibration[]> {
  const { rows } = await db.query(
    `SELECT ${MEMBER_COLUMNS} FROM creator_published WHERE NOT blacklisted ORDER BY creator_id COLLATE "C"`,
  )
  const bySource = new Map<string, CohortMember[]>()
  for (const row of rows) {
    const key = sourceKey(row.source)
    bySource.set(key, [...(bySource.get(key) ?? []), memberFromRow(row, now)])
  }
  const out: Calibration[] = []
  for (const [key, members] of [...bySource].sort(([a], [b]) => a.localeCompare(b))) {
    const result = calibrateSample(members)
    await db.query(
      `INSERT INTO cohort_calibration (source_key, target, required, method, pool_size, basis, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (source_key) DO UPDATE SET target = EXCLUDED.target, required = EXCLUDED.required,
         method = EXCLUDED.method, pool_size = EXCLUDED.pool_size, basis = EXCLUDED.basis, computed_at = EXCLUDED.computed_at`,
      [key, result.target, result.required, result.method, result.poolSize, JSON.stringify({ metrics: result.metrics, rules: result.rules }), now],
    )
    out.push({ ...result, source: key === '-' ? null : key, computedAt: now.toISOString() })
  }
  return out
}

export async function readCalibration(q: Queryable) {
  const { rows } = await q.query('SELECT * FROM cohort_calibration ORDER BY source_key')
  return rows.map((row) => ({
    source: row.source_key === '-' ? null : String(row.source_key),
    target: Number(row.target),
    required: row.required == null ? null : Number(row.required),
    method: String(row.method),
    poolSize: Number(row.pool_size),
    basis: row.basis,
    computedAt: row.computed_at instanceof Date ? row.computed_at.toISOString() : String(row.computed_at),
  }))
}

/**
 * Rebuild the pool table from `creators`: drop rows no longer released, write
 * missing or republished ones (`full`: all), calibrate, then re-rank every
 * group (staleness moves with the clock, so every group, not only touched ones).
 */
export async function refreshPublished(
  db: Db,
  options: { now?: Date; full?: boolean; calibrate?: boolean } = {},
): Promise<{ written: number; removed: number; groups: number; changed: number }> {
  const now = options.now ?? new Date()
  const removed = await db.query(
    `DELETE FROM creator_published p
      WHERE NOT EXISTS (SELECT 1 FROM creators c WHERE c.id = p.creator_id AND c.status = 'released')`,
  )
  const { rows: todo } = await db.query(
    `SELECT c.id FROM creators c LEFT JOIN creator_published p ON p.creator_id = c.id
      WHERE c.status = 'released'
        AND ($1 OR p.creator_id IS NULL
          -- published_at went through a JS Date (milliseconds).
          OR p.published_at IS DISTINCT FROM date_trunc('milliseconds', COALESCE(c.metrics_locked_at, c.updated_at)))
      ORDER BY c.id`,
    [Boolean(options.full)],
  )
  for (let i = 0; i < todo.length; i += CHUNK) {
    const ids = todo.slice(i, i + CHUNK).map((row) => String(row.id))
    const { rows } = await db.query('SELECT * FROM creators WHERE id = ANY($1)', [ids])
    const items = new Map((await attachCreatorMeta(db, rows, false)).map((item) => [item.id, item]))
    const built = rows.map((row) => buildRecord(row, items.get(row.id)!)).filter((b): b is Built => b != null)
    await upsertRecords(db, built.map((b) => b.record))
  }
  if (options.calibrate !== false) await calibrateSources(db, now)
  const targets = await loadTargets(db)
  const { rows: groups } = await db.query(
    `SELECT DISTINCT group_key FROM creator_published
     UNION SELECT group_key FROM cohort_dirty_groups ORDER BY 1`,
  )
  let changed = 0
  for (const row of groups) {
    changed += (await inTransaction(db, (client) => recomputeGroups(client, [row.group_key], { now, targets }))).changed
  }
  return { written: todo.length, removed: removed.rowCount ?? 0, groups: groups.length, changed }
}

/**
 * Percentiles for rows shown outside the pool list (detail, shortlist,
 * project): stored ranks when the row is in the pool table, otherwise ranked
 * on the fly against its group as it stands (read only). A stale snapshot has
 * none.
 */
export async function ranksFor(
  q: Queryable,
  items: Array<{ id: string; source: string | null; metrics: CreatorMetrics; stale?: boolean }>,
  now = new Date(),
): Promise<Map<string, MetricPercentiles>> {
  const out = new Map<string, MetricPercentiles>()
  if (!items.length) return out
  const { rows } = await q.query(
    'SELECT creator_id, ranks, fetched_at FROM creator_published WHERE creator_id = ANY($1) AND NOT blacklisted',
    [items.map((item) => item.id)],
  )
  const stored = new Map(rows.map((row) => [String(row.creator_id), row]))
  const missing = new Map<string, typeof items>()
  for (const item of items) {
    const row = stored.get(item.id)
    if (row) {
      out.set(item.id, isStale(row.fetched_at, now) ? {} : (row.ranks ?? {}))
      continue
    }
    if (item.stale) {
      out.set(item.id, {})
      continue
    }
    const key = cohortGroupKey({ source: item.source, window: item.metrics.window, contentForm: item.metrics.contentForm ?? null })
    missing.set(key, [...(missing.get(key) ?? []), item])
  }
  if (missing.size) {
    const targets = await loadTargets(q)
    for (const [groupKey, list] of missing) {
      const { members } = await groupMembers(q, groupKey, now)
      for (const item of list) {
        out.set(item.id, rankAgainst(members, { id: item.id, followers: item.metrics.followers, metrics: item.metrics }, {
          target: targetFor(targets, item.source),
        }))
      }
    }
  }
  return out
}

export type ReferenceLineRow = {
  group: string
  source: string | null
  window: number
  contentForm: string | null
  tier: string
  key: NumericMetricKey
  n: number
  p25: number
  p50: number
  p75: number
}

/**
 * Stored 25 / 50 / 75 分位 lines (groups × tiers with ≥ 30 current values).
 * `where` narrows by source, window, content form, tier or metric.
 */
export async function readReferenceLines(
  q: Queryable,
  where: { groups?: string[]; source?: string | null; window?: number; contentForm?: string | null; tier?: string; key?: string } = {},
): Promise<ReferenceLineRow[]> {
  const clauses: string[] = []
  const values: unknown[] = []
  const add = (sql: string, value: unknown) => {
    values.push(value)
    clauses.push(sql.replace('?', `$${values.length}`))
  }
  if (where.groups) add('group_key = ANY(?)', where.groups)
  if (where.tier) add('tier = ?', where.tier)
  if (where.key) add('metric = ?', where.key)
  const { rows } = await q.query(
    `SELECT group_key, tier, metric, n, p25, p50, p75 FROM cohort_reference_lines
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY group_key, tier, metric`,
    values,
  )
  return rows
    .map((row) => ({ row, group: parseCohortGroupKey(String(row.group_key)) }))
    .filter(({ group }) =>
      (where.source === undefined || group.source === where.source)
      && (where.window === undefined || group.window === where.window)
      && (where.contentForm === undefined || group.contentForm === where.contentForm))
    .map(({ row, group }) => ({
      group: String(row.group_key),
      ...group,
      tier: String(row.tier),
      key: row.metric as NumericMetricKey,
      n: Number(row.n),
      p25: Number(row.p25),
      p50: Number(row.p50),
      p75: Number(row.p75),
    }))
}
