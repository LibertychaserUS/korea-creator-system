import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultSavedQuery, METRIC_KEYS, RANKED_METRIC_KEYS, rankGroup, type CohortMember } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'
import { loadTargets, metricColumn, rankColumn, recomputeDirtyGroups, refreshPublished } from '../src/http/published'

/**
 * Break: the pool table's ranks stop following publish / take-down / blacklist
 * in the same transaction, a group mixes sources, windows or content forms, a
 * small group gets a rank, or an old snapshot keeps one.
 */
describe('cohort percentiles on the pool table', () => {
  let context: TestCtx
  let opsToken: string
  let selectorToken: string
  const tag = `cohort${Date.now()}`

  beforeAll(async () => {
    context = await createTestApp()
    opsToken = (await context.loginJson('ops@kcs.local')).token
    selectorToken = (await context.loginJson('selector@kcs.local')).token
  })

  afterAll(() => context.close())

  const ops = (path: string, init: { method?: string; body?: unknown } = {}) =>
    context.app.request(path, {
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${opsToken}`, 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  const select = async (path: string, body?: unknown) => {
    const res = await context.app.request(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${selectorToken}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    expect(res.status).toBeLessThan(300)
    return res.json()
  }

  async function create(name: string, source: string, metrics: Record<string, unknown>, publish = true) {
    const res = await ops('/api/ops/creators', {
      method: 'POST',
      body: {
        displayName: name,
        source,
        externalId: name,
        regions: [tag],
        verticals: ['test'],
        categories: ['never_collaborated'],
        metrics: { window: 90, followers: 30_000, readMedian: 10_000, interactionMedian: 500, ...metrics },
      },
    })
    expect(res.status).toBe(201)
    const { id } = await res.json()
    if (publish) expect((await ops(`/api/ops/creators/${id}/publish`, { method: 'POST' })).status).toBe(200)
    return id as string
  }

  const pool = async (region = tag) => (await select(`/api/select/pool?region=${region}&pageSize=100`)).items as any[]
  const byName = (items: any[]) => Object.fromEntries(items.map((item) => [item.displayName, item]))

  it('ranks each source × window × content form on its own, and not below 10 peers', async () => {
    for (let i = 0; i < 12; i += 1) {
      await create(`${tag}-蒲${i}`, 'pugongying', { cpe: 10 + i, contentForm: 'video' })
      await create(`${tag}-瓜${i}`, 'qiangua', { cpe: 0.1 + i / 10, contentForm: 'video' })
    }
    for (let i = 0; i < 9; i += 1) await create(`${tag}-图${i}`, 'pugongying', { cpe: 1 + i, contentForm: 'image' })

    const items = byName(await pool())
    // Cheapest 蒲公英 video is the best of its own group, however cheap 千瓜 is.
    expect(items[`${tag}-蒲0`].percentiles.cpe).toMatchObject({ n: 12, band: 'front' })
    expect(items[`${tag}-蒲0`].percentiles.cpe.percentile).toBeGreaterThan(90)
    expect(items[`${tag}-瓜11`].percentiles.cpe.band).toBe('back')
    expect(items[`${tag}-蒲0`].cohort).toMatchObject({ source: 'pugongying', window: 90, contentForm: 'video', size: 12 })
    // 9 image notes: listed, never ranked.
    expect(items[`${tag}-图0`].cohort.size).toBe(9)
    expect(items[`${tag}-图0`].percentiles).toEqual({})
  })

  it('publish and take-down re-rank the group in the same request', async () => {
    const before = byName(await pool())[`${tag}-蒲5`].percentiles.cpe
    const id = await create(`${tag}-蒲new`, 'pugongying', { cpe: 1, contentForm: 'video' })
    const after = byName(await pool())[`${tag}-蒲5`].percentiles.cpe
    expect(after.n).toBe(before.n + 1)
    expect(after.percentile).toBeLessThan(before.percentile)

    expect((await ops(`/api/ops/creators/${id}/unpublish`, { method: 'POST' })).status).toBe(200)
    const back = byName(await pool())
    expect(back[`${tag}-蒲new`]).toBeUndefined()
    expect(back[`${tag}-蒲5`].percentiles.cpe).toEqual(before)
    const dirty = await context.db.query('SELECT count(*)::int AS n FROM cohort_dirty_groups')
    expect(dirty.rows[0].n).toBe(0)
  })

  it('a blacklist edit drops the row and re-ranks the rest right away', async () => {
    const items = byName(await pool())
    const target = items[`${tag}-瓜0`]
    const n = items[`${tag}-瓜5`].percentiles.cpe.n
    const res = await ops(`/api/ops/creators/${target.id}`, {
      method: 'PATCH',
      body: { categories: ['never_collaborated', 'blacklist'] },
    })
    expect(res.status).toBe(200)
    const after = byName(await pool())
    expect(after[`${tag}-瓜0`]).toBeUndefined()
    expect(after[`${tag}-瓜5`].percentiles.cpe.n).toBe(n - 1)
    expect(after[`${tag}-瓜5`].cohort.size).toBe(11)
    await ops(`/api/ops/creators/${target.id}`, { method: 'PATCH', body: { categories: ['never_collaborated'] } })
    expect(byName(await pool())[`${tag}-瓜5`].percentiles.cpe.n).toBe(n)
  })

  it('concurrent publishes in one group end where a full recompute ends', async () => {
    const ids = await Promise.all([0, 1, 2, 3].map((i) => create(`${tag}-并${i}`, 'pugongying', { cpe: 5 + i, contentForm: 'video' }, false)))
    await Promise.all(ids.map((id) => ops(`/api/ops/creators/${id}/publish`, { method: 'POST' })))
    const live = await context.db.query(
      "SELECT creator_id, ranks FROM creator_published WHERE group_key = 'pugongying|90|video' ORDER BY creator_id",
    )
    const { rows } = await context.db.query(
      `SELECT creator_id, fetched_at, ${METRIC_KEYS.map(metricColumn).join(', ')}
         FROM creator_published WHERE group_key = 'pugongying|90|video' AND NOT blacklisted`,
    )
    const members: CohortMember[] = rows.map((row) => {
      const metrics: Record<string, unknown> = { platformRanks: null }
      for (const key of METRIC_KEYS) metrics[key] = row[metricColumn(key)]
      return { id: row.creator_id, followers: metrics.followers as number, metrics: metrics as any }
    })
    const target = (await loadTargets(context.db)).get('pugongying') ?? 97
    const expected = rankGroup(members, { target })
    for (const row of live.rows) expect(row.ranks).toEqual(expected.get(row.creator_id))
  })

  it('a snapshot older than 60 days lists without a percentile and fails a percentile filter', async () => {
    const listed = byName(await pool())
    const id = listed[`${tag}-蒲3`].id
    const peers = listed[`${tag}-蒲4`].percentiles.cpe.n
    await context.db.query(
      "UPDATE creators SET metrics_locked_fetched_at = now() - interval '61 days' WHERE id = $1",
      [id],
    )
    await refreshPublished(context.db, { full: true, calibrate: false })
    const row = byName(await pool())[`${tag}-蒲3`]
    expect(row.stale).toBe(true)
    expect(row.percentiles).toEqual({})
    const run = await select('/api/select/queries/run?pageSize=100', defaultSavedQuery({
      name: 'stale',
      regions: [tag],
      filters: [{ key: 'cpe', op: 'percentileGte', value: 0 }],
    }))
    const names = run.items.map((item: any) => item.displayName)
    expect(names).toContain(`${tag}-蒲4`)
    expect(names).not.toContain(`${tag}-蒲3`)
    const detail = await select(`/api/select/creators/${id}`)
    expect(detail).toMatchObject({ stale: true, percentiles: {} })
    // The other 蒲公英 videos no longer count it as a peer.
    expect(byName(await pool())[`${tag}-蒲4`].percentiles.cpe.n).toBe(peers - 1)
  })

  it('returns the same cohort on query, detail, and project rows', async () => {
    const items = byName(await pool())
    const target = items[`${tag}-蒲0`]
    const run = await select('/api/select/queries/run?pageSize=100', defaultSavedQuery({ name: 'cohort', regions: [tag] }))
    const fromRun = run.items.find((item: any) => item.id === target.id)
    expect(fromRun.cohort).toEqual(target.cohort)
    const detail = await select(`/api/select/creators/${target.id}`)
    expect(detail.cohort).toEqual(target.cohort)
    expect(detail.percentiles).toEqual(target.percentiles)

    const project = await select('/api/select/projects', { name: 'cohort project' })
    await select(`/api/select/projects/${project.id}/assignments`, { creatorIds: [target.id] })
    const board = await select(`/api/select/projects/${project.id}`)
    expect(board.assignments[0].cohort).toEqual(target.cohort)
  })

  it('dev can read each source\'s sample target with its bootstrap basis; select cannot', async () => {
    const devops = (await context.loginJson('devops@kcs.local')).token
    await refreshPublished(context.db)
    const res = await context.app.request('/api/dev/cohorts', { headers: { authorization: `Bearer ${devops}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    const pgy = body.calibration.find((row: any) => row.source === 'pugongying')
    expect(pgy.target).toBeGreaterThanOrEqual(30)
    expect(['bootstrap', 'analytic']).toContain(pgy.method)
    expect(body.groups.find((g: any) => g.key === 'pugongying|90|video')).toMatchObject({ source: 'pugongying', window: 90, contentForm: 'video' })
    const denied = await context.app.request('/api/dev/cohorts', { headers: { authorization: `Bearer ${selectorToken}` } })
    expect(denied.status).toBe(403)
  })

  it('has a typed column for every metric and a rank column for every ranked one; triggers leave no dirty group', async () => {
    const { rows } = await context.db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'creator_published'",
    )
    const columns = new Set(rows.map((row) => row.column_name))
    for (const key of METRIC_KEYS) expect(columns.has(metricColumn(key))).toBe(true)
    for (const key of RANKED_METRIC_KEYS) expect(columns.has(rankColumn(key))).toBe(true)
    expect(await recomputeDirtyGroups(context.db)).toBe(0)
  })
})
