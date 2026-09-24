import type {
  CapacityDiskReading,
  CapacityForecast,
  CapacityLevel,
  CapacityReport,
  CapacityWorstCase,
} from '@kcs/contract'
import { audit } from '../../http/audit'
import type { AppEnv } from '../../http/types'
import { capacityConfig, collectReadings, type CapacityConfig, type CapacityReadings } from './collect'
import { FORECAST_WINDOW_DAYS, dayNumber, fastestGrowing, forecastCapacity, theilSen } from './forecast'

export { capacityConfig, collectReadings, type CapacityConfig, type CapacityReadings } from './collect'
export { forecastCapacity } from './forecast'

const HISTORY_DAYS = 90
const COLUMNS = [
  'total_bytes', 'table_bytes', 'index_bytes', 'toast_bytes', 'live_tuples', 'dead_tuples',
  'fs_size_bytes', 'fs_used_bytes', 'fs_avail_bytes', 'records', 'calls', 'avg_raw_bytes', 'level', 'detail',
] as const
type Column = (typeof COLUMNS)[number]
type Reading = { scope: string; name: string } & Partial<Record<Column, unknown>>

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : (value as string | null) ?? null)
const num = (value: unknown) => (value == null ? null : Number(value))

/** Readings are filed under the team's calendar day (the same zone the daily tasks run in). */
export const CAPACITY_TIME_ZONE = 'Asia/Shanghai'

export function capacityDay(now: Date, timeZone = CAPACITY_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function diskColumns(disk: CapacityDiskReading) {
  return { fs_size_bytes: disk.size, fs_used_bytes: disk.used, fs_avail_bytes: disk.avail }
}

function readingRows(readings: CapacityReadings): Reading[] {
  const rows: Reading[] = [{ scope: 'database', name: readings.databaseName, total_bytes: readings.databaseBytes }]
  for (const table of readings.tables) {
    rows.push({
      scope: 'table',
      name: table.name,
      total_bytes: table.totalBytes,
      table_bytes: table.tableBytes,
      index_bytes: table.indexBytes,
      toast_bytes: table.toastBytes,
      live_tuples: table.liveTuples,
      dead_tuples: table.deadTuples,
    })
  }
  if (readings.walBytes != null) rows.push({ scope: 'wal', name: 'pg_wal', total_bytes: readings.walBytes })
  if (readings.disk) {
    rows.push({ scope: 'disk', name: readings.disk.name, ...diskColumns(readings.disk), detail: { declared: readings.disk.declared } })
  }
  if (readings.backup) {
    rows.push({
      scope: 'backup',
      name: readings.backup.name,
      total_bytes: readings.backup.bytes,
      ...(readings.backup.disk ? diskColumns(readings.backup.disk) : {}),
    })
  }
  for (const source of readings.sources) {
    rows.push({ scope: 'source', name: source.id, records: source.records, calls: source.calls, avg_raw_bytes: source.avgRawBytes })
  }
  return rows
}

async function storeReadings(env: AppEnv, day: string, rows: Reading[]) {
  const client = await env.db.connect()
  try {
    await client.query('BEGIN')
    for (const row of rows) {
      const values = COLUMNS.map((column) => {
        const value = row[column]
        return column === 'detail' && value != null ? JSON.stringify(value) : value ?? null
      })
      await client.query(
        `INSERT INTO ops_capacity_daily (day, scope, name, ${COLUMNS.join(', ')}, collected_at)
         VALUES ($1, $2, $3, ${COLUMNS.map((_, i) => `$${i + 4}`).join(', ')}, $${COLUMNS.length + 4})
         ON CONFLICT (day, scope, name) DO UPDATE SET
           ${COLUMNS.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}, collected_at = EXCLUDED.collected_at`,
        [day, row.scope, row.name, ...values, env.now().toISOString()],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function worstCase(env: AppEnv, lastDay: string | null): Promise<CapacityWorstCase> {
  if (!lastDay) return { perDay: null, indexOverhead: null, sources: [] }
  const [quota, usage, raw] = await Promise.all([
    env.db.query("SELECT id, quota FROM ingest_sources WHERE adapter_type <> 'file_drop' ORDER BY id"),
    env.db.query(
      `SELECT name, sum(records)::float8 AS records, sum(calls)::float8 AS calls,
              sum(records * avg_raw_bytes) FILTER (WHERE avg_raw_bytes IS NOT NULL)::float8
                / NULLIF(sum(records) FILTER (WHERE avg_raw_bytes IS NOT NULL), 0) AS avg_bytes
         FROM ops_capacity_daily
        WHERE scope = 'source' AND day > $1::date - $2::int AND day <= $1::date
        GROUP BY name`,
      [lastDay, FORECAST_WINDOW_DAYS],
    ),
    env.db.query(
      `SELECT index_bytes, table_bytes, toast_bytes FROM ops_capacity_daily
        WHERE scope = 'table' AND name = 'creator_raw' AND day <= $1::date ORDER BY day DESC LIMIT 1`,
      [lastDay],
    ),
  ])
  const override = Number(process.env.KCS_CAPACITY_INDEX_OVERHEAD)
  const rawRow = raw.rows[0]
  const heap = rawRow ? Number(rawRow.table_bytes) + Number(rawRow.toast_bytes) : 0
  const indexOverhead = Number.isFinite(override) && override >= 0
    ? override
    : rawRow && heap > 0 ? Number(rawRow.index_bytes) / heap : null
  const byId = new Map(usage.rows.map((row) => [row.name, row]))
  const sources = quota.rows.map((row) => {
    const seen = byId.get(row.id)
    const calls = Number(seen?.calls ?? 0)
    const recordsPerCall = calls > 0 ? Number(seen.records) / calls : null
    const avgRawBytes = seen?.avg_bytes == null ? null : Number(seen.avg_bytes)
    const q = row.quota == null ? null : Number(row.quota)
    const perDay = q != null && recordsPerCall != null && avgRawBytes != null
      ? q * recordsPerCall * avgRawBytes * (1 + (indexOverhead ?? 0))
      : null
    return { id: row.id, quota: q, recordsPerCall, avgRawBytes, perDay }
  })
  const known = sources.filter((s) => s.perDay != null)
  return {
    perDay: known.length ? known.reduce((sum, s) => sum + s.perDay!, 0) : null,
    indexOverhead,
    sources,
  }
}

/** Everything the 存储 card shows, from the stored readings (no new measurement). */
export async function capacityReport(env: AppEnv): Promise<CapacityReport> {
  const latestDay = await env.db.query(
    "SELECT to_char(max(day), 'YYYY-MM-DD') AS day, max(collected_at) AS at FROM ops_capacity_daily WHERE scope <> 'forecast'",
  )
  const lastDay: string | null = latestDay.rows[0]?.day ?? null
  const [disk, database, tables, latest, worst] = await Promise.all([
    env.db.query(
      `SELECT DISTINCT ON (day) to_char(day, 'YYYY-MM-DD') AS day, fs_used_bytes, fs_size_bytes
         FROM ops_capacity_daily WHERE scope = 'disk' AND day > $1::date - $2::int
        ORDER BY day, collected_at DESC`,
      [lastDay ?? capacityDay(env.now()), HISTORY_DAYS],
    ),
    env.db.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(total_bytes)::float8 AS bytes
         FROM ops_capacity_daily WHERE scope = 'database' AND day > $1::date - $2::int
        GROUP BY day ORDER BY day`,
      [lastDay ?? capacityDay(env.now()), HISTORY_DAYS],
    ),
    env.db.query(
      `SELECT name, to_char(day, 'YYYY-MM-DD') AS day, total_bytes::float8 AS bytes
         FROM ops_capacity_daily WHERE scope = 'table' AND day > $1::date - $2::int ORDER BY day`,
      [lastDay ?? capacityDay(env.now()), FORECAST_WINDOW_DAYS],
    ),
    lastDay
      ? env.db.query("SELECT * FROM ops_capacity_daily WHERE day = $1::date AND scope <> 'forecast'", [lastDay])
      : Promise.resolve({ rows: [] as Record<string, any>[] }),
    worstCase(env, lastDay),
  ])

  const series = disk.rows.length
    ? disk.rows.map((row) => ({ day: row.day, used: Number(row.fs_used_bytes), capacity: num(row.fs_size_bytes) }))
    : database.rows.map((row) => ({ day: row.day, used: Number(row.bytes), capacity: null }))
  const forecast: CapacityForecast = forecastCapacity({ series, worstCasePerDay: worst.perDay })

  const dbPoints = database.rows
    .map((row) => ({ t: dayNumber(row.day), y: Number(row.bytes) }))
    .filter((p, _, all) => p.t > all.at(-1)!.t - FORECAST_WINDOW_DAYS)
  const dbSlope = dbPoints.length >= 2 ? theilSen(dbPoints) : null

  const byTable = new Map<string, { day: string; bytes: number }[]>()
  for (const row of tables.rows) {
    const list = byTable.get(row.name) ?? []
    list.push({ day: row.day, bytes: Number(row.bytes) })
    byTable.set(row.name, list)
  }

  const rows = latest.rows
  const diskOf = (row: Record<string, any> | undefined): CapacityDiskReading | null =>
    row && row.fs_size_bytes != null
      ? {
          name: row.name,
          size: Number(row.fs_size_bytes),
          used: Number(row.fs_used_bytes),
          avail: Number(row.fs_avail_bytes),
          declared: Boolean(row.detail?.declared),
        }
      : null
  const backupRow = rows.find((row) => row.scope === 'backup')
  const databaseByDay = new Map(database.rows.map((row) => [row.day, Number(row.bytes)]))
  const diskByDay = new Map(disk.rows.map((row) => [row.day, row]))
  const days = [...new Set([...databaseByDay.keys(), ...diskByDay.keys()])].sort()

  return {
    generatedAt: env.now().toISOString(),
    lastReadingAt: iso(latestDay.rows[0]?.at),
    latest: lastDay
      ? {
          day: lastDay,
          databaseBytes: rows.filter((row) => row.scope === 'database').reduce<number | null>((sum, row) => (sum ?? 0) + Number(row.total_bytes), null),
          walBytes: num(rows.find((row) => row.scope === 'wal')?.total_bytes),
          disk: diskOf(rows.find((row) => row.scope === 'disk')),
          backup: backupRow ? { name: backupRow.name, bytes: Number(backupRow.total_bytes), disk: diskOf(backupRow) } : null,
          tables: rows
            .filter((row) => row.scope === 'table')
            .sort((a, b) => Number(b.total_bytes) - Number(a.total_bytes))
            .map((row) => ({
              name: row.name,
              totalBytes: Number(row.total_bytes),
              tableBytes: Number(row.table_bytes),
              indexBytes: Number(row.index_bytes),
              toastBytes: Number(row.toast_bytes),
              liveTuples: Number(row.live_tuples),
              deadTuples: Number(row.dead_tuples),
            })),
          sources: rows
            .filter((row) => row.scope === 'source')
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            .map((row) => ({ id: row.name, records: Number(row.records), calls: Number(row.calls), avgRawBytes: num(row.avg_raw_bytes) })),
        }
      : null,
    forecast,
    database: { perDay: dbSlope?.slope ?? null, lower: dbSlope?.lower ?? null, upper: dbSlope?.upper ?? null },
    topGrowing: fastestGrowing(byTable),
    worstCase: worst,
    history: days.map((day) => ({
      day,
      used: diskByDay.has(day) ? Number(diskByDay.get(day)!.fs_used_bytes) : databaseByDay.get(day) ?? null,
      capacity: num(diskByDay.get(day)?.fs_size_bytes),
      databaseBytes: databaseByDay.get(day) ?? null,
    })),
  }
}

export type CapacitySnapshotResult = {
  day: string
  level: CapacityLevel
  previousLevel: CapacityLevel | null
  audited: string[]
  forecast: CapacityForecast
}

/**
 * Take today's storage readings, store them, recompute the forecast and
 * record an audit row when the alert level moves or a new change in growth
 * speed shows up. Safe to call more than once a day: the day's readings are
 * replaced, and an unchanged level writes no new audit row.
 *
 * Meant for the worker's once-a-day slot; `actorId` is set when a person
 * asked for the reading from the ops console.
 */
export async function runDailyCapacitySnapshot(
  env: AppEnv,
  options: {
    config?: CapacityConfig
    actorId?: string | null
    /** Replaces the measurement (tests). */
    collect?: (day: string) => Promise<CapacityReadings>
  } = {},
): Promise<CapacitySnapshotResult> {
  const day = capacityDay(env.now())
  const readings = options.collect
    ? await options.collect(day)
    : await collectReadings(env.db, day, options.config ?? capacityConfig(), CAPACITY_TIME_ZONE)
  await storeReadings(env, day, readingRows(readings))
  const report = await capacityReport(env)
  const { forecast } = report

  const previous = await env.db.query(
    "SELECT level, detail FROM ops_capacity_daily WHERE scope = 'forecast' AND name = 'disk' ORDER BY day DESC, collected_at DESC LIMIT 1",
  )
  const previousLevel = (previous.rows[0]?.level ?? null) as CapacityLevel | null
  const previousChange: string | null = previous.rows[0]?.detail?.changePoint?.day ?? null
  await storeReadings(env, day, [{
    scope: 'forecast',
    name: 'disk',
    level: forecast.level,
    detail: {
      status: forecast.status,
      usage: forecast.usage,
      slope: forecast.slope,
      etas: forecast.etas,
      changePoint: forecast.changePoint,
      reasons: forecast.reasons,
      worstCasePerDay: forecast.worstCasePerDay,
    },
  }])

  const audited: string[] = []
  const actor = options.actorId ?? null
  if (forecast.level !== (previousLevel ?? 'ok')) {
    const why = forecast.reasons.map((r) => (r.kind === 'usage' ? `usage>${r.threshold}` : r.kind === 'eta' ? `eta${r.threshold}<=${r.within}d` : `change@${r.day}`))
    await audit(env.db, actor, 'capacity.alert', 'capacity', day, `${previousLevel ?? 'ok'}→${forecast.level}${why.length ? ` ${why.join(' ')}` : ''}`)
    audited.push('capacity.alert')
  }
  if (forecast.changePoint && forecast.changePoint.day !== previousChange) {
    const { day: at, beforePerDay, afterPerDay } = forecast.changePoint
    await audit(env.db, actor, 'capacity.change', 'capacity', day, `${at} ${Math.round(beforePerDay)}→${Math.round(afterPerDay)} B/day`)
    audited.push('capacity.change')
  }
  return { day, level: forecast.level, previousLevel, audited, forecast }
}

