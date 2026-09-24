import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { API, apiPath, type CategoryUsage, type CategoryView, type SourceDictionaries } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'
import { replaceSourceDictionary } from '../src/routes/ops-catalog'

let ctx: TestCtx
let ops: string
let devops: string
let selector: string
let viewer: string

const call = async (token: string, method: string, path: string, body?: unknown) =>
  ctx.app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const trail = async (action: string) =>
  (await ctx.db.query('SELECT actor_id, entity_id, summary FROM audit_logs WHERE action = $1 ORDER BY created_at', [action])).rows

beforeAll(async () => {
  ctx = await createTestApp()
  ops = (await ctx.loginJson('ops@kcs.local')).token
  devops = (await ctx.loginJson('devops@kcs.local')).token
  selector = (await ctx.loginJson('selector@kcs.local')).token
  viewer = (await ctx.loginJson('viewer@kcs.local')).token
})

afterAll(async () => {
  await ctx.close()
})

describe('POST /api/ops/categories · GET /api/ops/categories/usage', () => {
  beforeEach(async () => {
    await ctx.db.query("DELETE FROM creator_categories WHERE category_slug LIKE 'c_test%'")
    await ctx.db.query("DELETE FROM categories WHERE slug LIKE 'c_test%'")
    await ctx.db.query("DELETE FROM audit_logs WHERE action = 'category.create'")
  })

  const body = { slug: 'c_test_beauty', names: { 'zh-CN': '美妆试用', en: 'Beauty trial', ko: '뷰티 체험' } }

  it('ops adds a category in three languages; it is enabled, not built in, and written down', async () => {
    const res = await call(ops, 'POST', API.opsCategoryCreate.path, body)
    expect(res.status).toBe(201)
    const created = (await res.json()) as CategoryView
    expect(created).toMatchObject({ slug: 'c_test_beauty', nameZh: '美妆试用', nameKo: '뷰티 체험', builtin: false, enabled: true, frontendVisible: true })
    const list = (await (await call(ops, 'GET', API.opsCategories.path)).json()) as { items: CategoryView[] }
    expect(list.items.map((c) => c.slug)).toContain('c_test_beauty')
    expect(await trail('category.create')).toEqual([{ actor_id: 'user_ops', entity_id: 'c_test_beauty', summary: '美妆试用' }])
  })

  it('a taken slug is 409; a bad slug or a missing language is 400', async () => {
    expect((await call(ops, 'POST', API.opsCategoryCreate.path, body)).status).toBe(201)
    const again = await call(ops, 'POST', API.opsCategoryCreate.path, body)
    expect(again.status).toBe(409)
    expect((await again.json()).error.message).toBe('category_exists')
    expect((await call(ops, 'POST', API.opsCategoryCreate.path, { ...body, slug: 'Bad Slug' })).status).toBe(400)
    expect((await call(ops, 'POST', API.opsCategoryCreate.path, { slug: 'c_test_x', names: { 'zh-CN': '只有中文' } })).status).toBe(400)
    expect(await trail('category.create')).toHaveLength(1)
  })

  it('only roles with ops.categories can add; usage counts creators per category', async () => {
    expect((await call(devops, 'POST', API.opsCategoryCreate.path, body)).status).toBe(403)
    expect((await call(selector, 'POST', API.opsCategoryCreate.path, body)).status).toBe(403)
    await call(ops, 'POST', API.opsCategoryCreate.path, body)
    const creators = (await ctx.db.query('SELECT id FROM creators ORDER BY id LIMIT 2')).rows.map((r) => r.id)
    for (const id of creators) {
      await ctx.db.query('INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1, $2)', [id, 'c_test_beauty'])
    }
    const usage = (await (await call(ops, 'GET', API.opsCategoryUsage.path)).json()) as CategoryUsage
    expect(usage.items.find((u) => u.slug === 'c_test_beauty')?.creators).toBe(2)
    expect((await call(selector, 'GET', API.opsCategoryUsage.path)).status).toBe(403)
  })
})

describe('GET /api/ops/dictionaries · POST /api/ops/dictionaries/:source/:kind', () => {
  beforeEach(async () => {
    await ctx.db.query('DELETE FROM source_dictionaries')
    await ctx.db.query("DELETE FROM audit_logs WHERE action = 'dictionary.replace'")
    await ctx.db.query("DELETE FROM creator_sources WHERE external_id LIKE 'dict_%'")
    await ctx.db.query("DELETE FROM creators WHERE id LIKE 'dict_%'")
  })

  async function creatorFrom(source: string, id: string, regions: string[], verticals: string[]) {
    await ctx.db.query(
      `INSERT INTO creators (id, creator_key, display_name, regions, verticals, status)
       VALUES ($1, $1, $1, $2, $3, 'draft')`,
      [id, regions, verticals],
    )
    await ctx.db.query('INSERT INTO creator_sources (creator_id, source, external_id) VALUES ($1, $2, $1)', [id, source])
  }

  const dictionaries = async (source: string) => {
    const res = await call(ops, 'GET', apiPath(API.opsDictionaries, {}, { source }))
    expect(res.status).toBe(200)
    return (await res.json()) as SourceDictionaries
  }

  it('without a platform list, offers values seen on creators from that source only, most used first', async () => {
    await creatorFrom('pugongying', 'dict_a', ['甲省', '甲一市'], ['甲类'])
    await creatorFrom('pugongying', 'dict_b', ['甲省', ' '], ['甲类', '乙类'])
    await creatorFrom('xinhong', 'dict_c', ['乙省'], ['丙类'])
    const d = await dictionaries('pugongying')
    expect(d.updatedAt).toEqual({ category: null, region: null })
    const region = d.region.filter((o) => ['甲省', '甲一市', '乙省'].includes(o.value))
    expect(region).toEqual([
      { value: '甲省', group: null, origin: 'seen', creators: 2 },
      { value: '甲一市', group: null, origin: 'seen', creators: 1 },
    ])
    expect(d.category.find((o) => o.value === '甲类')).toMatchObject({ origin: 'seen', creators: 2 })
    expect(d.category.map((o) => o.value)).not.toContain('丙类')
    expect(d.region.map((o) => o.value)).not.toContain('')
  })

  it('a platform list comes first in its own order with groups; seen values not on it follow', async () => {
    await creatorFrom('pugongying', 'dict_a', ['甲省', '甲一县'], ['甲类'])
    const res = await call(ops, 'POST', apiPath(API.opsDictionaryReplace, { source: 'pugongying', kind: 'region' }), {
      items: [
        { value: '甲省', group: null },
        { value: '甲一市', group: '甲省' },
        { value: '甲一市', group: '甲省' },
        { value: '  甲二市 ', group: '甲省' },
      ],
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ source: 'pugongying', kind: 'region', count: 3 })
    const d = await dictionaries('pugongying')
    expect(d.region).toEqual([
      { value: '甲省', group: null, origin: 'platform', creators: 1 },
      { value: '甲一市', group: '甲省', origin: 'platform', creators: 0 },
      { value: '甲二市', group: '甲省', origin: 'platform', creators: 0 },
      ...d.region.slice(3),
    ])
    expect(d.region.slice(3).every((o) => o.origin === 'seen')).toBe(true)
    expect(d.region.find((o) => o.value === '甲一县')?.origin).toBe('seen')
    expect(d.updatedAt.region).not.toBeNull()
    expect(d.updatedAt.category).toBeNull()
    expect(await trail('dictionary.replace')).toEqual([{ actor_id: 'user_ops', entity_id: 'pugongying/region', summary: '3' }])
  })

  it('a replace swaps the whole list for that source and kind, and leaves the others alone', async () => {
    await replaceSourceDictionary(ctx.db, 'pugongying', 'category', [{ value: '美妆' }, { value: '母婴' }])
    await replaceSourceDictionary(ctx.db, 'qiangua', 'category', [{ value: '美食' }])
    await replaceSourceDictionary(ctx.db, 'pugongying', 'category', [{ value: '穿搭' }])
    const platform = (d: SourceDictionaries) => d.category.filter((o) => o.origin === 'platform').map((o) => o.value)
    expect(platform(await dictionaries('pugongying'))).toEqual(['穿搭'])
    expect(platform(await dictionaries('qiangua'))).toEqual(['美食'])
    await replaceSourceDictionary(ctx.db, 'pugongying', 'category', [])
    expect(platform(await dictionaries('pugongying'))).toEqual([])
  })

  it('unknown source or kind; only ops.categories may replace; selector cannot read', async () => {
    expect((await call(ops, 'GET', apiPath(API.opsDictionaries, {}, { source: 'file-drop' }))).status).toBe(400)
    expect((await call(ops, 'GET', API.opsDictionaries.path)).status).toBe(400)
    const replace = (token: string, source: string, kind: string, body: unknown = { items: [] }) =>
      call(token, 'POST', apiPath(API.opsDictionaryReplace, { source, kind }), body)
    expect((await replace(ops, 'nope', 'region')).status).toBe(404)
    expect((await replace(ops, 'pugongying', 'brand')).status).toBe(404)
    expect((await replace(ops, 'pugongying', 'region', { items: [{ value: '' }] })).status).toBe(400)
    expect((await replace(devops, 'pugongying', 'region')).status).toBe(403)
    expect((await call(selector, 'GET', apiPath(API.opsDictionaries, {}, { source: 'pugongying' }))).status).toBe(403)
  })
})

describe('DELETE /api/select/shortlist/:creatorId', () => {
  let creatorId: string

  beforeEach(async () => {
    await ctx.db.query('DELETE FROM shortlist_items')
    await ctx.db.query("DELETE FROM audit_logs WHERE action IN ('shortlist.add', 'shortlist.remove')")
    creatorId = (await ctx.db.query("SELECT id FROM creators WHERE status = 'released' ORDER BY id LIMIT 1")).rows[0].id
  })

  it('takes a creator off the org’s shortlist and writes it down; a second time is 404', async () => {
    expect((await call(selector, 'POST', API.shortlistAdd.path, { creatorId })).status).toBe(200)
    const listed = (await (await call(selector, 'GET', API.shortlist.path)).json()) as { items: { creatorId: string }[] }
    expect(listed.items.map((i) => i.creatorId)).toEqual([creatorId])
    const path = apiPath(API.shortlistRemove, { creatorId })
    expect((await call(selector, 'DELETE', path)).status).toBe(200)
    expect(((await (await call(selector, 'GET', API.shortlist.path)).json()) as { items: unknown[] }).items).toEqual([])
    expect((await call(selector, 'DELETE', path)).status).toBe(404)
    expect(await trail('shortlist.remove')).toEqual([{ actor_id: 'user_selector', entity_id: creatorId, summary: 'shortlist' }])
  })

  it('read-only viewers and ops cannot remove', async () => {
    await call(selector, 'POST', API.shortlistAdd.path, { creatorId })
    const path = apiPath(API.shortlistRemove, { creatorId })
    expect((await call(viewer, 'DELETE', path)).status).toBe(403)
    expect((await call(ops, 'DELETE', path)).status).toBe(403)
  })
})
