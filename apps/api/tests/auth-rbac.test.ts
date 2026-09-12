import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/**
 * Break: wrong role can write ops/assign, or unauthenticated calls return 200.
 */
describe('auth and HTTP RBAC', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('rejects unknown credentials with 401', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@kcs.local', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('logs in a seed ops user and returns role', async () => {
    const res = await ctx.login('ops@kcs.local')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.role).toBe('ops')
    expect(body.user.email).toBe('ops@kcs.local')
    expect(typeof body.token).toBe('string')
  })

  it('returns 401 for /api/ops/creators without a session', async () => {
    const res = await ctx.app.request('/api/ops/creators')
    expect(res.status).toBe(401)
  })

  it('returns 403 when selector lists unpublished ops inventory', async () => {
    const { token } = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/ops/creators', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('returns 403 when devops publishes a creator', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const created = await ctx.app.request('/api/ops/creators', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ops.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'RBAC达人',
        regions: ['서울'],
        followersUnknown: true,
        categories: ['never_collaborated'],
      }),
    })
    expect(created.status).toBe(201)
    const { id } = await created.json()
    const devops = await ctx.loginJson('devops@kcs.local')
    const pub = await ctx.app.request(`/api/ops/creators/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${devops.token}` },
    })
    expect(pub.status).toBe(403)
  })

  it('returns 403 when selector_viewer assigns to a project', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const project = await ctx.app.request('/api/select/projects', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sel.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '只读不可分配' }),
    })
    expect(project.status).toBe(201)
    const { id } = await project.json()
    const viewer = await ctx.loginJson('viewer@kcs.local')
    const assign = await ctx.app.request(`/api/select/projects/${id}/assignments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${viewer.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ creatorIds: ['missing'] }),
    })
    expect(assign.status).toBe(403)
  })
})
