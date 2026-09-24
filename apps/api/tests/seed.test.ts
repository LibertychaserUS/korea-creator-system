import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SEED_USERS } from '@kcs/contract'
import { connectDb } from '../src/db'
import { migrate } from '../src/migrate'
import { seed } from '../src/seed'
import { createTestApp, type TestCtx } from './helpers'

const TEST_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test'

describe('usable demo seed', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('keeps the five local demo users', async () => {
    expect(SEED_USERS.map((u) => u.email)).toEqual([
      'admin@kcs.local',
      'ops@kcs.local',
      'devops@kcs.local',
      'selector@kcs.local',
      'viewer@kcs.local',
    ])
    for (const user of SEED_USERS) {
      const res = await ctx.login(user.email, 'Kcs!demo2026')
      expect(res.status, user.email).toBe(200)
      const body = await res.json()
      expect(body.user.role).toBe(user.role)
    }
  })

  it('seeds 24 fixture-normalized talents with all sources, health grades, locks, and drafts', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const res = await ctx.app.request('/api/ops/creators', {
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()).items as Array<{
      status: string
      categories: string[]
      followers: number | null
      hasCollaborated: boolean
      collabBrands: string[]
      price: { currency: string; amountMin: number | null } | null
      source: string
      metrics: { health: string | null; lowActive: boolean | null; cpe: number | null }
      metricsLocked: object | null
    }>
    expect(items.length).toBeGreaterThanOrEqual(24)
    expect(items.some((row) => row.categories.includes('collaborated'))).toBe(true)
    expect(items.some((row) => row.categories.includes('never_collaborated'))).toBe(true)
    expect(items.some((row) => row.status !== 'released')).toBe(true)
    expect(items.some((row) => (row.followers ?? 0) > 0)).toBe(true)
    expect(items.some((row) => row.hasCollaborated && row.collabBrands.length > 0)).toBe(true)
    expect(new Set(items.map((row) => row.source))).toEqual(new Set(['pugongying', 'qiangua', 'xinhong']))
    expect(items.some((row) => row.metrics.health === 'excellent')).toBe(false)
    expect(items.some((row) => row.metrics.health === 'normal')).toBe(true)
    expect(items.some((row) => row.metrics.health === 'abnormal')).toBe(true)
    expect(items.every((row) => row.metrics.health == null || ['healthy', 'abnormal'].includes(row.metrics.health))).toBe(true)
    expect(items.some((row) => row.source === 'pugongying' && row.metrics.lowActive === true)).toBe(true)
    expect(items.some((row) => row.status === 'released' && row.metricsLocked != null)).toBe(true)
    expect(items.every((row) => row.metrics.cpe != null)).toBe(true)
  })

  it('seeds 4+ projects that already have assignments', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/select/projects', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()).items as Array<{ id: string; memberCount: number }>
    expect(items.length).toBeGreaterThanOrEqual(4)
    expect(items.filter((row) => row.memberCount > 0).length).toBeGreaterThanOrEqual(4)
  })

  it('seeds 6+ ingest jobs in varied statuses for the /dev monitor', async () => {
    const devops = await ctx.loginJson('devops@kcs.local')
    const health = await ctx.app.request('/api/dev/health', {
      headers: { authorization: `Bearer ${devops.token}` },
    })
    expect(health.status).toBe(200)
    const body = await health.json()
    expect(Number(body.jobCount)).toBeGreaterThanOrEqual(6)
    const statuses = new Set((body.jobs as Array<{ status: string }>).map((row) => row.status))
    expect(statuses.size).toBeGreaterThanOrEqual(3)
  })

  it('migrations alone write the reference rows and no demo data', async () => {
    const db = await connectDb(TEST_URL)
    try {
      await db.query(`
        TRUNCATE TABLE
          audit_logs, reviews, shortlist_items, assignments, projects, saved_queries,
          creator_raw, creator_metrics_history, creator_sources, prices, collaborations, creator_categories, creators, assets,
          ingest_dead_letters, ingest_jobs, ingest_source_usage, ingest_sources, users, orgs, categories
        RESTART IDENTITY CASCADE
      `)
      await db.query(`DELETE FROM schema_migrations WHERE version = '0008_base_reference_data.sql'`)
      await migrate(db)
      await migrate(db)
      const count = async (sql: string) => (await db.query(sql)).rows[0].n as number
      expect(await count('SELECT count(*)::int AS n FROM orgs')).toBe(1)
      expect(await count('SELECT count(*)::int AS n FROM categories WHERE builtin')).toBe(5)
      expect(await count(`SELECT count(*)::int AS n FROM categories WHERE group_name = 'coop_history'`)).toBe(2)
      expect(await count('SELECT count(*)::int AS n FROM ingest_sources')).toBe(4)
      for (const table of ['creators', 'projects', 'assignments', 'ingest_jobs', 'saved_queries', 'users']) {
        expect(await count(`SELECT count(*)::int AS n FROM ${table}`), table).toBe(0)
      }
      await db.query(`UPDATE ingest_sources SET name = '千瓜（停用）', enabled = false WHERE id = 'qiangua'`)
      await db.query(`DELETE FROM schema_migrations WHERE version = '0008_base_reference_data.sql'`)
      await migrate(db)
      const qiangua = await db.query(`SELECT name, enabled FROM ingest_sources WHERE id = 'qiangua'`)
      expect(qiangua.rows[0]).toEqual({ name: '千瓜（停用）', enabled: false })
    } finally {
      await seed(db, { reset: true })
      await db.end()
    }
  })

  it('does not duplicate seed rows when run again without reset', async () => {
    const db = await connectDb(TEST_URL)
    await migrate(db)
    const first = await seed(db)
    const second = await seed(db)
    await db.end()
    expect(second).toEqual(first)
    expect(first.talents).toBeGreaterThanOrEqual(24)
    expect(first.projects).toBeGreaterThanOrEqual(4)
    expect(first.assignments).toBeGreaterThanOrEqual(4)
    expect(first.ingestJobs).toBeGreaterThanOrEqual(6)
    expect(first.users).toBeGreaterThanOrEqual(5)
  })
})
