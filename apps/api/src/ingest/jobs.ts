import { SOURCE_DEFAULTS, type SourceId } from '@kcs/contract'
import { audit } from '../http/audit'
import { camelJobs } from '../http/creators'
import type { AppEnv } from '../http/types'
import { closeJobDeadLetters } from './dead-letters'

/** Register a source the queue is about to use, with the contract defaults. Never overwrites ops' edits. */
export async function ensureSource(env: AppEnv, source: SourceId) {
  const defaults = SOURCE_DEFAULTS[source]
  await env.db.query(
    `INSERT INTO ingest_sources (id, name, adapter_type, enabled, rate_limit, quota, daily_budget_usd, owner)
     VALUES ($1,$2,$1,true,$3,$4,$5,'ops') ON CONFLICT (id) DO NOTHING`,
    [source, defaults.name, defaults.rateLimit, defaults.quota, defaults.dailyBudgetUsd],
  )
}

export type RetryResult =
  | { ok: true; job: ReturnType<typeof camelJobs>[number] }
  | { ok: false; reason: 'not_found' | 'not_retryable' }

/**
 * A run that stopped short (failed / partial) goes back to the queue with a
 * fresh attempt budget and keeps its cursor, so it continues rather than
 * restarts. Its parked dead letter is settled — nobody is waiting on it now.
 * Same action from the ops page (`ingest.retry`) and the devops page (`dev.retry`).
 */
export async function retryJob(env: AppEnv, jobId: string, actorId: string): Promise<RetryResult> {
  const { rows } = await env.db.query(
    `UPDATE ingest_jobs SET status = 'queued', attempts = 0, next_run_at = now(),
       error = NULL, error_code = NULL, error_summary = NULL, ended_at = NULL,
       dead_lettered_at = NULL, locked_by = NULL, lease_expires_at = NULL, updated_at = now()
     WHERE id = $1 AND status IN ('failed','partial') RETURNING *`,
    [jobId],
  )
  if (!rows[0]) {
    const exists = await env.db.query('SELECT 1 FROM ingest_jobs WHERE id = $1', [jobId])
    return { ok: false, reason: exists.rowCount ? 'not_retryable' : 'not_found' }
  }
  await closeJobDeadLetters(env, rows[0].id, actorId, rows[0].id)
  await audit(env.db, actorId, 'ingest.retry', 'ingest_job', rows[0].id, 'retry')
  return { ok: true, job: camelJobs(rows)[0] }
}
