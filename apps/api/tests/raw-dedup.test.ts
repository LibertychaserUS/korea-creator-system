import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type RawRecord, type SourceAdapter } from '@kcs/contract'
import { persistPage } from '../src/ingest/persist'
import { createTestApp, type TestCtx } from './helpers'

const RUN = `dedup${Date.now().toString(36)}`

const adapter: SourceAdapter = {
  id: 'qiangua',
  supports: [],
  provides: ['followers'],
  async fetch() {
    return { records: [], nextCursor: null }
  },
  normalize(record) {
    return {
      ok: true,
      creator: {
        creatorKey: creatorKeyFor('qiangua', record.externalId),
        externalId: record.externalId,
        platform: 'xhs',
        displayName: `去重 ${record.externalId}`,
        xhsId: null,
        avatarUrl: null,
        regions: [],
        verticals: [],
        metrics: { ...emptyMetrics(30), followers: Number(record.payload.粉丝数) },
        warnings: [],
      },
    }
  },
}

function raw(payload: Record<string, unknown>, fetchedAt: string): RawRecord {
  return { source: 'qiangua', platform: 'xhs', externalId: `${RUN}-a`, fetchedAt, payload }
}

describe('raw JSON: stored once per distinct content, every fetch kept', () => {
  let ctx: TestCtx
  const auth = { authorization: 'Bearer test:ops@kcs.local' }

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  it('three identical fetches → three fetch rows, one stored body; a change → a second body; all read back in full', async () => {
    const same = { 达人ID: `${RUN}-a`, 粉丝数: 5000, 长ID: '12345678901234567890', nested: { a: [1, 2, { b: '가' }] } }
    // Key order differs on the wire; jsonb text is canonical, so it is still the same content.
    const reordered = { nested: { a: [1, 2, { b: '가' }] }, 长ID: '12345678901234567890', 粉丝数: 5000, 达人ID: `${RUN}-a` }
    const before = Number((await ctx.db.query('SELECT count(*) FROM raw_payloads')).rows[0].count)
    for (const [payload, at] of [[same, '2026-09-20T01:00:00Z'], [same, '2026-09-21T01:00:00Z'], [reordered, '2026-09-22T01:00:00Z']] as const) {
      await persistPage(ctx.env, adapter, { records: [raw(payload, at)], nextCursor: null }, null, 'qiangua')
    }
    const changed = { ...same, 粉丝数: 5200 }
    await persistPage(ctx.env, adapter, { records: [raw(changed, '2026-09-23T01:00:00Z')] , nextCursor: null }, null, 'qiangua')

    const creator = (await ctx.db.query('SELECT id FROM creators WHERE creator_key = $1', [creatorKeyFor('qiangua', `${RUN}-a`)])).rows[0]
    const fetches = await ctx.db.query(
      'SELECT payload, encode(payload_hash, \'hex\') AS hash FROM creator_raw WHERE creator_id = $1 ORDER BY fetched_at',
      [creator.id],
    )
    expect(fetches.rows).toHaveLength(4)
    expect(fetches.rows.every((row) => row.payload === null)).toBe(true)
    expect(new Set(fetches.rows.map((row) => row.hash)).size).toBe(2)
    const after = Number((await ctx.db.query('SELECT count(*) FROM raw_payloads')).rows[0].count)
    expect(after - before).toBe(2)

    const response = await ctx.app.request(`/api/ingest/raw/${creator.id}`, { headers: auth })
    expect(response.status).toBe(200)
    const body = await response.json() as { items: { payload: Record<string, unknown>; fetchedAt: string; contentHash: string }[] }
    expect(body.items.map((item) => item.fetchedAt)).toEqual([
      '2026-09-23T01:00:00.000Z', '2026-09-22T01:00:00.000Z', '2026-09-21T01:00:00.000Z', '2026-09-20T01:00:00.000Z',
    ])
    expect(body.items[0]!.payload).toEqual(changed)
    for (const item of body.items.slice(1)) expect(item.payload).toEqual(same)
    expect(body.items[1]!.contentHash).toBe(body.items[3]!.contentHash)
    expect(body.items[0]!.contentHash).not.toBe(body.items[1]!.contentHash)
  })

  it('the migration moves legacy inline payloads over, is safe to run again, and uses lz4 for the body', async () => {
    const creator = (await ctx.db.query('SELECT id FROM creators WHERE creator_key = $1', [creatorKeyFor('qiangua', `${RUN}-a`)])).rows[0]
    const legacy = { 达人ID: `${RUN}-a`, legacy: true, 粉丝数: 4000 }
    for (const n of [1, 2]) {
      await ctx.db.query(
        `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
         VALUES ($1, $2, 'qiangua', $3, now(), $4)`,
        [`${RUN}-legacy-${n}`, creator.id, `${RUN}-a`, JSON.stringify(legacy)],
      )
    }
    const sql = await readFile(new URL('../src/migrations/0045_raw_payload_dedup.sql', import.meta.url), 'utf8')
    await ctx.db.query(sql)
    await ctx.db.query(sql)
    const { rows } = await ctx.db.query(
      `SELECT r.payload AS inline, p.payload AS stored FROM creator_raw r JOIN raw_payloads p ON p.hash = r.payload_hash
        WHERE r.id = ANY($1)`,
      [[`${RUN}-legacy-1`, `${RUN}-legacy-2`]],
    )
    expect(rows).toEqual([{ inline: null, stored: legacy }, { inline: null, stored: legacy }])
    const compression = await ctx.db.query(
      "SELECT attcompression FROM pg_attribute WHERE attrelid = 'raw_payloads'::regclass AND attname = 'payload'",
    )
    expect(compression.rows[0].attcompression).toBe('l')
  })
})
