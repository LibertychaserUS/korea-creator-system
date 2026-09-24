import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { API, apiPath, type DevAuditPage, type DevI18nReport, type DevPipeline } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'
import { quotaDay } from '../src/routes/dev-console'

let ctx: TestCtx
let devops: string
let ops: string
let selector: string

const call = async (token: string, method: string, path: string, body?: unknown) =>
  ctx.app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const json = async <T>(token: string, path: string): Promise<T> => {
  const res = await call(token, 'GET', path)
  expect(res.status, path).toBe(200)
  return res.json() as Promise<T>
}

beforeAll(async () => {
  ctx = await createTestApp()
  devops = (await ctx.loginJson('devops@kcs.local')).token
  ops = (await ctx.loginJson('ops@kcs.local')).token
  selector = (await ctx.loginJson('selector@kcs.local')).token
})

afterAll(async () => {
  await ctx.close()
})

describe('GET /api/dev/pipeline', () => {
  beforeEach(async () => {
    await ctx.db.query('DELETE FROM ingest_source_usage')
  })

  it('reports today’s calls against the quota, per source', async () => {
    const today = quotaDay(new Date())
    await ctx.db.query("UPDATE ingest_sources SET quota = 200, rate_limit = 30 WHERE id = 'qiangua'")
    await ctx.db.query(
      `INSERT INTO ingest_source_usage (source, day, calls) VALUES
         ('qiangua', $1::date, 50), ('qiangua', $1::date - 1, 7), ('qiangua', $1::date - 9, 999)`,
      [today],
    )
    const report = await json<DevPipeline>(devops, API.devPipeline.path)
    expect(report.day).toBe(today)
    expect(report.quotaTimeZone).toBe('UTC')
    expect(new Date(report.resetsAt).getTime()).toBeGreaterThan(Date.now())
    const qiangua = report.sources.find((s) => s.id === 'qiangua')!
    expect(qiangua).toMatchObject({ quota: 200, rateLimit: 30, callsToday: 50, remainingToday: 150, usageRatio: 0.25 })
    // Nine days back is outside the 7-day strip.
    expect(qiangua.recentDays.map((d) => d.calls)).toEqual([7, 50])
    const idle = report.sources.find((s) => s.id === 'xinhong')!
    expect(idle.callsToday).toBe(0)
    expect(report.totals.jobs).toBeGreaterThan(0)
  })

  it('shows the last success, the last failure and what is parked', async () => {
    await ctx.db.query(
      `INSERT INTO ingest_jobs (id, source_id, schedule, status, error_code, created_at, updated_at, ended_at, source_mode, written_count)
       VALUES ('pl_ok', 'xinhong', 'once', 'ok', NULL, now(), now() - interval '2 hours', now() - interval '2 hours', 'live', 12),
              ('pl_bad', 'xinhong', 'once', 'failed', 'SOURCE_UNAVAILABLE', now(), now() - interval '1 hour', now(), 'live', 0)
       ON CONFLICT (id) DO NOTHING`,
    )
    await ctx.db.query(
      `INSERT INTO ingest_dead_letters (id, kind, source, job_id, code, message, state)
       VALUES ('pl_dl', 'job', 'xinhong', 'pl_bad', 'SOURCE_UNAVAILABLE', 'x', 'open')
       ON CONFLICT (id) DO NOTHING`,
    )
    const report = await json<DevPipeline>(devops, API.devPipeline.path)
    const xinhong = report.sources.find((s) => s.id === 'xinhong')!
    expect(xinhong.lastSuccessAt).not.toBeNull()
    expect(xinhong.lastFailureAt).not.toBeNull()
    expect(xinhong.lastErrorCode).toBe('SOURCE_UNAVAILABLE')
    expect(xinhong.lastMode).toBe('live')
    expect(xinhong.failed24h).toBeGreaterThanOrEqual(1)
    expect(xinhong.written24h).toBeGreaterThanOrEqual(12)
    expect(xinhong.openDeadLetters).toBeGreaterThanOrEqual(1)
  })

  it('needs dev.read', async () => {
    expect((await call(selector, 'GET', API.devPipeline.path)).status).toBe(403)
    expect((await ctx.app.request(API.devPipeline.path)).status).toBe(401)
  })
})

describe('GET /api/dev/audit', () => {
  beforeAll(async () => {
    await ctx.db.query("DELETE FROM audit_logs WHERE id LIKE 'au_%'")
    const rows = Array.from({ length: 130 }, (_, i) => [
      `au_${String(i).padStart(3, '0')}`,
      i % 2 ? 'user_ops' : 'user_devops',
      i % 3 ? 'creator.update' : 'ingest.retry',
      i % 3 ? 'creator' : 'ingest_job',
      `ent_${i % 5}`,
      i === 7 ? '春季上新' : 'update',
      new Date(Date.UTC(2026, 8, 1 + (i % 20), 12)).toISOString(),
    ])
    for (const row of rows) {
      await ctx.db.query(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, summary, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        row,
      )
    }
  })

  it('pages newest first, 100 by default, with the actor’s name', async () => {
    const page = await json<DevAuditPage>(devops, API.devAudit.path)
    expect(page.pageSize).toBe(100)
    expect(page.items).toHaveLength(100)
    expect(page.total).toBeGreaterThanOrEqual(130)
    const times = page.items.map((row) => row.createdAt)
    expect([...times].sort().reverse()).toEqual(times)
    const byOps = page.items.find((row) => row.actorId === 'user_ops')!
    expect(byOps.actorName).toBe('运营录入')
    expect(byOps.actorEmail).toBe('ops@kcs.local')
    const second = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { page: 2, pageSize: 50 }))
    expect(second.items).toHaveLength(50)
    expect(second.items[0]!.id).toBe(page.items[50]!.id)
  })

  it('filters by action (exact or family), entity, actor, words and day range', async () => {
    const exact = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { action: 'ingest.retry', pageSize: 100 }))
    expect(exact.items.every((row) => row.action === 'ingest.retry')).toBe(true)
    const family = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { action: 'creator.' }))
    expect(family.items.every((row) => row.action.startsWith('creator.'))).toBe(true)
    const entity = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { entityId: 'ent_3' }))
    expect(entity.items.every((row) => row.entityId === 'ent_3')).toBe(true)
    const actor = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { actor: 'user_devops' }))
    expect(actor.items.every((row) => row.actorId === 'user_devops')).toBe(true)
    const words = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { q: '春季' }))
    expect(words.items.map((row) => row.id)).toEqual(['au_007'])
    const byName = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { q: 'ops@kcs', pageSize: 5 }))
    expect(byName.items.every((row) => row.actorEmail === 'ops@kcs.local')).toBe(true)
    const range = await json<DevAuditPage>(devops, apiPath(API.devAudit, {}, { from: '2026-09-03', to: '2026-09-04', pageSize: 100 }))
    expect(range.items.length).toBeGreaterThan(0)
    for (const row of range.items) {
      expect(row.createdAt >= '2026-09-03T00:00:00' && row.createdAt < '2026-09-05T00:00:00').toBe(true)
    }
    expect(family.actions.map((a) => a.action)).toEqual(expect.arrayContaining(['creator.update', 'ingest.retry']))
  })

  it('rejects a malformed day with 400, not a database error', async () => {
    const res = await call(devops, 'GET', apiPath(API.devAudit, {}, { from: '2026-13-45' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'VALIDATION', message: 'invalid_from' })
    expect((await call(devops, 'GET', apiPath(API.devAudit, {}, { to: 'yesterday' }))).status).toBe(400)
  })

  it('needs dev.read', async () => {
    expect((await call(selector, 'GET', API.devAudit.path)).status).toBe(403)
  })
})

describe('GET /api/dev/i18n-theme', () => {
  it('lists the three languages and checks the export headers line up', async () => {
    const report = await json<DevI18nReport>(devops, API.devI18n.path)
    expect(report.locales).toEqual(['zh-CN', 'en', 'ko'])
    expect(report.themes).toEqual(['light', 'dark', 'system'])
    expect(report.exportLabels.ok).toBe(true)
    expect(report.exportLabels.locales.map((l) => l.locale)).toEqual(['zh-CN', 'en', 'ko'])
    const counts = new Set(report.exportLabels.locales.map((l) => l.keys))
    expect(counts.size).toBe(1)
  })

  it('needs dev.read', async () => {
    expect((await call(selector, 'GET', API.devI18n.path)).status).toBe(403)
  })
})

describe('writes that used to leave no audit row', () => {
  const trail = async (action: string, entityId?: string) =>
    (await ctx.db.query(
      `SELECT actor_id, entity_id, summary FROM audit_logs WHERE action = $1 ${entityId ? 'AND entity_id = $2' : ''}
        ORDER BY created_at DESC`,
      entityId ? [action, entityId] : [action],
    )).rows

  it('category change, shortlist, saved query and export are recorded with the actor', async () => {
    const patched = await call(ops, 'PATCH', apiPath(API.opsCategoryPatch, { slug: 'intending' }), { frontendVisible: false })
    expect(patched.status).toBe(200)
    expect((await trail('category.update', 'intending'))[0]).toMatchObject({ actor_id: 'user_ops', summary: 'frontendVisible' })

    const released = (await ctx.db.query("SELECT id FROM creators WHERE status = 'released' ORDER BY id LIMIT 1")).rows[0].id
    expect((await call(selector, 'POST', API.shortlistAdd.path, { creatorId: released })).status).toBe(200)
    expect((await trail('shortlist.add', released))[0]).toMatchObject({ actor_id: 'user_selector' })

    const created = await call(selector, 'POST', API.queryCreate.path, { name: '审计用方案' })
    expect(created.status).toBe(201)
    const id = (await created.json()).id
    expect((await trail('query.create', id))[0]).toMatchObject({ actor_id: 'user_selector', summary: '审计用方案' })
    expect((await call(selector, 'DELETE', apiPath(API.queryDelete, { id }))).status).toBe(200)
    expect(await trail('query.delete', id)).toHaveLength(1)

    const project = (await ctx.db.query('SELECT id FROM projects ORDER BY id LIMIT 1')).rows[0].id
    expect((await call(selector, 'GET', apiPath(API.exportProject, { id: project }))).status).toBe(200)
    expect((await trail('project.export', project))[0]).toMatchObject({ actor_id: 'user_selector' })
  })

  it('a refused write leaves nothing behind', async () => {
    const before = (await trail('shortlist.add', 'nobody')).length
    expect((await call(selector, 'POST', API.shortlistAdd.path, { creatorId: 'nobody' })).status).toBe(404)
    expect((await call(ops, 'PATCH', apiPath(API.opsCategoryPatch, { slug: 'no-such-slug' }), { enabled: true })).status).toBe(404)
    expect(await trail('shortlist.add', 'nobody')).toHaveLength(before)
    expect(await trail('category.update', 'no-such-slug')).toHaveLength(0)
  })
})
