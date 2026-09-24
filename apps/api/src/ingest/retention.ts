import type { Queryable } from '../db'

/**
 * What the daily sweep keeps. `0` for any knob means keep everything of that kind.
 * History snapshots (`creator_metrics_history`) are never touched: they are the
 * trend line the detail page draws and cannot be re-fetched from the vendor.
 */
export type RetentionConfig = {
  /** Newest raw payloads kept per (creator, source). */
  rawPerSource: number
  /** Settled dead letters (replayed / dismissed) older than this are dropped; open ones never. */
  deadLetterDays: number
  auditDays: number
  /** How often the queue holder runs the sweep; `0` turns it off. */
  intervalMs: number
}

export const RETENTION_DEFAULTS: RetentionConfig = {
  rawPerSource: 10,
  deadLetterDays: 90,
  auditDays: 365,
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
    intervalMs: knob(source.RETENTION_INTERVAL_HOURS, RETENTION_DEFAULTS.intervalMs / 3_600_000) * 3_600_000,
  }
}

export type RetentionResult = { raw: number; deadLetters: number; auditLogs: number }

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
  const result: RetentionResult = { raw: 0, deadLetters: 0, auditLogs: 0 }
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
  return result
}
