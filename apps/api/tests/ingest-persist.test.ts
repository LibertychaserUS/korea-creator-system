import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  creatorKeyFor,
  deriveMetrics,
  emptyMetrics,
  type NormalizedCreator,
  type RawRecord,
  type SourceAdapter,
} from '@kcs/contract'
import {
  incomingFromSheet,
  incomingFromSource,
  persistPage,
  upsertCreatorFromNormalized,
} from '../src/ingest/persist'
import { replayRecord } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

const RUN = `persist${Date.now().toString(36)}`

function raw(externalId: string, fetchedAt = '2026-09-20T00:00:00.000Z'): RawRecord {
  return { source: 'qiangua', platform: 'xhs', externalId, fetchedAt, payload: { 达人ID: externalId } }
}

function creator(externalId: string, overrides: Partial<NormalizedCreator> = {}): NormalizedCreator {
  return {
    creatorKey: creatorKeyFor('xhs', externalId),
    externalId,
    platform: 'xhs',
    displayName: `统一入库 ${externalId}`,
    xhsId: `${RUN}-xhs-${externalId}`,
    avatarUrl: null,
    regions: ['서울'],
    verticals: ['beauty'],
    metrics: deriveMetrics({
      ...emptyMetrics(30),
      followers: 60_000,
      readMedian: 8_000,
      interactionMedian: 400,
      priceImage: 6_000,
    }),
    warnings: [],
    ...overrides,
  }
}

const adapter: SourceAdapter = {
  id: 'qiangua',
  supports: [],
  provides: ['followers'],
  async fetch() {
    return { records: [], nextCursor: null }
  },
  normalize(record) {
    return { ok: true, creator: creator(record.externalId, { displayName: String(record.payload['昵称'] ?? `统一入库 ${record.externalId}`) }) }
  },
}

async function sideRecords(ctx: TestCtx, creatorId: string) {
  const [sources, rawRows, history] = await Promise.all([
    ctx.db.query('SELECT source, external_id FROM creator_sources WHERE creator_id = $1', [creatorId]),
    ctx.db.query('SELECT source FROM creator_raw WHERE creator_id = $1', [creatorId]),
    ctx.db.query('SELECT source FROM creator_metrics_history WHERE creator_id = $1', [creatorId]),
  ])
  return { sources: sources.rowCount, raw: rawRows.rowCount, history: history.rowCount }
}

describe('one upsert for every way a creator comes in', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp({ getAdapter: (source) => (source === 'qiangua' ? adapter : undefined) })
  })
  afterAll(() => ctx.close())

  it('a queue page writes the creator, the source link, the raw payload and one history row', async () => {
    const counts = await persistPage(ctx.env, adapter, { records: [raw(`${RUN}-a`)], nextCursor: null }, null, 'qiangua')
    expect(counts).toEqual({ written: 1, skipped: 0, failed: 0 })
    const row = (await ctx.db.query('SELECT * FROM creators WHERE creator_key = $1', [creatorKeyFor('xhs', `${RUN}-a`)])).rows[0]
    expect(row).toMatchObject({ status: 'draft', needs_review: true, source: 'qiangua', followers: 60_000 })
    expect(await sideRecords(ctx, row.id)).toEqual({ sources: 1, raw: 1, history: 1 })
  })

  it('a replayed dead letter lands exactly like a page: same creator, same side records', async () => {
    const before = (await ctx.db.query('SELECT id FROM creators WHERE creator_key = $1', [creatorKeyFor('xhs', `${RUN}-a`)])).rows[0]
    const counts = await replayRecord(ctx.env, {
      source: 'qiangua',
      jobId: null,
      externalId: `${RUN}-a`,
      payload: { 达人ID: `${RUN}-a`, 昵称: '重放后的名字' },
    })
    expect(counts).toEqual({ written: 0, skipped: 1, failed: 0 })
    const after = (await ctx.db.query('SELECT id, display_name FROM creators WHERE creator_key = $1', [creatorKeyFor('xhs', `${RUN}-a`)])).rows
    expect(after).toEqual([{ id: before.id, display_name: '重放后的名字' }])
    expect(await sideRecords(ctx, before.id)).toEqual({ sources: 1, raw: 2, history: 2 })
  })

  it('re-collecting a published creator moves the latest numbers, never the publish snapshot or status', async () => {
    const { rows } = await ctx.db.query(
      `SELECT id, metrics_locked, metrics_locked_at, source, external_id FROM creators
        WHERE status = 'released' AND metrics_locked IS NOT NULL AND source = 'qiangua' AND external_id IS NOT NULL LIMIT 1`,
    )
    const published = rows[0]
    const record = raw(String(published.external_id), '2026-09-21T00:00:00.000Z')
    await upsertCreatorFromNormalized(ctx.env, null, incomingFromSource(
      'qiangua',
      creator(String(published.external_id), {
        xhsId: null,
        metrics: deriveMetrics({ ...emptyMetrics(30), followers: 1_234_567, readMedian: 1 }),
      }),
      record,
    ))
    const after = (await ctx.db.query('SELECT * FROM creators WHERE id = $1', [published.id])).rows[0]
    expect(after.status).toBe('released')
    expect(after.needs_review).toBe(true)
    expect(after.metrics.followers).toBe(1_234_567)
    expect(after.metrics_locked).toEqual(published.metrics_locked)
    expect(after.metrics_locked_at).toEqual(published.metrics_locked_at)
  })

  it('a workbook row with a known 小红书号 updates that creator: followers / price only, no history, snapshot kept', async () => {
    const target = (await ctx.db.query('SELECT * FROM creators WHERE creator_key = $1', [creatorKeyFor('xhs', `${RUN}-a`)])).rows[0]
    await ctx.db.query(
      `UPDATE creators SET status = 'released', metrics_locked = metrics, metrics_locked_at = now() WHERE id = $1`,
      [target.id],
    )
    const locked = (await ctx.db.query('SELECT metrics_locked FROM creators WHERE id = $1', [target.id])).rows[0].metrics_locked
    const incoming = incomingFromSheet(
      { displayName: '表格里的名字', xhsId: target.xhs_id, followers: '70,500', price: '9000' },
      new Date('2026-09-22T00:00:00.000Z'),
    )!
    const outcome = await upsertCreatorFromNormalized(ctx.env, null, incoming)
    expect(outcome).toEqual({ creatorId: target.id, created: false })
    const after = (await ctx.db.query('SELECT * FROM creators WHERE id = $1', [target.id])).rows[0]
    expect(after.display_name).toBe('表格里的名字')
    expect(after.followers).toBe(70_500)
    expect(after.metrics).toMatchObject({ followers: 70_500, priceImage: 9_000, readMedian: 8_000, interactionMedian: 400 })
    expect(after.source).toBe('qiangua')
    expect(after.metrics_locked).toEqual(locked)
    expect(after.status).toBe('released')
    expect(await sideRecords(ctx, target.id)).toEqual({ sources: 1, raw: 2, history: 2 })
  })

  it('a workbook row nobody knows becomes a draft with the usual starting categories, price and review', async () => {
    const outcome = await upsertCreatorFromNormalized(
      ctx.env,
      null,
      incomingFromSheet({ displayName: `${RUN} 新表格博主`, followers: '12000', price: '3000', persona: '护肤' }, new Date())!,
    )
    expect(outcome.created).toBe(true)
    const [row, cats, price, reviews] = await Promise.all([
      ctx.db.query('SELECT * FROM creators WHERE id = $1', [outcome.creatorId]),
      ctx.db.query('SELECT category_slug FROM creator_categories WHERE creator_id = $1', [outcome.creatorId]),
      ctx.db.query('SELECT amount_min FROM prices WHERE creator_id = $1', [outcome.creatorId]),
      ctx.db.query("SELECT status FROM reviews WHERE creator_id = $1", [outcome.creatorId]),
    ])
    expect(row.rows[0]).toMatchObject({ status: 'draft', needs_review: true, followers: 12_000, note: '护肤', source: null })
    expect(cats.rows.map((r) => r.category_slug)).toEqual(['never_collaborated'])
    expect(price.rows[0].amount_min).toBe(3_000)
    expect(reviews.rows).toEqual([{ status: 'pending' }])
    expect(await sideRecords(ctx, outcome.creatorId)).toEqual({ sources: 0, raw: 0, history: 0 })
  })

  it('one creator is one transaction: a failure part-way leaves nothing behind', async () => {
    const broken = incomingFromSource('qiangua', creator(`${RUN}-broken`), raw(`${RUN}-broken`))
    ;(broken.metrics as { window: unknown }).window = null
    await expect(upsertCreatorFromNormalized(ctx.env, null, broken)).rejects.toThrow()
    const left = await ctx.db.query('SELECT 1 FROM creators WHERE creator_key = $1', [broken.creatorKey])
    const links = await ctx.db.query('SELECT 1 FROM creator_sources WHERE external_id = $1', [`${RUN}-broken`])
    expect(left.rowCount).toBe(0)
    expect(links.rowCount).toBe(0)
  })

  it('fetch refuses an ad-hoc URL and stores only SourceQuery fields', async () => {
    const ops = (await ctx.loginJson('ops@kcs.local')).token
    const post = (body: unknown) => ctx.app.request('/api/ingest/fetch', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const url = await post({ source: 'qiangua', window: 30, sourceUrl: 'https://example.invalid/x' })
    expect(url.status).toBe(400)
    expect((await url.json()).error).toMatchObject({ code: 'SOURCE-INVALID', message: 'adhoc_url_forbidden' })
    const queued = await post({ source: 'qiangua', window: 30, keyword: '面霜', note: 'extra', maxPages: 2 })
    expect(queued.status).toBe(202)
    const { job } = await queued.json()
    expect(job.query).toEqual({ source: 'qiangua', window: 30, keyword: '面霜' })
    expect(job.maxPages).toBe(2)
    await ctx.db.query("UPDATE ingest_jobs SET status = 'failed' WHERE id = $1", [job.id])
  })
})
