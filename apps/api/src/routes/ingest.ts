import { SOURCE_IDS, type SourceQuery } from '@kcs/contract'
import { adapterDescriptions } from '../adapters'
import { runIngest } from '../ingest/service'
import { closeJobDeadLetters } from '../ingest/dead-letters'
import { enqueueIngestJob, processJob } from '../ingest/worker'
import { audit } from '../http/audit'
import { camelJobs } from '../http/creators'
import { z } from 'zod'
import { ingestJobBody, readJson } from '../http/body'
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
    const query = raw as SourceQuery | null
    if (!query || typeof query !== 'object' || !SOURCE_IDS.includes(query.source) || ![30, 90].includes(query.window)) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'invalid_source_query')
    }
    const maxPages = Number((query as SourceQuery & { maxPages?: number }).maxPages ?? 5)
    const job = await enqueueIngestJob(env, query, user!.id, maxPages)
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
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs ORDER BY created_at DESC')
    return context.json({ items: camelJobs(rows) })
  })

  app.post('/api/ingest/jobs', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ingest.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, ingestJobBody)
    if (invalid) return invalid
    if (body.sourceUrl) return jsonError(context, 400, 'SOURCE-INVALID', 'adhoc_url_forbidden')
    const source = await env.db.query('SELECT * FROM ingest_sources WHERE id = $1', [body.sourceId])
    if (!source.rows[0]) return jsonError(context, 400, 'SOURCE-INVALID', 'source_missing')
    if (!source.rows[0].enabled) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'source_disabled')
    }
    return context.json(
      await runIngest(
        env,
        source.rows[0].id,
        body.schedule || 'once',
        body.sampleRate ?? 0.1,
        user!.id,
      ),
      201,
    )
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
    const { rows } = await env.db.query(
      `UPDATE ingest_jobs SET status = 'queued', attempts = 0, next_run_at = now(),
       error = NULL, error_code = NULL, error_summary = NULL, ended_at = NULL,
       dead_lettered_at = NULL, locked_by = NULL, lease_expires_at = NULL, updated_at = now()
       WHERE id = $1 AND status IN ('failed','partial') RETURNING *`,
      [
      context.req.param('id'),
      ],
    )
    if (!rows[0]) {
      const exists = await env.db.query('SELECT 1 FROM ingest_jobs WHERE id = $1', [
        context.req.param('id'),
      ])
      return exists.rowCount
        ? jsonError(context, 409, 'JOB-STATE', 'job_not_retryable')
        : jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    // Requeued by hand: its dead-letter entry is settled, not waiting.
    await closeJobDeadLetters(env, rows[0].id, user!.id, rows[0].id)
    await audit(env.db, user!.id, 'ingest.retry', 'ingest_job', rows[0].id, 'retry')
    return context.json(camelJobs(rows)[0])
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
