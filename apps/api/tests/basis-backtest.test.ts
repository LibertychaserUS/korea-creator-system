import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { emptyMetrics } from '@kcs/contract'
import { backtestRows, runBasisBacktest } from '../src/ingest/basis-backtest'
import { createTestApp, type TestCtx } from './helpers'

const SOURCE = `bt${Date.now().toString(36)}`

describe('basis backtest from creator_events', () => {
  let ctx: TestCtx
  let ids: string[]

  beforeAll(async () => {
    ctx = await createTestApp()
    ids = (await ctx.db.query(
      `SELECT id FROM creators c WHERE metrics_locked_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM creator_events e WHERE e.creator_id = c.id)
        ORDER BY id LIMIT 3`,
    )).rows.map((r) => r.id as string)
    expect(ids).toHaveLength(3)
  })
  afterAll(async () => {
    await ctx.db.query('DELETE FROM creator_metrics_history WHERE source = $1', [SOURCE])
    await ctx.db.query("DELETE FROM creator_events WHERE context->>'test' = $1", [SOURCE])
    await ctx.close()
  })

  const snapshot = async (creatorId: string, at: string, readMedian: number, traffic: 'organic' | 'all', allRead: number | null = null, window = 30) => {
    const metrics = {
      ...emptyMetrics(window as 30 | 90),
      followers: 20_000,
      readMedian,
      cpe: 2,
      basis: { trafficScope: traffic, businessScope: 'coop' },
      allTraffic: allRead == null ? null : { impressionMedian: null, readMedian: allRead, interactionMedian: null, engagementRate: null, fetchedAt: at },
    }
    await ctx.db.query(
      `INSERT INTO creator_metrics_history (id, creator_id, source, "window", fetched_at, metrics) VALUES ($1, $2, $3, $4, $5, $6)`,
      [`${SOURCE}-${creatorId}-${at}-${window}`, creatorId, SOURCE, window, at, JSON.stringify(metrics)],
    )
  }
  const event = (creatorId: string, kind: string, at: string) =>
    ctx.db.query('INSERT INTO creator_events (kind, creator_id, occurred_at, context) VALUES ($1, $2, $3, $4)', [kind, creatorId, at, { test: SOURCE }])

  it('labels published creators as used or not, and reads the latest value per 口径 from before the first use', async () => {
    const [used, dropped, idle] = ids as [string, string, string]
    await snapshot(used, '2026-09-01T00:00:00Z', 1_000, 'organic', 1_800)
    await snapshot(used, '2026-09-05T00:00:00Z', 1_100, 'organic')
    // After the first use: never read, it would leak the outcome.
    await snapshot(used, '2026-09-12T00:00:00Z', 9_999, 'organic', 9_999)
    await snapshot(used, '2026-09-04T00:00:00Z', 7_777, 'organic', null, 90)
    await event(used, 'publish', '2026-09-02T00:00:00Z')
    await event(used, 'assign', '2026-09-10T00:00:00Z')

    await snapshot(dropped, '2026-09-03T00:00:00Z', 500, 'all')
    await event(dropped, 'publish', '2026-09-03T00:00:00Z')
    await event(dropped, 'assign', '2026-09-06T00:00:00Z')
    await event(dropped, 'unassign', '2026-09-07T00:00:00Z')

    // Never published: not labelled.
    await snapshot(idle, '2026-09-03T00:00:00Z', 700, 'organic')

    const rows = await backtestRows(ctx.db, SOURCE)
    const byId = new Map(rows.map((row) => [row.creatorId, row]))
    expect(byId.get(used)).toMatchObject({ used: true, followers: 20_000 })
    expect(byId.get(used)!.values.readMedian).toEqual({ organic: 1_100, all: 1_800 })
    expect(byId.get(used)!.values.cpe).toEqual({ coop: 2 })
    // Assigned and taken off again = not used; its snapshot is 全部流量.
    expect(byId.get(dropped)).toMatchObject({ used: false, values: { readMedian: { all: 500 } } })
    expect(byId.has(idle)).toBe(false)

    const report = await runBasisBacktest(ctx.db, SOURCE)
    expect(report).toMatchObject({ status: 'insufficient', rules: { minRecords: 300 } })
    expect(report.comparisons.every((c) => c.verdict === 'insufficient' && c.scores.every((s) => s.auc == null))).toBe(true)
  })
})
