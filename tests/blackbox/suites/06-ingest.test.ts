import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { ERROR, PATHS } from '../helpers/contract'
import { enabledFileDropSource } from '../helpers/fixtures'
import { assertDenied, errorCode, itemsOf, leakedBusinessPayload, request } from '../helpers/http'

/**
 * PRD §8.3 IngestJob + UX 4 硬限制 + SCREEN ING-JOB-NEW / DEV-JOB-DETAIL.
 * Break: unregistered URL starts a job, or selector can retry.
 */

describe('Ingest jobs', () => {
  let ops: Session
  let devops: Session
  let selector: Session
  let sourceId: string
  let jobId: string

  beforeAll(async () => {
    ops = await login('ops')
    devops = await login('devops')
    selector = await login('selector')
    const source = await enabledFileDropSource(ops)
    sourceId = String(source.id)
  })

  it('exposes only the official and vendor adapters (no self-built scraper)', async () => {
    const res = await request('GET', PATHS.ingestAdapters, { token: ops.token })
    expect(res.status).toBe(200)
    const adapters = itemsOf(res.json)
    expect(adapters.map((row) => row.id).sort()).toEqual(['pugongying', 'qiangua', 'xinhong'])
    expect(adapters.find((row) => row.id === 'pugongying')?.route).toBe('official')
    expect(adapters.filter((row) => row.route === 'vendor')).toHaveLength(2)
  })

  it('creates a job against an enabled configured source (PRD §8.3 / §12)', async () => {
    const res = await request('POST', PATHS.ingestJobs, {
      token: ops.token,
      body: { sourceId, schedule: 'once', sampleRate: 0.1 },
    })
    expect(res.status).toBe(201)
    expect(typeof res.json.id).toBe('string')
    expect(['queued', 'running', 'ok', 'failed']).toContain(res.json.status)
    jobId = String(res.json.id)

    const detail = await request('GET', PATHS.ingestJob(jobId), { token: ops.token })
    expect(detail.status).toBe(200)
    expect(detail.json.sourceId ?? detail.json.source_id).toBeTruthy()
    expect(String(detail.json.errorSummary ?? '')).not.toMatch(/password|secret|key=/i)
  })

  it('rejects an unregistered source id with 400 SOURCE-INVALID (PRD §8.3 只打已配置 Source)', async () => {
    const res = await request('POST', PATHS.ingestJobs, {
      token: ops.token,
      body: { sourceId: 'src_not_registered', schedule: 'once' },
    })
    expect(res.status).toBe(400)
    expect([ERROR.SOURCE_INVALID, ERROR.VALIDATION]).toContain(errorCode(res.json))
  })

  it('rejects an ad-hoc source URL with 400 — no silent run (UX 4 硬限制)', async () => {
    const res = await request('POST', PATHS.ingestJobs, {
      token: ops.token,
      body: { sourceUrl: 'https://example.invalid/unregistered-scrape', schedule: 'once' },
    })
    expect(res.status).toBe(400)
    const jobs = await request('GET', PATHS.ingestJobs, { token: ops.token })
    const leaked = itemsOf(jobs.json).some((row) =>
      JSON.stringify(row).includes('example.invalid'),
    )
    expect(leaked).toBe(false)
  })

  it('retry follows the job lifecycle: a live job is not retryable (409), a cancelled one goes back to the queue (04 抓取流水线 §生命周期)', async () => {
    const create = await request('POST', PATHS.ingestJobs, {
      token: ops.token,
      body: { sourceId, schedule: 'once' },
    })
    const id = String(create.json.id ?? jobId)

    // Retry is only for jobs that stopped short (failed / partial); a live or finished one is 409.
    const state = String((await request('GET', PATHS.devJob(id), { token: devops.token })).json.status)
    const early = await request('POST', PATHS.devRetry(id), { token: devops.token })
    if (state === 'failed' || state === 'partial') {
      expect(early.status).toBe(200)
      expect(String(early.json.status)).toBe('queued')
      return
    }
    expect(early.status).toBe(409)
    expect(errorCode(early.json)).toBe('JOB-STATE')

    // Stop it → failed (cancelled) → retry is allowed and re-queues.
    const cancel = await request('POST', PATHS.ingestJobCancel(id), { token: ops.token })
    if (cancel.status === 409) return // already finished before we could cancel; lifecycle still consistent
    expect(cancel.status).toBe(200)
    expect(String(cancel.json.status)).toBe('failed')

    const retry = await request('POST', PATHS.devRetry(id), { token: devops.token })
    expect(retry.status).toBe(200)
    expect(String(retry.json.status)).toBe('queued')
    expect(retry.json.error ?? null).toBeNull()
    expect(String(retry.json.errorSummary ?? '')).not.toMatch(/password|secret|cookie/i)
  })

  it('forbids selector retry (PRD §8.3 / UX 4 权限不够)', async () => {
    const res = await request('POST', PATHS.devRetry(jobId || 'any'), {
      token: selector.token,
    })
    assertDenied(res)
    expect(leakedBusinessPayload(res.json)).toBe(false)
  })

  it('forbids ops retry in M1 (UX 3 运营不重试)', async () => {
    const res = await request('POST', PATHS.devRetry(jobId || 'any'), {
      token: ops.token,
    })
    assertDenied(res)
  })

  it('devops can GET the same job the ops created (PRD §8.2 /ingest 与 /dev 同套数据)', async () => {
    const res = await request('GET', PATHS.devJobs, { token: devops.token })
    expect(res.status).toBe(200)
    expect(itemsOf(res.json).some((row) => row.id === jobId)).toBe(true)
  })
})
