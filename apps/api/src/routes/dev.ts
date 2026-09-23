import {
  DEAD_LETTER_KINDS,
  DEAD_LETTER_MAX_REPLAYS,
  DEAD_LETTER_STATES,
  parsePaging,
  type DeadLetterState,
  type SourceQuery,
} from '@kcs/contract'
import { audit } from '../http/audit'
import { camelJobs } from '../http/creators'
import { pageRows } from '../http/lists'
import { jsonError } from '../http/responses'
import type { AppEnv, KcsApp, RouteHelpers } from '../http/types'
import { camelDeadLetters, scrub } from '../ingest/dead-letters'
import { retryJob } from '../ingest/jobs'
import { enqueueIngestJob, replayRecord } from '../ingest/worker'

async function resolveDeadLetter(
  env: AppEnv,
  id: string,
  state: DeadLetterState,
  actorId: string,
  replayJobId: string | null,
) {
  const { rows } = await env.db.query(
    `UPDATE ingest_dead_letters SET state = $2, replay_count = replay_count + 1,
       replay_job_id = COALESCE($4, replay_job_id), resolved_at = now(), resolved_by = $3,
       updated_at = now() WHERE id = $1 RETURNING *`,
    [id, state, actorId, replayJobId],
  )
  return camelDeadLetters(rows)[0]
}

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
    const parked = await env.db.query(
      `SELECT count(*) FILTER (WHERE kind = 'job')::int AS jobs,
              count(*) FILTER (WHERE kind = 'record')::int AS records
         FROM ingest_dead_letters WHERE state = 'open'`,
    )
    // Who is draining right now, if anyone. One claim at a time by design.
    const active = await env.db.query(
      `SELECT source_id, locked_by, lease_expires_at FROM ingest_jobs
        WHERE status = 'running' AND lease_expires_at > now()
        ORDER BY started_at LIMIT 5`,
    )
    return context.json({
      ok: true,
      jobs: jobs.rows,
      sourcesEnabled: sources.rows[0].enabled,
      jobCount: Number(total.rows[0].n),
      deadLetters: {
        jobs: Number(parked.rows[0].jobs),
        records: Number(parked.rows[0].records),
        total: Number(parked.rows[0].jobs) + Number(parked.rows[0].records),
      },
      running: active.rows.map((row) => ({
        sourceId: row.source_id,
        lockedBy: row.locked_by,
        leaseExpiresAt: row.lease_expires_at,
      })),
    })
  })

  app.get('/api/dev/jobs', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const paging = parsePaging(context.req.query())
    const { rows, total } = await pageRows(
      env.db,
      { columns: '*', from: 'FROM ingest_jobs', order: 'updated_at DESC, id COLLATE "C"' },
      [],
      paging,
    )
    return context.json({ items: camelJobs(rows), total, page: paging.page, pageSize: paging.pageSize })
  })

  app.get('/api/dev/jobs/:id', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_jobs WHERE id = $1', [
      context.req.param('id'),
    ])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(camelJobs(rows)[0])
  })

  app.post('/api/dev/jobs/:id/retry', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'dev.retry')
    if (denied) return denied
    const result = await retryJob(env, context.req.param('id'), user!.id)
    if (result.ok) return context.json(result.job)
    return result.reason === 'not_found'
      ? jsonError(context, 404, 'NOT-FOUND', 'not_found')
      : jsonError(context, 409, 'JOB-STATE', 'job_not_retryable')
  })

  app.get('/api/dev/failures', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query(
      "SELECT * FROM ingest_jobs WHERE status = 'failed' ORDER BY updated_at DESC",
    )
    return context.json({ items: camelJobs(rows) })
  })

  /**
   * Dead letters. The queue parks what it could not finish instead of dropping
   * it: whole runs that ran out of attempts, and single creators whose payload
   * could not be read or written. Nothing here is retried automatically.
   */
  app.get('/api/dev/dead-letters', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const state = context.req.query('state') ?? 'open'
    const kind = context.req.query('kind')
    const source = context.req.query('source')
    const conditions: string[] = []
    const values: unknown[] = []
    if (state !== 'all') {
      if (!(DEAD_LETTER_STATES as readonly string[]).includes(state)) {
        return jsonError(context, 400, 'VALIDATION', 'unknown_state')
      }
      values.push(state)
      conditions.push(`state = $${values.length}`)
    }
    if (kind) {
      if (!(DEAD_LETTER_KINDS as readonly string[]).includes(kind)) {
        return jsonError(context, 400, 'VALIDATION', 'unknown_kind')
      }
      values.push(kind)
      conditions.push(`kind = $${values.length}`)
    }
    if (source) {
      values.push(source)
      conditions.push(`source = $${values.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await env.db.query(
      `SELECT * FROM ingest_dead_letters ${where} ORDER BY created_at DESC LIMIT 200`,
      values,
    )
    return context.json({ items: camelDeadLetters(rows) })
  })

  app.get('/api/dev/dead-letters/:id', async (context) => {
    const { denied } = await helpers.requireAuth(context, 'dev.read')
    if (denied) return denied
    const { rows } = await env.db.query('SELECT * FROM ingest_dead_letters WHERE id = $1', [
      context.req.param('id'),
    ])
    if (!rows[0]) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    return context.json(camelDeadLetters(rows)[0])
  })

  /**
   * Replay. A parked run goes back as a *new* job that continues from the
   * saved cursor; a parked record is re-read from the payload we already have
   * (no vendor call, no quota). A replay that keeps failing is a poison
   * message — after `DEAD_LETTER_MAX_REPLAYS` we stop offering the button.
   */
  app.post('/api/dev/dead-letters/:id/replay', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'dev.retry')
    if (denied) return denied
    const id = context.req.param('id')
    const { rows } = await env.db.query('SELECT * FROM ingest_dead_letters WHERE id = $1', [id])
    const entry = rows[0]
    if (!entry) return jsonError(context, 404, 'NOT-FOUND', 'not_found')
    if (entry.state !== 'open') {
      return jsonError(context, 409, 'JOB-STATE', 'dead_letter_not_open')
    }
    if (Number(entry.replay_count) >= DEAD_LETTER_MAX_REPLAYS) {
      return jsonError(context, 409, 'JOB-STATE', 'dead_letter_replays_exhausted')
    }

    try {
      if (entry.kind === 'job') {
        const query = (entry.query ?? {}) as SourceQuery
        const job = await enqueueIngestJob(
          env,
          { ...query, source: entry.source, cursor: entry.cursor ?? null },
          user!.id,
          Number(query.limit ?? 0) || 5,
        )
        const updated = await resolveDeadLetter(env, id, 'replayed', user!.id, job?.id ?? null)
        await audit(env.db, user!.id, 'ingest.deadLetter.replay', 'ingest_dead_letter', id, 'replay')
        return context.json({ deadLetter: updated, job })
      }

      const counts = await replayRecord(env, {
        source: entry.source,
        jobId: entry.job_id ?? null,
        externalId: String(entry.external_id),
        payload: (entry.payload ?? {}) as Record<string, unknown>,
      })
      if (!counts.written && !counts.skipped) {
        // Still unreadable / unwritable: bump the counter, leave it parked.
        const again = await env.db.query(
          `UPDATE ingest_dead_letters SET replay_count = replay_count + 1, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [id],
        )
        return context.json({ deadLetter: camelDeadLetters(again.rows)[0], result: counts }, 409)
      }
      const updated = await resolveDeadLetter(env, id, 'replayed', user!.id, null)
      await audit(env.db, user!.id, 'ingest.deadLetter.replay', 'ingest_dead_letter', id, 'replay')
      return context.json({ deadLetter: updated, result: counts })
    } catch (error) {
      const again = await env.db.query(
        `UPDATE ingest_dead_letters SET replay_count = replay_count + 1,
           message = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, scrub(error instanceof Error ? error.message : String(error))],
      )
      return context.json({ deadLetter: camelDeadLetters(again.rows)[0] }, 409)
    }
  })

  app.post('/api/dev/dead-letters/:id/dismiss', async (context) => {
    const { user, denied } = await helpers.requireAuth(context, 'dev.retry')
    if (denied) return denied
    const id = context.req.param('id')
    const { rows } = await env.db.query(
      `UPDATE ingest_dead_letters SET state = 'dismissed', resolved_at = now(),
         resolved_by = $2, updated_at = now()
       WHERE id = $1 AND state = 'open' RETURNING *`,
      [id, user!.id],
    )
    if (!rows[0]) {
      const exists = await env.db.query('SELECT 1 FROM ingest_dead_letters WHERE id = $1', [id])
      return exists.rowCount
        ? jsonError(context, 409, 'JOB-STATE', 'dead_letter_not_open')
        : jsonError(context, 404, 'NOT-FOUND', 'not_found')
    }
    await audit(env.db, user!.id, 'ingest.deadLetter.dismiss', 'ingest_dead_letter', id, 'dismiss')
    return context.json(camelDeadLetters(rows)[0])
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
