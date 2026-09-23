import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

describe('creator source identity merge', () => {
  let context: TestCtx
  let opsToken: string

  beforeAll(async () => {
    delete process.env.PGY_ACCESS_TOKEN
    delete process.env.QIANGUA_TOKEN
    context = await createTestApp()
    opsToken = (await context.loginJson('ops@kcs.local')).token
    const ids = ['seed_pugongying_pgy_001', 'seed_qiangua_qg_001']
    await context.db.query('DELETE FROM assignments WHERE creator_id = ANY($1)', [ids])
    await context.db.query('DELETE FROM shortlist_items WHERE creator_id = ANY($1)', [ids])
    await context.db.query('DELETE FROM creators WHERE id = ANY($1)', [ids])
  })

  afterAll(() => context.close())

  async function ingest(source: 'pugongying' | 'qiangua', externalId: string) {
    const response = await context.app.request('/api/ingest/fetch?sync=1', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opsToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source,
        window: 30,
        externalIds: [externalId],
        maxPages: 1,
      }),
    })
    expect(response.status).toBe(201)
    const job = await response.json()
    const sample = await context.app.request(`/api/ingest/jobs/${job.id}/sample`, {
      headers: { authorization: `Bearer ${opsToken}` },
    })
    return (await sample.json()).items[0].id as string
  }

  it('merges matching xhsId while retaining both source links and snapshots', async () => {
    const pgyCreatorId = await ingest('pugongying', 'pgy_001')
    const qianguaCreatorId = await ingest('qiangua', 'qg_001')
    expect(qianguaCreatorId).toBe(pgyCreatorId)

    const creatorRows = await context.db.query(
      "SELECT id, source, external_id FROM creators WHERE xhs_id = 'cheongdam_skin'",
    )
    expect(creatorRows.rows).toHaveLength(1)
    expect(creatorRows.rows[0]).toMatchObject({
      source: 'qiangua',
      external_id: 'qg_001',
    })
    const links = await context.db.query(
      'SELECT source, external_id FROM creator_sources WHERE creator_id = $1 ORDER BY source',
      [pgyCreatorId],
    )
    expect(links.rows).toEqual([
      { source: 'pugongying', external_id: 'pgy_001' },
      { source: 'qiangua', external_id: 'qg_001' },
    ])
    const history = await context.db.query(
      'SELECT source FROM creator_metrics_history WHERE creator_id = $1 ORDER BY source',
      [pgyCreatorId],
    )
    expect(history.rows).toEqual([
      { source: 'pugongying' },
      { source: 'qiangua' },
    ])

    const opsDetail = await context.app.request(`/api/ops/creators/${pgyCreatorId}`, {
      headers: { authorization: `Bearer ${opsToken}` },
    })
    expect((await opsDetail.json()).sources).toHaveLength(2)
    await context.app.request(`/api/ops/creators/${pgyCreatorId}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${opsToken}` },
    })
    const selector = await context.loginJson('selector@kcs.local')
    const selectDetail = await context.app.request(`/api/select/creators/${pgyCreatorId}`, {
      headers: { authorization: `Bearer ${selector.token}` },
    })
    expect((await selectDetail.json()).sources).toHaveLength(2)
  })
})
