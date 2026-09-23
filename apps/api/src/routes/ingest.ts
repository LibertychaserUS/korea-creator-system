import { parsePaging, SOURCE_IDS, type SourceQuery } from '@kcs/contract'
import { adapterDescriptions } from '../adapters'
import { retryJob } from '../ingest/jobs'
import { enqueueIngestJob, processJob } from '../ingest/worker'
import { audit } from '../http/audit'
import { camelJobs } from '../http/creators'
import { z } from 'zod'
import { readJson } from '../http/body'
import { csv, pageRows } from '../http/lists'
import { jsonError } from '../http/responses'
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
      `SELECT id, creator_id, source, external_id, fetched_at, payload
       FROM creator_raw WHERE creator_id = $1 ORDER BY fetched_at DESC, id DESC LIMIT $2`,
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
    return context.json({ items: rows })
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
function pickSourceQuery(input: SourceQuery): SourceQuery {
  const out: Record<string, unknown> = {}
  for (const key of SOURCE_QUERY_KEYS) if (input[key] !== undefined) out[key] = input[key]
  return out as SourceQuery
}
