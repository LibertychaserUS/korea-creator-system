import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PAGE_SIZE_MAX } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'

/**
 * Break: an ops / devops list still returns every row, a page repeats or
 * drops a row, the stage tab counts ignore the search, or `total` lies.
 */
describe('paged ops / devops lists', () => {
  let ctx: TestCtx
  let ops: string
  let devops: string

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    devops = (await ctx.loginJson('devops@kcs.local')).token
    for (let i = 0; i < 7; i += 1) {
      await ctx.db.query(
        `INSERT INTO creators (id, creator_key, display_name, status, regions, verticals, source, xhs_id, metrics_locked_at)
         VALUES ($1, $1, $2, $3, '{}', '{}', $4, $5, $6)`,
        [
          `paging_${i}`,
          `分页博主 ${i}`,
          i < 3 ? 'released' : 'draft',
          i % 2 ? 'qiangua' : null,
          `pgxhs${i}`,
          i === 5 ? new Date() : null,
        ],
      )
    }
    for (let i = 0; i < 9; i += 1) {
      await ctx.db.query(
        `INSERT INTO ingest_jobs (id, source_id, schedule, status, created_at, updated_at)
         VALUES ($1, 'qiangua', 'once', 'ok', now() - ($2 || ' minutes')::interval, now() - ($2 || ' minutes')::interval)`,
        [`paging_job_${i}`, i],
      )
    }
  })

  afterAll(() => ctx.close())

  async function get(path: string, token: string) {
    const res = await ctx.app.request(path, { headers: { authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    return res.json()
  }

  async function walk(path: string, token: string, pageSize: number) {
    const ids: string[] = []
    let total = 0
    for (let page = 1; ; page += 1) {
      const body = await get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`, token)
      total = body.total
      expect(body.page).toBe(page)
      expect(body.pageSize).toBe(pageSize)
      ids.push(...body.items.map((row: { id: string }) => row.id))
      if (page * pageSize >= total) break
    }
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(total)
    return ids
  }

  it('ops creators: search + source narrow first, stage counts follow them, stage then pages', async () => {
    const body = await get('/api/ops/creators?q=分页博主&stage=review&pageSize=2', ops)
    expect(body.counts).toEqual({ review: 3, released: 3, withdrawn: 1 })
    expect(body.total).toBe(3)
    expect(body.items).toHaveLength(2)
    expect(body.items.every((row: { stage: string }) => row.stage === 'review')).toBe(true)
    expect(await walk('/api/ops/creators?q=分页博主', ops, 3)).toHaveLength(7)

    const byXhs = await get('/api/ops/creators?q=PGXHS4', ops)
    expect(byXhs.items.map((row: { id: string }) => row.id)).toEqual(['paging_4'])
    const manual = await get('/api/ops/creators?q=分页博主&source=manual', ops)
    expect(manual.counts).toEqual({ review: 2, released: 2, withdrawn: 0 })
    const qiangua = await get('/api/ops/creators?q=分页博主&source=qiangua&stage=withdrawn', ops)
    expect(qiangua.items.map((row: { id: string }) => row.id)).toEqual(['paging_5'])
  })

  it('ops creators default to the newest 50 with the full total', async () => {
    const body = await get('/api/ops/creators', ops)
    expect(body.pageSize).toBe(50)
    expect(body.items.length).toBeLessThanOrEqual(50)
    const all = (await ctx.db.query('SELECT count(*)::int AS n FROM creators')).rows[0].n
    expect(body.total).toBe(all)
    expect(body.counts.review + body.counts.released + body.counts.withdrawn).toBe(all)
  })

  it('ingest jobs page newest first and filter by source / status', async () => {
    const ids = await walk('/api/ingest/jobs?source=qiangua&status=ok', ops, 4)
    expect(ids.slice(0, 9)).toEqual(Array.from({ length: 9 }, (_, i) => `paging_job_${i}`))
    const capped = await get('/api/ingest/jobs?pageSize=1000', ops)
    expect(capped.pageSize).toBe(PAGE_SIZE_MAX)
  })

  it('devops jobs and ops batches page with a total', async () => {
    const all = (await ctx.db.query('SELECT count(*)::int AS n FROM ingest_jobs')).rows[0].n
    expect(await walk('/api/dev/jobs', devops, 5)).toHaveLength(all)
    const batches = await walk('/api/ops/batches', ops, 5)
    expect(batches).toHaveLength(all)
    const first = await get('/api/ops/batches?pageSize=1', ops)
    expect(first.items[0]).not.toHaveProperty('total_count')
  })
})
