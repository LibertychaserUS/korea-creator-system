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

  it('seeds 24+ talents with coop mix, multi-currency prices, grades, and unpublished rows', async () => {
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
      label: string | null
    }>
    expect(items.length).toBeGreaterThanOrEqual(24)
    expect(items.some((row) => row.categories.includes('collaborated'))).toBe(true)
    expect(items.some((row) => row.categories.includes('never_collaborated'))).toBe(true)
    expect(items.some((row) => row.status !== 'released')).toBe(true)
    expect(items.some((row) => (row.followers ?? 0) > 0)).toBe(true)
    expect(items.some((row) => row.hasCollaborated && row.collabBrands.length > 0)).toBe(true)
    const currencies = new Set(items.map((row) => row.price?.currency).filter(Boolean))
    expect(currencies.has('CNY')).toBe(true)
    expect(currencies.has('USD')).toBe(true)
    expect(currencies.has('KRW')).toBe(true)
    const grades = new Set(items.map((row) => row.label).filter((g) => g && /[SABC]/.test(g)))
    expect(grades.size).toBeGreaterThanOrEqual(3)
  })

  it('seeds 4+ projects that already have assignments', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/select/projects', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()).items as Array<{ id: string; member_count: number }>
    expect(items.length).toBeGreaterThanOrEqual(4)
    expect(items.filter((row) => Number(row.member_count) > 0).length).toBeGreaterThanOrEqual(4)
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
