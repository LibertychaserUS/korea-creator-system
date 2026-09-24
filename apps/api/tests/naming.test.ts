import { afterEach, describe, expect, it } from 'vitest'
import { API, apiPath } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

/** Vendor payloads and saved job queries are stored verbatim; everything else must be camelCase. */
const OPAQUE = new Set(['payload', 'query', 'metrics', 'percentiles', 'flags'])

function snakeKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => snakeKeys(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => [
    ...(key.includes('_') ? [`${path}.${key}`] : []),
    ...(OPAQUE.has(key) ? [] : snakeKeys(child, `${path}.${key}`)),
  ])
}

describe('response keys are camelCase', () => {
  it('overview, review, batches, audit, sample, shortlist, categories, projects', async () => {
    const context = await createTestApp()
    contexts.push(context)
    const ops = (await context.loginJson('ops@kcs.local')).token
    const devops = (await context.loginJson('devops@kcs.local')).token
    const selector = (await context.loginJson('selector@kcs.local')).token
    const get = async (token: string, path: string) => {
      const res = await context.app.request(path, { headers: { authorization: `Bearer ${token}` } })
      expect(res.status, path).toBe(200)
      return res.json()
    }

    const released = (await context.db.query("SELECT id FROM creators WHERE status = 'released' ORDER BY id LIMIT 1")).rows[0].id
    const job = (await context.db.query('SELECT id FROM ingest_jobs ORDER BY id LIMIT 1')).rows[0].id
    await context.db.query(
      `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status) VALUES ('rv_naming', $1, 'low', 'ok', 'pending')`,
      [released],
    )
    await context.db.query('UPDATE creators SET last_ingest_job_id = $2 WHERE id = $1', [released, job])
    await context.app.request(API.shortlistAdd.path, {
      method: 'POST',
      headers: { authorization: `Bearer ${selector}`, 'content-type': 'application/json' },
      body: JSON.stringify({ creatorId: released }),
    })
    await context.app.request(apiPath(API.opsUnpublish, { id: released }), {
      method: 'POST',
      headers: { authorization: `Bearer ${ops}` },
    })

    const overview = await get(ops, API.opsOverview.path)
    const review = await get(ops, API.opsReview.path)
    const batches = await get(ops, API.opsBatches.path)
    const categories = await get(ops, API.opsCategories.path)
    const audit = await get(devops, API.devAudit.path)
    const sample = await get(ops, apiPath(API.ingestSample, { id: job }))
    const projects = await get(selector, API.projects.path)
    const project = await get(selector, apiPath(API.projectGet, { id: projects.items[0].id }))
    await context.app.request(apiPath(API.opsPublish, { id: released }), {
      method: 'POST',
      headers: { authorization: `Bearer ${ops}` },
    })
    const shortlist = await get(selector, API.shortlist.path)

    for (const [name, body] of Object.entries({ overview, review, batches, categories, audit, sample, projects, project, shortlist })) {
      expect(snakeKeys(body), name).toEqual([])
    }

    expect(overview.recentJobs[0]).toEqual(expect.objectContaining({ writtenCount: expect.any(Number), createdAt: expect.any(String) }))
    expect(review.items.find((row: { id: string }) => row.id === 'rv_naming')).toMatchObject({
      creatorId: released,
      riskLevel: 'low',
      displayName: expect.any(String),
    })
    expect(batches.items[0]).toEqual(expect.objectContaining({ sourceId: expect.any(String), sourceName: expect.any(String) }))
    expect(categories.items.find((row: { slug: string }) => row.slug === 'collaborated')).toMatchObject({
      nameZh: expect.any(String),
      builtin: true,
      frontendVisible: expect.any(Boolean),
    })
    expect(audit.items.find((row: { entityId: string }) => row.entityId === released)).toMatchObject({
      entityType: 'creator',
      action: 'creator.unpublish',
    })
    expect(sample.items).toEqual([expect.objectContaining({ id: released, displayName: expect.any(String), needsReview: expect.any(Boolean) })])
    expect(projects.items[0]).toEqual(expect.objectContaining({ memberCount: expect.any(Number), updatedAt: expect.any(String) }))
    expect(project.memberCount).toBe(project.assignments.length)
    expect(shortlist.items.find((row: { creatorId: string }) => row.creatorId === released)).toMatchObject({
      addedAt: expect.any(String),
      displayName: expect.any(String),
    })
  })

  it('every other read endpoint', async () => {
    const context = await createTestApp()
    contexts.push(context)
    const tokens = {
      ops: (await context.loginJson('ops@kcs.local')).token,
      devops: (await context.loginJson('devops@kcs.local')).token,
      selector: (await context.loginJson('selector@kcs.local')).token,
    }
    const released = (await context.db.query("SELECT id FROM creators WHERE status = 'released' ORDER BY id LIMIT 1")).rows[0].id
    const job = (await context.db.query('SELECT id FROM ingest_jobs ORDER BY id LIMIT 1')).rows[0].id
    const reads: Array<[keyof typeof tokens, string]> = [
      ['devops', API.devHealth.path],
      ['devops', API.devJobs.path],
      ['devops', apiPath(API.devJob, { id: job })],
      ['devops', API.devFailures.path],
      ['devops', API.devPipeline.path],
      ['devops', API.devDeadLetters.path],
      ['ops', API.ingestJobs.path],
      ['ops', apiPath(API.ingestJob, { id: job })],
      ['ops', API.ingestAdapters.path],
      ['ops', API.opsCreators.path],
      ['ops', apiPath(API.opsCreatorGet, { id: released })],
      ['ops', apiPath(API.opsCreatorHistory, { id: released })],
      ['ops', API.assetList.path],
      ['selector', API.pool.path],
      ['selector', apiPath(API.poolCreator, { id: released })],
      ['selector', apiPath(API.poolCreatorHistory, { id: released })],
      ['selector', API.queries.path],
      ['selector', API.me.path],
    ]
    for (const [role, path] of reads) {
      const res = await context.app.request(path, { headers: { authorization: `Bearer ${tokens[role]}` } })
      expect(res.status, path).toBe(200)
      expect(snakeKeys(await res.json()), path).toEqual([])
    }
  })
})
