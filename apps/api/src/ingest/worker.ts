import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import type { PoolClient } from 'pg'
import {
  DEFAULT_QUOTA_TIME_ZONE,
  INGEST_LEASE_MS,
  INGEST_MAX_ATTEMPTS,
  INGEST_QUEUE_LOCK,
  type SourceAdapter,
  type SourceId,
  type SourcePage,
  type SourceQuery,
} from '@kcs/contract'
import { getAdapter } from '../adapters'
import { camelJobs } from '../http/creators'
import type { AppEnv } from '../http/types'
import { deadLetterJob, failureOf } from './dead-letters'
import { ensureSource } from './jobs'
import { persistPage } from './persist'
import { retentionConfig, retentionEnabled, runRetention, type RetentionConfig } from './retention'
import { dailyConfig, runDueDailyTasks, type DailyConfig } from './daily'
import './daily-tasks'
import { WORKBOOK_SOURCE, ingestSheetRow } from './workbook'
import { errorMessage, logEvent } from '../log'

/** Who holds a claim. Shows up in `ingest_jobs.locked_by` for triage. */
const WORKER_ID = `${hostname()}:${process.pid}`
const LEASE_SECONDS = Number(process.env.INGEST_LEASE_MS || INGEST_LEASE_MS) / 1_000

/**
 * Retry delay after a transient failure: "full jitter" — a uniform draw in
 * [0, min(cap, base · 2^attempt)] — so retries from many jobs spread out
 * instead of arriving together. A vendor `Retry-After` is a floor (capped at
 * `retryAfterCapMs`), never ignored.
 */
export type BackoffConfig = { baseMs: number; capMs: number; retryAfterCapMs: number }

export function backoffConfig(source: NodeJS.ProcessEnv = process.env): BackoffConfig {
  const pick = (value: string | undefined, fallback: number) => {
    const n = Number(value)
    return value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 ? n : fallback
  }
  return {
    baseMs: pick(source.INGEST_BACKOFF_BASE_MS, 1_000),
    capMs: pick(source.INGEST_BACKOFF_CAP_MS, 5 * 60_000),
    retryAfterCapMs: pick(source.INGEST_RETRY_AFTER_CAP_MS, 60 * 60_000),
  }
}

export function backoffDelayMs(
  attempt: number,
  retryAfterMs: number | null,
  config: BackoffConfig = backoffConfig(),
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(config.capMs, config.baseMs * 2 ** Math.max(0, attempt))
  const jitter = Math.floor(random() * ceiling)
  if (retryAfterMs == null) return jitter
  return Math.max(jitter, Math.min(retryAfterMs, config.retryAfterCapMs))
}

/** Pure token-bucket arithmetic (the live bucket is `takePgToken`, same maths in SQL). */
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

export type ProcessOptions = {
  /** Checked at every page boundary; true = hand the job back to the queue with its cursor. */
  shouldStop?: () => boolean
}

export async function processJob(env: AppEnv, jobId: string, options: ProcessOptions = {}) {
  const initial = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [jobId])
  const job = initial.rows[0]
  if (!job || !['queued', 'running', 'partial'].includes(job.status)) {
    return job ? camelJobs([job])[0] : null
  }
  const source = String(job.source_id)
  const lease = WORKER_ID
  try {
    /**
     * Claim, single-flight, in one statement:
     *  - `queued` / `partial` are free to take; a `running` job only once its
     *    lease has lapsed (the previous drainer died mid-page);
     *  - and never while another job of the same source holds a live lease —
     *    two runs on one source would eat each other's per-minute allowance.
     */
    const claimed = await env.db.query(
      `UPDATE ingest_jobs SET status = 'running', started_at = COALESCE(started_at, now()),
         locked_by = $2, lease_expires_at = now() + make_interval(secs => $3::float8),
         next_run_at = NULL, error = NULL, error_code = NULL, error_summary = NULL, updated_at = now()
       WHERE id = $1
         AND (status IN ('queued','partial')
              OR (status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= now())))
         AND NOT EXISTS (
           SELECT 1 FROM ingest_jobs busy
            WHERE busy.source_id = ingest_jobs.source_id
              AND busy.id <> ingest_jobs.id
              AND busy.status = 'running'
              AND busy.lease_expires_at > now())
       RETURNING *`,
      [jobId, lease, LEASE_SECONDS],
    )
    if (!claimed.rows[0]) return readJob(env, jobId)
    const adapter = resolveAdapter(env, source)
    if (!adapter) throw new Error(`unsupported adapter: ${source}`)
    const sourceRow = await env.db.query(
      'SELECT rate_limit, quota, quota_tz FROM ingest_sources WHERE id = $1',
      [source],
    )
    const quotaTz = quotaTimeZone(sourceRow.rows[0]?.quota_tz)
    const rateLimit = Math.max(1, Number(sourceRow.rows[0]?.rate_limit ?? 60))
    const quota = Math.max(0, Number(sourceRow.rows[0]?.quota ?? 1000))

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
      // Cancelled between pages, or the lease was taken over while we were slow:
      // either way this run stops here and leaves the row to whoever owns it.
      const current = await env.db.query(
        'SELECT status, locked_by FROM ingest_jobs WHERE id = $1',
        [jobId],
      )
      if (current.rows[0]?.status !== 'running' || current.rows[0]?.locked_by !== lease) {
        return readJob(env, jobId)
      }
      if (options.shouldStop?.() || !(await takeRateToken(env, source, rateLimit, options.shouldStop))) {
        return requeueJob(env, jobId, lease, source, cursor, pagesDone)
      }
      const reserved = await reserveQuota(env, source, quota, quotaTz)
      if (!reserved.ok) {
        await env.db.query(
          `UPDATE ingest_jobs SET status = 'partial', cursor = $2, next_run_at = $3,
           error = 'quota_exhausted', error_code = 'QUOTA_EXHAUSTED',
           error_summary = 'daily source quota exhausted', ended_at = now(),
           locked_by = NULL, lease_expires_at = NULL, updated_at = now()
           WHERE id = $1`,
          [jobId, cursor, reserved.resetsAt],
        )
        logEvent('warn', 'ingest.job_partial', { jobId, source, code: 'QUOTA_EXHAUSTED', pages: pagesDone })
        return readJob(env, jobId)
      }
      const page = await adapter.fetch({ ...baseQuery, cursor })
      sourceMode = (page as SourcePage & { sourceMode?: string }).sourceMode ?? sourceMode
      if (sourceMode === 'fixture') {
        // No vendor was called (demo data) — give the reserved call back, 04 §fixture 模式「不计配额」.
        await releaseQuota(env, source, reserved.day)
      } else {
        quotaUsed += 1
      }
      const counts = await persistPage(env, adapter, page, jobId, source as SourceId)
      written += counts.written
      skipped += counts.skipped
      failed += counts.failed
      pagesDone += 1
      cursor = page.nextCursor
      // The page write doubles as the lease heartbeat: a job that keeps making
      // progress keeps its claim, one that stalls loses it after LEASE_SECONDS.
      await env.db.query(
        `UPDATE ingest_jobs SET cursor = $2, pages_done = $3, quota_used = $4,
         written_count = $5, skipped_dupes = $6, failed_count = $7, source_mode = $8,
         lease_expires_at = now() + make_interval(secs => $9::float8),
         updated_at = now() WHERE id = $1`,
        [jobId, cursor, pagesDone, quotaUsed, written, skipped, failed, sourceMode, LEASE_SECONDS],
      )
      if (!cursor) break
    }

    await env.db.query(
      `UPDATE ingest_jobs SET status = 'ok', cursor = $2, error = NULL,
       locked_by = NULL, lease_expires_at = NULL,
       ended_at = now(), updated_at = now() WHERE id = $1`,
      [jobId, cursor],
    )
    logEvent('info', 'ingest.job_done', {
      jobId, source, pages: pagesDone, written, skipped, failed, quotaUsed, sourceMode,
    })
    return readJob(env, jobId)
  } catch (error) {
    return failJob(env, jobId, source, error)
  }
}

/**
 * Shutdown between pages: the run goes back to `queued` with its cursor and
 * without a lease, so whoever drains next continues from here right away.
 */
async function requeueJob(
  env: AppEnv,
  jobId: string,
  lease: string,
  source: string,
  cursor: string | null,
  pagesDone: number,
) {
  await env.db.query(
    `UPDATE ingest_jobs SET status = 'queued', cursor = $3, next_run_at = NULL,
       locked_by = NULL, lease_expires_at = NULL, updated_at = now()
     WHERE id = $1 AND locked_by = $2`,
    [jobId, lease, cursor],
  )
  logEvent('info', 'ingest.job_requeued', { jobId, source, cursor, pages: pagesDone })
  return readJob(env, jobId)
}

/**
 * One attempt died. Either it is worth another go later (vendor hiccup, 429,
 * 5xx) or it never will be (bad credential, unknown adapter, vendor rejected
 * the request) — the second kind skips the backoff ladder entirely instead of
 * paying for three identical failures. Whichever way the attempts end, the run
 * lands in the dead-letter list with its parameters and cursor, so no work is
 * silently lost and a replay continues rather than restarts.
 */
async function failJob(env: AppEnv, jobId: string, source: string, error: unknown) {
  const { code, permanent, message, retryAfterMs } = failureOf(error)
  const row = await env.db.query(
    'SELECT attempts, max_attempts, cursor, query FROM ingest_jobs WHERE id = $1',
    [jobId],
  )
  const attempts = Number(row.rows[0]?.attempts ?? 0) + 1
  const maxAttempts = Math.max(1, Number(row.rows[0]?.max_attempts ?? INGEST_MAX_ATTEMPTS))
  const exhausted = permanent || attempts >= maxAttempts

  const result = await env.db.query(
    `UPDATE ingest_jobs SET attempts = $2::int, attempt = $2::int,
       status = CASE WHEN $3::boolean THEN 'failed' ELSE 'queued' END,
       next_run_at = CASE WHEN $3::boolean THEN NULL
         ELSE now() + make_interval(secs => $6::float8 / 1000) END,
       error = $4, error_code = $5, error_summary = $4,
       ended_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
       dead_lettered_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
       locked_by = NULL, lease_expires_at = NULL,
       updated_at = now() WHERE id = $1 RETURNING *`,
    [jobId, attempts, exhausted, message, code, backoffDelayMs(attempts, retryAfterMs)],
  )
  logEvent(exhausted ? 'error' : 'warn', 'ingest.job_failed', {
    jobId,
    source,
    code,
    attempt: attempts,
    permanent,
    willRetry: !exhausted,
    retryAfterMs,
    message,
  })
  if (exhausted) {
    await deadLetterJob(env, {
      jobId,
      source,
      code,
      message,
      attempts,
      query: row.rows[0]?.query ?? null,
      cursor: row.rows[0]?.cursor ?? null,
    })
  }
  return result.rows[0] ? camelJobs(result.rows)[0] : null
}

/**
 * The drainer. Deliberately one pipeline, not a pool:
 *
 * - every API process can host this loop, but only the one that wins the
 *   Postgres advisory lock actually drains; the rest keep asking, so a restart
 *   or a second replica means failover, never a second consumer;
 * - it takes one due job per tick and finishes it before looking again. Vendor
 *   calls are billed per request and capped per minute, so concurrency would
 *   only raise the bill and the 429 rate;
 * - the same holder runs the registered daily tasks (`./daily`, once per
 *   local day) between jobs;
 * - the same holder runs the optional retention sweep once per
 *   `retention.intervalMs` (first time right after it wins the lock), so at
 *   most one process deletes — and only when ops turned a kind on explicitly;
 * - `INGEST_WORKER=0` opts a process out entirely (e.g. a replica that should
 *   only serve HTTP).
 */
export function startIngestWorker(
  env: AppEnv,
  options: { intervalMs?: number; retention?: RetentionConfig; daily?: DailyConfig } = {},
) {
  const intervalMs = options.intervalMs ?? 2_000
  const retention = options.retention ?? retentionConfig()
  const daily = options.daily ?? dailyConfig()
  if (process.env.INGEST_WORKER === '0') {
    return async () => undefined
  }
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  let holder: PoolClient | null = null
  let inflight: Promise<void> = Promise.resolve()
  let sweptAt = 0

  const sweep = async () => {
    if (!retentionEnabled(retention) || Date.now() - sweptAt < retention.intervalMs) return
    sweptAt = Date.now()
    try {
      const deleted = await runRetention(env.db, retention, env.now())
      logEvent('info', 'retention.sweep', { worker: WORKER_ID, ...deleted })
    } catch (error) {
      logEvent('error', 'retention.failed', { worker: WORKER_ID, message: errorMessage(error) })
    }
  }

  const acquire = async () => {
    if (holder) return true
    const client = await env.db.connect() as PoolClient
    try {
      const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [
        INGEST_QUEUE_LOCK,
      ])
      if (rows[0]?.ok) {
        holder = client
        logEvent('info', 'ingest.lock_acquired', { worker: WORKER_ID })
        return true
      }
    } catch (error) {
      logEvent('warn', 'ingest.lock_failed', { worker: WORKER_ID, message: errorMessage(error) })
    }
    client.release()
    return false
  }

  const tick = async () => {
    if (stopped) return
    try {
      if (!(await acquire())) return
      await sweep()
      if (stopped) return
      await runDueDailyTasks(env, daily)
      if (stopped) return
      const { rows } = await env.db.query(
        `SELECT id FROM ingest_jobs
         WHERE (status = 'queued' AND (next_run_at IS NULL OR next_run_at <= now()))
            OR (status = 'partial' AND next_run_at IS NOT NULL AND next_run_at <= now())
            -- A run left mid-page by a drainer that died: its lease has lapsed,
            -- so picking it up continues from the cursor instead of stalling forever.
            OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= now())
         ORDER BY created_at
         LIMIT 1`,
      )
      if (rows[0]) await processJob(env, rows[0].id, { shouldStop: () => stopped })
    } catch (error) {
      logEvent('error', 'ingest.tick_failed', { worker: WORKER_ID, message: errorMessage(error) })
      // A dropped connection releases the lock; the next tick re-acquires it.
      if (holder) {
        holder.release(true)
        holder = null
      }
    } finally {
      if (!stopped) schedule()
    }
  }

  const schedule = () => {
    timer = setTimeout(() => {
      inflight = tick()
    }, intervalMs)
  }

  schedule()
  /**
   * Stops taking new jobs, lets the current one reach its next page boundary
   * (where it is requeued with its cursor), then gives the advisory lock back.
   * Resolves once all of that is done; the caller caps how long it waits.
   */
  return async () => {
    stopped = true
    if (timer) clearTimeout(timer)
    await inflight
    if (holder) {
      const client = holder
      holder = null
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [INGEST_QUEUE_LOCK])
        client.release()
      } catch {
        client.release(true)
      }
      logEvent('info', 'ingest.lock_released', { worker: WORKER_ID })
    }
  }
}

/**
 * Re-read one parked payload. No vendor call and no quota: the JSON is the one
 * the vendor already gave us, so a replay after a field-map fix is free.
 */
export async function replayRecord(
  env: AppEnv,
  input: { source: SourceId | typeof WORKBOOK_SOURCE; jobId: string | null; externalId: string; payload: Record<string, unknown> },
) {
  if (input.source === WORKBOOK_SOURCE) {
    // A parked workbook row: its cells are the payload, re-read them the same way.
    const { __file: _file, ...row } = input.payload as Record<string, string>
    return ingestSheetRow(env, input.jobId, row)
  }
  const adapter = resolveAdapter(env, input.source)
  if (!adapter) throw new Error(`unsupported adapter: ${input.source}`)
  const page: SourcePage = {
    nextCursor: null,
    records: [
      {
        source: input.source,
        platform: 'xhs',
        externalId: input.externalId,
        fetchedAt: env.now().toISOString(),
        payload: input.payload,
      },
    ],
  }
  return persistPage(env, adapter, page, input.jobId, input.source)
}

function quotaTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value) return DEFAULT_QUOTA_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return value
  } catch {
    return DEFAULT_QUOTA_TIME_ZONE
  }
}

/**
 * The quota day is the vendor's calendar day in `tz`, and the wall resets at
 * its next midnight — 16:00 UTC for Beijing — so one vendor day never gets
 * two UTC days' worth of calls.
 */
async function quotaDay(env: AppEnv, tz: string): Promise<{ day: string; resetsAt: Date }> {
  const { rows } = await env.db.query(
    `SELECT ($1::timestamptz AT TIME ZONE $2)::date::text AS day,
            (date_trunc('day', $1::timestamptz AT TIME ZONE $2) + interval '1 day') AT TIME ZONE $2 AS resets_at`,
    [env.now(), tz],
  )
  return { day: rows[0].day, resetsAt: new Date(rows[0].resets_at) }
}

async function reserveQuota(env: AppEnv, source: string, quota: number, tz: string) {
  const { day, resetsAt } = await quotaDay(env, tz)
  if (quota <= 0) return { ok: false, day, resetsAt }
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
  return { ok: Boolean(result.rowCount), day, resetsAt }
}

/** Gives a call back to the day it was taken from, even if midnight passed in between. */
async function releaseQuota(env: AppEnv, source: string, day: string) {
  await env.db.query(
    `UPDATE ingest_source_usage SET calls = GREATEST(0, calls - 1) WHERE source = $1 AND day = $2`,
    [source, day],
  )
}

/**
 * One token from the source's bucket in Postgres, or how long until the next
 * one. Capacity = `rate_limit` per minute, refilled continuously; a changed
 * rate limit starts a fresh, full bucket (as ops would expect after raising it).
 */
export async function takePgToken(env: AppEnv, source: string, ratePerMinute: number): Promise<{ ok: boolean; waitMs: number }> {
  const capacity = Math.max(1, ratePerMinute)
  const now = env.now()
  const refill = `CASE WHEN b.capacity <> EXCLUDED.capacity THEN EXCLUDED.capacity
      ELSE LEAST(EXCLUDED.capacity, b.tokens
        + GREATEST(0, EXTRACT(EPOCH FROM (EXCLUDED.updated_at - b.updated_at))) * EXCLUDED.capacity / 60.0) END`
  const { rows } = await env.db.query(
    `INSERT INTO ingest_rate_buckets AS b (source, capacity, tokens, updated_at) VALUES ($1, $2::float8, $2::float8 - 1, $3::timestamptz)
     ON CONFLICT (source) DO UPDATE SET
       tokens = ${refill} - 1,
       capacity = EXCLUDED.capacity,
       updated_at = EXCLUDED.updated_at
     WHERE ${refill} >= 1
     RETURNING tokens`,
    [source, capacity, now],
  )
  if (rows[0]) return { ok: true, waitMs: 0 }
  const state = await env.db.query(
    `SELECT LEAST(capacity, tokens + GREATEST(0, EXTRACT(EPOCH FROM ($2::timestamptz - updated_at))) * capacity / 60.0) AS tokens
       FROM ingest_rate_buckets WHERE source = $1`,
    [source, now],
  )
  const tokens = Number(state.rows[0]?.tokens ?? 0)
  return { ok: false, waitMs: Math.max(1, Math.ceil((1 - tokens) / (capacity / 60_000))) }
}

/** Waits for a rate token; false if asked to stop while waiting. */
async function takeRateToken(env: AppEnv, source: string, ratePerMinute: number, shouldStop?: () => boolean) {
  for (;;) {
    const taken = await takePgToken(env, source, ratePerMinute)
    if (taken.ok) return true
    if (shouldStop?.()) return false
    await new Promise((resolve) => setTimeout(resolve, Math.min(500, taken.waitMs)))
  }
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

async function readJob(env: AppEnv, id: string) {
  const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return rows[0] ? camelJobs(rows)[0] : null
}
