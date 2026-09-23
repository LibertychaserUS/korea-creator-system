import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SOURCE_DEFAULTS, SOURCE_IDS } from '@kcs/contract'
import { randomUUID } from 'node:crypto'
import { ensureSource } from '../src/ingest/jobs'
import { createTestApp, type TestCtx } from './helpers'

describe('one retry, one source registry', () => {
  let ctx: TestCtx
  let devops: string

  beforeAll(async () => {
    ctx = await createTestApp()
    devops = (await ctx.loginJson('devops@kcs.local')).token
  })
  afterAll(() => ctx.close())

  async function parkedJob(status: string) {
    const id = randomUUID()
    await ctx.db.query(
      `INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, attempts, sample_rate, cursor, error, error_code, error_summary)
       VALUES ($1,'xinhong','once',$2,3,3,1,'page-7','boom','VENDOR_UNAVAILABLE','boom')`,
      [id, status],
    )
    return id
  }

  it('the migration writes exactly the contract defaults for every source', async () => {
    const { rows } = await ctx.db.query('SELECT id, name, rate_limit, quota FROM ingest_sources WHERE id = ANY($1)', [SOURCE_IDS])
    expect(Object.fromEntries(rows.map((row) => [row.id, { name: row.name, rateLimit: row.rate_limit, quota: row.quota }])))
      .toEqual(Object.fromEntries(SOURCE_IDS.map((id) => [id, {
        name: SOURCE_DEFAULTS[id].name,
        rateLimit: SOURCE_DEFAULTS[id].rateLimit,
        quota: SOURCE_DEFAULTS[id].quota,
      }])))
  })

  it('registering a source again leaves what ops changed alone', async () => {
    await ctx.db.query("UPDATE ingest_sources SET name = '新红（改过的名字）', rate_limit = 7 WHERE id = 'xinhong'")
    await ensureSource(ctx.env, 'xinhong')
    const { rows } = await ctx.db.query("SELECT name, rate_limit FROM ingest_sources WHERE id = 'xinhong'")
    expect(rows[0]).toEqual({ name: '新红（改过的名字）', rate_limit: 7 })
    await ctx.db.query('UPDATE ingest_sources SET name = $1, rate_limit = $2 WHERE id = $3', [
      SOURCE_DEFAULTS.xinhong.name,
      SOURCE_DEFAULTS.xinhong.rateLimit,
      'xinhong',
    ])
  })

  for (const path of ['/api/ingest/jobs/:id/retry', '/api/dev/jobs/:id/retry']) {
    it(`${path}: failed → queued with a fresh budget and its cursor; live job 409; unknown 404`, async () => {
      const failed = await parkedJob('failed')
      const res = await ctx.app.request(path.replace(':id', failed), {
        method: 'POST',
        headers: { authorization: `Bearer ${devops}` },
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ id: failed, status: 'queued', attempts: 0, cursor: 'page-7', error: null, errorCode: null })
      const audited = await ctx.db.query(
        "SELECT 1 FROM audit_logs WHERE action = 'ingest.retry' AND entity_id = $1",
        [failed],
      )
      expect(audited.rowCount).toBe(1)
      await ctx.db.query("UPDATE ingest_jobs SET status = 'failed' WHERE id = $1", [failed])

      const running = await parkedJob('running')
      const busy = await ctx.app.request(path.replace(':id', running), {
        method: 'POST',
        headers: { authorization: `Bearer ${devops}` },
      })
      expect(busy.status).toBe(409)
      expect((await busy.json()).error.code).toBe('JOB-STATE')
      await ctx.db.query("UPDATE ingest_jobs SET status = 'failed' WHERE id = $1", [running])

      const missing = await ctx.app.request(path.replace(':id', 'no-such-job'), {
        method: 'POST',
        headers: { authorization: `Bearer ${devops}` },
      })
      expect(missing.status).toBe(404)
    })
  }
})
