import { afterEach, describe, expect, it } from 'vitest'
import { creatorKeyFor, emptyMetrics, type SourceAdapter } from '@kcs/contract'
import { parseRetryAfter, VendorHttpError, vendorHttpError } from '../src/adapters/common'
import { failureOf } from '../src/ingest/dead-letters'
import { backoffConfig, backoffDelayMs, processJob, takePgToken } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

const config = { baseMs: 1_000, capMs: 60_000, retryAfterCapMs: 600_000 }

describe('full-jitter backoff', () => {
  it('draws uniformly under min(cap, base·2^attempt)', () => {
    expect(backoffDelayMs(1, null, config, () => 0)).toBe(0)
    expect(backoffDelayMs(1, null, config, () => 0.999)).toBe(1_998)
    expect(backoffDelayMs(3, null, config, () => 0.5)).toBe(4_000)
    expect(backoffDelayMs(20, null, config, () => 0.999)).toBe(59_940)
  })

  it('spreads retries out instead of lining them up', () => {
    const delays = new Set(Array.from({ length: 50 }, () => backoffDelayMs(4, null, config)))
    expect(delays.size).toBeGreaterThan(10)
    for (const delay of delays) expect(delay).toBeLessThan(16_000)
  })

  it('treats Retry-After as a floor, capped', () => {
    expect(backoffDelayMs(1, 30_000, config, () => 0)).toBe(30_000)
    expect(backoffDelayMs(6, 1_000, config, () => 0.9)).toBe(54_000)
    expect(backoffDelayMs(1, 24 * 3_600_000, config, () => 0)).toBe(600_000)
  })

  it('reads its knobs from env, ignoring junk', () => {
    expect(backoffConfig({ INGEST_BACKOFF_BASE_MS: '200', INGEST_BACKOFF_CAP_MS: 'x' })).toEqual({
      baseMs: 200,
      capMs: 300_000,
      retryAfterCapMs: 3_600_000,
    })
  })
})

describe('Retry-After', () => {
  it('parses seconds and HTTP dates', () => {
    const now = Date.parse('2026-09-24T00:00:00.000Z')
    expect(parseRetryAfter('120', now)).toBe(120_000)
    expect(parseRetryAfter(' 1.5 ', now)).toBe(1_500)
    expect(parseRetryAfter('Thu, 24 Sep 2026 00:01:00 GMT', now)).toBe(60_000)
    expect(parseRetryAfter('Wed, 23 Sep 2026 00:00:00 GMT', now)).toBe(0)
    expect(parseRetryAfter('soon', now)).toBeNull()
    expect(parseRetryAfter(null, now)).toBeNull()
  })

  it('travels from the response to the failure classifier', () => {
    const error = vendorHttpError('qiangua', new Response('', { status: 429, headers: { 'retry-after': '7' } }))
    expect(error).toBeInstanceOf(VendorHttpError)
    expect(error.message).toBe('qiangua HTTP 429')
    expect(failureOf(error)).toMatchObject({ code: 'SOURCE_UNAVAILABLE', permanent: false, retryAfterMs: 7_000 })
    expect(failureOf(new Error('boom')).retryAfterMs).toBeNull()
  })

  it('a 429 with Retry-After schedules the retry no earlier than asked', async () => {
    const adapter: SourceAdapter = {
      id: 'qiangua',
      supports: ['cursor'],
      provides: ['followers'],
      async fetch() {
        throw new VendorHttpError('qiangua', 429, 90_000)
      },
      normalize(raw) {
        return {
          ok: true,
          creator: {
            creatorKey: creatorKeyFor('xhs', raw.externalId),
            externalId: raw.externalId,
            platform: 'xhs',
            displayName: 'x',
            xhsId: null,
            avatarUrl: null,
            regions: [],
            verticals: [],
            metrics: emptyMetrics(30),
            warnings: [],
          },
        }
      },
    }
    const context = await createTestApp({ getAdapter: (source) => source === 'qiangua' ? adapter : undefined })
    contexts.push(context)
    const token = (await context.loginJson('ops@kcs.local')).token
    const response = await context.app.request('/api/ingest/fetch', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'qiangua', window: 30, maxPages: 1 }),
    })
    const { job } = await response.json()
    const before = Date.now()
    const done = await processJob(context.env, job.id)
    expect(done).toMatchObject({ status: 'queued', errorCode: 'SOURCE_UNAVAILABLE' })
    const waited = new Date(done!.nextRunAt!).getTime() - before
    expect(waited).toBeGreaterThanOrEqual(85_000)
    expect(waited).toBeLessThan(120_000)
  })
})

describe('token bucket in Postgres', () => {
  it('holds rate_limit tokens, refills continuously, and survives the process', async () => {
    const context = await createTestApp()
    contexts.push(context)
    const t0 = new Date('2026-09-24T00:00:00.000Z')
    context.env.now = () => t0
    for (let i = 0; i < 6; i += 1) expect((await takePgToken(context.env, 'bb-rate', 6)).ok).toBe(true)
    const empty = await takePgToken(context.env, 'bb-rate', 6)
    expect(empty.ok).toBe(false)
    expect(empty.waitMs).toBe(10_000)

    // A second "process" (fresh env, same database) sees the same empty bucket.
    const other = { ...context.env, now: () => new Date(t0.getTime() + 5_000) }
    const half = await takePgToken(other, 'bb-rate', 6)
    expect(half).toEqual({ ok: false, waitMs: 5_000 })

    context.env.now = () => new Date(t0.getTime() + 10_000)
    expect((await takePgToken(context.env, 'bb-rate', 6)).ok).toBe(true)
    expect((await takePgToken(context.env, 'bb-rate', 6)).ok).toBe(false)

    const row = await context.db.query("SELECT capacity, tokens FROM ingest_rate_buckets WHERE source = 'bb-rate'")
    expect(Number(row.rows[0].capacity)).toBe(6)
    expect(Number(row.rows[0].tokens)).toBeCloseTo(0, 6)
  })

  it('a changed rate limit starts a full bucket at the new size', async () => {
    const context = await createTestApp()
    contexts.push(context)
    context.env.now = () => new Date('2026-09-24T00:00:00.000Z')
    expect((await takePgToken(context.env, 'bb-rate-2', 1)).ok).toBe(true)
    expect((await takePgToken(context.env, 'bb-rate-2', 1)).ok).toBe(false)
    for (let i = 0; i < 3; i += 1) expect((await takePgToken(context.env, 'bb-rate-2', 3)).ok).toBe(true)
    expect((await takePgToken(context.env, 'bb-rate-2', 3)).ok).toBe(false)
  })
})
