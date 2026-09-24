import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type RawRecord, type SourceAdapter } from '@kcs/contract'
import { persistPage } from '../src/ingest/persist'
import { DEFAULT_REFRESH_MODEL, estimateChangeRate, refreshIntervalDays, refreshModelConfig } from '../src/ingest/refresh-model'
import {
  allocate,
  measureArms,
  mulberry32,
  runScheduler,
  sampleBeta,
  schedulerConfig,
  type Arm,
} from '../src/ingest/scheduler'
import { materialChanges } from '../src/ingest/tiering'
import { createTestApp, type TestCtx } from './helpers'

const arm = (trials: number, successes: number): Arm => ({
  trials, successes, alpha: 1 + successes, beta: 1 + trials - successes, mean: (1 + successes) / (2 + trials),
})

describe('Poisson refresh model', () => {
  it('estimates λ from how many refreshes saw a change', () => {
    // 10 refreshes a day apart, 5 saw a change → λ = −ln(5.5 / 10.5) ≈ 0.647 / day.
    expect(estimateChangeRate(10, 5, 10)).toBeCloseTo(0.6466, 3)
    expect(estimateChangeRate(10, 0, 10)).toBe(0)
    expect(estimateChangeRate(0, 0, 0)).toBeNull()
  })

  it('refreshes when a change is as likely as not, held to 1–30 days; too few visits → 7 days', () => {
    const fast = refreshIntervalDays({ visits: 10, changes: 10, observedDays: 10 })
    expect(fast.days).toBeCloseTo(Math.max(1, Math.log(2) / fast.rate!), 5)
    expect(fast.days).toBeGreaterThanOrEqual(1)
    const half = refreshIntervalDays({ visits: 10, changes: 5, observedDays: 70 })
    expect(half.days).toBeCloseTo(Math.log(2) / (0.6466 / 7), 1)
    expect(refreshIntervalDays({ visits: 10, changes: 0, observedDays: 70 }).days).toBe(30)
    expect(refreshIntervalDays({ visits: 2, changes: 2, observedDays: 2 }).days).toBe(7)
    expect(refreshModelConfig({ REFRESH_MAX_DAYS: '14', REFRESH_DEFAULT_DAYS: '99' })).toMatchObject({ maxDays: 14, defaultDays: 14 })
    expect(refreshModelConfig({})).toEqual(DEFAULT_REFRESH_MODEL)
  })

  it('a material change is a move past the metric\'s tolerance, or a number appearing / disappearing', () => {
    expect(materialChanges({ followers: 10_000 }, { followers: 10_100 })).toEqual([])
    expect(materialChanges({ followers: 10_000 }, { followers: 10_300 })).toEqual(['followers'])
    expect(materialChanges({ cpe: null }, { cpe: 3.2 })).toEqual(['cpe'])
  })
})

describe('Thompson split between refresh and discovery', () => {
  const config = schedulerConfig({})

  it('starts at 70 / 30 until both arms have enough trials', () => {
    expect(allocate(arm(0, 0), arm(0, 0), config)).toEqual({ method: 'start', refreshShare: 0.7, discoveryShare: 0.30000000000000004, winProbability: null })
    expect(allocate(arm(500, 400), arm(10, 0), config).method).toBe('start')
  })

  it('moves toward the better arm, but never below 50% refresh or 10% discovery', () => {
    const refreshWins = allocate(arm(200, 150), arm(200, 5), config, mulberry32(1))
    expect(refreshWins.method).toBe('thompson')
    expect(refreshWins.winProbability).toBeGreaterThan(0.99)
    expect(refreshWins.refreshShare).toBe(0.9)
    const discoveryWins = allocate(arm(200, 5), arm(200, 150), config, mulberry32(2))
    expect(discoveryWins.winProbability).toBeLessThan(0.01)
    expect(discoveryWins.refreshShare).toBe(0.5)
    const even = allocate(arm(100, 30), arm(100, 30), config, mulberry32(3))
    expect(even.refreshShare).toBeGreaterThan(0.5)
    expect(even.refreshShare).toBeLessThan(0.6)
  })

  it('samples Beta draws with the right mean', () => {
    const random = mulberry32(42)
    let sum = 0
    for (let i = 0; i < 20_000; i += 1) sum += sampleBeta(3, 7, random)
    expect(sum / 20_000).toBeCloseTo(0.3, 2)
  })

  it('reads its knobs from the environment', () => {
    expect(schedulerConfig({ INGEST_SCHEDULER: '1', SCHEDULER_BUDGET_SHARE: '0.5', SCHEDULER_REFRESH_MIN: '0.6' }))
      .toMatchObject({ enqueue: true, budgetShare: 0.5, refreshMin: 0.6, discoveryMin: 0.1 })
    expect(schedulerConfig({}).enqueue).toBe(false)
  })
})

const RUN = `sched${Date.now().toString(36)}`

const adapter: SourceAdapter = {
  id: 'qiangua',
  supports: ['externalIds', 'cursor'],
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
        displayName: `调度 ${record.externalId}`,
        xhsId: null,
        avatarUrl: null,
        regions: [],
        verticals: [],
        metrics: { ...emptyMetrics(30), followers: Number(record.payload.fans) },
        warnings: [],
      },
    }
  },
}

describe('scheduler against the database', () => {
  let ctx: TestCtx
  const auth = { authorization: 'Bearer test:ops@kcs.local', 'content-type': 'application/json' }

  beforeAll(async () => {
    ctx = await createTestApp({ getAdapter: (source) => (source === 'qiangua' ? adapter : undefined) })
  })
  beforeEach(async () => {
    await ctx.db.query("DELETE FROM ingest_jobs WHERE schedule IN ('refresh','discovery')")
    await ctx.db.query('DELETE FROM ingest_discovery_searches')
    await ctx.db.query('DELETE FROM ingest_scheduler_state')
  })
  afterAll(() => ctx.close())

  const write = (externalId: string, fans: number, at: string, jobId: string | null = null) => {
    const record: RawRecord = { source: 'qiangua', platform: 'xhs', externalId, fetchedAt: at, payload: { fans, at } }
    return persistPage(ctx.env, adapter, { records: [record], nextCursor: null }, jobId, 'qiangua')
  }

  it('every write updates the link\'s change statistics and the next refresh time', async () => {
    const id = `${RUN}-stats`
    await write(id, 10_000, '2026-09-01T00:00:00Z')
    let link = (await ctx.db.query('SELECT * FROM creator_sources WHERE source = $1 AND external_id = $2', ['qiangua', id])).rows[0]
    expect(link).toMatchObject({ refresh_visits: 0, refresh_changes: 0, refresh_interval_days: 7 })
    expect(new Date(link.next_refresh_at).toISOString()).toBe('2026-09-08T00:00:00.000Z')

    await write(id, 10_050, '2026-09-03T00:00:00Z') // within 2% → no change
    await write(id, 12_000, '2026-09-05T00:00:00Z') // change
    await write(id, 12_010, '2026-09-07T00:00:00Z')
    link = (await ctx.db.query('SELECT * FROM creator_sources WHERE source = $1 AND external_id = $2', ['qiangua', id])).rows[0]
    expect(link).toMatchObject({ refresh_visits: 3, refresh_changes: 1, observed_days: 6 })
    const expected = refreshIntervalDays({ visits: 3, changes: 1, observedDays: 6 })
    expect(Number(link.change_rate)).toBeCloseTo(expected.rate!, 6)
    expect(Number(link.refresh_interval_days)).toBeCloseTo(expected.days, 6)
    const history = await ctx.db.query(
      `SELECT material_change, changed_metrics FROM creator_metrics_history h JOIN creators c ON c.id = h.creator_id
        WHERE c.creator_key = $1 ORDER BY h.fetched_at`,
      [creatorKeyFor('qiangua', id)],
    )
    expect(history.rows.map((r) => r.material_change)).toEqual([null, false, true, false])
    expect(history.rows[2].changed_metrics).toEqual(['followers'])
  })

  it('plans without enqueuing by default, stores the plan, and shows it with the settings', async () => {
    ctx.env.now = () => new Date('2026-09-24T02:00:00Z')
    await ctx.db.query("UPDATE ingest_sources SET quota = 100, enabled = true WHERE id = 'qiangua'")
    await ctx.db.query("DELETE FROM ingest_source_usage WHERE source = 'qiangua'")
    const created = await ctx.app.request('/api/ingest/discovery-searches', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ name: '韩妆新人', query: { source: 'qiangua', window: 30, keyword: '韩妆', externalIds: ['x'] }, maxPages: 3 }),
    })
    expect(created.status).toBe(201)
    const search = await created.json()
    expect(search.query).toEqual({ source: 'qiangua', window: 30, keyword: '韩妆' })

    const state = await runScheduler(ctx.env, schedulerConfig({}), mulberry32(7))
    const plan = state.sources.find((s) => s.source === 'qiangua')!
    expect(state.enqueue).toBe(false)
    expect(state.split.method).toBe('start')
    expect(plan.budget).toBe(80)
    expect(plan.discoveryCalls).toBe(24)
    expect(plan.discoveryJobs).toEqual([{ searchId: search.id, pages: 3, jobId: null }])
    expect(plan.refreshIds).toBeGreaterThan(0)
    const jobs = await ctx.db.query("SELECT count(*)::int AS n FROM ingest_jobs WHERE schedule IN ('refresh','discovery')")
    expect(jobs.rows[0].n).toBe(0)
    expect(state.sources.find((s) => s.source === 'pugongying')!.refreshJobs.every((id) => id.startsWith('dry-run-'))).toBe(true)

    const shown = await ctx.app.request('/api/ingest/scheduler', { headers: { authorization: 'Bearer test:devops@kcs.local' } })
    expect(shown.status).toBe(200)
    const body = await shown.json()
    expect(body.lastPlan.split.refreshShare).toBe(0.7)
    expect(body.config).toMatchObject({ refreshMin: 0.5, discoveryMin: 0.1, startRefreshShare: 0.7, enqueue: false })
    expect(body.due.find((d: { source: string }) => d.source === 'qiangua').due).toBeGreaterThan(0)
  })

  it('with INGEST_SCHEDULER=1 it enqueues refresh jobs (creators in use first) and due searches, once', async () => {
    ctx.env.now = () => new Date('2026-09-24T02:00:00Z')
    await ctx.db.query("UPDATE ingest_sources SET quota = 10, enabled = true WHERE id = 'qiangua'")
    await ctx.db.query("DELETE FROM ingest_source_usage WHERE source = 'qiangua'")
    await ctx.db.query(
      `INSERT INTO ingest_discovery_searches (id, source, name, query, max_pages) VALUES ($1, 'qiangua', 's', '{"keyword":"k"}', 5)`,
      [`${RUN}-search`],
    )
    const released = (await ctx.db.query(
      `SELECT cs.external_id FROM creator_sources cs JOIN creators c ON c.id = cs.creator_id
        WHERE cs.source = 'qiangua' AND c.status = 'released' ORDER BY cs.external_id LIMIT 1`,
    )).rows[0]?.external_id as string | undefined
    const config = schedulerConfig({ INGEST_SCHEDULER: '1' })
    const state = await runScheduler(ctx.env, config, mulberry32(9))
    const plan = state.sources.find((s) => s.source === 'qiangua')!
    expect(plan.budget).toBe(8)
    expect(plan.discoveryJobs[0]!.pages).toBeGreaterThanOrEqual(2)
    const jobs = await ctx.db.query(
      "SELECT schedule, query, max_pages, opened_by FROM ingest_jobs WHERE source_id = 'qiangua' AND schedule IN ('refresh','discovery') ORDER BY schedule",
    )
    const discovery = jobs.rows.find((j) => j.schedule === 'discovery')
    expect(discovery).toMatchObject({ opened_by: 'scheduler', query: { source: 'qiangua', window: 30, keyword: 'k', cursor: null } })
    const refresh = jobs.rows.find((j) => j.schedule === 'refresh')
    expect(refresh.query.externalIds.length).toBe(plan.refreshIds)
    if (released) expect(refresh.query.externalIds[0]).toBe(released)
    const searched = await ctx.db.query('SELECT last_enqueued_at FROM ingest_discovery_searches WHERE id = $1', [`${RUN}-search`])
    expect(searched.rows[0].last_enqueued_at).not.toBeNull()

    const again = await runScheduler(ctx.env, config, mulberry32(9))
    expect(again.sources.find((s) => s.source === 'qiangua')!.skipped).toBe('previous_plan_running')
  })

  it('counts rewards: a refresh that moved the numbers of a creator in use, a discovery that got published', async () => {
    ctx.env.now = () => new Date('2026-09-24T02:00:00Z')
    const job = `${RUN}-refresh-job`
    await ctx.db.query(
      `INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, sample_rate, created_at)
       VALUES ($1, 'qiangua', 'refresh', 'ok', 0, 1, now())`,
      [job],
    )
    const id = `${RUN}-reward`
    await write(id, 5_000, '2026-09-20T00:00:00Z')
    await write(id, 9_000, '2026-09-21T00:00:00Z', job)
    const before = await measureArms(ctx.env, schedulerConfig({}))
    await ctx.db.query("UPDATE creators SET status = 'released' WHERE creator_key = $1", [creatorKeyFor('qiangua', id)])
    const after = await measureArms(ctx.env, schedulerConfig({}))
    expect(after.refresh.trials).toBe(before.refresh.trials)
    expect(after.refresh.successes).toBe(before.refresh.successes + 1)

    const discoveryJob = `${RUN}-discovery-job`
    await ctx.db.query(
      `INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, sample_rate) VALUES ($1, 'qiangua', 'discovery', 'ok', 0, 1)`,
      [discoveryJob],
    )
    await write(`${RUN}-found`, 3_000, '2026-09-22T00:00:00Z', discoveryJob)
    const found = await measureArms(ctx.env, schedulerConfig({}))
    expect(found.discovery.trials).toBe(before.discovery.trials + 1)
    await ctx.db.query('UPDATE creators SET metrics_locked_at = now() WHERE creator_key = $1', [creatorKeyFor('qiangua', `${RUN}-found`)])
    expect((await measureArms(ctx.env, schedulerConfig({}))).discovery.successes).toBe(found.discovery.successes + 1)
  })
})
