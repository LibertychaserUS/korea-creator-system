import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('ingest jobs and S3 contract', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('runs a file-drop source without inventing an arbitrary URL', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const sources = await ctx.app.request('/api/ingest/sources', {
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(sources.status).toBe(200)
    const list = await sources.json()
    const file = list.items.find((s: { adapterType: string }) => s.adapterType === 'file_drop')
    expect(file.enabled).toBe(true)
    const job = await ctx.app.request('/api/ingest/jobs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sourceId: file.id, schedule: 'once', sampleRate: 0.1 }),
    })
    expect(job.status).toBe(201)
    const body = await job.json()
    expect(['queued', 'running', 'ok']).toContain(body.status)
    const detail = await ctx.app.request(`/api/ingest/jobs/${body.id}`, {
      headers: { authorization: `Bearer ${ops.token}` },
    })
    const row = await detail.json()
    expect(row.writtenCount).toBeGreaterThanOrEqual(1)
    expect(row.errorSummary ?? '').not.toMatch(/password|secret|key=/i)
  })

  it('lets devops retry a failed job and forbids ops retry', async () => {
    const devops = await ctx.loginJson('devops@kcs.local')
    const failed = await ctx.app.request('/api/dev/failures', {
      headers: { authorization: `Bearer ${devops.token}` },
    })
    expect(failed.status).toBe(200)
    const failedItems = (await failed.json()).items as Array<{ id: string; status: string }>
    const ops = await ctx.loginJson('ops@kcs.local')
    const failedJob = failedItems[0]
    const opsRetry = await ctx.app.request(`/api/dev/jobs/${failedJob.id}/retry`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(opsRetry.status).toBe(403)
    const retry = await ctx.app.request(`/api/dev/jobs/${failedJob.id}/retry`, {
      method: 'POST',
      headers: { authorization: `Bearer ${devops.token}` },
    })
    expect(retry.status).toBe(200)
    const after = await retry.json()
    expect(after.attempt).toBeGreaterThanOrEqual(1)
  })

  it('returns a presigned object key under avatars/ or attachments/', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const res = await ctx.app.request('/api/assets/presign', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ purpose: 'avatar', contentType: 'image/png' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.key).toMatch(/^avatars\//)
    expect(body.url).toMatch(/^https?:\/\//)
  })

  it('forbids selector from presigning uploads', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/assets/presign', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sel.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ purpose: 'avatar', contentType: 'image/png' }),
    })
    expect(res.status).toBe(403)
  })
})
