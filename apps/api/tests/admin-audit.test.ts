import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/**
 * 账号管理审计端点（POST /api/auth/admin-audit）：
 * - 只有 platform_admin 能写（403 其他角色 / 401 匿名）；
 * - 成功写 audit_logs，返回 201 { ok: true }；
 * - 字段超长或缺失返回 400。
 */
describe('admin account audit endpoint', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  const validBody = {
    action: 'account.create',
    target: 'someone@kcs.local',
    summary: 'role=ops',
  }

  it('returns 401 without a session', async () => {
    const res = await ctx.app.request('/api/auth/admin-audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for roles without admin.users', async () => {
    const { token } = await ctx.loginJson('ops@kcs.local')
    const res = await ctx.app.request('/api/auth/admin-audit', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(403)
  })

  it('writes audit_logs and returns 201 for platform_admin', async () => {
    const { token } = await ctx.loginJson('admin@kcs.local')
    const res = await ctx.app.request('/api/auth/admin-audit', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })

    const { rows } = await ctx.db.query(
      `SELECT actor_id, action, entity_type, entity_id, summary
       FROM audit_logs WHERE action = 'account.create' AND entity_id = $1`,
      [validBody.target],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].actor_id).toBe('user_platform_admin')
    expect(rows[0].entity_type).toBe('account')
    expect(rows[0].summary).toBe(validBody.summary)
  })

  it('accepts the session via the kcs_session cookie header', async () => {
    const { token } = await ctx.loginJson('admin@kcs.local')
    const res = await ctx.app.request('/api/auth/admin-audit', {
      method: 'POST',
      headers: {
        cookie: `kcs_session=${encodeURIComponent(token)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'account.update', target: 'other@kcs.local', summary: 'role=selector' }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 400 when a field exceeds its length cap', async () => {
    const { token } = await ctx.loginJson('admin@kcs.local')
    for (const body of [
      { ...validBody, action: 'x'.repeat(81) },
      { ...validBody, target: 'x'.repeat(121) },
      { ...validBody, summary: 'x'.repeat(501) },
    ]) {
      const res = await ctx.app.request('/api/auth/admin-audit', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(res.status).toBe(400)
    }
  })

  it('returns 400 when action or target is missing', async () => {
    const { token } = await ctx.loginJson('admin@kcs.local')
    const res = await ctx.app.request('/api/auth/admin-audit', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'nothing to anchor this record to' }),
    })
    expect(res.status).toBe(400)
  })
})
