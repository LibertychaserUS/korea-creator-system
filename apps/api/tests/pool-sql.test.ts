import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  defaultSavedQuery,
  deriveMetrics,
  emptyMetrics,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  toMinorUnits,
  type SavedQuery,
} from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'
import { enrichPoolItems, legacyRun, queryPool } from './legacy-pool'
import { publicPoolRow, asPublished, loadCreator } from '../src/http/creators'
import { ensurePublishedSnapshots } from '../src/http/pool'
import { loadTargets, refreshPublished } from '../src/http/published'

/**
 * Break: the pool table drifts from `creators` or from the contract's cohort
 * engine — a tie, a null, a source-less row or a blacklisted row ranked
 * differently than `rankGroup` / `applySavedQuery` would, or a page boundary
 * drops or repeats a row.
 */
describe('select pool in SQL matches the in-memory contract evaluation', () => {
  let ctx: TestCtx
  let token: string
  const tag = `sqlpool${Date.now()}`

  let seedValue = 7
  function rand() {
    seedValue = (seedValue * 1_103_515_245 + 12_345) % 2 ** 31
    return seedValue / 2 ** 31
  }
  function pick<T>(values: readonly T[]): T {
    return values[Math.floor(rand() * values.length)]
  }

  function minorPair(min: number | null, max: number | null, currency: 'CNY' | 'KRW') {
    return [
      min == null ? null : toMinorUnits(min, currency),
      max == null ? null : toMinorUnits(max, currency),
      currency,
    ]
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    token = (await ctx.loginJson('selector@kcs.local')).token
    // Small value sets on purpose: lots of ties and nulls inside each cohort.
    for (let i = 0; i < 240; i += 1) {
      const id = randomUUID()
      const followers = pick([null, 250, 4_000, 5_000, 49_999, 50_000, 120_000, 500_000, 800_000])
      const readMedian = pick([null, 800, 800, 1_200, 5_000, 20_000])
      const raw = {
        ...emptyMetrics(30),
        followers,
        readMedian,
        interactionMedian: pick([null, 20, 40, 40, 300]),
        likeMedian: pick([null, 10, 30]),
        collectMedian: pick([null, 5, 30]),
        noteCount: pick([null, 10, 40]),
        viralCount: pick([null, 0, 2]),
        priceImage: pick([null, 1_000, 3_000, 3_000, 9_000]),
        cpe: pick([null, null, null, 2.5, 3]),
        health: pick([null, 'healthy', 'healthy', 'abnormal'] as const),
        coopBrands: pick([[], ['兰芝'], ['雪花秀', '兰芝']]),
      }
      const legacy = i % 17 === 0
      const partial = i % 13 === 0
      const locked = legacy
        ? null
        : partial
          ? { followers, readMedian, interactionMedian: raw.interactionMedian, priceImage: raw.priceImage }
          : deriveMetrics(raw)
      await ctx.db.query(
        `INSERT INTO creators (id, creator_key, display_name, status, followers, regions, verticals,
           metrics, metrics_locked, metrics_locked_at, source, xhs_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          id,
          `${tag}_${i}`,
          `${tag} 博主 ${i}`,
          i % 11 === 0 ? 'draft' : 'released',
          followers,
          [pick(['上海', '서울', '부산', 'Shanghai']), tag],
          [pick(['beauty', 'food'])],
          JSON.stringify(deriveMetrics(raw)),
          locked ? JSON.stringify(locked) : null,
          locked ? new Date() : null,
          pick(['pugongying', 'qiangua', 'xinhong', 'qiangua', null]),
          i % 5 === 0 ? `xhs${i}` : null,
        ],
      )
      if (i % 19 === 0) {
        await ctx.db.query(
          "INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1, 'blacklist')",
          [id],
        )
      }
      if (i % 4 === 0) {
        await ctx.db.query(
          `INSERT INTO collaborations (id, creator_id, brand) VALUES (gen_random_uuid()::text, $1, $2)`,
          [id, pick(['兰芝', '悦诗风吟', '雪花秀'])],
        )
      }
      if (i % 3 === 0) {
        await ctx.db.query(
          `INSERT INTO prices (id, creator_id, amount_min_minor, amount_max_minor, currency)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
          [id, ...minorPair(pick([null, 800, 2_000]), pick([null, 5_000, 30_000]), pick(['CNY', 'KRW'] as const))],
        )
      }
    }
  })

  afterAll(() => ctx.close())

  async function get(path: string) {
    const res = await ctx.app.request(path, { headers: { authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    return res.json()
  }

  async function allPages(path: string, pageSize = 37) {
    const sep = path.includes('?') ? '&' : '?'
    const first = await get(`${path}${sep}pageSize=${pageSize}&page=1`)
    const items = [...first.items]
    for (let page = 2; (page - 1) * pageSize < first.total; page += 1) {
      items.push(...(await get(`${path}${sep}pageSize=${pageSize}&page=${page}`)).items)
    }
    expect(items).toHaveLength(first.total)
    return items
  }

  function json<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
  }

  type Row = { id: string; metrics: Record<string, any> }
  /** The old sort left full ties in database order; SQL settles them by id. Same tie-break here. */
  function settleTies<T extends Row>(rows: T[], keys: Array<[string, 1 | -1]>): T[] {
    const cmp = (a: T, b: T) => {
      for (const [key, dir] of keys) {
        const left = a.metrics[key]
        const right = b.metrics[key]
        if (left == null && right == null) continue
        if (left == null) return 1
        if (right == null) return -1
        if (left !== right) return (left - right) * dir
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    }
    return [...rows].sort(cmp)
  }

  it('heals released rows whose snapshot is missing or partial, and only once; reads write nothing', async () => {
    const count = async (sql: string) => (await ctx.db.query(sql)).rows[0].n
    const missing = await count("SELECT count(*)::int AS n FROM creators WHERE status = 'released' AND metrics_locked IS NULL")
    const tableRows = await count('SELECT count(*)::int AS n FROM creator_published')
    expect(missing).toBeGreaterThan(0)
    await get(`/api/select/pool?region=${tag}`)
    await get(`/api/select/shortlist`)
    expect(await count("SELECT count(*)::int AS n FROM creators WHERE status = 'released' AND metrics_locked IS NULL")).toBe(missing)
    expect(await count('SELECT count(*)::int AS n FROM creator_published')).toBe(tableRows)
    expect(await ensurePublishedSnapshots(ctx.db)).toBe(missing)
    expect(await ensurePublishedSnapshots(ctx.db, { full: true })).toBeGreaterThan(0)
    expect(await ensurePublishedSnapshots(ctx.db, { full: true })).toBe(0)
    const refreshed = await refreshPublished(ctx.db)
    expect(refreshed.written).toBeGreaterThan(0)
    expect(await count("SELECT count(*)::int AS n FROM creator_published WHERE creator_key LIKE '" + tag + "%'"))
      .toBe(await count("SELECT count(*)::int AS n FROM creators WHERE status = 'released' AND creator_key LIKE '" + tag + "%'"))
    const again = await refreshPublished(ctx.db)
    expect(again).toMatchObject({ written: 0, removed: 0, changed: 0 })
  })

  const poolQueries: Array<Record<string, string>> = [
    {},
    { sort: 'readMedian', dir: 'asc' },
    { sort: 'followers', order: 'desc' },
    { sort: 'engagementRate' },
    { tier: 'mid,junior', health: 'healthy' },
    { health: 'excellent' },
    { source: 'qiangua', cpeMax: '3' },
    { region: '上' },
    { brand: '兰' },
    { brand: ',' },
    { q: '博主 1' },
    { hasCollaborated: 'true' },
    { hasCollaborated: 'false', sort: 'cpr' },
    { priceMin: '1000', priceMax: '20000' },
    { priceMin: '1000', currency: 'KRW' },
    { categories: 'blacklist' },
    { category: 'beauty' },
    { collabCountMin: '1' },
    { collabCountMax: 'x' },
    { readMedianMin: 'abc' },
    { engagementRateMin: '0.02', followersMax: '200000' },
  ]

  for (const query of poolQueries) {
    it(`GET pool ${JSON.stringify(query)} — same rows, order and percentiles, across pages`, async () => {
      const scoped = { region: tag, ...query, ...(query.region ? { region: query.region } : {}) }
      const params = new URLSearchParams(scoped).toString()
      const sql = await allPages(`/api/select/pool?${params}`)
      const sortKey = query.sort ?? 'cpe'
      const dir = (query.dir ?? query.order ?? (sortKey === 'cpe' ? 'asc' : 'desc')) === 'asc' ? 1 : -1
      const legacy = settleTies(json((await queryPool(ctx.db, scoped)).map(publicPoolRow)), [
        [sortKey, dir],
        ['followers', -1],
      ])
      expect(sql.map((row: any) => row.id)).toEqual(legacy.map((row) => row.id))
      expect(sql).toEqual(legacy)
    })
  }

  const specs: Array<Partial<SavedQuery>> = [
    {},
    { sort: { key: 'followers', dir: 'desc' }, sources: ['pugongying'], tiers: ['mid', 'junior'] },
    { filters: [{ key: 'readMedian', op: 'percentileGte', value: 50 }] },
    { filters: [{ key: 'cpe', op: 'percentileGte', value: 60 }, { key: 'readMedian', op: 'percentileGte', value: 12.5 }] },
    { filters: [{ key: 'engagementRate', op: 'between', value: [0.01, 0.05] }], sort: { key: 'engagementRate', dir: 'asc' } },
    { filters: [{ key: 'followers', op: 'percentileGte', value: 10 }] },
    { health: ['healthy'], regions: ['上海'], brandsAny: ['兰芝'] },
    { columns: ['followers', 'priceImage', 'cpm', 'viralRate'], sort: { key: 'viralRate', dir: 'asc' } },
    { filters: [{ key: 'cpe', op: 'lte', value: 3 }], highlights: [{ key: 'readMedian', op: 'gte', value: 1_000, tone: 'good' }] },
    {
      columns: ['followers'],
      highlights: [
        { key: 'health', op: 'eq', value: 'abnormal', tone: 'bad' },
        { key: 'cpe', op: 'percentileGte', value: 50, tone: 'good' },
        { key: 'readMedian', op: 'gte', value: 1_000, tone: 'good', sources: ['qiangua'] },
        { key: 'interactionMedian', op: 'percentileLte', value: 40, tone: 'warn' },
      ],
    },
  ]

  for (const [index, overrides] of specs.entries()) {
    it(`queries/run spec #${index} — same rows, order, cohorts, percentiles and flags`, async () => {
      const spec = defaultSavedQuery({ name: 'eq', ...overrides })
      const sql = []
      let total = 0
      for (let page = 1; ; page += 1) {
        const res = await ctx.app.request(`/api/select/queries/run?page=${page}&pageSize=45`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(spec),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        total = body.total
        sql.push(...body.items)
        if (page * 45 >= total) break
      }
      const legacy = settleTies(json(await legacyRun(ctx.db, spec)) as any[], [
        [spec.sort.key, spec.sort.dir === 'asc' ? 1 : -1],
        ['cpe', 1],
        ['followers', -1],
      ])
      expect(total).toBe(legacy.length)
      expect(sql.map((row: any) => row.id)).toEqual(legacy.map((row) => row.id))
      expect(sql).toEqual(legacy)
    })
  }

  it('queries/run q narrows by name / creator key / 小红书号 before paging', async () => {
    const res = await ctx.app.request('/api/select/queries/run?q=XHS10', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(defaultSavedQuery({ name: 'q' })),
    })
    const body = await res.json()
    expect(body.items.length).toBeGreaterThan(0)
    const legacy = (await legacyRun(ctx.db, defaultSavedQuery({ name: "q" }))) as any[]
    const ids = new Set(body.items.map((row: any) => row.id))
    const expected = []
    for (const row of legacy) {
      const item = await loadCreator(ctx.db, row.id, false)
      if (`${item!.displayName} ${item!.creatorKey} ${item!.xhsId ?? ''}`.toLowerCase().includes('xhs10')) expected.push(row.id)
    }
    expect([...ids].sort()).toEqual(expected.slice(0, PAGE_SIZE_DEFAULT).sort())
  })

  it('detail percentiles equal the whole-pool evaluation without loading the pool', async () => {
    const pool = await queryPool(ctx.db, {})
    const targets = await loadTargets(ctx.db)
    const sample = pool.filter((item) => String(item.creatorKey).startsWith(tag)).slice(0, 25)
    for (const item of sample) {
      const detail = await get(`/api/select/creators/${item.id}`)
      const published = asPublished((await loadCreator(ctx.db, item.id, false))!)
      const expected = json(publicPoolRow(enrichPoolItems([published], pool, targets)[0]))
      expect({ ...detail, metricsLatest: undefined, rawAvailable: undefined, referenceLines: undefined }).toEqual({
        ...expected,
        metricsLatest: undefined,
        rawAvailable: undefined,
      })
    }
  })

  it('paging: default and capped page size, total survives an empty page', async () => {
    const first = await get(`/api/select/pool?region=${tag}`)
    expect(first.pageSize).toBe(PAGE_SIZE_DEFAULT)
    expect(first.items).toHaveLength(Math.min(PAGE_SIZE_DEFAULT, first.total))
    const capped = await get(`/api/select/pool?region=${tag}&pageSize=5000`)
    expect(capped.pageSize).toBe(PAGE_SIZE_MAX)
    const beyond = await get(`/api/select/pool?region=${tag}&page=999`)
    expect(beyond.items).toEqual([])
    expect(beyond.total).toBe(first.total)
  })
})
