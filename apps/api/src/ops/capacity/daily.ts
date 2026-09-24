import { INGEST_QUEUE_LOCK } from '@kcs/contract'
import type { Queryable } from '../../db'
import type { AppEnv } from '../../http/types'
import { errorMessage, logEvent } from '../../log'
import { capacityDay, runDailyCapacitySnapshot, type CapacitySnapshotResult } from './index'

/**
 * Stand-in until the worker's daily-task hook is on this branch: once per
 * Beijing day, only in the process that holds the ingest queue lock, take the
 * storage reading. With the hook, this file goes and one line replaces it:
 * `registerDailyTask('capacity', (env) => runDailyCapacitySnapshot(env))`.
 *
 * The worker holds the lock on its own connection, so "this process holds it"
 * is read from pg_locks: the holder's `application_name` is this process's
 * (index.ts gives every API process its own via PGAPPNAME).
 */
export async function holdsQueueLock(db: Queryable): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory' AND l.granted AND l.classid = 0 AND l.objid = $1 AND l.objsubid = 1
          AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND a.application_name = current_setting('application_name')
     ) AS held`,
    [INGEST_QUEUE_LOCK],
  )
  return Boolean(rows[0]?.held)
}

async function takenToday(db: Queryable, day: string): Promise<boolean> {
  const { rows } = await db.query(
    "SELECT 1 FROM ops_capacity_daily WHERE day = $1::date AND scope = 'forecast' AND name = 'disk'",
    [day],
  )
  return rows.length > 0
}

/** Takes today's reading if nobody has yet and this process is the queue holder. */
export async function runCapacityIfDue(env: AppEnv): Promise<CapacitySnapshotResult | null> {
  const day = capacityDay(env.now())
  if (await takenToday(env.db, day)) return null
  if (!(await holdsQueueLock(env.db))) return null
  return runDailyCapacitySnapshot(env)
}

/** `KCS_CAPACITY_DAILY=0` turns it off; the ops console can still take a reading by hand. */
export function startCapacityDaily(env: AppEnv, options: { intervalMs?: number } = {}): () => void {
  if (process.env.KCS_CAPACITY_DAILY === '0') return () => undefined
  const intervalMs = options.intervalMs ?? 10 * 60_000
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const result = await runCapacityIfDue(env)
      if (result) logEvent('info', 'capacity.snapshot', { day: result.day, level: result.level, audited: result.audited })
    } catch (error) {
      logEvent('error', 'capacity.snapshot_failed', { message: errorMessage(error) })
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
