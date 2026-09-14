import { randomUUID } from 'node:crypto'
import type {
  SourceAdapter,
  SourceId,
  SourcePage,
  SourceQuery,
} from '@kcs/contract'
import { getAdapter } from '../adapters'
import { camelJobs } from '../http/creators'
import type { AppEnv } from '../http/types'

const runningSources = new Set<string>()
const buckets = new Map<string, TokenBucket>()

export class TokenBucket {
  private tokens: number
  private updatedAt: number

  constructor(
    readonly ratePerMinute: number,
    now = Date.now(),
  ) {
    this.tokens = Math.max(1, ratePerMinute)
    this.updatedAt = now
  }

  tryTake(now = Date.now()): boolean {
    this.refill(now)
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }

  waitMs(now = Date.now()): number {
    this.refill(now)
    if (this.tokens >= 1) return 0
    return Math.ceil((1 - this.tokens) / (Math.max(1, this.ratePerMinute) / 60_000))
  }

  private refill(now: number) {
    const elapsed = Math.max(0, now - this.updatedAt)
    const capacity = Math.max(1, this.ratePerMinute)
    this.tokens = Math.min(capacity, this.tokens + elapsed * (capacity / 60_000))
    this.updatedAt = now
  }
}

export async function enqueueIngestJob(
  env: AppEnv,
  query: SourceQuery,
  openedBy: string,
  maxPages = 5,
) {
  const adapter = resolveAdapter(env, query.source)
  if (!adapter) throw new Error(`unsupported adapter: ${query.source}`)
  await ensureSource(env, query.source)
  const id = randomUUID()
  await env.db.query(
    `INSERT INTO ingest_jobs
      (id, source_id, schedule, status, attempt, sample_rate, opened_by, query, cursor, max_pages)
     VALUES ($1,$2,'once','queued',0,1,$3,$4,$5,$6)`,
    [
      id,
      query.source,
      openedBy,
      JSON.stringify(query),
      query.cursor ?? null,
      Math.max(1, Math.min(100, maxPages)),
    ],
  )
  return readJob(env, id)
}

export async function processJob(env: AppEnv, jobId: string) {
  const initial = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [jobId])
  const job = initial.rows[0]
  if (!job || !['queued', 'running'].includes(job.status)) {
    return job ? camelJobs([job])[0] : null
  }
  const source = String(job.source_id)
  if (runningSources.has(source)) return camelJobs([job])[0]
  runningSources.add(source)
  try {
    const claimed = await env.db.query(
      `UPDATE ingest_jobs SET status = 'running', started_at = COALESCE(started_at, now()),
       next_run_at = NULL, error = NULL, error_code = NULL, error_summary = NULL, updated_at = now()
       WHERE id = $1 AND status IN ('queued','running') RETURNING *`,
      [jobId],
    )
    if (!claimed.rows[0]) return readJob(env, jobId)
    const adapter = resolveAdapter(env, source)
    if (!adapter) throw new Error(`unsupported adapter: ${source}`)
    const sourceRow = await env.db.query(
      'SELECT rate_limit, quota FROM ingest_sources WHERE id = $1',
      [source],
    )
    const rateLimit = Math.max(1, Number(sourceRow.rows[0]?.rate_limit ?? 60))
    const quota = Math.max(0, Number(sourceRow.rows[0]?.quota ?? 1000))
    const bucketKey = `${source}:${rateLimit}`
    const bucket = buckets.get(bucketKey) ?? new TokenBucket(rateLimit, env.now().getTime())
    buckets.set(bucketKey, bucket)

    const baseQuery = parseQuery(claimed.rows[0].query, source as SourceId)
    let cursor = claimed.rows[0].cursor ?? baseQuery.cursor ?? null
    let pagesDone = Number(claimed.rows[0].pages_done ?? 0)
    const maxPages = Number(claimed.rows[0].max_pages ?? 5)
    let written = Number(claimed.rows[0].written_count ?? 0)
    let skipped = Number(claimed.rows[0].skipped_dupes ?? 0)
    let failed = Number(claimed.rows[0].failed_count ?? 0)
    let quotaUsed = Number(claimed.rows[0].quota_used ?? 0)
    let sourceMode = claimed.rows[0].source_mode ?? 'live'

    while (pagesDone < maxPages) {
      const current = await env.db.query('SELECT status, error FROM ingest_jobs WHERE id = $1', [jobId])
      if (current.rows[0]?.status !== 'running') return readJob(env, jobId)
      await takeRateToken(bucket, env)
      const reserved = await reserveQuota(env, source, quota)
      if (!reserved) {
        await env.db.query(
          `UPDATE ingest_jobs SET status = 'partial', cursor = $2, next_run_at = $3,
           error = 'quota_exhausted', error_code = 'QUOTA_EXHAUSTED',
           error_summary = 'daily source quota exhausted', ended_at = now(), updated_at = now()
           WHERE id = $1`,
          [jobId, cursor, nextUtcMidnight(env.now())],
        )
        return readJob(env, jobId)
      }
      quotaUsed += 1
      const page = await adapter.fetch({ ...baseQuery, cursor })
      sourceMode = (page as SourcePage & { sourceMode?: string }).sourceMode ?? sourceMode
      const counts = await persistPage(env, adapter, page, jobId, source as SourceId)
      written += counts.written
      skipped += counts.skipped
      failed += counts.failed
      pagesDone += 1
      cursor = page.nextCursor
      await env.db.query(
        `UPDATE ingest_jobs SET cursor = $2, pages_done = $3, quota_used = $4,
         written_count = $5, skipped_dupes = $6, failed_count = $7, source_mode = $8,
         updated_at = now() WHERE id = $1`,
        [jobId, cursor, pagesDone, quotaUsed, written, skipped, failed, sourceMode],
      )
      if (!cursor) break
    }

    await env.db.query(
      `UPDATE ingest_jobs SET status = 'ok', cursor = $2, error = NULL,
       ended_at = now(), updated_at = now() WHERE id = $1`,
      [jobId, cursor],
    )
    return readJob(env, jobId)
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : 'source unavailable'
    const result = await env.db.query(
      `UPDATE ingest_jobs SET attempts = attempts + 1, attempt = attempt + 1,
       status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'queued' END,
       next_run_at = CASE WHEN attempts + 1 >= 3 THEN NULL
         ELSE now() + make_interval(secs => power(2, attempts + 1)::int) END,
       error = $2, error_code = 'SOURCE_UNAVAILABLE', error_summary = $2,
       ended_at = CASE WHEN attempts + 1 >= 3 THEN now() ELSE NULL END,
       updated_at = now() WHERE id = $1 RETURNING *`,
      [jobId, message],
    )
    return result.rows[0] ? camelJobs(result.rows)[0] : null
  } finally {
    runningSources.delete(source)
  }
}

export function startIngestWorker(env: AppEnv, options: { intervalMs?: number } = {}) {
  const intervalMs = options.intervalMs ?? 2_000
  let stopped = false
  let timer: NodeJS.Timeout | undefined

  const tick = async () => {
    if (stopped) return
    try {
      const { rows } = await env.db.query(
        `SELECT id FROM ingest_jobs
         WHERE status = 'queued' AND (next_run_at IS NULL OR next_run_at <= now())
         ORDER BY created_at LIMIT 20`,
      )
      for (const row of rows) await processJob(env, row.id)
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs)
    }
  }

  timer = setTimeout(tick, intervalMs)
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

async function persistPage(
  env: AppEnv,
  adapter: SourceAdapter,
  page: SourcePage,
  jobId: string,
  source: SourceId,
) {
  let written = 0
  let skipped = 0
  let failed = 0
  for (const raw of page.records) {
    const normalized = adapter.normalize(raw)
    if (!normalized.ok) {
      failed += 1
      continue
    }
    try {
      const creator = normalized.creator
      const linked = await env.db.query(
        'SELECT creator_id FROM creator_sources WHERE source = $1 AND external_id = $2',
        [source, creator.externalId],
      )
      const byXhs = !linked.rows[0] && creator.xhsId
        ? await env.db.query(
            'SELECT id FROM creators WHERE xhs_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [creator.xhsId],
          )
        : { rows: [] as Array<{ id: string }> }
      const existingId = linked.rows[0]?.creator_id ?? byXhs.rows[0]?.id
      const creatorId = existingId ?? randomUUID()
      if (existingId) {
        await env.db.query(
          `UPDATE creators SET
             display_name = $2, needs_review = true, followers = $3, followers_unknown = $4,
             regions = $5, verticals = $6, xhs_id = COALESCE($7, xhs_id),
             metrics = $8, metrics_window = $9, source = $10, external_id = $11,
             metrics_fetched_at = $12, last_ingest_job_id = $13, updated_at = now()
           WHERE id = $1`,
          [
            creatorId,
            creator.displayName,
            creator.metrics.followers,
            creator.metrics.followers == null,
            creator.regions,
            creator.verticals,
            creator.xhsId,
            JSON.stringify(creator.metrics),
            creator.metrics.window,
            source,
            creator.externalId,
            raw.fetchedAt,
            jobId,
          ],
        )
      } else {
        await env.db.query(
          `INSERT INTO creators (
             id, creator_key, display_name, status, needs_review, followers, followers_unknown,
             regions, verticals, xhs_id, metrics, metrics_window, source, external_id,
             metrics_fetched_at, last_ingest_job_id
           ) VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            creatorId,
            creator.creatorKey,
            creator.displayName,
            creator.metrics.followers,
            creator.metrics.followers == null,
            creator.regions,
            creator.verticals,
            creator.xhsId,
            JSON.stringify(creator.metrics),
            creator.metrics.window,
            source,
            creator.externalId,
            raw.fetchedAt,
            jobId,
          ],
        )
      }
      await env.db.query(
        `INSERT INTO creator_sources
          (creator_id, source, external_id, first_seen_at, last_seen_at)
         VALUES ($1,$2,$3,$4,$4)
         ON CONFLICT (source, external_id) DO UPDATE SET
           creator_id = EXCLUDED.creator_id,
           last_seen_at = GREATEST(creator_sources.last_seen_at, EXCLUDED.last_seen_at)`,
        [creatorId, source, creator.externalId, raw.fetchedAt],
      )
      await env.db.query(
        `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          randomUUID(),
          creatorId,
          source,
          raw.externalId,
          raw.fetchedAt,
          JSON.stringify(raw.payload),
        ],
      )
      await env.db.query(
        `INSERT INTO creator_metrics_history
          (id, creator_id, source, "window", fetched_at, job_id, metrics)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          randomUUID(),
          creatorId,
          source,
          creator.metrics.window,
          raw.fetchedAt,
          jobId,
          JSON.stringify(creator.metrics),
        ],
      )
      if (existingId) skipped += 1
      else written += 1
    } catch {
      failed += 1
    }
  }
  return { written, skipped, failed }
}

async function reserveQuota(env: AppEnv, source: string, quota: number) {
  if (quota <= 0) return false
  const day = env.now().toISOString().slice(0, 10)
  await env.db.query(
    `INSERT INTO ingest_source_usage (source, day, calls) VALUES ($1,$2,0)
     ON CONFLICT (source, day) DO NOTHING`,
    [source, day],
  )
  const result = await env.db.query(
    `UPDATE ingest_source_usage SET calls = calls + 1
     WHERE source = $1 AND day = $2 AND calls < $3 RETURNING calls`,
    [source, day, quota],
  )
  return Boolean(result.rowCount)
}

async function takeRateToken(bucket: TokenBucket, env: AppEnv) {
  while (!bucket.tryTake(env.now().getTime())) {
    await new Promise((resolve) => setTimeout(resolve, bucket.waitMs(env.now().getTime())))
  }
}

async function ensureSource(env: AppEnv, source: SourceId) {
  await env.db.query(
    `INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, owner)
     VALUES ($1,$2,$1,true,60,1000,'ops') ON CONFLICT (id) DO NOTHING`,
    [
      source,
      source === 'pugongying' ? '蒲公英' : source === 'qiangua' ? '千瓜' : '新红',
    ],
  )
}

function resolveAdapter(env: AppEnv, source: string): SourceAdapter | undefined {
  return env.getAdapter?.(source) ?? getAdapter(source) ?? undefined
}

function parseQuery(value: unknown, source: SourceId): SourceQuery {
  const input = typeof value === 'string' ? JSON.parse(value) : value
  return {
    ...((input && typeof input === 'object' ? input : {}) as Partial<SourceQuery>),
    source,
    window: (input as Partial<SourceQuery> | null)?.window === 90 ? 90 : 30,
  }
}

function nextUtcMidnight(now: Date) {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  ))
}

async function readJob(env: AppEnv, id: string) {
  const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return rows[0] ? camelJobs(rows)[0] : null
}
