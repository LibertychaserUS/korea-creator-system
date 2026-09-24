import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_TIER_CONFIG,
  decideTiers,
  pinsFromEvents,
  runValueTiers,
  swingingDoor,
  tierConfig,
  type Snapshot,
} from '../src/ingest/tiering'
import { createTestApp, type TestCtx } from './helpers'

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000)

describe('swinging door', () => {
  const tol = (e: number) => () => e

  it('a straight line keeps only its two ends, however long', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ t: i, v: 100 + 5 * i }))
    expect(swingingDoor(points, tol(1))).toEqual([0, 19])
  })

  it('noise inside the tolerance is ignored; a step is kept on both sides', () => {
    const values = [100, 101, 99, 100, 101, 150, 151, 149, 150]
    const kept = swingingDoor(values.map((v, t) => ({ t, v })), tol(2))
    expect(kept[0]).toBe(0)
    expect(kept[kept.length - 1]).toBe(8)
    expect(kept).toContain(4)
    expect(kept).toContain(5)
    expect(kept.length).toBeLessThanOrEqual(5)
  })

  it('a turning point (up, then down) is kept', () => {
    const values = [0, 10, 20, 30, 40, 30, 20, 10, 0]
    expect(swingingDoor(values.map((v, t) => ({ t, v })), tol(0.5))).toEqual([0, 4, 8])
  })

  it('two points or fewer are all kept', () => {
    expect(swingingDoor([{ t: 0, v: 1 }], tol(1))).toEqual([0])
    expect(swingingDoor([{ t: 0, v: 1 }, { t: 1, v: 9 }], tol(1))).toEqual([0, 1])
  })
})

describe('value tiers for one creator', () => {
  const snap = (id: string, n: number, metrics: Record<string, unknown>, source = 'pugongying'): Snapshot => ({
    id, source, fetchedAt: day(n), metrics,
  })

  it('pins the latest, anomalies and the snapshot a decision saw; labels change points; ages the rest', () => {
    const snapshots = [
      snap('a', 0, { followers: 10_000, readMedian: 1000 }),
      snap('b', 10, { followers: 10_050, readMedian: 1010 }),
      snap('c', 20, { followers: 10_100, readMedian: 1000 }),
      snap('d', 30, { followers: 12_000, readMedian: 1005 }), // follower step, under the anomaly ratio
      snap('e', 40, { followers: 12_050, readMedian: 1000 }),
      snap('f', 50, { followers: 12_100, readMedian: 3000 }), // readMedian ×3 → anomaly
      snap('g', 400, { followers: 12_100, readMedian: 3000 }),
    ]
    const pins = pinsFromEvents(snapshots, [{ at: new Date(day(12).getTime()), reason: 'publish' }])
    expect(pins.get('b')).toEqual(['publish'])
    const now = day(401)
    const tiers = Object.fromEntries(decideTiers(snapshots, pins, now).map((d) => [d.id, d]))
    expect(tiers.g!.tier).toBe('pinned')
    expect(tiers.g!.features.reasons).toContain('latest')
    expect(tiers.b!.tier).toBe('pinned')
    expect(tiers.e!.features.reasons).toContain('anomaly')
    expect(tiers.f!.features.reasons).toContain('anomaly')
    expect(tiers.f!.features.deltas.readMedian).toBe(2)
    expect(tiers.c!.tier).toBe('change_point')
    expect(tiers.c!.features.changed).toContain('followers')
    expect(tiers.a!.features.ageDays).toBe(401)
    expect(tiers.a!.tier).toBe('cold')
  })

  it('sources are separate series: a 蒲公英 vs 千瓜 difference is not an anomaly', () => {
    const snapshots = [
      snap('p1', 0, { followers: 680_000 }),
      snap('q1', 1, { followers: 530_000 }, 'qiangua'),
      snap('p2', 2, { followers: 681_000 }),
      snap('q2', 3, { followers: 531_000 }, 'qiangua'),
      snap('p3', 4, { followers: 682_000 }),
    ]
    const tiers = decideTiers(snapshots, new Map(), day(5))
    expect(tiers.every((d) => !d.features.reasons.includes('anomaly'))).toBe(true)
    expect(tiers.find((d) => d.id === 'p2')!.tier).toBe('downsample')
  })

  it('tolerances, the cold threshold and the anomaly ratio can be set from the environment', () => {
    const config = tierConfig({ TIER_TOLERANCES: '{"followers":0.5,"cpe":null,"custom":0.2}', TIER_COLD_AFTER_DAYS: '30', TIER_ANOMALY_RATIO: '0.9' })
    expect(config.tolerances.followers).toBe(0.5)
    expect(config.tolerances.cpe).toBeUndefined()
    expect(config.tolerances.custom).toBe(0.2)
    expect(config.coldAfterDays).toBe(30)
    expect(config.anomalyRatio).toBe(0.9)
    expect(tierConfig({ TIER_TOLERANCES: 'nope' }).tolerances).toEqual(DEFAULT_TIER_CONFIG.tolerances)
  })
})

describe('value tiers daily task', () => {
  let ctx: TestCtx
  const creator = 'seed_pugongying_pgy_001'

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('labels every snapshot and raw fetch, pins the publish snapshot and the assignment basis, deletes nothing', async () => {
    const run = `tier${Date.now().toString(36)}`
    await ctx.db.query('DELETE FROM creator_metrics_history WHERE creator_id = $1', [creator])
    await ctx.db.query('DELETE FROM creator_raw WHERE creator_id = $1', [creator])
    const days = [1, 5, 9, 13]
    for (const [i, n] of days.entries()) {
      await ctx.db.query(
        `INSERT INTO creator_metrics_history (id, creator_id, source, "window", fetched_at, metrics)
         VALUES ($1, $2, 'pugongying', 30, $3, $4)`,
        [`${run}-h${i}`, creator, day(n), JSON.stringify({ followers: 10_000 + i, readMedian: 1000 })],
      )
      await ctx.db.query(
        `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
         VALUES ($1, $2, 'pugongying', 'pgy_001', $3, '{}')`,
        [`${run}-r${i}`, creator, day(n)],
      )
    }
    await ctx.db.query(
      `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
       VALUES ($1, $2, 'pugongying', 'pgy_001', $3, '{}')`,
      [`${run}-r-extra`, creator, day(5).getTime() + 3_600_000].map((v, i) => (i === 2 ? new Date(v as number) : v)),
    )
    await ctx.db.query('UPDATE creators SET metrics_locked_at = $2 WHERE id = $1', [creator, day(6)])
    ctx.env.now = () => day(20)

    const before = await ctx.db.query('SELECT (SELECT count(*) FROM creator_metrics_history)::int AS h, (SELECT count(*) FROM creator_raw)::int AS r')
    const result = await runValueTiers(ctx.env)
    const after = await ctx.db.query('SELECT (SELECT count(*) FROM creator_metrics_history)::int AS h, (SELECT count(*) FROM creator_raw)::int AS r')
    expect(after.rows[0]).toEqual(before.rows[0])
    expect(result.creators).toBeGreaterThan(0)

    const { rows } = await ctx.db.query(
      `SELECT id, value_tier, tier_features FROM creator_metrics_history WHERE creator_id = $1 ORDER BY fetched_at`,
      [creator],
    )
    expect(rows.map((r) => r.value_tier)).toEqual(['downsample', 'pinned', 'downsample', 'pinned'])
    expect(rows[1].tier_features.reasons).toContain('publish')
    expect(rows[3].tier_features.reasons).toContain('latest')
    const raws = await ctx.db.query('SELECT id, value_tier FROM creator_raw WHERE creator_id = $1 ORDER BY fetched_at, id', [creator])
    expect(Object.fromEntries(raws.rows.map((r) => [r.id, r.value_tier]))).toEqual({
      [`${run}-r0`]: 'downsample',
      [`${run}-r1`]: 'pinned',
      [`${run}-r-extra`]: 'downsample',
      [`${run}-r2`]: 'downsample',
      [`${run}-r3`]: 'pinned',
    })
    const untiered = await ctx.db.query('SELECT count(*)::int AS n FROM creator_metrics_history WHERE value_tier IS NULL')
    expect(untiered.rows[0].n).toBe(0)
  })
})
