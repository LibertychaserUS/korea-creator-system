import { randomUUID } from 'node:crypto'
import {
  CREATOR_STAGES,
  normalizeMetrics,
  parsePaging,
  type CreatorStage,
  type Permission,
} from '@kcs/contract'
import type { Context, MiddlewareHandler } from 'hono'
import { runWorkbookIngest } from '../ingest/workbook'
import { creatorTrends } from '../ingest/trends'
import { audit } from '../http/audit'
import {
  categoryPatchBody,
  creatorCreateBody,
  creatorPatchBody,
  presignBody,
  readJson,
  validationError,
} from '../http/body'
import {
  apiPublicBase,
  assetPublicUrl,
  attachCreatorMeta,
  camelJobs,
  creatorHistory,
  hasCollabSql,
  loadCreator,
  mutexCoop,
  readUpload,
  saveRelations,
} from '../http/creators'
import { pageRows } from '../http/lists'
import { recordEvents } from '../http/events'
import { inTransaction, recomputeGroups, republish, syncPublished } from '../http/published'
import { jsonError } from '../http/responses'
import { categoryView, overviewJobView, reviewView } from '../http/views'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'
import {
  IMAGE_MAX_BYTES,
  UPLOAD_URL_TTL_SECONDS,
  WORKBOOK_MAX_BYTES,
  imageExtension,
  isImageType,
  safeImageHeaders,
  signUploadToken,
  sniffImage,
  uploadLimit,
  verifyUploadToken,
} from '../http/uploads'

/** S3_READ_MODE=redirect: 302 to a signed bucket URL instead of streaming through the API. */
const READ_REDIRECT_SECONDS = 300

const STAGE_SQL = `(CASE WHEN c.status = 'released' THEN 'released'
  WHEN c.metrics_locked_at IS NOT NULL THEN 'withdrawn' ELSE 'review' END)`

export function registerOpsRoutes(app: KcsApp, env: AppEnv, helpers: RouteHelpers) {
  // Auth before the body limit, so strangers get 401/403 rather than a 413.
  const gate = (permission: Permission): MiddlewareHandler => async (context, next) => {
    const { denied } = await helpers.requireAuth(context, permission)
    if (denied) return denied
    await next()
  }

  // Unknown slugs would hit the creator_categories FK halfway through a write.
  const checkCategories = async (context: Context, categories: string[] | undefined) => {
    if (!categories?.length) return null
    if (mutexCoop(categories)) {
      return validationError(context, 'coop_history_mutex', [
        { path: 'categories', message: 'collaborated and never_collaborated are mutually exclusive' },
      ])
    }
    const { rows } = await env.db.query('SELECT slug FROM categories WHERE slug = ANY($1)', [categories])
    const known = new Set(rows.map((row) => row.slug))
    const unknown = categories.filter((slug) => !known.has(slug))
    if (!unknown.length) return null
    return validationError(context, 'unknown_category', unknown.map((slug) => ({
      path: 'categories',
      message: `unknown category: ${slug}`,
    })))
  }

  app.get('/api/ops/overview', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const counts = await env.db.query(`
      SELECT
        count(*) FILTER (WHERE status = 'draft')::int AS draft,
        count(*) FILTER (WHERE needs_review)::int AS review,
        count(*) FILTER (WHERE status = 'ready')::int AS ready,
        count(*) FILTER (WHERE status = 'released')::int AS released,
        count(*) FILTER (WHERE status <> 'released' AND metrics_locked_at IS NULL)::int AS pending,
        count(*) FILTER (WHERE status <> 'released' AND metrics_locked_at IS NOT NULL)::int AS withdrawn
      FROM creators
    `)
    const jobs = await env.db.query(
      `SELECT id, status, written_count, failed_count, batch_name, file_name, created_at
       FROM ingest_jobs ORDER BY created_at DESC LIMIT 5`,
    )
    return context.json({ counts: counts.rows[0], recentJobs: jobs.rows.map(overviewJobView) })
  })

  /**
   * `?stage=review|released|withdrawn&q=&source=<id>|manual&page=&pageSize=`.
   * `counts` is per stage over the `q` / `source` match, so tab badges follow the search.
   */
  const listCreators = async (context: Parameters<typeof helpers.requireAuth>[0]) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const query = context.req.query()
    const params: unknown[] = []
    const where: string[] = []
    const needle = (query.q ?? '').trim()
    if (needle) {
      params.push(needle)
      where.push(`(strpos(lower(c.display_name), lower($${params.length})) > 0
        OR strpos(lower(COALESCE(c.xhs_id, '')), lower($${params.length})) > 0)`)
    }
    if (query.source === 'manual') where.push("COALESCE(c.source, '') = ''")
    else if (query.source) {
      params.push(query.source)
      where.push(`c.source = $${params.length}`)
    }
    const matched = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const counts = await env.db.query(
      `SELECT ${STAGE_SQL} AS stage, count(*)::int AS n FROM creators c ${matched} GROUP BY 1`,
      params,
    )
    const stages = Object.fromEntries(CREATOR_STAGES.map((stage) => [stage, 0])) as Record<CreatorStage, number>
    for (const row of counts.rows) stages[row.stage as CreatorStage] = row.n
    const stage = CREATOR_STAGES.includes(query.stage as CreatorStage) ? query.stage as CreatorStage : null
    if (stage) {
      params.push(stage)
      where.push(`${STAGE_SQL} = $${params.length}`)
    }
    const paging = parsePaging(query)
    const { rows, total } = await pageRows(
      env.db,
      {
        columns: `c.*, ${hasCollabSql()}::int AS collab_count`,
        from: `FROM creators c ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
        order: 'c.updated_at DESC, c.id COLLATE "C"',
      },
      params,
      paging,
    )
    return context.json({
      items: await attachCreatorMeta(env.db, rows, true),
      total,
      page: paging.page,
      pageSize: paging.pageSize,
      counts: stages,
    })
  }
  app.get('/api/ops/creators', listCreators)
  app.get('/api/kcs/creators', listCreators)

  app.post('/api/ops/creators', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, creatorCreateBody)
    if (invalid) return invalid
    const rejected = await checkCategories(context, body.categories)
    if (rejected) return rejected
    const id = randomUUID()
    const key = body.creatorKey || `ck_${id.slice(0, 8)}`
    // A manual quote is folded in on read (`metricsFromRow`), where its currency is checked.
    const metrics = normalizeMetrics({
      ...(body.metrics && typeof body.metrics === 'object' ? body.metrics : {}),
      followers: body.metrics?.followers ?? body.followers ?? null,
    }, body.source ?? null)
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

  app.get('/api/ops/creators/:id/history', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const creatorId = context.req.param('id')
    const exists = await env.db.query('SELECT 1 FROM creators WHERE id = $1', [creatorId])
    if (!exists.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json({ snapshots: await creatorHistory(env.db, creatorId, context.req.query()) })
  })

  /** 按来源分线的走势与人话提示（与 `/api/ingest/trends/:creatorId` 同一份数据）。 */
  app.get('/api/ops/creators/:id/trends', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const trends = await creatorTrends(env, context.req.param('id'), context.req.query())
    if (!trends) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(trends)
  })

  app.patch('/api/ops/creators/:id', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const id = context.req.param('id')
    const { data: body, invalid } = await readJson(context, creatorPatchBody)
    if (invalid) return invalid
    const rejected = await checkCategories(context, body.categories)
    if (rejected) return rejected
    const metrics = body.metrics && typeof body.metrics === 'object'
      ? normalizeMetrics(body.metrics, null)
      : null
    const updated = await env.db.query(
      `UPDATE creators SET
        display_name = COALESCE($2, display_name),
        followers = COALESCE($3::integer, followers),
        followers_unknown = COALESCE($4, followers_unknown),
        regions = COALESCE($5, regions),
        verticals = COALESCE($6, verticals),
        rating = COALESCE($7, rating),
        note = COALESCE($8, note),
        qc_notes = COALESCE($9, qc_notes),
        label = COALESCE($10, label),
        needs_review = COALESCE($11, needs_review),
        metrics = CASE
          WHEN $12::jsonb IS NOT NULL THEN $12::jsonb
          WHEN $3::integer IS NOT NULL AND metrics IS NOT NULL
            THEN jsonb_set(metrics, '{followers}', to_jsonb($3::integer))
          ELSE metrics END,
        metrics_window = COALESCE($13, metrics_window),
        metrics_fetched_at = CASE WHEN $12::jsonb IS NULL THEN metrics_fetched_at ELSE now() END,
        updated_at = now()
       WHERE id = $1 RETURNING id`,
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
    if (!updated.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (body.categories || body.collaborations || body.price) {
      await saveRelations(env.db, id, body)
    }
    // Name, regions, quotes… follow by trigger; a blacklist change re-ranks the group.
    await republish(env.db, [id])
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
    // Already in the pool: the snapshot stays as it was. Only a take-down and a
    // fresh publish move the pool onto newer numbers.
    if (item.status === 'released') {
      return context.json({
        ok: true,
        status: 'released',
        refreshed: false,
        metricsLockedAt: item.metricsLockedAt,
      })
    }
    // `item.metrics` is the latest record with followers / price folded in, so
    // the snapshot stands on its own even if those columns change later. The
    // pool row and its group's percentiles are written in the same transaction.
    const rows = await inTransaction(env.db, async (client) => {
      const result = await client.query(
        `UPDATE creators SET status = 'released', needs_review = false,
           metrics_locked = $2, metrics_locked_at = now(),
           metrics_locked_fetched_at = LEAST(COALESCE(metrics_fetched_at, now()), now()), updated_at = now()
         WHERE id = $1 RETURNING metrics_locked_at`,
        [id, JSON.stringify(item.metrics)],
      )
      await client.query(
        "UPDATE reviews SET status = 'passed' WHERE creator_id = $1 AND status = 'pending'",
        [id],
      )
      await client.query('UPDATE assignments SET pool_gone = false WHERE creator_id = $1', [id])
      await recomputeGroups(client, await syncPublished(client, [id]))
      await recordEvents(client, [{
        kind: 'publish', creatorId: id, orgId: user!.orgId, actorId: user!.id, context: { republish: item.stage === 'withdrawn' },
      }])
      return result.rows
    })
    await audit(
      env.db,
      user!.id,
      item.stage === 'withdrawn' ? 'creator.republish' : 'creator.publish',
      'creator',
      id,
      item.displayName,
    )
    return context.json({
      ok: true,
      status: 'released',
      refreshed: true,
      metricsLockedAt: rows[0].metrics_locked_at instanceof Date
        ? rows[0].metrics_locked_at.toISOString()
        : rows[0].metrics_locked_at,
    })
  })

  app.post('/api/ops/creators/:id/unpublish', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.publish')
    if (denied) return denied
    const id = context.req.param('id')
    const updated = await inTransaction(env.db, async (client) => {
      const result = await client.query(
        "UPDATE creators SET status = 'ready', updated_at = now() WHERE id = $1 RETURNING id",
        [id],
      )
      if (!result.rowCount) return result
      await client.query('UPDATE assignments SET pool_gone = true WHERE creator_id = $1', [id])
      await recomputeGroups(client, await syncPublished(client, [id]))
      await recordEvents(client, [{ kind: 'unpublish', creatorId: id, orgId: user!.orgId, actorId: user!.id }])
      return result
    })
    if (!updated.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    await audit(env.db, user!.id, 'creator.unpublish', 'creator', id, 'unpublish')
    return context.json({ ok: true, status: 'ready' })
  })

  app.get('/api/ops/categories', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM categories ORDER BY builtin DESC, slug')
    return context.json({ items: rows.map(categoryView) })
  })

  app.patch('/api/ops/categories/:slug', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.categories')
    if (denied) return denied
    const slug = context.req.param('slug')
    const { data: body, invalid } = await readJson(context, categoryPatchBody)
    if (invalid) return invalid
    if (body.enabled === false && ['collaborated', 'never_collaborated'].includes(slug)) {
      return validationError(context, 'cannot_disable_builtin_coop', [
        { path: 'enabled', message: 'builtin coop_history categories stay enabled' },
      ])
    }
    const names = body.names ?? {}
    const updated = await env.db.query(
      `UPDATE categories SET
        name_zh = COALESCE($2, name_zh),
        name_en = COALESCE($3, name_en),
        name_ko = COALESCE($4, name_ko),
        enabled = COALESCE($5, enabled),
        frontend_visible = COALESCE($6, frontend_visible)
       WHERE slug = $1 RETURNING slug`,
      [
        slug,
        names['zh-CN'] ?? body.nameZh ?? null,
        names.en ?? body.nameEn ?? null,
        names.ko ?? body.nameKo ?? null,
        body.enabled ?? null,
        body.frontendVisible ?? null,
      ],
    )
    if (!updated.rowCount) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json({ ok: true })
  })

  app.get('/api/ops/review', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT r.*, c.display_name FROM reviews r JOIN creators c ON c.id = r.creator_id
       WHERE r.status = 'pending' ORDER BY r.created_at DESC`,
    )
    return context.json({ items: rows.map(reviewView) })
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
    await republish(env.db, [String(rows[0].creator_id)])
    await audit(env.db, user!.id, 'review.pass', 'review', id, 'pass')
    return context.json({ ok: true })
  })

  app.get('/api/ops/batches', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'ops.read')
    if (denied) return denied
    const paging = parsePaging(context.req.query())
    const { rows, total } = await pageRows(
      env.db,
      {
        columns: 'j.*, s.name AS source_name',
        from: 'FROM ingest_jobs j JOIN ingest_sources s ON s.id = j.source_id',
        order: 'j.created_at DESC, j.id COLLATE "C"',
      },
      [],
      paging,
    )
    const items = camelJobs(rows).map((job, index) => ({ ...job, sourceName: rows[index].source_name }))
    return context.json({ items, total, page: paging.page, pageSize: paging.pageSize })
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
    return validationError(context, 'file_required', [{ path: 'file', message: 'an .xlsx workbook is required' }])
  })

  // Not a bucket URL: the bucket is private and a raw S3 presigned PUT cannot cap
  // the size. The URL is the API's own upload endpoint, signed for this key and
  // image type, valid UPLOAD_URL_TTL_SECONDS, one upload, IMAGE_MAX_BYTES at most.
  app.post('/api/assets/presign', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'ops.write')
    if (denied) return denied
    const { data: body, invalid } = await readJson(context, presignBody)
    if (invalid) return invalid
    const contentType = body.contentType ?? 'image/png'
    if (!isImageType(contentType)) return jsonError(context, 415, 'UPLOAD-TYPE', 'unsupported_type')
    const purpose = body.purpose === 'attachment' ? 'attachments' : 'avatars'
    const key = `${purpose}/${randomUUID()}.${imageExtension(contentType)}`
    const exp = Math.floor(env.now().getTime() / 1000) + UPLOAD_URL_TTL_SECONDS
    const publicUrl = assetPublicUrl(key)
    await env.db.query(
      `INSERT INTO assets (key, url, content_type, size, uploaded_by) VALUES ($1,$2,$3,0,$4)
       ON CONFLICT (key) DO NOTHING`,
      [key, publicUrl, contentType, user!.id],
    )
    const token = signUploadToken({ key, type: contentType, exp })
    return context.json({
      url: `${apiPublicBase()}/api/assets/upload/${key}?token=${token}`,
      key,
      method: 'PUT',
      headers: { 'content-type': contentType },
      maxBytes: IMAGE_MAX_BYTES,
      expiresAt: new Date(exp * 1000).toISOString(),
      publicUrl,
    })
  })

  // The signed token is the credential (like an S3 presigned URL), so no session.
  app.put('/api/assets/upload/:key{.+}', uploadLimit(IMAGE_MAX_BYTES, 0), async (context) => {
    const key = decodeURIComponent(context.req.param('key'))
    const grant = verifyUploadToken(context.req.query('token') || '', key, env.now().getTime())
    if (!grant) return jsonError(context, 403, 'AUTH-DENIED', 'upload_url_invalid')
    const bytes = Buffer.from(await context.req.arrayBuffer())
    if (!bytes.length) return jsonError(context, 400, 'VALIDATION', 'file_required')
    if (bytes.length > IMAGE_MAX_BYTES) return jsonError(context, 413, 'UPLOAD-TOO-LARGE', 'file_too_large')
    if (sniffImage(bytes) !== grant.type) return jsonError(context, 415, 'UPLOAD-TYPE', 'unsupported_type')
    const claimed = await env.db.query(
      `UPDATE assets SET size = $2, content_type = $3 WHERE key = $1 AND size = 0 AND bytes IS NULL RETURNING url`,
      [key, bytes.length, grant.type],
    )
    if (!claimed.rowCount) return jsonError(context, 409, 'CONFLICT', 'upload_url_used')
    try {
      await env.store.put(key, bytes, grant.type)
      if (!env.store.durable) await env.db.query('UPDATE assets SET bytes = $2 WHERE key = $1', [key, bytes])
    } catch (error) {
      await env.db.query('UPDATE assets SET size = 0 WHERE key = $1', [key])
      throw error
    }
    return context.json({ url: String(claimed.rows[0].url), key }, 201)
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
    const { rows } = await env.db.query('SELECT bytes, size FROM assets WHERE key = $1', [key])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    let bytes: Buffer | null = rows[0].bytes ?? null
    if (!bytes && env.store.durable && Number(rows[0].size) > 0) {
      if (process.env.S3_READ_MODE === 'redirect' && env.store.signedGetUrl) {
        const location = await env.store.signedGetUrl(key, READ_REDIRECT_SECONDS)
        return new Response(null, {
          status: 302,
          headers: { location, 'cache-control': `private, max-age=${READ_REDIRECT_SECONDS - 60}` },
        })
      }
      bytes = await env.store.get(key)
    }
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
    await env.store.put(key, bytes, type)
    const publicUrl = assetPublicUrl(key)
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
