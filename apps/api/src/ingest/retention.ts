import type { Queryable } from '../db'

/**
 * Optional cleanup. For now everything is kept: every knob defaults to `0`
 * ("keep all of that kind"), so the sweep deletes nothing unless ops set a
 * positive value on purpose. History snapshots (`creator_metrics_history`)
 * are never touched either way: they are the trend line the detail page draws
 * and cannot be re-fetched from the vendor.
 */
export type RetentionConfig = {
  /** Newest raw payloads kept per (creator, source); `0` keeps all. */
  rawPerSource: number
  /** Settled dead letters (replayed / dismissed) older than this are dropped; open ones never. `0` keeps all. */
  deadLetterDays: number
  /** `0` keeps all. */
  auditDays: number
  /**
   * Finished queue runs (`ok` / `failed`) ended longer ago than this; `0` keeps
   * all. Never a run with an open dead letter, one a creator names as its
   * first or last job, or a file import (`batches`).
   */
  jobDays: number
  /** How often the queue holder checks; `0` turns the check off. */
  intervalMs: number
}

export const RETENTION_DEFAULTS: RetentionConfig = {
  rawPerSource: 0,
  deadLetterDays: 0,
  auditDays: 0,
  jobDays: 0,
  intervalMs: 24 * 60 * 60 * 1_000,
}

const BATCH = 5_000

function knob(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export function retentionConfig(source: NodeJS.ProcessEnv = process.env): RetentionConfig {
  return {
    rawPerSource: knob(source.RETENTION_RAW_PER_SOURCE, RETENTION_DEFAULTS.rawPerSource),
    deadLetterDays: knob(source.RETENTION_DEAD_LETTER_DAYS, RETENTION_DEFAULTS.deadLetterDays),
    auditDays: knob(source.RETENTION_AUDIT_DAYS, RETENTION_DEFAULTS.auditDays),
    jobDays: knob(source.RETENTION_JOB_DAYS, RETENTION_DEFAULTS.jobDays),
    intervalMs: knob(source.RETENTION_INTERVAL_HOURS, RETENTION_DEFAULTS.intervalMs / 3_600_000) * 3_600_000,
  }
}

/** True only when ops switched on at least one kind of cleanup. */
export function retentionEnabled(config: RetentionConfig): boolean {
  return config.intervalMs > 0 && (config.rawPerSource > 0 || config.deadLetterDays > 0 || config.auditDays > 0 || config.jobDays > 0)
}

export type RetentionResult = { raw: number; deadLetters: number; auditLogs: number; jobs: number }

/** Deletes in batches so a first run over a large backlog never holds one long lock. */
async function drain(db: Queryable, sql: string, params: unknown[]) {
  let total = 0
  for (;;) {
    const { rowCount } = await db.query(sql, [...params, BATCH])
    total += rowCount ?? 0
    if ((rowCount ?? 0) < BATCH) return total
  }
}

export async function runRetention(
  db: Queryable,
  config: RetentionConfig = retentionConfig(),
  now: Date = new Date(),
): Promise<RetentionResult> {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)
  const result: RetentionResult = { raw: 0, deadLetters: 0, auditLogs: 0, jobs: 0 }
  if (config.rawPerSource > 0) {
    result.raw = await drain(
      db,
      `DELETE FROM creator_raw WHERE id IN (
         SELECT id FROM (
           SELECT id, row_number() OVER (
             PARTITION BY creator_id, source ORDER BY fetched_at DESC, id DESC) AS rn
           FROM creator_raw) ranked
         WHERE rn > $1 LIMIT $2)`,
      [config.rawPerSource],
    )
    // Bodies no remaining fetch points at (a body is shared by identical fetches).
    await drain(
      db,
      `DELETE FROM raw_payloads WHERE hash IN (
         SELECT p.hash FROM raw_payloads p
         WHERE NOT EXISTS (SELECT 1 FROM creator_raw r WHERE r.payload_hash = p.hash) LIMIT $1)`,
      [],
    )
  }
  if (config.deadLetterDays > 0) {
    result.deadLetters = await drain(
      db,
      `DELETE FROM ingest_dead_letters WHERE id IN (
         SELECT id FROM ingest_dead_letters
         WHERE state <> 'open' AND resolved_at < $1 LIMIT $2)`,
      [daysAgo(config.deadLetterDays)],
    )
  }
  if (config.auditDays > 0) {
    result.auditLogs = await drain(
      db,
      `DELETE FROM audit_logs WHERE id IN (
         SELECT id FROM audit_logs WHERE created_at < $1 LIMIT $2)`,
      [daysAgo(config.auditDays)],
    )
  }
  if (config.jobDays > 0) {
    result.jobs = await drain(
      db,
      `DELETE FROM ingest_jobs WHERE id IN (
         SELECT j.id FROM ingest_jobs j
         WHERE j.status IN ('ok', 'failed') AND j.ended_at < $1 AND j.file_name IS NULL
           AND NOT EXISTS (SELECT 1 FROM ingest_dead_letters d WHERE d.job_id = j.id AND d.state = 'open')
           AND NOT EXISTS (SELECT 1 FROM creators c WHERE c.first_ingest_job_id = j.id)
           AND NOT EXISTS (SELECT 1 FROM creators c WHERE c.last_ingest_job_id = j.id)
         LIMIT $2)`,
      [daysAgo(config.jobDays)],
    )
  }
  return result
}
