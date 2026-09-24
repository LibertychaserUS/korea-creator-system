import type { IngestFailureCode } from '@kcs/contract'
import { audit } from '../http/audit'
import type { AppEnv } from '../http/types'
import { logEvent } from '../log'
import { scrub } from './dead-letters'

export type PausedSource = {
  id: string
  name: string
  pausedAt: string
  code: IngestFailureCode | string
  detail: string | null
}

/**
 * Take a source offline because the vendor will not serve it any more (HTTP
 * 402: the balance ran out). Every further call would fail the same way, so
 * the queue stops picking its jobs; the audit trail and the ops console home
 * say why. Only the first pause is recorded.
 */
export async function pauseSource(env: AppEnv, source: string, code: IngestFailureCode, detail: string): Promise<boolean> {
  const clean = scrub(detail)
  const { rowCount } = await env.db.query(
    `UPDATE ingest_sources SET paused_at = now(), paused_code = $2, paused_detail = $3
      WHERE id = $1 AND paused_at IS NULL`,
    [source, code, clean],
  )
  if (!rowCount) return false
  await audit(env.db, null, 'source.paused', 'ingest_source', source, `${code}: ${clean}`)
  logEvent('error', 'source.paused', { source, code, message: clean })
  return true
}

/** Back online; its queued jobs run again from where they stopped. */
export async function resumeSource(env: AppEnv, source: string, actorId: string): Promise<boolean> {
  const { rows } = await env.db.query(
    `UPDATE ingest_sources SET paused_at = NULL, paused_code = NULL, paused_detail = NULL
      WHERE id = $1 AND paused_at IS NOT NULL RETURNING paused_code`,
    [source],
  )
  if (!rows[0]) return false
  await audit(env.db, actorId, 'source.resumed', 'ingest_source', source, 'resumed')
  logEvent('info', 'source.resumed', { source, actorId })
  return true
}

export async function pausedSources(env: AppEnv): Promise<PausedSource[]> {
  const { rows } = await env.db.query(
    `SELECT id, name, paused_at, paused_code, paused_detail FROM ingest_sources
      WHERE paused_at IS NOT NULL ORDER BY paused_at`,
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    pausedAt: row.paused_at instanceof Date ? row.paused_at.toISOString() : String(row.paused_at),
    code: row.paused_code,
    detail: row.paused_detail ?? null,
  }))
}

export async function isSourcePaused(env: AppEnv, source: string): Promise<boolean> {
  const { rows } = await env.db.query('SELECT paused_at FROM ingest_sources WHERE id = $1', [source])
  return rows[0]?.paused_at != null
}
