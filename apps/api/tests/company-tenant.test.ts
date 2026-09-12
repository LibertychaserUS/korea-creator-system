import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectDb } from '../src/db'
import { migrate } from '../src/migrate'
import { seed } from '../src/seed'
import { createTestApp, type TestCtx } from './helpers'

const TEST_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test'

const PINK_NAMES = ['Chin 沁柔 / 柔柔', '美丽妄娜 / Wanna', 'くるみ / Kurumi', '居猫夫人', '橘七七', '久木田帆乃夏']

describe('company tenant + IMOK pink pack', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('seeds IMOK and a second company; ops@ and selector@ belong to IMOK', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const sel = await ctx.loginJson('selector@kcs.local')
    expect(ops.user.companyId).toBe('org_imok')
    expect(sel.user.companyId).toBe('org_imok')

    const me = await ctx.app.request('/api/auth/me', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(me.status).toBe(200)
    const body = await me.json()
    expect(body.user.companyId).toBe('org_imok')
    expect(body.user.company.slug).toBe('imok')

    const db = await connectDb(TEST_URL)
    const { rows } = await db.query(`SELECT id, slug, name FROM orgs ORDER BY id`)
    await db.end()
    const slugs = rows.map((row) => row.slug)
    expect(slugs).toEqual(expect.arrayContaining(['imok', 'hansoul']))
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('imports the three IMOK CSVs idempotently into that company dataset', async () => {
    const db = await connectDb(TEST_URL)
    await migrate(db)
    const first = await seed(db)
    const second = await seed(db)
    const counts = await db.query(
      `SELECT dataset, count(*)::int AS n FROM company_dataset_rows WHERE org_id = 'org_imok' GROUP BY dataset`,
    )
    await db.end()

    expect(first.imported).toEqual({ summary: 6, detail: 146, chart: 104 })
    expect(second.imported).toEqual(first.imported)
    expect(second).toEqual(first)
    const byDataset = Object.fromEntries(counts.rows.map((row) => [row.dataset, row.n]))
    expect(byDataset).toMatchObject({ summary: 6, detail: 146, chart: 104 })
  })

  it('persists IMOK filter rule pack from 建议/粉量/对接/韩国关系/结论/风险', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/select/company', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.company.id).toBe('org_imok')
    expect(body.rulePack.slug).toBe('imok-pink')
    expect(body.rulePack.dimensions.map((d: { key: string }) => d.key)).toEqual([
      'advice',
      'followersBand',
      'outreach',
      'koreaRelation',
      'conclusion',
      'risk',
    ])
    expect(body.rulePack.dimensions.map((d: { label: string }) => d.label)).toEqual([
      '建议',
      '粉量',
      '对接',
      '韩国关系',
      '结论',
      '风险',
    ])
    expect(body.rulePack.dimensions[0].options).toEqual(
      expect.arrayContaining(['优先（粉色里最贴条件）', '不进正式名单']),
    )
    expect(body.rulePack.dimensions[1].options).toEqual(expect.arrayContaining(['过线', '接近', '不够']))
  })

  it('persists 合作过名单 for IMOK from the pink pack', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/select/company', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const body = await res.json()
    const names = body.collaborators.map((row: { displayName: string }) => row.displayName)
    expect(names.sort()).toEqual([...PINK_NAMES].sort())
    expect(body.collaborators.every((row: { outreach: string }) => row.outreach)).toBe(true)
  })

  it('stores company prefs JSON with currency and default sort', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/select/company', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const body = await res.json()
    expect(body.prefs).toMatchObject({
      currency: 'CNY',
      locale: 'zh-CN',
      defaultSort: 'rating',
    })
    expect(['CNY', 'USD', 'KRW']).toContain(body.prefs.currency)

    const db = await connectDb(TEST_URL)
    const other = await db.query(`SELECT prefs FROM orgs WHERE id = 'org_hansoul'`)
    await db.end()
    expect(other.rows[0].prefs).toMatchObject({ currency: 'USD', defaultSort: 'followers' })
  })

  it('scopes selector pool to the caller company and applies that company rule filters', async () => {
    const db = await connectDb(TEST_URL)
    await db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, followers, regions, org_id)
       VALUES ('creator_hansoul_only', 'ck_hansoul_only', '韩颂独占', 'released', 90000, '{서울}', 'org_hansoul')
       ON CONFLICT (id) DO NOTHING`,
    )
    await db.query(
      `INSERT INTO creator_categories (creator_id, category_slug)
       VALUES ('creator_hansoul_only', 'never_collaborated') ON CONFLICT DO NOTHING`,
    )
    await db.end()

    const sel = await ctx.loginJson('selector@kcs.local')
    const pool = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(pool.status).toBe(200)
    const body = await pool.json()
    expect(body.company.id).toBe('org_imok')
    expect(body.rulePack.slug).toBe('imok-pink')
    const names = body.items.map((row: { displayName: string }) => row.displayName)
    expect(names).not.toContain('韩颂独占')
    expect(names).toEqual(expect.arrayContaining(['Chin 沁柔 / 柔柔']))

    const byAdvice = await ctx.app.request(
      `/api/select/pool?advice=${encodeURIComponent('优先（粉色里最贴条件）')}`,
      { headers: { authorization: `Bearer ${sel.token}` } },
    )
    const advised = (await byAdvice.json()).items.map((row: { displayName: string }) => row.displayName)
    expect(advised).toEqual(['Chin 沁柔 / 柔柔'])

    const collab = await ctx.app.request('/api/select/pool?hasCollaborated=true', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    const collabNames = (await collab.json()).items.map((row: { displayName: string }) => row.displayName)
    expect(collabNames).toEqual(expect.arrayContaining(PINK_NAMES))
  })
})
