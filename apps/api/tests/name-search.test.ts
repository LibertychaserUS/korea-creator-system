import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type RawRecord, type SourceAdapter } from '@kcs/contract'
import { persistPage } from '../src/ingest/persist'
import { nameMatchSql, searchCreatorNames } from '../src/ingest/name-search'
import { createTestApp, type TestCtx } from './helpers'

const RUN = `ns${Date.now().toString(36)}`

const adapter: SourceAdapter = {
  id: 'qiangua',
  supports: ['externalIds'],
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
        displayName: String(record.payload.name),
        xhsId: null,
        avatarUrl: null,
        regions: [],
        verticals: [],
        metrics: { ...emptyMetrics(30), followers: Number(record.payload.fans ?? 10_000) },
        warnings: [],
      },
    }
  },
}

const NAMES = {
  cheongdam: '청담스킨 공식',
  cheongdamLatin: 'Cheongdam Skin',
  jisooLatin: 'Jisoo',
  jisoo: '지수의 하루',
  jeongsuk: '정숙',
  hongshu: '小红薯的日常',
  hongshao: '红烧肉研究所',
} as const

describe('fuzzy nickname search', () => {
  let ctx: TestCtx
  const ids: Record<string, string> = {}
  const search = async (q: string, options: Parameters<typeof searchCreatorNames>[2] = {}) =>
    (await searchCreatorNames(ctx.db, q, options)).filter((hit) => Object.values(ids).includes(hit.id))
  const keys = (hits: { id: string }[]) => hits.map((hit) => Object.entries(ids).find(([, id]) => id === hit.id)![0])

  beforeAll(async () => {
    ctx = await createTestApp()
    for (const [key, name] of Object.entries(NAMES)) {
      const record: RawRecord = {
        source: 'qiangua', platform: 'xhs', externalId: `${RUN}-${key}`, fetchedAt: new Date().toISOString(), payload: { name },
      }
      await persistPage(ctx.env, adapter, { records: [record], nextCursor: null }, null, 'qiangua')
      ids[key] = (await ctx.db.query(
        "SELECT creator_id FROM creator_sources WHERE source = 'qiangua' AND external_id = $1",
        [`${RUN}-${key}`],
      )).rows[0].creator_id
    }
  })
  afterAll(() => ctx.close())

  it('Korean: part of a name, then the Latin spelling of it', async () => {
    const hits = await search('청담')
    expect(keys(hits)).toEqual(['cheongdam', 'cheongdamLatin'])
    expect(hits[0]).toMatchObject({ exact: true, score: 1 })
    expect(hits[1]!.exact).toBe(false)
  })

  it('Korean: a wrong final consonant still finds it', async () => {
    expect(keys(await search('청닮스킨'))).toContain('cheongdam')
  })

  it('Korean: initial consonants only (초성)', async () => {
    expect(keys(await search('ㅈㅅ')).sort()).toEqual(['jeongsuk', 'jisoo'])
  })

  it('romanised either way: Jisoo ↔ 지수', async () => {
    expect(keys(await search('jisoo'))).toEqual(['jisooLatin', 'jisoo'])
    expect(keys(await search('지수'))).toEqual(['jisoo', 'jisooLatin'])
    expect(keys(await search('JI SOO'))).toContain('jisooLatin')
  })

  it('Chinese: two characters in the middle of a name, and not a near-miss', async () => {
    expect(keys(await search('红薯'))).toEqual(['hongshu'])
    expect(keys(await search('日常'))).toEqual(['hongshu'])
    expect(keys(await search('红烧'))).toEqual(['hongshao'])
  })

  it('full-width, spaces, punctuation and case do not matter', async () => {
    expect(keys(await search('ＣＨＥＯＮＧＤＡＭ－skin'))).toContain('cheongdamLatin')
    expect(keys(await search('청담 스킨!'))).toContain('cheongdam')
  })

  it('nothing to search, nothing found; status filter narrows', async () => {
    expect(await searchCreatorNames(ctx.db, '   ')).toEqual([])
    expect(await search('！！！')).toEqual([])
    expect(await search('청담', { statuses: ['released'] })).toEqual([])
    expect(keys(await search('청담', { statuses: ['draft'] }))).toEqual(['cheongdam', 'cheongdamLatin'])
  })

  it('follows a rename (generated column)', async () => {
    await ctx.db.query("UPDATE creators SET display_name = '서울뷰티' WHERE id = $1", [ids.jeongsuk])
    expect(keys(await search('ㅈㅅ'))).toEqual(['jisoo'])
    expect(keys(await search('뷰티'))).toEqual(['jeongsuk'])
    await ctx.db.query('UPDATE creators SET display_name = $2 WHERE id = $1', [ids.jeongsuk, NAMES.jeongsuk])
  })

  it('the select pool and saved queries search nicknames the same fuzzy way', async () => {
    const selector = { authorization: 'Bearer test:selector@kcs.local', 'content-type': 'application/json' }
    const ops = { authorization: 'Bearer test:ops@kcs.local' }
    for (const key of ['jisoo', 'jeongsuk'] as const) {
      await ctx.db.query("UPDATE creators SET regions = ARRAY['kr'] WHERE id = $1", [ids[key]])
      expect((await ctx.app.request(`/api/ops/creators/${ids[key]}/publish`, { method: 'POST', headers: ops })).status).toBe(200)
    }
    const pool = async (q: string) => (await (await ctx.app.request(`/api/select/pool?q=${encodeURIComponent(q)}`, { headers: selector })).json())
      .items.map((row: { id: string }) => row.id).filter((id: string) => Object.values(ids).includes(id))
    expect(await pool('Jisu')).toEqual([ids.jisoo])
    expect(await pool('ㅈㅅ')).toEqual(expect.arrayContaining([ids.jisoo, ids.jeongsuk]))
    expect(await pool('지수')).toEqual([ids.jisoo])
  })

  it('the SQL pieces drop into another query', async () => {
    const match = nameMatchSql('x', '$1')
    const { rows } = await ctx.db.query(
      `SELECT x.id FROM creators x WHERE ${match.where} AND x.id = ANY($2::text[]) ORDER BY ${match.order}, x.id`,
      ['红薯', Object.values(ids)],
    )
    expect(rows.map((row) => row.id)).toEqual([ids.hongshu])
  })

  it('uses the gram index', async () => {
    await ctx.db.query('SET enable_seqscan = off')
    try {
      const plan = await ctx.db.query(`EXPLAIN SELECT id FROM creators c WHERE ${nameMatchSql('c', "'청담'").where}`)
      expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain('creators_name_grams_idx')
    } finally {
      await ctx.db.query('SET enable_seqscan = on')
    }
  })

  it('the migration can run again', async () => {
    for (const file of ['0051_name_search.sql', '0090_restorable_name_grams.sql']) {
      await ctx.db.query(await readFile(new URL(`../src/migrations/${file}`, import.meta.url), 'utf8'))
    }
    expect(keys(await search('청담'))).toEqual(['cheongdam', 'cheongdamLatin'])
  })

  it('grams compute with an empty search_path, as pg_restore runs', async () => {
    const client = await ctx.db.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL search_path = ''")
      const { rows } = await client.query(
        'SELECT public.kcs_name_grams($1) AS grams, name_grams FROM public.creators WHERE id = $2',
        [NAMES.cheongdam, ids.cheongdam],
      )
      expect(rows[0].grams).toEqual(rows[0].name_grams)
      await client.query(
        'CREATE TEMP TABLE restore_probe (display_name text, name_grams text[] GENERATED ALWAYS AS (public.kcs_name_grams(display_name)) STORED)',
      )
      await client.query('INSERT INTO pg_temp.restore_probe (display_name) VALUES ($1)', [NAMES.jisoo])
      expect((await client.query('SELECT cardinality(name_grams) AS n FROM pg_temp.restore_probe')).rows[0].n).toBeGreaterThan(0)
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })

  it('route: ingest rights, capped query', async () => {
    const ok = await ctx.app.request(`/api/ingest/name-search?q=${encodeURIComponent('红薯')}`, {
      headers: { authorization: 'Bearer test:ops@kcs.local' },
    })
    expect(ok.status).toBe(200)
    const body = await ok.json()
    expect(body.items.map((item: { id: string }) => item.id)).toContain(ids.hongshu)
    expect(body.items[0]).toMatchObject({ displayName: expect.any(String), exact: expect.any(Boolean), score: expect.any(Number) })
    const denied = await ctx.app.request('/api/ingest/name-search?q=x', { headers: { authorization: 'Bearer test:selector@kcs.local' } })
    expect(denied.status).toBe(403)
  })
})
