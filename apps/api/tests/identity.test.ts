import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RawRecord, SourceId } from '@kcs/contract'
import { qianguaAdapter, xinhongAdapter } from '../src/adapters'
import { parseVendorJson } from '../src/adapters/common'
import { persistPage, readSheetRow, upsertCreatorFromNormalized } from '../src/ingest/persist'
import { createTestApp, type TestCtx } from './helpers'

const RUN = `ident${Date.now().toString(36)}`

function raw(source: SourceId, payload: Record<string, unknown>): RawRecord {
  return { source, platform: 'xhs', externalId: String(payload['达人ID']), fetchedAt: new Date().toISOString(), payload }
}

function readSheetOk(row: Record<string, string>) {
  const result = readSheetRow(row, new Date())
  if (!result.ok) throw new Error(result.errors.join())
  return result.incoming
}

async function linksOf(ctx: TestCtx, source: SourceId, externalId: string) {
  const { rows } = await ctx.db.query(
    `SELECT c.id, c.display_name, c.xhs_id, c.followers, c.creator_key
       FROM creator_sources s JOIN creators c ON c.id = s.creator_id
      WHERE s.source = $1 AND s.external_id = $2`,
    [source, externalId],
  )
  return rows[0]
}

describe('ids past 2^53', () => {
  it('keep their digits when parsed', () => {
    const parsed = parseVendorJson('{"a":12345678901234567891,"b":-9007199254740993,"c":42,"d":1.5,"e":1e21,"f":"7"}') as Record<string, unknown>
    expect(parsed).toEqual({ a: '12345678901234567891', b: '-9007199254740993', c: 42, d: 1.5, e: 1e21, f: '7' })
  })

  describe('from a live vendor response', () => {
    let ctx: TestCtx
    let server: Server
    const saved = { token: process.env.QIANGUA_TOKEN, base: process.env.QIANGUA_BASE_URL }
    // Both ids round to the same double; the body is sent verbatim so nothing re-serialises them first.
    const ids = ['92233720368547758071', '92233720368547758072']
    beforeAll(async () => {
      ctx = await createTestApp()
      server = createServer((_req, res) => {
        res.setHeader('content-type', 'application/json')
        res.end(`{"data":[{"达人ID":${ids[0]},"昵称":"大号一"},{"达人ID":${ids[1]},"昵称":"大号二"}]}`)
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      process.env.QIANGUA_TOKEN = 'test'
      process.env.QIANGUA_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })
    afterAll(async () => {
      if (saved.token === undefined) delete process.env.QIANGUA_TOKEN
      else process.env.QIANGUA_TOKEN = saved.token
      if (saved.base === undefined) delete process.env.QIANGUA_BASE_URL
      else process.env.QIANGUA_BASE_URL = saved.base
      await new Promise((resolve) => server.close(resolve))
      await ctx.close()
    })

    it('two ids become two creators with the ids as sent', async () => {
      expect(Number(ids[0])).toBe(Number(ids[1]))
      const page = await qianguaAdapter.fetch({ source: 'qiangua', window: 30 })
      expect(page.records.map((r) => r.externalId)).toEqual(ids)
      expect(await persistPage(ctx.env, qianguaAdapter, page, null, 'qiangua')).toEqual({ written: 2, skipped: 0, failed: 0 })
      const [a, b] = [await linksOf(ctx, 'qiangua', ids[0]), await linksOf(ctx, 'qiangua', ids[1])]
      expect(a.id).not.toBe(b.id)
      expect(a).toMatchObject({ display_name: '大号一', creator_key: `qiangua:${ids[0]}` })
      expect(b).toMatchObject({ display_name: '大号二', creator_key: `qiangua:${ids[1]}` })
      const { rows } = await ctx.db.query(`SELECT COALESCE(r.payload, p.payload)->>'达人ID' AS id FROM creator_raw r LEFT JOIN raw_payloads p ON p.hash = r.payload_hash
          WHERE r.source = 'qiangua' AND r.external_id = ANY($1) ORDER BY r.external_id`, [ids])
      expect(rows.map((r) => r.id)).toEqual(ids)
    })
  })
})

describe('identity across sources', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('千瓜 10001 and 新红 10001 without a 小红书号 stay two creators', async () => {
    const id = `${RUN}-10001`
    await persistPage(ctx.env, qianguaAdapter, { records: [raw('qiangua', { 达人ID: id, 昵称: '千瓜那位', 粉丝数: 5000 })], nextCursor: null }, null, 'qiangua')
    await persistPage(ctx.env, xinhongAdapter, { records: [raw('xinhong', { 达人ID: id, 昵称: '新红那位', 粉丝数: 90000 })], nextCursor: null }, null, 'xinhong')

    const qg = await linksOf(ctx, 'qiangua', id)
    const xh = await linksOf(ctx, 'xinhong', id)
    expect(qg.id).not.toBe(xh.id)
    expect(qg).toMatchObject({ display_name: '千瓜那位', followers: 5000, xhs_id: null, creator_key: `qiangua:${id}` })
    expect(xh).toMatchObject({ display_name: '新红那位', followers: 90000, xhs_id: null, creator_key: `xinhong:${id}` })
  })

  it('the same vendor id with different 小红书号 in two sources both write', async () => {
    const id = `${RUN}-20002`
    const a = await persistPage(ctx.env, qianguaAdapter, { records: [raw('qiangua', { 达人ID: id, 昵称: '甲', 小红书号: `${RUN}_a` })], nextCursor: null }, null, 'qiangua')
    const b = await persistPage(ctx.env, xinhongAdapter, { records: [raw('xinhong', { 达人ID: id, 昵称: '乙', 小红书号: `${RUN}_b` })], nextCursor: null }, null, 'xinhong')
    expect(a).toEqual({ written: 1, skipped: 0, failed: 0 })
    expect(b).toEqual({ written: 1, skipped: 0, failed: 0 })
    expect((await linksOf(ctx, 'qiangua', id)).xhs_id).toBe(`${RUN}_a`)
    expect((await linksOf(ctx, 'xinhong', id)).xhs_id).toBe(`${RUN}_b`)
  })

  it('a vendor refresh without a 小红书号 keeps the real one', async () => {
    const id = `${RUN}-30003`
    await persistPage(ctx.env, qianguaAdapter, { records: [raw('qiangua', { 达人ID: id, 昵称: '丙', 小红书号: `${RUN}_c` })], nextCursor: null }, null, 'qiangua')
    await persistPage(ctx.env, qianguaAdapter, { records: [raw('qiangua', { 达人ID: id, 昵称: '丙' })], nextCursor: null }, null, 'qiangua')
    expect((await linksOf(ctx, 'qiangua', id)).xhs_id).toBe(`${RUN}_c`)
  })
})

describe('source signals are stored beside the metrics', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('on the creator and on its snapshot; a sheet row leaves them alone', async () => {
    const id = `${RUN}-sig`
    await persistPage(ctx.env, xinhongAdapter, { records: [raw('xinhong', { 达人ID: id, 昵称: '信号', 互动粉丝比: '4.5', 健康等级: '异常', 小红书号: `${RUN}_sig` })], nextCursor: null }, null, 'xinhong')
    const creator = await linksOf(ctx, 'xinhong', id)
    const row = (await ctx.db.query('SELECT source_signals, metrics FROM creators WHERE id = $1', [creator.id])).rows[0]
    expect(row.source_signals).toMatchObject({ healthLevel: 'abnormal', fanInteractionRatio: 0.045 })
    expect(row.metrics.health).toBe('abnormal')
    const history = await ctx.db.query('SELECT signals FROM creator_metrics_history WHERE creator_id = $1', [creator.id])
    expect(history.rows[0].signals).toMatchObject({ healthLevel: 'abnormal' })

    await upsertCreatorFromNormalized(ctx.env, null, readSheetOk({ displayName: '信号', xhsId: `${RUN}_sig`, followers: '9000' }))
    const after = (await ctx.db.query('SELECT source_signals, followers FROM creators WHERE id = $1', [creator.id])).rows[0]
    expect(after).toMatchObject({ followers: 9000, source_signals: expect.objectContaining({ healthLevel: 'abnormal' }) })
  })
})

describe('migration 0040 splits old cross-source merges', () => {
  let ctx: TestCtx
  const sql = readFile(new URL('../src/migrations/0040_split_cross_source_merges.sql', import.meta.url), 'utf8')

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  async function rerun() {
    const client = await ctx.db.connect()
    try {
      await client.query('BEGIN')
      await client.query(await sql)
      await client.query('COMMIT')
    } finally {
      client.release()
    }
  }

  async function oldMerge(input: {
    id: string
    key: string
    xhsId: string | null
    links: { source: SourceId; externalId: string; seen: string; payload: Record<string, unknown>; metrics: Record<string, unknown> }[]
  }) {
    const last = input.links[input.links.length - 1]!
    await ctx.db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, needs_review, followers, xhs_id, metrics, metrics_window, source, external_id)
       VALUES ($1,$2,$3,'released',false,$4,$5,$6,30,$7,$8)`,
      [input.id, input.key, String(last.payload['昵称'] ?? last.payload.name), last.metrics.followers, input.xhsId, JSON.stringify(last.metrics), last.source, last.externalId],
    )
    await ctx.db.query("INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1, 'never_collaborated')", [input.id])
    for (const [i, link] of input.links.entries()) {
      await ctx.db.query(
        'INSERT INTO creator_sources (creator_id, source, external_id, first_seen_at, last_seen_at) VALUES ($1,$2,$3,$4,$4)',
        [input.id, link.source, link.externalId, link.seen],
      )
      await ctx.db.query(
        'INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload) VALUES ($1,$2,$3,$4,$5,$6)',
        [`${input.id}-raw-${i}`, input.id, link.source, link.externalId, link.seen, JSON.stringify(link.payload)],
      )
      await ctx.db.query(
        `INSERT INTO creator_metrics_history (id, creator_id, source, "window", fetched_at, metrics)
         VALUES ($1,$2,$3,30,$4,$5)`,
        [`${input.id}-hist-${i}`, input.id, link.source, link.seen, JSON.stringify({ window: 30, ...link.metrics })],
      )
    }
  }

  it('moves the stranger out with its own raw, history and link; the first one keeps the creator', async () => {
    const ext = `${RUN}-m1`
    const merged = `${RUN}-merged`
    await oldMerge({
      id: merged,
      key: `xhs:${ext}`,
      xhsId: ext,
      links: [
        { source: 'qiangua', externalId: ext, seen: '2026-09-01T00:00:00Z', payload: { 达人ID: ext, 昵称: '千瓜那位' }, metrics: { followers: 5000 } },
        { source: 'xinhong', externalId: ext, seen: '2026-09-02T00:00:00Z', payload: { 达人ID: ext, 昵称: '新红那位' }, metrics: { followers: 90000 } },
      ],
    })

    await rerun()

    const owner = (await ctx.db.query('SELECT * FROM creators WHERE id = $1', [merged])).rows[0]
    expect(owner).toMatchObject({ display_name: '千瓜那位', followers: 5000, xhs_id: null, status: 'released', source: 'qiangua', creator_key: `qiangua:${ext}` })
    const categories = await ctx.db.query('SELECT category_slug FROM creator_categories WHERE creator_id = $1', [merged])
    expect(categories.rowCount).toBe(1)

    const moved = await linksOf(ctx, 'xinhong', ext)
    expect(moved.id).not.toBe(merged)
    const row = (await ctx.db.query('SELECT * FROM creators WHERE id = $1', [moved.id])).rows[0]
    expect(row).toMatchObject({ display_name: '新红那位', followers: 90000, xhs_id: null, status: 'draft', needs_review: true, source: 'xinhong', creator_key: `xinhong:${ext}` })
    const counts = async (table: string, id: string) =>
      Number((await ctx.db.query(`SELECT count(*) AS n FROM ${table} WHERE creator_id = $1`, [id])).rows[0].n)
    expect(await counts('creator_raw', moved.id)).toBe(1)
    expect(await counts('creator_metrics_history', moved.id)).toBe(1)
    expect(await counts('creator_raw', merged)).toBe(1)
    expect(await counts('creator_metrics_history', merged)).toBe(1)

    await rerun()
    expect((await linksOf(ctx, 'xinhong', ext)).id).toBe(moved.id)
    expect((await linksOf(ctx, 'qiangua', ext)).id).toBe(merged)
  })

  it('keeps a real merge (same 小红书号 on both sides) and restores a 小红书号 a vendor id overwrote', async () => {
    const merged = `${RUN}-real`
    await oldMerge({
      id: merged,
      key: `xhs:${RUN}-pgy`,
      xhsId: `${RUN}-qg`,
      links: [
        { source: 'pugongying', externalId: `${RUN}-pgy`, seen: '2026-09-01T00:00:00Z', payload: { userId: `${RUN}-pgy`, name: '同一人', redId: `${RUN}_Same` }, metrics: { followers: 10000 } },
        { source: 'qiangua', externalId: `${RUN}-qg`, seen: '2026-09-02T00:00:00Z', payload: { 达人ID: `${RUN}-qg`, 昵称: '同一人', 小红书号: `${RUN}_same ` }, metrics: { followers: 10100 } },
      ],
    })

    await rerun()

    expect((await linksOf(ctx, 'qiangua', `${RUN}-qg`)).id).toBe(merged)
    const row = (await ctx.db.query('SELECT xhs_id FROM creators WHERE id = $1', [merged])).rows[0]
    expect(row.xhs_id).toBe(`${RUN}_same`.toLowerCase())
  })
})

describe('小红书号 is one identity whatever the spelling', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('"Cheongdam_Skin " and "cheongdam_skin" from two sources are one creator', async () => {
    const xhs = `${RUN}_Cheongdam_Skin`
    await persistPage(ctx.env, qianguaAdapter, { records: [raw('qiangua', { 达人ID: `${RUN}-cs1`, 昵称: '清潭', 小红书号: `${xhs} ` })], nextCursor: null }, null, 'qiangua')
    await persistPage(ctx.env, xinhongAdapter, { records: [raw('xinhong', { 达人ID: `${RUN}-cs2`, 昵称: '清潭', 小红书号: `\u3000${xhs.toLowerCase()}` })], nextCursor: null }, null, 'xinhong')
    const a = await linksOf(ctx, 'qiangua', `${RUN}-cs1`)
    const b = await linksOf(ctx, 'xinhong', `${RUN}-cs2`)
    expect(a.id).toBe(b.id)
    expect(a.xhs_id).toBe(xhs.toLowerCase())
  })

  it('a record that learns its 小红书号 joins the creator already holding it', async () => {
    const xhs = `${RUN}_later`
    await persistPage(ctx.env, qianguaAdapter, { records: [raw('qiangua', { 达人ID: `${RUN}-l1`, 昵称: '先有号' , 小红书号: xhs })], nextCursor: null }, null, 'qiangua')
    await persistPage(ctx.env, xinhongAdapter, { records: [raw('xinhong', { 达人ID: `${RUN}-l2`, 昵称: '后补号' })], nextCursor: null }, null, 'xinhong')
    const before = await linksOf(ctx, 'xinhong', `${RUN}-l2`)
    expect(before.id).not.toBe((await linksOf(ctx, 'qiangua', `${RUN}-l1`)).id)
    const counts = await persistPage(ctx.env, xinhongAdapter, { records: [raw('xinhong', { 达人ID: `${RUN}-l2`, 昵称: '后补号', 小红书号: xhs.toUpperCase() })], nextCursor: null }, null, 'xinhong')
    // `skipped` counts updates of an existing creator; nothing failed on the unique 小红书号.
    expect(counts).toEqual({ written: 0, skipped: 1, failed: 0 })
    expect((await linksOf(ctx, 'xinhong', `${RUN}-l2`)).id).toBe((await linksOf(ctx, 'qiangua', `${RUN}-l1`)).id)
    // The earlier creator keeps what it was measured with.
    const kept = await ctx.db.query('SELECT count(*)::int AS n FROM creator_raw WHERE creator_id = $1', [before.id])
    expect(kept.rows[0].n).toBe(1)
  })

  it('any writer is folded by the database, and two creators cannot hold one account', async () => {
    const xhs = `${RUN}_DbFold`
    await ctx.db.query(
      "INSERT INTO creators (id, creator_key, display_name, status, xhs_id) VALUES ($1, $1, 'x', 'draft', $2)",
      [`${RUN}-db1`, `  ${xhs} `],
    )
    expect((await ctx.db.query('SELECT xhs_id FROM creators WHERE id = $1', [`${RUN}-db1`])).rows[0].xhs_id).toBe(xhs.toLowerCase())
    await expect(ctx.db.query(
      "INSERT INTO creators (id, creator_key, display_name, status, xhs_id) VALUES ($1, $1, 'y', 'draft', $2)",
      [`${RUN}-db2`, xhs.toUpperCase()],
    )).rejects.toMatchObject({ code: '23505' })
  })
})

describe('migration 0042 merges creators whose 小红书号 differ only in spelling', () => {
  let ctx: TestCtx
  const sql = readFile(new URL('../src/migrations/0042_normalize_xhs_ids.sql', import.meta.url), 'utf8')
  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('keeps the released one, moves everything over, and archives the rest verbatim', async () => {
    const [keep, dup] = [`${RUN}-keep`, `${RUN}-dup`]
    const client = await ctx.db.connect()
    try {
      await client.query('BEGIN')
      // Recreate the state before 0042: no folding, no unique index.
      await client.query('DROP INDEX creators_xhs_id_key')
      await client.query('ALTER TABLE creators DISABLE TRIGGER creators_normalize_xhs')
      await client.query(
        `INSERT INTO creators (id, creator_key, display_name, status, xhs_id, created_at) VALUES
           ($1, $1, '新建的', 'draft', $3, '2026-01-01'), ($2, $2, '已上架', 'released', $4, '2026-02-01')`,
        [dup, keep, `${RUN}_Cheongdam_Skin `, `${RUN}_cheongdam_skin`],
      )
      await client.query(
        `INSERT INTO creator_categories (creator_id, category_slug) VALUES
           ($1, 'never_collaborated'), ($2, 'never_collaborated'), ($1, 'intending')`,
        [dup, keep],
      )
      await client.query(
        "INSERT INTO creator_sources (creator_id, source, external_id, first_seen_at, last_seen_at) VALUES ($1, 'qiangua', $2, now(), now())",
        [dup, `${RUN}-dup-ext`],
      )
      await client.query(
        "INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload) VALUES ($1, $2, 'qiangua', $3, now(), '{}')",
        [`${RUN}-dup-raw`, dup, `${RUN}-dup-ext`],
      )
      await client.query(await sql)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    expect((await ctx.db.query('SELECT 1 FROM creators WHERE id = $1', [dup])).rowCount).toBe(0)
    expect((await ctx.db.query('SELECT xhs_id FROM creators WHERE id = $1', [keep])).rows[0].xhs_id).toBe(`${RUN}_cheongdam_skin`.toLowerCase())
    const categories = await ctx.db.query('SELECT category_slug FROM creator_categories WHERE creator_id = $1 ORDER BY 1', [keep])
    expect(categories.rows.map((r) => r.category_slug)).toEqual(['intending', 'never_collaborated'])
    expect((await linksOf(ctx, 'qiangua', `${RUN}-dup-ext`)).id).toBe(keep)
    expect((await ctx.db.query('SELECT creator_id FROM creator_raw WHERE id = $1', [`${RUN}-dup-raw`])).rows[0].creator_id).toBe(keep)

    const archived = (await ctx.db.query('SELECT * FROM creator_merges WHERE merged_id = $1', [dup])).rows
    expect(archived).toHaveLength(1)
    expect(archived[0]).toMatchObject({ into_id: keep, merged_row: expect.objectContaining({ id: dup, display_name: '新建的' }) })
    expect(archived[0].conflicts).toEqual([
      { table: 'creator_categories', row: { creator_id: dup, category_slug: 'never_collaborated' } },
    ])

    // Rerunning changes nothing.
    await ctx.db.query(await sql)
    expect((await ctx.db.query('SELECT count(*)::int AS n FROM creator_merges WHERE merged_id = $1', [dup])).rows[0].n).toBe(1)
  })

  it('drops the duplicate\'s pool row instead of moving it, and marks its group for re-ranking', async () => {
    const [keep, dup] = [`${RUN}-pkeep`, `${RUN}-pdup`]
    const group = `${RUN}-group`
    const client = await ctx.db.connect()
    try {
      await client.query('BEGIN')
      await client.query('DROP INDEX creators_xhs_id_key')
      await client.query('ALTER TABLE creators DISABLE TRIGGER creators_normalize_xhs')
      await client.query(
        `INSERT INTO creators (id, creator_key, display_name, status, xhs_id, created_at) VALUES
           ($1, $1, '后上架', 'released', $3, '2026-03-01'), ($2, $2, '先上架', 'released', $4, '2026-02-01')`,
        [dup, keep, `${RUN}_Pool_Twin`, `${RUN}_pool_twin`],
      )
      await client.query(
        `INSERT INTO creator_published (creator_id, group_key, "window", tier, display_name, creator_key, metrics, published_at)
         VALUES ($1, $3, 30, 'mid', '后上架', $1, '{}', now()), ($2, $3, 30, 'mid', '先上架', $2, '{}', now())`,
        [dup, keep, group],
      )
      await client.query('DELETE FROM cohort_dirty_groups WHERE group_key = $1', [group])
      await client.query(await sql)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const pool = await ctx.db.query('SELECT creator_id, display_name FROM creator_published WHERE group_key = $1', [group])
    expect(pool.rows).toEqual([{ creator_id: keep, display_name: '先上架' }])
    const archived = (await ctx.db.query('SELECT conflicts FROM creator_merges WHERE merged_id = $1', [dup])).rows
    expect(archived).toEqual([{ conflicts: [] }])
    expect((await ctx.db.query('SELECT 1 FROM cohort_dirty_groups WHERE group_key = $1', [group])).rowCount).toBe(1)
    await ctx.db.query('DELETE FROM cohort_dirty_groups WHERE group_key = $1', [group])
  })
})
