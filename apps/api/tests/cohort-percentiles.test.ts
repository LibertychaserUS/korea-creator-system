import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultSavedQuery } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'

describe('source and tier percentile cohorts', () => {
  let context: TestCtx
  let opsToken: string
  let selectorToken: string
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    context = await createTestApp()
    opsToken = (await context.loginJson('ops@kcs.local')).token
    selectorToken = (await context.loginJson('selector@kcs.local')).token
    for (const creator of [
      { name: '蒲低', source: 'pugongying', cpe: 0.0001 },
      { name: '蒲高', source: 'pugongying', cpe: 999_999 },
      { name: '瓜低', source: 'qiangua', cpe: 0.0002 },
      { name: '瓜高', source: 'qiangua', cpe: 888_888 },
    ]) {
      const created = await context.app.request('/api/ops/creators', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${opsToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          displayName: creator.name,
          source: creator.source,
          externalId: creator.name,
          regions: ['cohort-test'],
          verticals: ['test'],
          categories: ['never_collaborated'],
          metrics: {
            window: 30,
            followers: 30_000,
            cpe: creator.cpe,
            readMedian: 10_000,
            interactionMedian: 500,
          },
        }),
      })
      ids[creator.name] = (await created.json()).id
      await context.app.request(`/api/ops/creators/${ids[creator.name]}/publish`, {
        method: 'POST',
        headers: { authorization: `Bearer ${opsToken}` },
      })
    }
  })

  afterAll(() => context.close())

  it('ranks each source independently inside the same tier', async () => {
    const response = await context.app.request('/api/select/pool?region=cohort-test', {
      headers: { authorization: `Bearer ${selectorToken}` },
    })
    const items = (await response.json()).items
    const allResponse = await context.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${selectorToken}` },
    })
    const allItems = (await allResponse.json()).items
    const sourceSizes = Object.fromEntries(
      ['pugongying', 'qiangua'].map((source) => [
        source,
        allItems.filter((item: { source: string; tier: string }) =>
          item.source === source && item.tier === 'junior').length,
      ]),
    )
    expect(items).toHaveLength(4)
    for (const item of items) {
      expect(item.cohort).toMatchObject({
        source: item.source,
        tier: 'junior',
        size: sourceSizes[item.source],
      })
    }
    const byName = Object.fromEntries(items.map((item: { displayName: string }) =>
      [item.displayName, item]))
    expect(byName['蒲低'].percentiles.cpe.percentile)
      .toBeGreaterThan(byName['蒲高'].percentiles.cpe.percentile)
    expect(byName['瓜低'].percentiles.cpe.percentile)
      .toBeGreaterThan(byName['瓜高'].percentiles.cpe.percentile)
  })

  it('returns the same cohort on query, detail, and project assignment rows', async () => {
    const query = defaultSavedQuery({ name: 'cohort', regions: ['cohort-test'] })
    const run = await context.app.request('/api/select/queries/run', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${selectorToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(query),
    })
    const queryItems = (await run.json()).items
    const pgyCohortSize = queryItems.find((item: { source: string }) =>
      item.source === 'pugongying').cohort.size
    const qianguaCohortSize = queryItems.find((item: { source: string }) =>
      item.source === 'qiangua').cohort.size
    expect(pgyCohortSize).toBeGreaterThanOrEqual(2)
    expect(qianguaCohortSize).toBeGreaterThanOrEqual(2)

    const detail = await context.app.request(`/api/select/creators/${ids['蒲低']}`, {
      headers: { authorization: `Bearer ${selectorToken}` },
    })
    expect((await detail.json()).cohort).toMatchObject({
      source: 'pugongying',
      tier: 'junior',
      size: pgyCohortSize,
    })

    const project = await context.app.request('/api/select/projects', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${selectorToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'cohort project' }),
    })
    const projectId = (await project.json()).id
    await context.app.request(`/api/select/projects/${projectId}/assignments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${selectorToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ creatorIds: [ids['蒲低']] }),
    })
    const board = await context.app.request(`/api/select/projects/${projectId}`, {
      headers: { authorization: `Bearer ${selectorToken}` },
    })
    expect((await board.json()).assignments[0].cohort.size).toBe(pgyCohortSize)
  })
})
