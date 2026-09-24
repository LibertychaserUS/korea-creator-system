import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultSavedQuery } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'

describe('saved query CRUD and run', () => {
  let ctx: TestCtx
  let token: string
  let id: string

  beforeAll(async () => {
    ctx = await createTestApp()
    token = (await ctx.loginJson('selector@kcs.local')).token
  })
  afterAll(() => ctx.close())

  it('rejects an invalid query with field errors', async () => {
    const res = await ctx.app.request('/api/select/queries', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', filters: [] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'invalid_query',
        fields: [{ path: 'name', message: 'name.required' }],
      },
      errors: ['name.required'],
    })
  })

  it('creates, lists, reads and increments version on patch', async () => {
    const spec = defaultSavedQuery({
      name: '测试性价比',
      filters: [{ key: 'cpe', op: 'lte', value: 3 }],
      health: ['healthy'],
    })
    const created = await ctx.app.request('/api/select/queries', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(spec),
    })
    expect(created.status).toBe(201)
    const body = await created.json()
    id = body.id
    expect(body).toMatchObject({ name: '测试性价比', version: 1 })

    const list = await ctx.app.request('/api/select/queries', { headers: { authorization: `Bearer ${token}` } })
    expect((await list.json()).items.some((item: { id: string }) => item.id === id)).toBe(true)

    const patched = await ctx.app.request(`/api/select/queries/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '测试性价比 v2' }),
    })
    expect(await patched.json()).toMatchObject({ id, name: '测试性价比 v2', version: 2 })
  })

  it('runs an unsaved query and deletes the saved one', async () => {
    const run = await ctx.app.request('/api/select/queries/run', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(defaultSavedQuery({
        name: '临时查询',
        health: ['healthy'],
        filters: [{ key: 'cpe', op: 'lte', value: 3 }],
      })),
    })
    expect(run.status).toBe(200)
    const result = await run.json()
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((row: { metrics: { cpe: number; health: string } }) =>
      row.metrics.cpe <= 3 && row.metrics.health === 'healthy')).toBe(true)
    expect(result.items[0]).toHaveProperty('flags')

    const removed = await ctx.app.request(`/api/select/queries/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(removed.status).toBe(200)
  })
})
