import {
  asPublished,
  attachCreatorMeta,
  creatorHistory,
  loadCreator,
  publicPoolRow,
} from '../http/creators'
import { poolPage, withPercentiles } from '../http/pool'
import { readJson, shortlistBody } from '../http/body'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'

export function registerSelectPoolRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  app.get('/api/select/pool', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    return context.json(await poolPage(env.db, context.req.query()))
  })

  app.get('/api/select/creators/:id', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const item = await loadCreator(env.db, context.req.param('id'), false)
    if (!item || item.status !== 'released' || item.categories.includes('blacklist')) {
      return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    const published = asPublished(item)
    const [enriched] = await withPercentiles(env.db, [published])
    const raw = await env.db.query(
      'SELECT 1 FROM creator_raw WHERE creator_id = $1 LIMIT 1',
      [item.id],
    )
    return context.json({
      ...publicPoolRow(enriched),
      metricsLatest: published.metricsLatest,
      rawAvailable: Boolean(raw.rowCount),
    })
  })

  app.get('/api/select/creators/:id/history', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const creatorId = context.req.param('id')
    const creator = await loadCreator(env.db, creatorId, false)
    if (!creator || creator.status !== 'released' || creator.categories.includes('blacklist')) {
      return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    return context.json({ snapshots: await creatorHistory(env.db, creatorId, context.req.query()) })
  })

  app.get('/api/select/shortlist', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT s.org_id, s.creator_id, s.added_at, c.display_name, c.followers, c.creator_key,
              c.status, c.regions, c.verticals, c.needs_review, c.followers_unknown, c.avatar_key,
              c.metrics, c.metrics_locked, c.metrics_locked_at, c.metrics_locked_fetched_at, c.source, c.external_id, c.metrics_fetched_at
       FROM shortlist_items s JOIN creators c ON c.id = s.creator_id
       WHERE s.org_id = $1 ORDER BY s.added_at DESC, s.creator_id`,
      [user!.orgId],
    )
    const meta = await attachCreatorMeta(
      env.db,
      rows.map((row) => ({
        id: row.creator_id,
        creator_key: row.creator_key,
        display_name: row.display_name,
        followers: row.followers,
        status: row.status,
        regions: row.regions,
        verticals: row.verticals,
        needs_review: row.needs_review,
        followers_unknown: row.followers_unknown,
        avatar_key: row.avatar_key,
        metrics: row.metrics,
        metrics_locked: row.metrics_locked,
        metrics_locked_at: row.metrics_locked_at,
        metrics_locked_fetched_at: row.metrics_locked_fetched_at,
        source: row.source,
        external_id: row.external_id,
        metrics_fetched_at: row.metrics_fetched_at,
      })),
      false,
    )
    const enriched = await withPercentiles(env.db, meta.map(asPublished))
    return context.json({
      items: enriched.map((item, index) => ({
        ...publicPoolRow(item),
        creatorId: item.id,
        addedAt: rows[index].added_at,
      })),
    })
  })

  app.post('/api/select/shortlist', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'select.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, shortlistBody)
    if (invalid) return invalid
    const creator = await loadCreator(env.db, body.creatorId, false)
    if (!creator || creator.status !== 'released' || creator.categories.includes('blacklist')) {
      return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    await env.db.query(
      `INSERT INTO shortlist_items (org_id, creator_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [user!.orgId, body.creatorId],
    )
    return context.json({ ok: true })
  })
}
