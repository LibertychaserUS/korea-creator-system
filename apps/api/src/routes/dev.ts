import { runIngest } from '../ingest/service'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerDevRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/dev/health', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const jobs = await env.db.query(
      'SELECT status, count(*)::int AS n FROM ingest_jobs GROUP BY status',
    )
    const sources = await env.db.query(
      'SELECT count(*) FILTER (WHERE enabled)::int AS enabled FROM ingest_sources',
    )
    const total = await env.db.query('SELECT count(*)::int AS n FROM ingest_jobs')
    return context.json({
      ok: true,
      jobs: jobs.rows,
      sourcesEnabled: sources.rows[0].enabled,
      jobCount: Number(total.rows[0].n),
    })
  })

  app.get('/api/dev/jobs', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs ORDER BY updated_at DESC')
    return context.json({ items: rows })
  })

  app.get('/api/dev/jobs/:id', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [
      context.req.param('id'),
    ])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(rows[0])
  })

  app.post('/api/dev/jobs/:id/retry', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'dev.retry')
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

  app.get('/api/dev/failures', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      "SELECT * FROM ingest_jobs WHERE status = 'failed' ORDER BY updated_at DESC",
    )
    return context.json({ items: rows })
  })

  app.get('/api/dev/pipeline', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(`
      SELECT
        (SELECT count(*) FROM ingest_sources WHERE enabled)::int AS sources,
        (SELECT count(*) FROM ingest_jobs)::int AS jobs,
        (SELECT count(*) FROM creators WHERE needs_review)::int AS review,
        (SELECT count(*) FROM creators WHERE status = 'released')::int AS released
    `)
    return context.json(rows[0])
  })

  app.get('/api/dev/audit', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100',
    )
    return context.json({ items: rows })
  })

  app.get('/api/dev/i18n-theme', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    return context.json({
      locales: ['zh-CN', 'en', 'ko'],
      themes: ['light', 'dark', 'system'],
    })
  })
}
