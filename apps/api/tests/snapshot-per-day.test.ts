import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type RawRecord, type SourceAdapter } from '@kcs/contract'
import { persistPage } from '../src/ingest/persist'
import { seed } from '../src/seed'
import { createTestApp, type TestCtx } from './helpers'

const RUN = `day${Date.now().toString(36)}`

const adapter: SourceAdapter = {
  id: 'qiangua',
  supports: ['externalIds'],
  provides: ['followers'],
  async fetch() {
    return { records: [], nextCursor: null }
  },
  normalize(record) {
    return {
      ok: true,
      creator: {
        creatorKey: creatorKeyFor('qiangua', record.externalId),
        externalId: record.externalId,
        platform: 'xhs',
        displayName: `快照 ${record.externalId}`,
        xhsId: null,
        avatarUrl: null,
        regions: [],
        verticals: [],
        metrics: { ...emptyMetrics(record.payload.window === 90 ? 90 : 30), followers: Number(record.payload.fans) },
        warnings: [],
      },
    }
  },
}

describe('one snapshot per creator, source and day', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp({ getAdapter: (source) => (source === 'qiangua' ? adapter : undefined) })
  })
  afterAll(() => ctx.close())

  const write = (externalId: string, fans: number, at: string, jobId: string | null = null, window = 30) => {
    const record: RawRecord = { source: 'qiangua', platform: 'xhs', externalId, fetchedAt: at, payload: { fans, at, window } }
    return persistPage(ctx.env, adapter, { records: [record], nextCursor: null }, jobId, 'qiangua')
  }
  const snapshots = async (externalId: string) => (await ctx.db.query(
    `SELECT h.fetched_at, h.job_id, h."window", h.snapshot_day::text AS day, (h.metrics->>'followers')::int AS followers,
            h.material_change
       FROM creator_metrics_history h JOIN creator_sources s ON s.creator_id = h.creator_id AND s.source = h.source
      WHERE s.external_id = $1 ORDER BY h."window", h.fetched_at`,
    [externalId],
  )).rows
  const raws = async (externalId: string) => Number((await ctx.db.query(
    "SELECT count(*) AS n FROM creator_raw WHERE source = 'qiangua' AND external_id = $1",
    [externalId],
  )).rows[0].n)
  const job = async () => {
    const id = `${RUN}-job-${Math.random().toString(36).slice(2, 8)}`
    await ctx.db.query(
      "INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, sample_rate) VALUES ($1, 'qiangua', 'once', 'ok', 0, 1)",
      [id],
    )
    return id
  }

  it('a later fetch the same day overwrites; every fetch keeps its raw row', async () => {
    const id = `${RUN}-same`
    const [first, second] = [await job(), await job()]
    await write(id, 10_000, '2026-09-10T01:00:00Z', first)
    await write(id, 11_000, '2026-09-10T09:00:00Z', second)
    expect(await snapshots(id)).toEqual([
      expect.objectContaining({ day: '2026-09-10', followers: 11_000, job_id: second }),
    ])
    expect(await raws(id)).toBe(2)
  })

  it('an older fetch arriving late leaves the day\'s latest alone', async () => {
    const id = `${RUN}-late`
    await write(id, 20_000, '2026-09-10T09:00:00Z')
    await write(id, 19_000, '2026-09-10T02:00:00Z')
    const rows = await snapshots(id)
    expect(rows).toHaveLength(1)
    expect(rows[0].followers).toBe(20_000)
    expect(await raws(id)).toBe(2)
  })

  it('the day is Beijing\'s: 15:59 and 16:01 UTC are two days', async () => {
    const id = `${RUN}-tz`
    await write(id, 30_000, '2026-09-10T15:59:00Z')
    await write(id, 30_000, '2026-09-10T16:01:00Z')
    expect((await snapshots(id)).map((row) => row.day)).toEqual(['2026-09-10', '2026-09-11'])
  })

  it('30- and 90-day numbers are kept apart', async () => {
    const id = `${RUN}-window`
    await write(id, 40_000, '2026-09-10T01:00:00Z', null, 30)
    await write(id, 40_000, '2026-09-10T02:00:00Z', null, 90)
    expect((await snapshots(id)).map((row) => row.window)).toEqual([30, 90])
  })

  it('"did it change" compares with an earlier day, and a same-day refetch replaces that observation', async () => {
    const id = `${RUN}-stats`
    const link = async () => (await ctx.db.query(
      "SELECT refresh_visits, refresh_changes, observed_days FROM creator_sources WHERE source = 'qiangua' AND external_id = $1",
      [id],
    )).rows[0]
    await write(id, 10_000, '2026-09-01T02:00:00Z')
    await write(id, 12_000, '2026-09-03T02:00:00Z')
    expect(await link()).toMatchObject({ refresh_visits: 1, refresh_changes: 1 })
    expect(Number((await link()).observed_days)).toBeCloseTo(2, 6)

    // Back to where it was, later the same day: one observation, now "no change".
    await write(id, 10_050, '2026-09-03T08:00:00Z')
    expect(await link()).toMatchObject({ refresh_visits: 1, refresh_changes: 0 })
    expect(Number((await link()).observed_days)).toBeCloseTo(2.25, 6)
    const rows = await snapshots(id)
    expect(rows.map((row) => [row.day, row.followers, row.material_change])).toEqual([
      ['2026-09-01', 10_000, null],
      ['2026-09-03', 10_050, false],
    ])
  })

  it('re-seeding demo history on start-up yields to a real snapshot of the same day', async () => {
    const demo = (await ctx.db.query(
      "SELECT id, creator_id, source, \"window\", fetched_at FROM creator_metrics_history WHERE id LIKE '%\\_history\\_0' LIMIT 1",
    )).rows[0]
    await ctx.db.query('DELETE FROM creator_metrics_history WHERE id = $1', [demo.id])
    await ctx.db.query(
      `INSERT INTO creator_metrics_history (id, creator_id, source, "window", fetched_at, metrics)
       VALUES ($1, $2, $3, $4, $5::timestamptz + interval '1 minute', $6)`,
      [`${RUN}-real`, demo.creator_id, demo.source, demo.window, demo.fetched_at, JSON.stringify(emptyMetrics(demo.window))],
    )
    await seed(ctx.db)
    const ids = (await ctx.db.query(
      'SELECT id FROM creator_metrics_history WHERE creator_id = $1 AND source = $2 AND snapshot_day = (SELECT snapshot_day FROM creator_metrics_history WHERE id = $3)',
      [demo.creator_id, demo.source, `${RUN}-real`],
    )).rows.map((row) => row.id)
    expect(ids).toEqual([`${RUN}-real`])
  })

  it('the migration folds existing same-day copies into the day\'s last one, and can run again', async () => {
    const id = `${RUN}-migrate`
    await write(id, 50_000, '2026-09-12T01:00:00Z')
    const creatorId = (await ctx.db.query(
      "SELECT creator_id FROM creator_sources WHERE source = 'qiangua' AND external_id = $1",
      [id],
    )).rows[0].creator_id
    const sql = await readFile(new URL('../src/migrations/0049_snapshot_per_day.sql', import.meta.url), 'utf8')
    await ctx.db.query('DROP INDEX creator_metrics_history_day_uidx')
    try {
      for (const [n, at] of [[51_000, '2026-09-12T05:00:00Z'], [52_000, '2026-09-12T12:00:00Z']] as const) {
        await ctx.db.query(
          `INSERT INTO creator_metrics_history (id, creator_id, source, "window", fetched_at, metrics)
           VALUES ($1, $2, 'qiangua', 30, $3, $4)`,
          [`${id}-${n}`, creatorId, at, JSON.stringify({ ...emptyMetrics(30), followers: n })],
        )
      }
    } finally {
      await ctx.db.query(sql)
    }
    expect((await snapshots(id)).map((row) => row.followers)).toEqual([52_000])
    await ctx.db.query(sql)
    expect((await snapshots(id)).map((row) => row.followers)).toEqual([52_000])
  })
})
