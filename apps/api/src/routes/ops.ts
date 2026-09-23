import { randomUUID } from 'node:crypto'
import { deriveMetrics, emptyMetrics, type Permission } from '@kcs/contract'
import type { MiddlewareHandler } from 'hono'
import { runIngest, runWorkbookIngest } from '../ingest/service'
import { audit } from '../http/audit'
import {
  assetPublicUrl,
  attachCreatorMeta,
  hasCollabSql,
  loadCreator,
  mutexCoop,
  readUpload,
  saveRelations,
} from '../http/creators'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'
import {
  IMAGE_MAX_BYTES,
  WORKBOOK_MAX_BYTES,
  imageExtension,
  isImageType,
  safeImageHeaders,
  sniffImage,
  uploadLimit,
} from '../http/uploads'

export function registerOpsRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  // Auth before the body limit, so strangers get 401/403 rather than a 413.
  const gate = (permission: Permission): MiddlewareHandler => async (context, next) => {
    const { denied } = await helpers.requireAuth(context, permission)
    if (denied) return denied
    await next()
  }

  app.get('/api/ops/overview', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const counts = await env.db.query(`
      SELECT
        count(*) FILTER (WHERE status = 'draft')::int AS draft,
        count(*) FILTER (WHERE needs_review)::int AS review,
        count(*) FILTER (WHERE status = 'ready')::int AS ready,
        count(*) FILTER (WHERE status = 'released')::int AS released
      FROM creators
    `)
    const jobs = await env.db.query(
      `SELECT id, status, written_count, failed_count, batch_name, file_name, created_at
       FROM ingest_jobs ORDER BY created_at DESC LIMIT 5`,
    )
    return context.json({ counts: counts.rows[0], recentJobs: jobs.rows })
  })

  const listCreators = async (context: Parameters<typeof helpers.requireAuth>[0]) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT c.*, ${hasCollabSql()}::int AS collab_count
       FROM creators c ORDER BY c.updated_at DESC`,
    )
    return context.json({ items: await attachCreatorMeta(env.db, rows, true) })
  }
  app.get('/api/ops/creators', listCreators)
  app.get('/api/kcs/creators', listCreators)

  app.post('/api/ops/creators', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const body = await context.req.json()
    if (!body.displayName) return jsonError(context, 400, 'VALIDATION', 'display_name_required')
    if (mutexCoop(body.categories)) return jsonError(context, 400, 'VALIDATION', 'coop_history_mutex')
    const id = randomUUID()
    const key = body.creatorKey || `ck_${id.slice(0, 8)}`
    const metrics = deriveMetrics({
      ...emptyMetrics(body.metrics?.window === 90 ? 90 : 30),
      ...(body.metrics && typeof body.metrics === 'object' ? body.metrics : {}),
      followers: body.metrics?.followers ?? body.followers ?? null,
      priceImage: body.metrics?.priceImage ?? body.price?.amountMin ?? null,
    })
    await env.db.query(
      `INSERT INTO creators
        (id, creator_key, display_name, status, needs_review, followers, followers_unknown, regions, verticals,
         rating, note, avatar_key, xhs_id, metrics, metrics_window, source, external_id, metrics_fetched_at)
       VALUES ($1,$2,$3,'draft',false,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        key,
        body.displayName,
        body.followers ?? metrics.followers,
        Boolean(body.followersUnknown),
        body.regions ?? [],
        body.verticals ?? [],
        body.rating ?? null,
        body.note ?? null,
        body.avatarKey ?? null,
        body.xhsId ?? null,
        JSON.stringify(metrics),
        metrics.window,
        body.source ?? null,
        body.externalId ?? null,
        body.metrics ? env.now().toISOString() : null,
      ],
    )
    await saveRelations(env.db, id, body)
    await audit(env.db, user!.id, 'creator.create', 'creator', id, body.displayName)
    return context.json({ id, creatorKey: key }, 201)
  })

  app.get('/api/ops/creators/:id', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const item = await loadCreator(env.db, context.req.param('id'), true)
    if (!item) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(item)
  })

  app.patch('/api/ops/creators/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const id = context.req.param('id')
    const body = await context.req.json()
    if (mutexCoop(body.categories)) return jsonError(context, 400, 'VALIDATION', 'coop_history_mutex')
    const metrics = body.metrics && typeof body.metrics === 'object'
      ? deriveMetrics({ ...emptyMetrics(body.metrics.window === 90 ? 90 : 30), ...body.metrics })
      : null
    await env.db.query(
      `UPDATE creators SET
        display_name = COALESCE($2, display_name),
        followers = COALESCE($3, followers),
        followers_unknown = COALESCE($4, followers_unknown),
        regions = COALESCE($5, regions),
        verticals = COALESCE($6, verticals),
        rating = COALESCE($7, rating),
        note = COALESCE($8, note),
        qc_notes = COALESCE($9, qc_notes),
        label = COALESCE($10, label),
        needs_review = COALESCE($11, needs_review),
        metrics = COALESCE($12, metrics),
        metrics_window = COALESCE($13, metrics_window),
        metrics_fetched_at = CASE WHEN $12::jsonb IS NULL THEN metrics_fetched_at ELSE now() END,
        updated_at = now()
       WHERE id = $1`,
      [
        id,
        body.displayName ?? null,
        body.followers ?? metrics?.followers ?? null,
        body.followersUnknown ?? null,
        body.regions ?? null,
        body.verticals ?? null,
        body.rating ?? null,
        body.note ?? null,
        body.qcNotes ?? null,
        body.label ?? null,
        body.needsReview ?? null,
        metrics ? JSON.stringify(metrics) : null,
        metrics?.window ?? null,
      ],
    )
    if (body.categories || body.collaborations || body.price) {
      await saveRelations(env.db, id, body)
    }
    await audit(env.db, user!.id, 'creator.update', 'creator', id, 'update')
    return context.json({ ok: true })
  })

  app.post('/api/ops/creators/:id/publish', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.publish')
    if (denied) return denied
    const id = context.req.param('id')
    const item = await loadCreator(env.db, id, true)
    if (!item) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (!item.displayName || !(item.regions?.length || item.verticals?.length)) {
      return jsonError(context, 400, 'VALIDATION', 'incomplete')
    }
    if (item.followers == null && !item.followersUnknown) {
      return jsonError(context, 400, 'VALIDATION', 'incomplete')
    }
    await env.db.query(
      `UPDATE creators SET status = 'released', metrics_locked = metrics,
       updated_at = now() WHERE id = $1`,
      [id],
    )
    await env.db.query('UPDATE assignments SET pool_gone = false WHERE creator_id = $1', [id])
    await audit(env.db, user!.id, 'creator.publish', 'creator', id, item.displayName)
    return context.json({ ok: true, status: 'released' })
  })

  app.post('/api/ops/creators/:id/unpublish', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.publish')
    if (denied) return denied
    const id = context.req.param('id')
    await env.db.query("UPDATE creators SET status = 'ready', updated_at = now() WHERE id = $1", [id])
    await env.db.query('UPDATE assignments SET pool_gone = true WHERE creator_id = $1', [id])
    await audit(env.db, user!.id, 'creator.unpublish', 'creator', id, 'unpublish')
    return context.json({ ok: true, status: 'ready' })
  })

  app.get('/api/ops/categories', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM categories ORDER BY builtin DESC, slug')
    return context.json({ items: rows })
  })

  app.patch('/api/ops/categories/:slug', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.categories')
    if (denied) return denied
    const slug = context.req.param('slug')
    const body = await context.req.json()
    if (body.enabled === false && ['collaborated', 'never_collaborated'].includes(slug)) {
      return jsonError(context, 400, 'VALIDATION', 'cannot_disable_builtin_coop')
    }
    const names = body.names ?? {}
    await env.db.query(
      `UPDATE categories SET
        name_zh = COALESCE($2, name_zh),
        name_en = COALESCE($3, name_en),
        name_ko = COALESCE($4, name_ko),
        enabled = COALESCE($5, enabled),
        frontend_visible = COALESCE($6, frontend_visible)
       WHERE slug = $1`,
      [
        slug,
        names['zh-CN'] ?? body.nameZh ?? null,
        names.en ?? body.nameEn ?? null,
        names.ko ?? body.nameKo ?? null,
        body.enabled ?? null,
        body.frontendVisible ?? null,
      ],
    )
    return context.json({ ok: true })
  })

  app.get('/api/ops/review', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT r.*, c.display_name FROM reviews r JOIN creators c ON c.id = r.creator_id
       WHERE r.status = 'pending' ORDER BY r.created_at DESC`,
    )
    return context.json({ items: rows })
  })

  app.post('/api/ops/review/:id/pass', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const id = context.req.param('id')
    const { rows } = await env.db.query('SELECT * FROM reviews WHERE id = $1', [id])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    await env.db.query("UPDATE reviews SET status = 'passed' WHERE id = $1", [id])
    await env.db.query("UPDATE creators SET needs_review = false, status = 'ready' WHERE id = $1", [
      rows[0].creator_id,
    ])
    await audit(env.db, user!.id, 'review.pass', 'review', id, 'pass')
    return context.json({ ok: true })
  })

  app.get('/api/ops/batches', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT j.*, s.name AS source_name FROM ingest_jobs j
       JOIN ingest_sources s ON s.id = j.source_id ORDER BY j.created_at DESC`,
    )
    return context.json({ items: rows })
  })

  app.post('/api/ops/batches', gate('ops.write'), uploadLimit(WORKBOOK_MAX_BYTES), async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    if ((context.req.header('content-type') || '').includes('multipart/form-data')) {
      const body = await context.req.parseBody()
      const upload = await readUpload(body.file)
      if (upload) {
        return context.json(
          await runWorkbookIngest(env, user!.id, {
            fileName: upload.name,
            batchName: String(body.batchName || body.batch_name || ''),
            buf: upload.buf,
          }),
          201,
        )
      }
    }
    return context.json(await runIngest(env, 'file-drop', 'once', 0.1, user!.id), 201)
  })

  app.post('/api/assets/presign', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const body = await context.req.json().catch(() => ({}))
    const contentType = body.contentType ?? 'image/png'
    if (!isImageType(contentType)) return jsonError(context, 415, 'UPLOAD-TYPE', 'unsupported_type')
    const purpose = body.purpose === 'attachment' ? 'attachments' : 'avatars'
    const key = `${purpose}/${randomUUID()}.${imageExtension(contentType)}`
    const signed = await env.store.presign(key, contentType)
    const publicUrl = assetPublicUrl(key)
    await env.db.query(
      `INSERT INTO assets (key, url, content_type, size) VALUES ($1,$2,$3,0)
       ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url`,
      [key, publicUrl, contentType],
    )
    return context.json({ url: signed.url || publicUrl, key })
  })

  // Anonymous on purpose (<img src> cannot send a Bearer), so it must never hand
  // back anything a browser would run: bytes are re-sniffed and only an image
  // type goes out, with nosniff / inline / a CSP that forbids everything.
  app.get('/api/assets/raw/*', async (context) => {
    let key: string
    try {
      key = decodeURIComponent(context.req.path.replace('/api/assets/raw/', ''))
    } catch {
      return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    const { rows } = await env.db.query('SELECT bytes FROM assets WHERE key = $1', [key])
    const bytes: Buffer | null = rows[0]?.bytes ?? null
    const type = bytes ? sniffImage(bytes) : null
    if (!bytes || !type) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return new Response(new Uint8Array(bytes), { headers: safeImageHeaders(type, bytes.length) })
  })

  app.post('/api/assets', gate('ops.write'), uploadLimit(IMAGE_MAX_BYTES), async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const body = await context.req.parseBody().catch(() => null)
    const file = body?.file
    if (!(file instanceof File) || file.size === 0) return jsonError(context, 400, 'VALIDATION', 'file_required')
    if (file.size > IMAGE_MAX_BYTES) return jsonError(context, 413, 'UPLOAD-TOO-LARGE', 'file_too_large')
    const bytes = Buffer.from(await file.arrayBuffer())
    const type = sniffImage(bytes)
    const declaredOk = !file.type || file.type === 'application/octet-stream' || isImageType(file.type)
    if (!type || !declaredOk) return jsonError(context, 415, 'UPLOAD-TYPE', 'unsupported_type')
    const purpose = String(body?.purpose || 'avatar') === 'attachment' ? 'attachments' : 'avatars'
    const key = `${purpose}/${randomUUID()}.${imageExtension(type)}`
    const stored = await env.store.put(key, bytes, type)
    const publicUrl = stored.url || assetPublicUrl(key)
    await env.db.query(
      `INSERT INTO assets (key, url, content_type, size, bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (key) DO UPDATE SET
         bytes = EXCLUDED.bytes, size = EXCLUDED.size, url = EXCLUDED.url, content_type = EXCLUDED.content_type`,
      [key, publicUrl, type, bytes.length, env.store.durable ? null : bytes, user!.id],
    )
    return context.json({ url: publicUrl, key }, 201)
  })

  app.get('/api/assets', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      'SELECT key, url, content_type, size FROM assets ORDER BY key',
    )
    return context.json({
      items: rows.map((row) => ({
        key: row.key,
        url: row.url,
        contentType: row.content_type,
        size: Number(row.size),
      })),
    })
  })

  app.get('/api/assets/:key{.+}', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const key = decodeURIComponent(context.req.param('key'))
    const { rows } = await env.db.query(
      'SELECT key, url, content_type, size FROM assets WHERE key = $1',
      [key],
    )
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json({
      key: rows[0].key,
      url: rows[0].url,
      contentType: rows[0].content_type,
      size: Number(rows[0].size),
    })
  })
}
