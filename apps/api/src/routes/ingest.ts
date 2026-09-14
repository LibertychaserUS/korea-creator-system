import { SOURCE_IDS, type SourceQuery } from '@kcs/contract'
import { adapterDescriptions } from '../adapters'
import { runAdapterIngest, runIngest } from '../ingest/service'
import { camelJobs } from '../http/creators'
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
    const query = await context.req.json().catch(() => null) as SourceQuery | null
    if (!query || !SOURCE_IDS.includes(query.source) || ![30, 90].includes(query.window)) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'invalid_source_query')
    }
    return context.json(await runAdapterIngest(env, query, user!.id), 201)
  })

  app.get('/api/ingest/raw/:creatorId', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT id, creator_id, source, external_id, fetched_at, payload
       FROM creator_raw WHERE creator_id = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [context.req.param('creatorId')],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    const row = rows[0]
    return context.json({
      id: row.id,
      creatorId: row.creator_id,
      source: row.source,
      externalId: row.external_id,
      fetchedAt: row.fetched_at,
      payload: row.payload,
    })
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
    const body = await context.req.json()
    if (body.sourceUrl) return jsonError(context, 400, 'SOURCE-INVALID', 'adhoc_url_forbidden')
    const source = await env.db.query('SELECT * FROM ingest_sources WHERE id = $1', [body.sourceId])
    if (!source.rows[0]) return jsonError(context, 400, 'SOURCE-INVALID', 'source_missing')
    if (!source.rows[0].enabled) {
      return jsonError(context, 400, 'SOURCE-INVALID', 'source_disabled')
    }
    return context.json(
      await runIngest(
        env,
        body.sourceId,
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
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [
      context.req.param('id'),
    ])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(
      await runIngest(
        env,
        rows[0].source_id,
        rows[0].schedule,
        Number(rows[0].sample_rate),
        user!.id,
        rows[0],
      ),
    )
  })
}
