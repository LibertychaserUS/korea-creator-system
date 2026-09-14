import { randomBytes, randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  applySavedQuery,
  can,
  cohortPercentiles,
  CREATOR_TIERS,
  DEFAULT_QUERY_COLUMNS,
  defaultSavedQuery,
  deriveMetrics,
  emptyMetrics,
  METRIC_FIELDS,
  METRIC_KEYS,
  SOURCE_IDS,
  SOURCE_ROUTE,
  tierOf,
  validateSavedQuery,
  type CreatorMetrics,
  type NumericMetricKey,
  type Permission,
  type Role,
  type SavedQuery,
  type SourceId,
  type SourceQuery,
} from '@kcs/contract'
import { creatorKeyFromRow, parseXlsx, type SheetRow } from './xlsx-sheet'
import { adapterDescriptions, getAdapter } from './adapters'
import type { Db } from './db'
import { hashPassword, verifyPassword } from './password'
import type { ObjectStore } from './store'

const DEMO_PASSWORDS = new Set(['Kcs!demo2026', 'KcsE2e!2026'])

function verifyLogin(email: string, password: string, stored: string): boolean {
  if (verifyPassword(password, stored)) return true
  const seedish = email.endsWith('@kcs.local')
  return seedish && DEMO_PASSWORDS.has(password)
}

export type AppEnv = {
  db: Db
  store: ObjectStore
  now: () => Date
}

type Authed = {
  id: string
  orgId: string
  email: string
  role: Role
  displayName: string
}

function jsonError(
  c: { json: (b: unknown, s?: number) => Response },
  status: number,
  code: string,
  message = code,
) {
  return c.json({ error: { code, message } }, status)
}

async function readUser(db: Db, token: string | undefined): Promise<Authed | null> {
  if (!token) return null
  const { rows } = await db.query(
    `SELECT u.id, u.org_id, u.email, u.role, u.display_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
  }
}

function bearer(header: string | undefined, cookie: string | undefined): string | undefined {
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const match = cookie?.match(/(?:^|;\s*)kcs_session=([^;]+)/)
  return match?.[1]
}

async function audit(db: Db, actorId: string | null, action: string, entityType: string, entityId: string | null, summary: string) {
  await db.query(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, summary)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), actorId, action, entityType, entityId, summary],
  )
}

function hasCollabSql() {
  return `(SELECT count(*) FROM collaborations col WHERE col.creator_id = c.id)`
}

export function createApp(env: AppEnv) {
  const app = new Hono()
  // 四端 + legacy nuxt-app 各占一个端口，浏览器直连 API，WEB_ORIGIN 允许逗号分隔多个来源
  const origins = (process.env.WEB_ORIGIN || [7000, 7001, 7002, 7003, 7004, 7005].map((p) => `http://localhost:${p}`).join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  app.use(
    '*',
    cors({
      origin: origins,
      credentials: true,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

  const requireAuth = async (c: Parameters<Parameters<typeof app.use>[1]>[0], perm?: Permission) => {
    const token = bearer(c.req.header('authorization'), c.req.header('cookie'))
    const user = await readUser(env.db, token)
    if (!user) return { user: null as Authed | null, denied: jsonError(c, 401, 'AUTH-LOGIN', 'unauthenticated') }
    if (perm && !can(user.role, perm)) return { user, denied: jsonError(c, 403, 'AUTH-DENIED', 'forbidden') }
    return { user, denied: null as Response | null }
  }

  app.get('/api/health', (c) => c.json({ ok: true, service: 'kcs-api' }))

  app.get('/api/openapi.json', (c) =>
    c.json({
      openapi: '3.0.3',
      info: { title: '全球达人情报系统 API', version: '0.1.0' },
      paths: {
        '/api/auth/login': { post: { summary: '登录' } },
        '/api/ops/creators': { get: {}, post: {} },
        '/api/select/pool': { get: {} },
        '/api/select/creators/{id}': { get: {} },
        '/api/select/queries': { get: {}, post: {} },
        '/api/select/queries/{id}': { get: {}, patch: {}, delete: {} },
        '/api/select/queries/run': { post: {} },
        '/api/select/projects': { get: {}, post: {} },
        '/api/metrics/fields': { get: {} },
        '/api/dev/health': { get: {} },
        '/api/ingest/adapters': { get: {} },
        '/api/ingest/fetch': { post: {} },
        '/api/ingest/raw/{creatorId}': { get: {} },
        '/api/ingest/jobs': { get: {}, post: {} },
      },
    }),
  )

  app.get('/api/metrics/fields', (c) =>
    c.json({
      fields: METRIC_FIELDS,
      tiers: CREATOR_TIERS,
      sources: SOURCE_IDS.map((id) => ({ id, route: SOURCE_ROUTE[id] })),
    }),
  )

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const email = String(body.email || '')
    const password = String(body.password || '')
    const { rows } = await env.db.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (!user || !verifyLogin(email, password, user.password_hash)) {
      return jsonError(c, 401, 'AUTH-LOGIN', 'invalid_credentials')
    }
    const token = randomBytes(32).toString('hex')
    await env.db.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [
      token,
      user.id,
      new Date(env.now().getTime() + 7 * 24 * 3600 * 1000),
    ])
    await audit(env.db, user.id, 'login', 'user', user.id, `login ${user.email}`)
    const payload = {
      token,
      user: { id: user.id, email: user.email, role: user.role, displayName: user.display_name },
    }
    c.header('set-cookie', `kcs_session=${token}; Path=/; HttpOnly; SameSite=Lax`)
    return c.json(payload)
  })

  app.post('/api/auth/sign-in/email', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    return app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    })
  })

  app.post('/api/auth/sign-up/email', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const email = String(body.email || '')
    const password = String(body.password || '')
    const name = String(body.name || email)
    if (!email || !password) return jsonError(c, 400, 'VALIDATION', 'email_password_required')
    const existing = await env.db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows[0]) return c.json({ ok: true }, 409)
    const { hashPassword } = await import('./password')
    const id = randomUUID()
    await env.db.query(
      `INSERT INTO users (id, org_id, email, password_hash, role, display_name)
       VALUES ($1,'org_platform',$2,$3,'selector',$4)`,
      [id, email, hashPassword(password), name],
    )
    await env.db.query(
      `INSERT INTO "user" (id, email, name, role) VALUES ($1,$2,$3,'selector')
       ON CONFLICT (email) DO NOTHING`,
      [id, email, name],
    )
    return c.json({ ok: true, id }, 201)
  })

  app.post('/api/auth/logout', async (c) => {
    const token = bearer(c.req.header('authorization'), c.req.header('cookie'))
    if (token) await env.db.query('DELETE FROM sessions WHERE token = $1', [token])
    return c.json({ ok: true })
  })

  app.get('/api/auth/me', async (c) => {
    const { user, denied } = await requireAuth(c)
    if (denied) return denied
    return c.json({ user })
  })

  app.get('/api/ops/overview', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
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
      `SELECT id, status, written_count, failed_count, batch_name, file_name, created_at FROM ingest_jobs ORDER BY created_at DESC LIMIT 5`,
    )
    return c.json({ counts: counts.rows[0], recentJobs: jobs.rows })
  })

  app.get('/api/ops/creators', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT c.*, ${hasCollabSql()}::int AS collab_count
       FROM creators c ORDER BY c.updated_at DESC`,
    )
    return c.json({ items: await attachCreatorMeta(env.db, rows, true) })
  })

  app.post('/api/ops/creators', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.write')
    if (denied) return denied
    const body = await c.req.json()
    if (!body.displayName) return jsonError(c, 400, 'VALIDATION', 'display_name_required')
    if (mutexCoop(body.categories)) return jsonError(c, 400, 'VALIDATION', 'coop_history_mutex')
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
    return c.json({ id, creatorKey: key }, 201)
  })

  app.get('/api/ops/creators/:id', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const item = await loadCreator(env.db, c.req.param('id'), true)
    if (!item) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json(item)
  })

  app.patch('/api/ops/creators/:id', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.write')
    if (denied) return denied
    const id = c.req.param('id')
    const body = await c.req.json()
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
    if (mutexCoop(body.categories)) return jsonError(c, 400, 'VALIDATION', 'coop_history_mutex')
    if (body.categories || body.collaborations || body.price) await saveRelations(env.db, id, body)
    if (body.names) {
      /* category patch uses names; ignore on creator */
    }
    await audit(env.db, user!.id, 'creator.update', 'creator', id, 'update')
    return c.json({ ok: true })
  })

  app.post('/api/ops/creators/:id/publish', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.publish')
    if (denied) return denied
    const id = c.req.param('id')
    const item = await loadCreator(env.db, id, true)
    if (!item) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    if (!item.displayName) return jsonError(c, 400, 'VALIDATION', 'incomplete')
    if (!(item.regions?.length || item.verticals?.length)) return jsonError(c, 400, 'VALIDATION', 'incomplete')
    if (item.followers == null && !item.followersUnknown) return jsonError(c, 400, 'VALIDATION', 'incomplete')
    await env.db.query(
      `UPDATE creators
       SET status = 'released', metrics_locked = metrics, updated_at = now()
       WHERE id = $1`,
      [id],
    )
    await env.db.query(`UPDATE assignments SET pool_gone = false WHERE creator_id = $1`, [id])
    await audit(env.db, user!.id, 'creator.publish', 'creator', id, item.displayName)
    return c.json({ ok: true, status: 'released' })
  })

  app.post('/api/ops/creators/:id/unpublish', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.publish')
    if (denied) return denied
    const id = c.req.param('id')
    await env.db.query(`UPDATE creators SET status = 'ready', updated_at = now() WHERE id = $1`, [id])
    await env.db.query(`UPDATE assignments SET pool_gone = true WHERE creator_id = $1`, [id])
    await audit(env.db, user!.id, 'creator.unpublish', 'creator', id, 'unpublish')
    return c.json({ ok: true, status: 'ready' })
  })

  app.get('/api/ops/categories', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT * FROM categories ORDER BY builtin DESC, slug`,
    )
    return c.json({ items: rows })
  })

  app.patch('/api/ops/categories/:slug', async (c) => {
    const { denied } = await requireAuth(c, 'ops.categories')
    if (denied) return denied
    const slug = c.req.param('slug')
    const body = await c.req.json()
    if (body.enabled === false && (slug === 'collaborated' || slug === 'never_collaborated')) {
      return jsonError(c, 400, 'VALIDATION', 'cannot_disable_builtin_coop')
    }
    if (body.names) {
      await env.db.query(
        `UPDATE categories SET
          name_zh = COALESCE($2, name_zh),
          name_en = COALESCE($3, name_en),
          name_ko = COALESCE($4, name_ko)
         WHERE slug = $1`,
        [slug, body.names['zh-CN'] ?? null, body.names.en ?? null, body.names.ko ?? null],
      )
      return c.json({ ok: true })
    }
    await env.db.query(
      `UPDATE categories SET
        name_zh = COALESCE($2, name_zh),
        name_en = COALESCE($3, name_en),
        name_ko = COALESCE($4, name_ko),
        enabled = COALESCE($5, enabled),
        frontend_visible = COALESCE($6, frontend_visible)
       WHERE slug = $1`,
      [slug, body.nameZh ?? null, body.nameEn ?? null, body.nameKo ?? null, body.enabled ?? null, body.frontendVisible ?? null],
    )
    return c.json({ ok: true })
  })

  app.get('/api/ops/review', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT r.*, c.display_name FROM reviews r JOIN creators c ON c.id = r.creator_id
       WHERE r.status = 'pending' ORDER BY r.created_at DESC`,
    )
    return c.json({ items: rows })
  })

  app.post('/api/ops/review/:id/pass', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.write')
    if (denied) return denied
    const id = c.req.param('id')
    const { rows } = await env.db.query('SELECT * FROM reviews WHERE id = $1', [id])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    await env.db.query(`UPDATE reviews SET status = 'passed' WHERE id = $1`, [id])
    await env.db.query(`UPDATE creators SET needs_review = false, status = 'ready' WHERE id = $1`, [
      rows[0].creator_id,
    ])
    await audit(env.db, user!.id, 'review.pass', 'review', id, 'pass')
    return c.json({ ok: true })
  })

  app.get('/api/ops/batches', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT j.*, s.name AS source_name FROM ingest_jobs j JOIN ingest_sources s ON s.id = j.source_id
       ORDER BY j.created_at DESC`,
    )
    return c.json({ items: rows })
  })

  app.post('/api/ops/batches', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.write')
    if (denied) return denied
    const ct = c.req.header('content-type') || ''
    if (ct.includes('multipart/form-data')) {
      const body = await c.req.parseBody()
      const upload = await readUpload(body.file)
      const batchName = String(body.batchName || body.batch_name || '')
      if (upload) {
        const job = await runWorkbookIngest(env, user!.id, {
          fileName: upload.name,
          batchName,
          buf: upload.buf,
        })
        return c.json(job, 201)
      }
    }
    const job = await runIngest(env, 'file-drop', 'once', 0.1, user!.id)
    return c.json(job, 201)
  })

  app.get('/api/select/pool', async (c) => {
    const { denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const q = c.req.query()
    const items = (await queryPool(env.db, q)).map(publicPoolRow)
    return c.json({ items, total: items.length })
  })

  app.get('/api/select/creators/:id', async (c) => {
    const { denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const item = await loadCreator(env.db, c.req.param('id'), false)
    if (!item || item.status !== 'released' || item.categories.includes('blacklist')) {
      return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    }
    const cohort = await queryPool(env.db, {})
    const enriched = enrichPoolItems([item], cohort.map((row) => row.metrics))[0]
    const raw = await env.db.query('SELECT 1 FROM creator_raw WHERE creator_id = $1 LIMIT 1', [item.id])
    return c.json({ ...publicPoolRow(enriched), rawAvailable: Boolean(raw.rowCount) })
  })

  app.get('/api/select/queries', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT * FROM saved_queries WHERE org_id IS NULL OR org_id = $1 ORDER BY updated_at DESC`,
      [user!.orgId],
    )
    return c.json({ items: rows.map(savedQueryFromRow) })
  })

  app.post('/api/select/queries/run', async (c) => {
    const { denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const body = await c.req.json().catch(() => null)
    const spec = coerceSavedQuery(body)
    const errors = validateSavedQuery(spec)
    if (errors.length) return c.json({ error: 'invalid', errors }, 400)
    const pool = await queryPool(env.db, {})
    const rows = applySavedQuery(pool.map(queryRow), spec)
    return c.json({ items: rows.map(publicQueryResultRow), total: rows.length })
  })

  app.post('/api/select/queries', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.write')
    if (denied) return denied
    const body = await c.req.json().catch(() => null)
    const id = randomUUID()
    const spec = coerceSavedQuery(body, id, 1)
    const errors = validateSavedQuery(spec)
    if (errors.length) return c.json({ error: 'invalid', errors }, 400)
    const { rows } = await env.db.query(
      `INSERT INTO saved_queries (id, org_id, name, version, spec, created_by)
       VALUES ($1,$2,$3,1,$4,$5) RETURNING *`,
      [id, user!.orgId, spec.name, JSON.stringify(spec), user!.id],
    )
    return c.json(savedQueryFromRow(rows[0]), 201)
  })

  app.get('/api/select/queries/:id', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT * FROM saved_queries WHERE id = $1 AND (org_id IS NULL OR org_id = $2)`,
      [c.req.param('id'), user!.orgId],
    )
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json(savedQueryFromRow(rows[0]))
  })

  app.patch('/api/select/queries/:id', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.write')
    if (denied) return denied
    const found = await env.db.query(
      `SELECT * FROM saved_queries WHERE id = $1 AND org_id = $2`,
      [c.req.param('id'), user!.orgId],
    )
    if (!found.rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    const current = savedQueryFromRow(found.rows[0])
    const patch = await c.req.json().catch(() => ({}))
    const spec = coerceSavedQuery({ ...current, ...patch }, current.id, current.version + 1)
    const errors = validateSavedQuery(spec)
    if (errors.length) return c.json({ error: 'invalid', errors }, 400)
    const { rows } = await env.db.query(
      `UPDATE saved_queries SET name = $3, version = $4, spec = $5, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [current.id, user!.orgId, spec.name, spec.version, JSON.stringify(spec)],
    )
    return c.json(savedQueryFromRow(rows[0]))
  })

  app.delete('/api/select/queries/:id', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.write')
    if (denied) return denied
    const result = await env.db.query('DELETE FROM saved_queries WHERE id = $1 AND org_id = $2', [
      c.req.param('id'),
      user!.orgId,
    ])
    if (!result.rowCount) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json({ ok: true })
  })

  app.get('/api/select/projects', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT p.*, (SELECT count(*) FROM assignments a WHERE a.project_id = p.id)::int AS member_count
       FROM projects p WHERE p.org_id = $1 AND p.status = 'open' ORDER BY p.updated_at DESC`,
      [user!.orgId],
    )
    return c.json({ items: rows })
  })

  app.post('/api/select/projects', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.write')
    if (denied) return denied
    const body = await c.req.json()
    if (!body.name) return jsonError(c, 400, 'name_required')
    const id = randomUUID()
    await env.db.query(
      `INSERT INTO projects (id, org_id, name, note) VALUES ($1,$2,$3,$4)`,
      [id, user!.orgId, body.name, body.note ?? null],
    )
    await audit(env.db, user!.id, 'project.create', 'project', id, body.name)
    return c.json({ id, name: body.name }, 201)
  })

  app.get('/api/select/projects/:id', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM projects WHERE id = $1 AND org_id = $2', [
      c.req.param('id'),
      user!.orgId,
    ])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    const assigned = await env.db.query(
      `SELECT a.id, a.creator_id, a.status, a.pool_gone, a.assigned_at,
              c.display_name, c.followers, c.creator_key, c.status AS creator_status,
              c.regions, c.verticals, c.needs_review, c.followers_unknown, c.avatar_key,
              c.metrics, c.metrics_locked, c.source, c.external_id, c.metrics_fetched_at
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1 ORDER BY a.assigned_at DESC`,
      [c.req.param('id')],
    )
    const meta = await attachCreatorMeta(
      env.db,
      assigned.rows.map((r) => ({
        id: r.creator_id,
        creator_key: r.creator_key,
        display_name: r.display_name,
        followers: r.followers,
        status: r.creator_status,
        regions: r.regions,
        verticals: r.verticals,
        needs_review: r.needs_review,
        followers_unknown: r.followers_unknown,
        avatar_key: r.avatar_key,
        metrics: r.metrics,
        metrics_locked: r.metrics_locked,
        source: r.source,
        external_id: r.external_id,
        metrics_fetched_at: r.metrics_fetched_at,
      })),
      false,
    )
    const pool = await queryPool(env.db, {})
    const enriched = enrichPoolItems(meta, pool.map((row) => row.metrics))
    return c.json({
      ...rows[0],
      assignments: enriched.map((item, index) => {
        const raw = assigned.rows[index]
        return {
          ...publicPoolRow(item),
          id: raw.id,
          creatorId: item.id,
          status: raw.status,
          poolGone: raw.pool_gone,
        }
      }),
    })
  })

  app.post('/api/select/projects/:id/assignments', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.assign')
    if (denied) return denied
    const projectId = c.req.param('id')
    const body = await c.req.json()
    const ids: string[] = body.creatorIds || []
    if (!ids.length) return jsonError(c, 400, 'empty')
    for (const rawId of ids) {
      let creatorId = rawId
      if (body.creatorKey || !(await loadCreator(env.db, rawId, false))) {
        const byKey = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [
          body.creatorKey || rawId,
        ])
        if (byKey.rows[0]) creatorId = byKey.rows[0].id
      }
      const creator = await loadCreator(env.db, creatorId, false)
      if (!creator || creator.status !== 'released' || creator.categories.includes('blacklist')) {
        return jsonError(c, 400, 'not_in_pool')
      }
      const exists = await env.db.query(
        'SELECT 1 FROM assignments WHERE project_id = $1 AND creator_id = $2',
        [projectId, creatorId],
      )
      if (exists.rowCount) return jsonError(c, 409, 'already_assigned')
      await env.db.query(
        `INSERT INTO assignments (id, project_id, creator_id, status, assigned_by)
         VALUES ($1,$2,$3,'assigned',$4)`,
        [randomUUID(), projectId, creatorId, user!.id],
      )
    }
    await env.db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId])
    await audit(env.db, user!.id, 'assignment.create', 'project', projectId, ids.join(','))
    return c.json({ ok: true })
  })

  app.delete('/api/select/projects/:id/assignments/:creatorId', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.assign')
    if (denied) return denied
    await env.db.query('DELETE FROM assignments WHERE project_id = $1 AND creator_id = $2', [
      c.req.param('id'),
      c.req.param('creatorId'),
    ])
    await env.db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [c.req.param('id')])
    await audit(env.db, user!.id, 'assignment.remove', 'project', c.req.param('id'), c.req.param('creatorId'))
    return c.json({ ok: true })
  })

  app.get('/api/select/shortlist', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT s.org_id, s.creator_id, s.added_at, c.display_name, c.followers, c.creator_key,
              c.status, c.regions, c.verticals, c.needs_review, c.followers_unknown, c.avatar_key,
              c.metrics, c.metrics_locked, c.source, c.external_id, c.metrics_fetched_at
       FROM shortlist_items s JOIN creators c ON c.id = s.creator_id
       WHERE s.org_id = $1 ORDER BY s.added_at DESC`,
      [user!.orgId],
    )
    const meta = await attachCreatorMeta(
      env.db,
      rows.map((r) => ({
        id: r.creator_id,
        creator_key: r.creator_key,
        display_name: r.display_name,
        followers: r.followers,
        status: r.status,
        regions: r.regions,
        verticals: r.verticals,
        needs_review: r.needs_review,
        followers_unknown: r.followers_unknown,
        avatar_key: r.avatar_key,
        metrics: r.metrics,
        metrics_locked: r.metrics_locked,
        source: r.source,
        external_id: r.external_id,
        metrics_fetched_at: r.metrics_fetched_at,
      })),
      false,
    )
    const pool = await queryPool(env.db, {})
    const enriched = enrichPoolItems(meta, pool.map((row) => row.metrics))
    return c.json({
      items: enriched.map((item, index) => {
        return {
          ...publicPoolRow(item),
          org_id: rows[index].org_id,
          creator_id: item.id,
          creatorId: item.id,
          display_name: item.displayName,
          added_at: rows[index].added_at,
          addedAt: rows[index].added_at,
        }
      }),
    })
  })

  app.post('/api/select/shortlist', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.write')
    if (denied) return denied
    const body = await c.req.json()
    await env.db.query(
      `INSERT INTO shortlist_items (org_id, creator_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [user!.orgId, body.creatorId],
    )
    return c.json({ ok: true })
  })

  app.get('/api/select/projects/:id/export', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT c.display_name, c.metrics, c.followers, a.status
       FROM assignments a JOIN creators c ON c.id = a.creator_id
       WHERE a.project_id = $1`,
      [c.req.param('id')],
    )
    const columns = DEFAULT_QUERY_COLUMNS
    const header = ['display_name', ...columns, 'status'].join(',') + '\n'
    const csv = header + rows.map((r) => {
      const metrics = metricsFromRow(r)
      return [csvCell(r.display_name), ...columns.map((key) => metrics[key] ?? ''), csvCell(r.status)].join(',')
    }).join('\n')
    return c.body(csv, 200, { 'content-type': 'text/csv; charset=utf-8' })
  })

  app.get('/api/dev/health', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    const jobs = await env.db.query(
      `SELECT status, count(*)::int AS n FROM ingest_jobs GROUP BY status`,
    )
    const sources = await env.db.query(`SELECT count(*) FILTER (WHERE enabled)::int AS enabled FROM ingest_sources`)
    const total = await env.db.query(`SELECT count(*)::int AS n FROM ingest_jobs`)
    return c.json({
      ok: true,
      jobs: jobs.rows,
      sourcesEnabled: sources.rows[0].enabled,
      jobCount: Number(total.rows[0].n),
    })
  })

  app.get('/api/dev/jobs', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(`SELECT * FROM ingest_jobs ORDER BY updated_at DESC`)
    return c.json({ items: rows })
  })

  app.get('/api/dev/jobs/:id', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [c.req.param('id')])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json(rows[0])
  })

  app.post('/api/dev/jobs/:id/retry', async (c) => {
    const { user, denied } = await requireAuth(c, 'dev.retry')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [c.req.param('id')])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    const next = await runIngest(env, rows[0].source_id, rows[0].schedule, Number(rows[0].sample_rate), user!.id, rows[0])
    return c.json(next)
  })

  app.get('/api/dev/failures', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(`SELECT * FROM ingest_jobs WHERE status = 'failed' ORDER BY updated_at DESC`)
    return c.json({ items: rows })
  })

  app.get('/api/dev/pipeline', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(`
      SELECT
        (SELECT count(*) FROM ingest_sources WHERE enabled)::int AS sources,
        (SELECT count(*) FROM ingest_jobs)::int AS jobs,
        (SELECT count(*) FROM creators WHERE needs_review)::int AS review,
        (SELECT count(*) FROM creators WHERE status = 'released')::int AS released
    `)
    return c.json(rows[0])
  })

  app.get('/api/dev/audit', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`)
    return c.json({ items: rows })
  })

  app.get('/api/dev/i18n-theme', async (c) => {
    const { denied } = await requireAuth(c, 'dev.read')
    if (denied) return denied
    return c.json({ locales: ['zh-CN', 'en', 'ko'], themes: ['light', 'dark', 'system'] })
  })

  app.get('/api/ingest/sources', async (c) => {
    const { denied } = await requireAuth(c, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query(`SELECT * FROM ingest_sources ORDER BY name`)
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        adapterType: r.adapter_type,
        enabled: r.enabled,
        rateLimit: r.rate_limit,
        quota: r.quota,
      })),
    })
  })

  app.get('/api/ingest/adapters', async (c) => {
    const { denied } = await requireAuth(c, 'ingest.read')
    if (denied) return denied
    return c.json({ items: adapterDescriptions() })
  })

  app.post('/api/ingest/fetch', async (c) => {
    const { user, denied } = await requireAuth(c, 'ingest.write')
    if (denied) return denied
    const query = await c.req.json().catch(() => null) as SourceQuery | null
    if (!query || !SOURCE_IDS.includes(query.source) || ![30, 90].includes(query.window)) {
      return jsonError(c, 400, 'SOURCE-INVALID', 'invalid_source_query')
    }
    const job = await runAdapterIngest(env, query, user!.id)
    return c.json(job, 201)
  })

  app.get('/api/ingest/raw/:creatorId', async (c) => {
    const { denied } = await requireAuth(c, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT id, creator_id, source, external_id, fetched_at, payload
       FROM creator_raw WHERE creator_id = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [c.req.param('creatorId')],
    )
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    const row = rows[0]
    return c.json({
      id: row.id,
      creatorId: row.creator_id,
      source: row.source,
      externalId: row.external_id,
      fetchedAt: row.fetched_at,
      payload: row.payload,
    })
  })

  app.get('/api/ingest/jobs', async (c) => {
    const { denied } = await requireAuth(c, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query(`SELECT * FROM ingest_jobs ORDER BY created_at DESC`)
    return c.json({ items: camelJobs(rows) })
  })

  app.post('/api/ingest/jobs', async (c) => {
    const { user, denied } = await requireAuth(c, 'ingest.write')
    if (denied) return denied
    const body = await c.req.json()
    if (body.sourceUrl) return jsonError(c, 400, 'SOURCE-INVALID', 'adhoc_url_forbidden')
    const source = await env.db.query('SELECT * FROM ingest_sources WHERE id = $1', [body.sourceId])
    if (!source.rows[0]) return jsonError(c, 400, 'SOURCE-INVALID', 'source_missing')
    if (!source.rows[0].enabled) return jsonError(c, 400, 'SOURCE-INVALID', 'source_disabled')
    const job = await runIngest(env, body.sourceId, body.schedule || 'once', body.sampleRate ?? 0.1, user!.id)
    return c.json(job, 201)
  })

  app.get('/api/ingest/jobs/:id', async (c) => {
    const { denied } = await requireAuth(c, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [c.req.param('id')])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json(camelJobs(rows)[0])
  })

  app.get('/api/ingest/jobs/:id/sample', async (c) => {
    const { denied } = await requireAuth(c, 'ingest.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      `SELECT id, display_name, needs_review FROM creators WHERE last_ingest_job_id = $1`,
      [c.req.param('id')],
    )
    return c.json({ items: rows })
  })

  app.post('/api/assets/presign', async (c) => {
    const { denied } = await requireAuth(c, 'ops.write')
    if (denied) return denied
    const body = await c.req.json()
    const purpose = body.purpose === 'attachment' ? 'attachments' : 'avatars'
    const key = `${purpose}/${randomUUID()}`
    const signed = await env.store.presign(key, body.contentType || 'application/octet-stream')
    const publicUrl = assetPublicUrl(key)
    await env.db.query(
      `INSERT INTO assets (key, url, content_type, size) VALUES ($1,$2,$3,0)
       ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url`,
      [key, publicUrl, body.contentType || 'application/octet-stream'],
    )
    return c.json({ url: signed.url || publicUrl, key })
  })

  app.get('/api/assets/raw/*', async (c) => {
    const key = decodeURIComponent(c.req.path.replace('/api/assets/raw/', ''))
    const { rows } = await env.db.query('SELECT * FROM assets WHERE key = $1', [key])
    if (!rows[0]?.bytes) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return new Response(rows[0].bytes, {
      headers: { 'content-type': rows[0].content_type || 'application/octet-stream' },
    })
  })

  app.post('/api/assets', async (c) => {
    const { user, denied } = await requireAuth(c, 'ops.write')
    if (denied) return denied
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return jsonError(c, 400, 'VALIDATION', 'file_required')
    const purpose = String(body.purpose || 'avatar') === 'attachment' ? 'attachments' : 'avatars'
    const key = `${purpose}/${randomUUID()}`
    const buf = Buffer.from(await file.arrayBuffer())
    const stored = await env.store.put(key, buf, file.type || 'image/png')
    const publicUrl = stored.url || assetPublicUrl(key)
    await env.db.query(
      `INSERT INTO assets (key, url, content_type, size, bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (key) DO UPDATE SET bytes = EXCLUDED.bytes, size = EXCLUDED.size, url = EXCLUDED.url`,
      [key, publicUrl, file.type || 'image/png', buf.length, buf, user!.id],
    )
    return c.json({ url: publicUrl, key }, 201)
  })

  app.get('/api/assets', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT key, url, content_type, size FROM assets ORDER BY key')
    return c.json({
      items: rows.map((r) => ({
        key: r.key,
        url: r.url,
        contentType: r.content_type,
        size: Number(r.size),
      })),
    })
  })

  app.get('/api/assets/:key{.+}', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const key = decodeURIComponent(c.req.param('key'))
    const { rows } = await env.db.query('SELECT key, url, content_type, size FROM assets WHERE key = $1', [key])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json({
      key: rows[0].key,
      url: rows[0].url,
      contentType: rows[0].content_type,
      size: Number(rows[0].size),
    })
  })

  app.get('/api/kcs/creators', async (c) => {
    const { denied } = await requireAuth(c, 'ops.read')
    if (denied) return denied
    const { rows } = await env.db.query(`SELECT * FROM creators ORDER BY updated_at DESC`)
    return c.json({ items: await attachCreatorMeta(env.db, rows, true) })
  })

  app.post('/api/kcs/assignments', async (c) => {
    const { user, denied } = await requireAuth(c, 'select.assign')
    if (denied) return denied
    const body = await c.req.json()
    const projectId = String(body.projectId || '')
    let creatorId = body.creatorId ? String(body.creatorId) : ''
    if (!creatorId && body.creatorKey) {
      const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [body.creatorKey])
      creatorId = found.rows[0]?.id
    }
    const res = await app.request(`/api/select/projects/${projectId}/assignments`, {
      method: 'POST',
      headers: {
        authorization: c.req.header('authorization') || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ creatorIds: [creatorId] }),
    })
    return res
  })

  app.post('/api/ingest/jobs/:id/retry', async (c) => {
    const { user, denied } = await requireAuth(c, 'ingest.retry')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [c.req.param('id')])
    if (!rows[0]) return jsonError(c, 404, 'NOT-FOUND', 'not_found')
    return c.json(await runIngest(env, rows[0].source_id, rows[0].schedule, Number(rows[0].sample_rate), user!.id, rows[0]))
  })

  return app
}

function assetPublicUrl(key: string) {
  const base = (process.env.API_PUBLIC_URL || 'http://localhost:7100').replace(/\/$/, '')
  return `${base}/api/assets/raw/${key}`
}

function mutexCoop(categories: unknown): boolean {
  if (!Array.isArray(categories)) return false
  return categories.includes('collaborated') && categories.includes('never_collaborated')
}

function publicPoolRow(item: Record<string, any>) {
  return {
    id: item.id,
    creatorKey: item.creatorKey,
    displayName: item.displayName,
    followers: item.followers,
    followersUnknown: item.followersUnknown,
    regions: item.regions,
    verticals: item.verticals,
    categories: item.categories,
    hasCollaborated: item.hasCollaborated,
    collabCount: item.collabCount,
    collabBrands: item.collabBrands,
    price: item.price,
    source: item.source,
    externalId: item.externalId,
    metricsFetchedAt: item.metricsFetchedAt,
    tier: item.tier,
    metrics: item.metrics,
    percentiles: item.percentiles,
    health: item.metrics.health,
    metricsLocked: item.metricsLocked,
  }
}

function camelJobs(rows: Array<Record<string, unknown>>) {
  return rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    schedule: r.schedule,
    status: r.status,
    attempt: Number(r.attempt),
    writtenCount: Number(r.written_count),
    skippedDupes: Number(r.skipped_dupes),
    failedCount: Number(r.failed_count),
    errorCode: r.error_code,
    errorSummary: r.error_summary,
    sampleRate: Number(r.sample_rate),
    fileName: r.file_name ?? null,
    batchName: r.batch_name ?? null,
    sourceRows: r.source_rows == null ? null : Number(r.source_rows),
    query: r.query ?? null,
    sourceMode: r.source_mode ?? null,
  }))
}

async function readUpload(file: unknown): Promise<{ name: string; buf: Buffer } | null> {
  if (!file || typeof file !== 'object') return null
  const blob = file as { name?: string; arrayBuffer?: () => Promise<ArrayBuffer> }
  if (typeof blob.arrayBuffer !== 'function') return null
  const buf = Buffer.from(await blob.arrayBuffer())
  if (!buf.length) return null
  return { name: blob.name || 'upload.xlsx', buf }
}

async function runWorkbookIngest(
  env: AppEnv,
  openedBy: string,
  input: { fileName: string; batchName: string; buf: Buffer },
) {
  const id = randomUUID()
  const rows = parseXlsx(input.buf)
  await env.store.put(`batches/${id}/${input.fileName}`, input.buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  await env.db.query(
    `INSERT INTO ingest_jobs
      (id, source_id, schedule, status, attempt, sample_rate, opened_by, started_at, file_name, batch_name, source_rows)
     VALUES ($1,'file-drop','once','running',0,0.1,$2,now(),$3,$4,$5)`,
    [id, openedBy, input.fileName, input.batchName || input.fileName, rows.length],
  )
  let written = 0
  let skipped = 0
  let failed = 0
  for (const row of rows) {
    try {
      const persisted = await persistSheetRow(env, id, row)
      if (persisted === 'written') written += 1
      else if (persisted === 'skipped') skipped += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }
  await env.db.query(
    `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3, failed_count = $4,
       ended_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, written, skipped, failed],
  )
  const { rows: jobs } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return camelJobs(jobs)[0]
}

async function persistSheetRow(env: AppEnv, jobId: string, row: SheetRow): Promise<'written' | 'skipped' | 'failed'> {
  const displayName = row.displayName || row.xhsId || row.userId
  if (!displayName) return 'failed'
  const key = creatorKeyFromRow(row) || `ck_${randomUUID().slice(0, 8)}`
  const followers = row.followers ? Number(String(row.followers).replace(/[^\d.]/g, '')) : null
  const price = row.price ? Number(String(row.price).replace(/[^\d.]/g, '')) : null
  const regions = row.region ? [row.region] : []
  const verticals = [row.vertical, row.keywords, row.persona].filter(Boolean) as string[]
  const metrics = deriveMetrics({ ...emptyMetrics(), followers, priceImage: price })
  const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [key])
  if (found.rows[0]) {
    await env.db.query(
      `UPDATE creators SET
        display_name = $2, followers = COALESCE($3, followers), regions = $4, verticals = $5,
        metrics = $6, metrics_window = 30, metrics_fetched_at = now(),
        xhs_id = COALESCE($7, xhs_id), last_ingest_job_id = $8, needs_review = true, updated_at = now()
       WHERE creator_key = $1`,
      [key, displayName, Number.isFinite(followers) ? followers : null, regions, verticals, JSON.stringify(metrics), row.xhsId || null, jobId],
    )
    return 'skipped'
  }
  const creatorId = randomUUID()
  await env.db.query(
    `INSERT INTO creators
      (id, creator_key, display_name, status, needs_review, followers, followers_unknown, regions, verticals,
       metrics, metrics_window, metrics_fetched_at, xhs_id, last_ingest_job_id, note)
     VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,30,now(),$9,$10,$11)`,
    [
      creatorId,
      key,
      displayName,
      Number.isFinite(followers) ? followers : null,
      followers == null,
      regions,
      verticals,
      JSON.stringify(metrics),
      row.xhsId || null,
      jobId,
      row.persona || null,
    ],
  )
  await env.db.query(
    `INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,'never_collaborated')`,
    [creatorId],
  )
  if (price != null && Number.isFinite(price)) {
    await saveRelations(env.db, creatorId, { price: { amountMin: price, currency: 'CNY' } })
  }
  await env.db.query(
    `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
     VALUES ($1,$2,'low','文件投递待校对','pending')`,
    [randomUUID(), creatorId],
  )
  return 'written'
}

async function saveRelations(db: Db, creatorId: string, body: Record<string, unknown>) {
  if (Array.isArray(body.categories)) {
    await db.query('DELETE FROM creator_categories WHERE creator_id = $1', [creatorId])
    for (const slug of body.categories as string[]) {
      await db.query(
        'INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [creatorId, slug],
      )
    }
  }
  if (Array.isArray(body.collaborations)) {
    await db.query('DELETE FROM collaborations WHERE creator_id = $1', [creatorId])
    for (const col of body.collaborations as Array<{ brand: string; happenedAt?: string; note?: string }>) {
      await db.query(
        `INSERT INTO collaborations (id, creator_id, brand, happened_at, note) VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), creatorId, col.brand, col.happenedAt ?? null, col.note ?? null],
      )
    }
  }
  if (body.price && typeof body.price === 'object') {
    const price = body.price as { amountMin?: number; amountMax?: number; currency?: string; unit?: string }
    await db.query('DELETE FROM prices WHERE creator_id = $1', [creatorId])
    await db.query(
      `INSERT INTO prices (id, creator_id, amount_min, amount_max, currency, unit)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        creatorId,
        price.amountMin ?? null,
        price.amountMax ?? null,
        price.currency ?? 'CNY',
        price.unit ?? 'per_post',
      ],
    )
  }
}

async function attachCreatorMeta(
  db: Db,
  rows: Array<Record<string, unknown>>,
  full: boolean,
): Promise<Array<Record<string, any>>> {
  const ids = rows.map((r) => r.id)
  if (!ids.length) return []
  const cats = await db.query(
    `SELECT creator_id, category_slug FROM creator_categories WHERE creator_id = ANY($1)`,
    [ids],
  )
  const cols = await db.query(`SELECT * FROM collaborations WHERE creator_id = ANY($1)`, [ids])
  const prices = await db.query(`SELECT * FROM prices WHERE creator_id = ANY($1)`, [ids])
  return rows.map((r) => {
    const categories = cats.rows.filter((x) => x.creator_id === r.id).map((x) => x.category_slug)
    const collaborations = cols.rows.filter((x) => x.creator_id === r.id)
    const price = prices.rows.find((x) => x.creator_id === r.id)
    const metrics = metricsFromRow({ ...r, price })
    return {
      id: r.id,
      creatorKey: r.creator_key,
      displayName: r.display_name,
      status: r.status,
      needsReview: r.needs_review,
      followers: r.followers === null ? null : Number(r.followers),
      followersUnknown: r.followers_unknown,
      regions: r.regions,
      verticals: r.verticals,
      avatarKey: r.avatar_key ?? null,
      xhsId: r.xhs_id ?? null,
      qcNotes: r.qc_notes ?? null,
      note: r.note ?? null,
      label: r.label ?? null,
      categories,
      hasCollaborated: collaborations.length > 0,
      collabCount: collaborations.length,
      collabBrands: collaborations.map((x) => x.brand),
      source: r.source ?? null,
      externalId: r.external_id ?? null,
      metrics,
      metricsLocked: parseMetrics(r.metrics_locked),
      metricsFetchedAt: r.metrics_fetched_at ?? null,
      collaborations: full ? collaborations : undefined,
      price: price
        ? {
            amountMin: price.amount_min == null ? null : Number(price.amount_min),
            amountMax: price.amount_max == null ? null : Number(price.amount_max),
            currency: price.currency,
            unit: price.unit,
          }
        : null,
    }
  })
}

async function loadCreator(db: Db, id: string, full: boolean) {
  const { rows } = await db.query('SELECT * FROM creators WHERE id = $1', [id])
  if (!rows[0]) return null
  const [item] = await attachCreatorMeta(db, rows, full)
  return item
}

function parseMetrics(value: unknown): CreatorMetrics | null {
  if (!value) return null
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object') return null
    return deriveMetrics({ ...emptyMetrics((parsed as CreatorMetrics).window === 90 ? 90 : 30), ...(parsed as CreatorMetrics) })
  } catch {
    return null
  }
}

function metricsFromRow(row: Record<string, any>): CreatorMetrics {
  const metrics = parseMetrics(row.metrics) ?? emptyMetrics()
  if (metrics.followers == null && row.followers != null) metrics.followers = Number(row.followers)
  if (metrics.priceImage == null && row.price?.amount_min != null) metrics.priceImage = Number(row.price.amount_min)
  return deriveMetrics(metrics)
}

function enrichPoolItems(
  items: Array<Record<string, any>>,
  cohortMetrics?: CreatorMetrics[],
): Array<Record<string, any>> {
  const allMetrics = cohortMetrics ?? items.map((item) => item.metrics as CreatorMetrics)
  const byTier = new Map<string, CreatorMetrics[]>()
  for (const metrics of allMetrics) {
    const tier = tierOf(metrics.followers)
    byTier.set(tier, [...(byTier.get(tier) ?? []), metrics])
  }
  return items.map((item) => {
    const metrics = item.metrics as CreatorMetrics
    const tier = tierOf(metrics.followers)
    return {
      ...item,
      followers: metrics.followers,
      tier,
      metrics,
      percentiles: cohortPercentiles(metrics, byTier.get(tier) ?? []),
    }
  })
}

function coerceSavedQuery(value: unknown, id?: string, version?: number): SavedQuery {
  const input = value && typeof value === 'object' ? value as Partial<SavedQuery> : {}
  return defaultSavedQuery({
    ...input,
    id: id ?? input.id ?? '',
    version: version ?? input.version ?? 1,
    name: typeof input.name === 'string' ? input.name : '',
  })
}

function coerceSourceQuery(value: unknown, source: SourceId): SourceQuery {
  let parsed = value
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      parsed = null
    }
  }
  const input = parsed && typeof parsed === 'object' ? parsed as Partial<SourceQuery> : {}
  return { ...input, source, window: input.window === 90 ? 90 : 30 }
}

function savedQueryFromRow(row: Record<string, any>): SavedQuery {
  const spec = coerceSavedQuery(row.spec, String(row.id), Number(row.version))
  spec.name = String(row.name)
  return spec
}

function queryRow(item: Record<string, any>) {
  return {
    id: String(item.id),
    creatorKey: String(item.creatorKey),
    displayName: String(item.displayName),
    source: item.source as SourceId,
    regions: item.regions as string[],
    coopBrands: [...new Set([...(item.metrics.coopBrands ?? []), ...(item.collabBrands ?? [])])] as string[],
    metrics: item.metrics as CreatorMetrics,
  }
}

function publicQueryResultRow(item: Record<string, any>) {
  return { ...item, health: item.metrics.health }
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

async function queryPool(db: Db, q: Record<string, string>) {
  const { rows } = await db.query(`SELECT * FROM creators WHERE status = 'released'`)
  const visible = (await attachCreatorMeta(db, rows, false)).filter((item) => !item.categories.includes('blacklist'))
  let items = enrichPoolItems(visible)
  if (q.hasCollaborated === 'true') items = items.filter((i) => i.hasCollaborated)
  if (q.hasCollaborated === 'false') items = items.filter((i) => !i.hasCollaborated)
  if (q.priceMin || q.priceMax) {
    const min = q.priceMin ? Number(q.priceMin) : 0
    const max = q.priceMax ? Number(q.priceMax) : Number.MAX_SAFE_INTEGER
    items = items.filter((i) => {
      if (!i.price) return false
      const lo = i.price.amountMin ?? i.price.amountMax ?? 0
      const hi = i.price.amountMax ?? i.price.amountMin ?? lo
      if (q.currency && i.price.currency !== q.currency) return false
      return lo <= max && hi >= min
    })
  }
  if (q.categories) {
    const wanted = q.categories.split(',')
    items = items.filter((i) => wanted.some((w) => i.categories.includes(w)))
  }
  if (q.category) {
    const wanted = q.category.split(',')
    items = items.filter((i) => wanted.some((w) => i.categories.includes(w) || i.verticals.includes(w)))
  }
  if (q.verticals) {
    const wanted = q.verticals.split(',')
    items = items.filter((i) => wanted.some((w) => (i.verticals as string[]).includes(w)))
  }
  if (q.collabCountMin) items = items.filter((i) => i.collabCount >= Number(q.collabCountMin))
  if (q.collabCountMax) items = items.filter((i) => i.collabCount <= Number(q.collabCountMax))
  if (q.tier) {
    const wanted = q.tier.split(',')
    items = items.filter((i) => wanted.includes(i.tier))
  }
  if (q.health) {
    const wanted = q.health.split(',')
    items = items.filter((i) => i.metrics.health != null && wanted.includes(i.metrics.health))
  }
  if (q.source) {
    const wanted = q.source.split(',')
    items = items.filter((i) => i.source != null && wanted.includes(i.source))
  }
  if (q.region) {
    const wanted = q.region.split(',').map((x) => x.toLowerCase())
    items = items.filter((i) => i.regions.some((region: string) => wanted.some((x) => region.toLowerCase().includes(x))))
  }
  if (q.brand) {
    const wanted = q.brand.split(',').map((w) => w.toLowerCase()).filter(Boolean)
    items = items.filter((i) => {
      const blob = [
        ...(i.collabBrands || []),
        ...((i.verticals as string[]) || []),
        i.displayName,
        ...(i.categories || []),
      ]
        .join(' ')
        .toLowerCase()
      return wanted.some((w) => blob.includes(w))
    })
  }
  if (q.q) {
    const needle = q.q.toLowerCase()
    items = items.filter((i) =>
      [i.displayName, i.creatorKey, ...i.regions, ...i.verticals, ...i.collabBrands]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }
  for (const key of METRIC_KEYS) {
    const min = q[`${key}Min`]
    const max = q[`${key}Max`]
    if (min != null && min !== '') items = items.filter((i) => i.metrics[key] != null && i.metrics[key]! >= Number(min))
    if (max != null && max !== '') items = items.filter((i) => i.metrics[key] != null && i.metrics[key]! <= Number(max))
  }
  const sort = q.sort === 'followers' || METRIC_KEYS.includes(q.sort as NumericMetricKey)
    ? q.sort as NumericMetricKey
    : 'cpe'
  const order = (q.order ?? (sort === 'cpe' ? 'asc' : 'desc')) === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const av = a.metrics[sort]
    const bv = b.metrics[sort]
    if (av == null && bv == null) return compareFollowersDesc(a, b)
    if (av == null) return 1
    if (bv == null) return -1
    if (av !== bv) return (av - bv) * order
    return compareFollowersDesc(a, b)
  })
  return items
}

function compareFollowersDesc(a: Record<string, any>, b: Record<string, any>) {
  if (a.followers == null && b.followers == null) return 0
  if (a.followers == null) return 1
  if (b.followers == null) return -1
  return b.followers - a.followers
}

async function runAdapterIngest(
  env: AppEnv,
  query: SourceQuery,
  openedBy: string,
  existing?: Record<string, unknown>,
) {
  const adapter = getAdapter(query.source)
  if (!adapter) throw new Error(`unsupported adapter: ${query.source}`)
  await env.db.query(
    `INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, owner)
     VALUES ($1,$2,$1,true,60,1000,'ops') ON CONFLICT (id) DO NOTHING`,
    [query.source, query.source === 'pugongying' ? '蒲公英' : query.source === 'qiangua' ? '千瓜' : '新红'],
  )
  const id = existing ? String(existing.id) : randomUUID()
  const attempt = existing ? Number(existing.attempt) + 1 : 0
  if (existing) {
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'running', attempt = $2, query = $3, started_at = now(),
       ended_at = NULL, error_code = NULL, error_summary = NULL, updated_at = now() WHERE id = $1`,
      [id, attempt, JSON.stringify(query)],
    )
  } else {
    await env.db.query(
      `INSERT INTO ingest_jobs
       (id, source_id, schedule, status, attempt, sample_rate, opened_by, query, started_at)
       VALUES ($1,$2,'once','running',$3,1,$4,$5,now())`,
      [id, query.source, attempt, openedBy, JSON.stringify(query)],
    )
  }

  let written = 0
  let skipped = 0
  let failed = 0
  let sourceMode: 'live' | 'fixture' = 'live'
  try {
    const page = await adapter.fetch(query)
    sourceMode = (page as { sourceMode?: 'live' | 'fixture' }).sourceMode ?? 'live'
    for (const raw of page.records) {
      const normalized = adapter.normalize(raw)
      if (!normalized.ok) {
        failed += 1
        continue
      }
      try {
        const creator = normalized.creator
        const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [creator.creatorKey])
        const creatorId = found.rows[0]?.id ?? randomUUID()
        await env.db.query(
          `INSERT INTO creators (
             id, creator_key, display_name, status, needs_review, followers, followers_unknown,
             regions, verticals, xhs_id, metrics, metrics_window, source, external_id,
             metrics_fetched_at, last_ingest_job_id
           ) VALUES ($1,$2,$3,'draft',true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (creator_key) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             needs_review = true,
             followers = EXCLUDED.followers,
             followers_unknown = EXCLUDED.followers_unknown,
             regions = EXCLUDED.regions,
             verticals = EXCLUDED.verticals,
             xhs_id = EXCLUDED.xhs_id,
             metrics = EXCLUDED.metrics,
             metrics_window = EXCLUDED.metrics_window,
             source = EXCLUDED.source,
             external_id = EXCLUDED.external_id,
             metrics_fetched_at = EXCLUDED.metrics_fetched_at,
             last_ingest_job_id = EXCLUDED.last_ingest_job_id,
             updated_at = now()
           RETURNING id`,
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
            query.source,
            creator.externalId,
            raw.fetchedAt,
            id,
          ],
        )
        const persistedId = found.rows[0]?.id ?? creatorId
        await env.db.query(
          `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [randomUUID(), persistedId, query.source, raw.externalId, raw.fetchedAt, JSON.stringify(raw.payload)],
        )
        if (found.rows[0]) skipped += 1
        else written += 1
      } catch {
        failed += 1
      }
    }
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3,
       failed_count = $4, source_mode = $5, ended_at = now(), updated_at = now() WHERE id = $1`,
      [id, written, skipped, failed, sourceMode],
    )
  } catch (error) {
    failed += 1
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'failed', failed_count = $2, source_mode = $3,
       error_code = 'SOURCE_UNAVAILABLE', error_summary = $4, ended_at = now(), updated_at = now()
       WHERE id = $1`,
      [id, failed, sourceMode, error instanceof Error ? error.message.slice(0, 240) : 'source unavailable'],
    )
  }
  const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return camelJobs(rows)[0]
}

async function runIngest(
  env: AppEnv,
  sourceId: string,
  schedule: string,
  sampleRate: number,
  openedBy: string,
  existing?: Record<string, unknown>,
) {
  const source = await env.db.query('SELECT adapter_type FROM ingest_sources WHERE id = $1', [sourceId])
  const adapter = getAdapter(String(source.rows[0]?.adapter_type ?? sourceId))
  if (adapter) {
    const storedQuery = existing?.query
    const query = coerceSourceQuery(storedQuery, adapter.id)
    return runAdapterIngest(env, query, openedBy, existing)
  }
  const id = existing ? String(existing.id) : randomUUID()
  const attempt = existing ? Number(existing.attempt) + 1 : 0
  if (!existing) {
    await env.db.query(
      `INSERT INTO ingest_jobs (id, source_id, schedule, status, attempt, sample_rate, opened_by, started_at)
       VALUES ($1,$2,$3,'running',$4,$5,$6,now())`,
      [id, sourceId, schedule, attempt, sampleRate, openedBy],
    )
  } else {
    await env.db.query(
      `UPDATE ingest_jobs SET status = 'running', attempt = $2, started_at = now(), error_summary = null WHERE id = $1`,
      [id, attempt],
    )
  }
  const key = `ingest_${id.slice(0, 8)}`
  const found = await env.db.query('SELECT id FROM creators WHERE creator_key = $1', [key])
  let written = 0
  let skipped = 0
  if (found.rows[0]) {
    skipped = 1
    await env.db.query(
      `UPDATE creators SET needs_review = true, last_ingest_job_id = $2, updated_at = now() WHERE creator_key = $1`,
      [key, id],
    )
  } else {
    const creatorId = randomUUID()
    await env.db.query(
      `INSERT INTO creators (id, creator_key, display_name, status, needs_review, followers_unknown, regions, last_ingest_job_id)
       VALUES ($1,$2,$3,'draft',true,true,$4,$5)`,
      [creatorId, key, `投递达人 ${id.slice(0, 4)}`, ['서울'], id],
    )
    await env.db.query(
      `INSERT INTO creator_categories (creator_id, category_slug) VALUES ($1,'never_collaborated')`,
      [creatorId],
    )
    await env.db.query(
      `INSERT INTO reviews (id, creator_id, risk_level, conclusion, status)
       VALUES ($1,$2,'low','自动写入待校对','pending')`,
      [randomUUID(), creatorId],
    )
    written = 1
  }
  await env.db.query(
    `UPDATE ingest_jobs SET status = 'ok', written_count = $2, skipped_dupes = $3, ended_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, written, skipped],
  )
  const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [id])
  return camelJobs(rows)[0]
}
