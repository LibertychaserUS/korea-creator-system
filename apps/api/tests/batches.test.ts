import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('ops batch upload', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('opens a job against the seeded file-drop source', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const res = await ctx.app.request('/api/ops/batches', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.sourceId).toBe('file-drop')
    expect(body.status).toBe('ok')
  })
})
