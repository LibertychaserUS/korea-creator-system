import { parsePaging, SOURCE_IDS, type SourceQuery } from '@kcs/contract'
import { adapterDescriptions } from '../adapters'
import { retryJob } from '../ingest/jobs'
import { enqueueIngestJob, processJob } from '../ingest/worker'
import { dailyTaskStatus, runDailyTaskNow } from '../ingest/daily'
import { readSchedulerState, schedulerConfig } from '../ingest/scheduler'
import {
  creatorDataStatus,
  DATA_STATUS_KINDS,
  dataStatusConfig,
  dataStatusCounts,
  decideMissing,
  listDataStatus,
  type DataStatusKind,
} from '../ingest/data-status'
import { randomUUID } from 'node:crypto'
import { audit } from '../http/audit'
import { camelJobs } from '../http/creators'
import { z } from 'zod'
import { readJson } from '../http/body'
import { csv, pageRows } from '../http/lists'
import { jsonError } from '../http/responses'
import { jobSampleView } from '../http/views'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerIngestRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/ingest/sources', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_sources ORDER BY name')
    return context.json({
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        adapterType: row.adapter_type,
        enabled: row.enabled,
        rateLimit: row.rate_limit,
        quota: row.quota,
      })),
    })
  })

  app.get('/api/ingest/daily', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    return context.json({ items: await dailyTaskStatus(env) })
  })

  app.post('/api/ingest/daily/:task/run', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.retry')
    if (denied) return denied
    const task = context.req.param('task')
    const outcome = await runDailyTaskNow(env, task)
    if (!outcome) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    await audit(env.db, user!.id, 'ingest.daily_run', 'daily_task', task, `${outcome.day} ${outcome.ok ? 'ok' : 'failed'}`)
    return context.json(outcome)
  })

  app.get('/api/ingest/scheduler', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const { samples: _samples, ...config } = schedulerConfig()
    const due = await env.db.query(
      `SELECT source, count(*)::int AS due, count(*) FILTER (WHERE next_refresh_at IS NULL)::int AS never,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY refresh_interval_days) AS median_interval_days
         FROM creator_sources WHERE next_refresh_at IS NULL OR next_refresh_at <= $1 GROUP BY source`,
      [env.now()],
    )
    return context.json({
      lastPlan: await readSchedulerState(env),
      config,
      due: due.rows.map((row) => ({
        source: row.source,
        due: row.due,
        neverRefreshed: row.never,
        medianIntervalDays: row.median_interval_days == null ? null : Number(row.median_interval_days),
      })),
    })
  })

  app.get('/api/ingest/discovery-searches', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_discovery_searches ORDER BY created_at, id')
    return context.json({ items: rows.map(discoverySearchView) })
  })

  app.post('/api/ingest/discovery-searches', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    const { data, invalid } = await readJson(context, DISCOVERY_SEARCH_BODY)
    if (invalid) return invalid
    const query = data.query as SourceQuery & { sourceUrl?: unknown; url?: unknown }
    if (!SOURCE_IDS.includes(query.source) || ![30, 90].includes(query.window)) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'invalid_source_query')
    }
    if (query.sourceUrl != null || query.url != null) return jsonError(context, 400, 'SOURCE-INVALID', 'adhoc_url_forbidden')
    const { externalIds: _ids, cursor: _cursor, ...saved } = pickSourceQuery(query)
    const id = randomUUID()
    const { rows } = await env.db.query(
      `INSERT INTO ingest_discovery_searches (id, source, name, query, enabled, max_pages, every_hours, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, query.source, data.name, JSON.stringify(saved), data.enabled ?? true, data.maxPages ?? 1, data.everyHours ?? 24, user!.id],
    )
    await audit(env.db, user!.id, 'ingest.discovery_create', 'discovery_search', id, data.name)
    return context.json(discoverySearchView(rows[0]), 201)
  })

  app.patch('/api/ingest/discovery-searches/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    const { data, invalid } = await readJson(context, DISCOVERY_SEARCH_PATCH)
    if (invalid) return invalid
    const { rows } = await env.db.query(
      `UPDATE ingest_discovery_searches SET
         name = COALESCE($2, name), enabled = COALESCE($3, enabled),
         max_pages = COALESCE($4, max_pages), every_hours = COALESCE($5, every_hours), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [context.req.param('id'), data.name ?? null, data.enabled ?? null, data.maxPages ?? null, data.everyHours ?? null],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    await audit(env.db, user!.id, 'ingest.discovery_update', 'discovery_search', rows[0].id, JSON.stringify(data))
    return context.json(discoverySearchView(rows[0]))
  })

  app.get('/api/ingest/data-status', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const query = context.req.query()
    if (!query.kind) return context.json({ counts: await dataStatusCounts(env), config: dataStatusConfig() })
    if (!DATA_STATUS_KINDS.includes(query.kind as DataStatusKind)) {
      return jsonError(context, 400, 'VALIDATION', 'unknown_kind')
    }
    return context.json(await listDataStatus(env, query.kind as DataStatusKind, parsePaging(query)))
  })

  app.get('/api/ingest/data-status/:creatorId', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const status = await creatorDataStatus(env, context.req.param('creatorId'))
    if (!status) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(status)
  })

  app.post('/api/ingest/data-status/:creatorId/missing', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    const { data, invalid } = await readJson(context, MISSING_DECISION_BODY)
    if (invalid) return invalid
    const outcome = await decideMissing(env, context.req.param('creatorId'), data.decision, user!.id)
    if (!outcome.found) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (!outcome.flagged) return jsonError(context, 409, 'STATE', 'not_flagged_missing')
    return context.json(outcome.status)
  })

  app.get('/api/ingest/adapters', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    return context.json({ items: adapterDescriptions() })
  })

  app.post('/api/ingest/fetch', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    const { data: raw, invalid } = await readJson(context, z.unknown())
    if (invalid) return invalid
    const input = raw as (SourceQuery & { maxPages?: number; sourceUrl?: unknown; url?: unknown }) | null
    if (!input || typeof input !== 'object' || !SOURCE_IDS.includes(input.source) || ![30, 90].includes(input.window)) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'invalid_source_query')
    }
    // Only registered sources are ever called; a URL in the body is refused, not ignored.
    if (input.sourceUrl != null || input.url != null) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'adhoc_url_forbidden')
    }
    const job = await enqueueIngestJob(env, pickSourceQuery(input), user!.id, Number(input.maxPages ?? 5))
    if (context.req.query('sync') === '1') {
      return context.json(await processJob(env, job!.id), 201)
    }
    return context.json({ job }, 202)
  })

  app.get('/api/ingest/raw/:creatorId', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const limit = Math.max(1, Math.min(100, Number(context.req.query('limit') || 30)))
    const { rows } = await env.db.query(
      `SELECT r.id, r.creator_id, r.source, r.external_id, r.fetched_at,
              COALESCE(r.payload, p.payload) AS payload, encode(r.payload_hash, 'hex') AS content_hash
       FROM creator_raw r LEFT JOIN raw_payloads p ON p.hash = r.payload_hash
       WHERE r.creator_id = $1 ORDER BY r.fetched_at DESC, r.id DESC LIMIT $2`,
      [context.req.param('creatorId'), limit],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const items = rows.map((row) => ({
      id: row.id,
      creatorId: row.creator_id,
      source: row.source,
      externalId: row.external_id,
      fetchedAt: row.fetched_at instanceof Date ? row.fetched_at.toISOString() : row.fetched_at,
      payload: row.payload,
      /** Fetches with the same content share one stored body; equal hashes = identical JSON. */
      contentHash: row.content_hash ?? null,
    }))
    // Top-level fields stay the newest record, as before; `items` is every record, newest first.
    return context.json({ ...items[0], items })
  })

  app.get('/api/ingest/jobs', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const query = context.req.query()
    const params: unknown[] = []
    const where: string[] = []
    for (const [param, column] of [['source', 'source_id'], ['status', 'status']] as const) {
      const wanted = csv(query[param])
      if (!wanted.length) continue
      params.push(wanted)
      where.push(`${column} = ANY($${params.length}::text[])`)
    }
    const paging = parsePaging(query)
    const { rows, total } = await pageRows(
      env.db,
      {
        columns: '*',
        from: `FROM ingest_jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
        order: 'created_at DESC, id COLLATE "C"',
      },
      params,
      paging,
    )
    return context.json({ items: camelJobs(rows), total, page: paging.page, pageSize: paging.pageSize })
  })

  // Gone: it ran a job inline, outside the queue's quota and rate limit, and
  // for a non-adapter source made up a creator. Sources go through
  // POST /api/ingest/fetch, files through POST /api/ops/batches.
  app.post('/api/ingest/jobs', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    return jsonError(context, 410, 'GONE', 'use_ingest_fetch')
  })

  app.get('/api/ingest/jobs/:id', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [
      context.req.param('id'),
    ])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(camelJobs(rows)[0])
  })

  app.get('/api/ingest/jobs/:id/sample', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      'SELECT id, display_name, needs_review FROM creators WHERE last_ingest_job_id = $1',
      [context.req.param('id')],
    )
    return context.json({ items: rows.map(jobSampleView) })
  })

  app.post('/api/ingest/jobs/:id/retry', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.retry')
    if (denied) return denied
    const result = await retryJob(env, context.req.param('id'), user!.id)
    if (result.ok) return context.json(result.job)
    return result.reason === 'not_found'
      ? jsonError(context, 404, 'NOT-FOUND', 'not_found')
      : jsonError(context, 409, 'JOB-STATE', 'job_not_retryable')
  })

  app.post('/api/ingest/jobs/:id/cancel', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    const { rows } = await env.db.query(
      `UPDATE ingest_jobs SET status = 'failed', error = 'cancelled',
       error_code = 'CANCELLED', error_summary = 'cancelled', ended_at = now(), updated_at = now()
       WHERE id = $1 AND status IN ('queued','running') RETURNING *`,
      [context.req.param('id')],
    )
    if (!rows[0]) {
      const exists = await env.db.query('SELECT 1 FROM ingest_jobs WHERE id = $1', [
        context.req.param('id'),
      ])
      return exists.rowCount
        ? jsonError(context, 409, 'JOB-STATE', 'job_not_cancellable')
        : jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    await audit(env.db, user!.id, 'ingest.cancel', 'ingest_job', rows[0].id, 'cancel')
    return context.json(camelJobs(rows)[0])
  })
}

const SOURCE_QUERY_KEYS = [
  'source', 'window', 'keyword', 'category', 'region', 'followersMin', 'followersMax',
  'priceMin', 'priceMax', 'health', 'externalIds', 'cursor', 'limit',
] as const satisfies readonly (keyof SourceQuery)[]

/** The stored `query` holds exactly the SourceQuery fields, nothing the client tacked on. */
const MISSING_DECISION_BODY = z.object({ decision: z.enum(['keep', 'gone']) })

const DISCOVERY_SEARCH_BODY = z.object({
  name: z.string().trim().min(1).max(120),
  query: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional(),
  maxPages: z.number().int().min(1).max(100).optional(),
  everyHours: z.number().int().min(1).max(8760).optional(),
})

const DISCOVERY_SEARCH_PATCH = DISCOVERY_SEARCH_BODY.omit({ query: true }).partial()

function discoverySearchView(row: Record<string, unknown>) {
  const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : (value as string | null) ?? null)
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    query: row.query,
    enabled: row.enabled,
    maxPages: row.max_pages,
    everyHours: row.every_hours,
    lastEnqueuedAt: iso(row.last_enqueued_at),
    createdAt: iso(row.created_at),
  }
}

function pickSourceQuery(input: SourceQuery): SourceQuery {
  const out: Record<string, unknown> = {}
  for (const key of SOURCE_QUERY_KEYS) if (input[key] !== undefined) out[key] = input[key]
  return out as SourceQuery
}
