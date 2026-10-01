import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('project brief (0091 + POST/PATCH 校验)', () => {
  let ctx: TestCtx
  let selector: string
  let viewer: string
  let projectId: string

  const call = (token: string, method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const create = (body: unknown) => call(selector, 'POST', '/api/select/projects', body)

  beforeAll(async () => {
    ctx = await createTestApp()
    selector = (await ctx.loginJson('selector@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token
  })

  afterAll(() => ctx.close())

  it('0091 adds a nullable jsonb brief column and is idempotent', async () => {
    const { rows } = await ctx.db.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'brief'`,
    )
    expect(rows).toEqual([{ data_type: 'jsonb', is_nullable: 'YES' }])
    const { readFile } = await import('node:fs/promises')
    const sql = await readFile(new URL('../src/migrations/0091_project_brief.sql', import.meta.url), 'utf8')
    await ctx.db.query(sql)
    await ctx.db.query(sql)
  })

  it('creates a project with a valid brief and reads it back on list and detail', async () => {
    const brief = {
      category: '美妆护肤',
      targetCount: 20,
      budgetMin: 5000,
      budgetMax: 80000,
      focus: 'reach',
      deadline: '2026-12-31',
    }
    const created = await create({ name: 'brief 任务', note: '有需求', brief })
    expect(created.status).toBe(201)
    projectId = (await created.json()).id

    const detail = await call(selector, 'GET', `/api/select/projects/${projectId}`)
    expect((await detail.json()).brief).toEqual(brief)
    const list = await call(selector, 'GET', '/api/select/projects')
    const item = (await list.json()).items.find((p: { id: string }) => p.id === projectId)
    expect(item.brief).toEqual(brief)
    expect(item.memberCount).toBe(0)
  })

  it('accepts boundary values and an empty brief', async () => {
    for (const brief of [
      { targetCount: 1 },
      { targetCount: 1000 },
      { budgetMin: 0, budgetMax: 1_000_000 },
      { focus: 'cost' },
      { focus: 'balance' },
      { deadline: null },
      {},
    ]) {
      const res = await create({ name: `边界 ${JSON.stringify(brief).slice(0, 20)}`, brief })
      expect(res.status).toBe(201)
      const detail = await call(selector, 'GET', `/api/select/projects/${(await res.json()).id}`)
      expect((await detail.json()).brief).toEqual(brief)
    }
  })

  it('accepts a project without a brief (legacy shape)', async () => {
    const res = await create({ name: '传统项目' })
    expect(res.status).toBe(201)
    const detail = await call(selector, 'GET', `/api/select/projects/${(await res.json()).id}`)
    expect((await detail.json()).brief).toBeNull()
  })

  it('rejects non-object briefs with a field error', async () => {
    for (const brief of ['美妆', [1, 2], 42]) {
      const res = await create({ name: '坏 brief', brief })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION')
      expect(body.error.fields).toEqual([{ path: 'brief', message: 'brief.type: expected an object' }])
    }
  })

  it('rejects fields outside the whitelist', async () => {
    const res = await create({ name: '坏字段', brief: { category: '美妆', audience: 'Z世代' } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.fields).toEqual([
      { path: 'brief.audience', message: 'brief.field: audience is not allowed' },
    ])
  })

  it('rejects out-of-range and mis-typed fields', async () => {
    const cases: Array<[unknown, string]> = [
      [{ category: 'x'.repeat(51) }, 'brief.category'],
      [{ targetCount: 0 }, 'brief.targetCount'],
      [{ targetCount: 1001 }, 'brief.targetCount'],
      [{ targetCount: 1.5 }, 'brief.targetCount'],
      [{ budgetMin: -1 }, 'brief.budgetMin'],
      [{ budgetMax: 1_000_001 }, 'brief.budgetMax'],
      [{ budgetMin: 100, budgetMax: 50 }, 'brief.budgetMin'],
      [{ focus: 'speed' }, 'brief.focus'],
      [{ deadline: '2026-13-01' }, 'brief.deadline'],
      [{ deadline: '03/01/2026' }, 'brief.deadline'],
      [{ deadline: 20261201 }, 'brief.deadline'],
    ]
    for (const [brief, path] of cases) {
      const res = await create({ name: '越界', brief })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION')
      expect(body.error.fields[0].path).toBe(path)
      expect(body.error.fields[0].message).toMatch(/^brief\.[a-zA-Z]+:/)
    }
  })

  it('rejects a brief larger than 4KB', async () => {
    const res = await create({ name: '太大', brief: { category: 'x'.repeat(5000) } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.fields[0].message).toBe('brief.size: must serialize to at most 4096 bytes')
  })

  it('patches the brief, clears it with null and leaves it alone when absent', async () => {
    const updated = await call(selector, 'PATCH', `/api/select/projects/${projectId}`, {
      brief: { category: '母婴', targetCount: 5, deadline: '2027-01-15' },
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).brief).toEqual({ category: '母婴', targetCount: 5, deadline: '2027-01-15' })

    const renamed = await call(selector, 'PATCH', `/api/select/projects/${projectId}`, { name: '改名任务' })
    expect((await renamed.json()).brief).toEqual({ category: '母婴', targetCount: 5, deadline: '2027-01-15' })

    const cleared = await call(selector, 'PATCH', `/api/select/projects/${projectId}`, { brief: null })
    expect((await cleared.json()).brief).toBeNull()
  })

  it('validates the brief on patch too and 404s unknown projects', async () => {
    const bad = await call(selector, 'PATCH', `/api/select/projects/${projectId}`, { brief: { focus: 'viral' } })
    expect(bad.status).toBe(400)
    const empty = await call(selector, 'PATCH', `/api/select/projects/${projectId}`, {})
    expect(empty.status).toBe(400)
    expect((await empty.json()).error.message).toContain('empty_patch')
    const missing = await call(selector, 'PATCH', '/api/select/projects/nope', { name: 'x' })
    expect(missing.status).toBe(404)
  })

  it('forbids the viewer role from creating or patching', async () => {
    const created = await call(viewer, 'POST', '/api/select/projects', { name: '偷建', brief: {} })
    expect(created.status).toBe(403)
    const patched = await call(viewer, 'PATCH', `/api/select/projects/${projectId}`, { name: '偷改' })
    expect(patched.status).toBe(403)
  })
})
