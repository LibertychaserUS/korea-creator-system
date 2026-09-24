import { DEFAULT_QUOTA_TIME_ZONE } from '@kcs/contract'
import type { AppEnv } from '../http/types'
import { errorMessage, logEvent } from '../log'

/**
 * Once-a-day work hung off the queue holder (the process with the ingest
 * advisory lock), so exactly one process runs it:
 *
 *   registerDailyTask('capacity', runDailyCapacitySnapshot)
 *
 * A task runs at most once per calendar day in `DAILY_TASKS_TZ` (default
 * Beijing), on the first worker tick at or after `DAILY_TASKS_HOUR` (default
 * 04:00). The `ingest_daily_runs` row is claimed before the task starts, so a
 * crash mid-task does not re-run it that day; a failed run is recorded and can
 * be started again by hand (`POST /api/ingest/daily/:task/run`).
 * `DAILY_TASKS=0` turns the schedule off (manual runs still work).
 */
export type DailyTask = (env: AppEnv) => Promise<unknown>

const tasks = new Map<string, DailyTask>()

/** Adds (or replaces) a task; the returned function removes it again. */
export function registerDailyTask(name: string, task: DailyTask): () => void {
  if (!/^[a-z0-9][a-z0-9_.-]{0,62}$/.test(name)) throw new Error(`invalid daily task name: ${name}`)
  tasks.set(name, task)
  return () => {
    if (tasks.get(name) === task) tasks.delete(name)
  }
}

export function dailyTaskNames(): string[] {
  return [...tasks.keys()].sort()
}

export type DailyConfig = { enabled: boolean; hour: number; timeZone: string }

export function dailyConfig(source: NodeJS.ProcessEnv = process.env): DailyConfig {
  const hour = Number(source.DAILY_TASKS_HOUR ?? 4)
  let timeZone = source.DAILY_TASKS_TZ || DEFAULT_QUOTA_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en', { timeZone })
  } catch {
    timeZone = DEFAULT_QUOTA_TIME_ZONE
  }
  return {
    enabled: source.DAILY_TASKS !== '0',
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 4,
    timeZone,
  }
}

/** Calendar day and hour of `now` in the configured zone. */
export function localDayHour(now: Date, timeZone: string): { day: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

export type DailyRunOutcome = { task: string; day: string; ok: boolean; result?: unknown; error?: string; ms: number }

async function runOne(env: AppEnv, name: string, day: string): Promise<DailyRunOutcome> {
  const task = tasks.get(name)!
  const started = Date.now()
  try {
    const result = await task(env)
    await env.db.query(
      'UPDATE ingest_daily_runs SET finished_at = now(), ok = true, result = $3, error = NULL WHERE task = $1 AND day = $2',
      [name, day, JSON.stringify(result ?? null)],
    )
    logEvent('info', 'daily.task_done', { task: name, day, ms: Date.now() - started })
    return { task: name, day, ok: true, result, ms: Date.now() - started }
  } catch (error) {
    const message = errorMessage(error)
    await env.db.query(
      'UPDATE ingest_daily_runs SET finished_at = now(), ok = false, error = $3 WHERE task = $1 AND day = $2',
      [name, day, message.slice(0, 2000)],
    ).catch(() => undefined)
    logEvent('error', 'daily.task_failed', { task: name, day, message })
    return { task: name, day, ok: false, error: message, ms: Date.now() - started }
  }
}

/** Runs every registered task not yet claimed for today. Called by the queue holder each tick. */
export async function runDueDailyTasks(env: AppEnv, config: DailyConfig = dailyConfig()): Promise<DailyRunOutcome[]> {
  if (!config.enabled || tasks.size === 0) return []
  const { day, hour } = localDayHour(env.now(), config.timeZone)
  if (hour < config.hour) return []
  const outcomes: DailyRunOutcome[] = []
  for (const name of dailyTaskNames()) {
    const claimed = await env.db.query(
      'INSERT INTO ingest_daily_runs (task, day) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING task',
      [name, day],
    )
    if (!claimed.rowCount) continue
    outcomes.push(await runOne(env, name, day))
  }
  return outcomes
}

/** Manual run (ops button / tests): replaces today's record for that task. */
export async function runDailyTaskNow(env: AppEnv, name: string, config: DailyConfig = dailyConfig()): Promise<DailyRunOutcome | null> {
  if (!tasks.has(name)) return null
  const { day } = localDayHour(env.now(), config.timeZone)
  await env.db.query(
    `INSERT INTO ingest_daily_runs (task, day) VALUES ($1, $2)
     ON CONFLICT (task, day) DO UPDATE SET started_at = now(), finished_at = NULL, ok = NULL, result = NULL, error = NULL`,
    [name, day],
  )
  return runOne(env, name, day)
}

export type DailyTaskStatus = {
  task: string
  lastDay: string | null
  lastStartedAt: string | null
  lastFinishedAt: string | null
  ok: boolean | null
  error: string | null
  result: unknown
}

export async function dailyTaskStatus(env: AppEnv): Promise<DailyTaskStatus[]> {
  const names = dailyTaskNames()
  const { rows } = await env.db.query(
    `SELECT DISTINCT ON (task) task, day::text AS day, started_at, finished_at, ok, error, result
       FROM ingest_daily_runs WHERE task = ANY($1::text[]) ORDER BY task, day DESC`,
    [names],
  )
  const byTask = new Map(rows.map((row) => [row.task as string, row]))
  const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : (value as string | null) ?? null)
  return names.map((task) => {
    const row = byTask.get(task)
    return {
      task,
      lastDay: row?.day ?? null,
      lastStartedAt: iso(row?.started_at),
      lastFinishedAt: iso(row?.finished_at),
      ok: row?.ok ?? null,
      error: row?.error ?? null,
      result: row?.result ?? null,
    }
  })
}
