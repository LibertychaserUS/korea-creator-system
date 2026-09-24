import { readdir, stat, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CapacityDiskReading,
  CapacitySourceReading,
  CapacityTableReading,
} from '@kcs/contract'
import type { Queryable } from '../../db'

/**
 * Where to look, from the environment. Every reading is optional: a managed
 * Postgres on another host has no local data directory, and a role without
 * pg_monitor cannot list WAL — those readings are left empty, never guessed.
 *
 *   KCS_CAPACITY_DATA_PATH   a path on the database's data disk (default: the
 *                            server's data_directory when it is on this host)
 *   KCS_CAPACITY_DISK_BYTES  size of the data disk when it cannot be read
 *                            locally (usage is then database + WAL)
 *   KCS_BACKUP_DIR           backup directory to measure
 */
export type CapacityConfig = {
  dataPath: string | null
  declaredDiskBytes: number | null
  backupDir: string | null
}

export function capacityConfig(source: NodeJS.ProcessEnv = process.env): CapacityConfig {
  const declared = Number(source.KCS_CAPACITY_DISK_BYTES)
  return {
    dataPath: source.KCS_CAPACITY_DATA_PATH?.trim() || null,
    declaredDiskBytes: Number.isFinite(declared) && declared > 0 ? declared : null,
    backupDir: source.KCS_BACKUP_DIR?.trim() || null,
  }
}

export type CapacityReadings = {
  day: string
  databaseName: string
  databaseBytes: number
  walBytes: number | null
  disk: CapacityDiskReading | null
  backup: { name: string; bytes: number; disk: CapacityDiskReading | null } | null
  tables: CapacityTableReading[]
  sources: CapacitySourceReading[]
}

async function diskAt(path: string): Promise<CapacityDiskReading | null> {
  try {
    const fs = await statfs(path)
    const avail = Number(fs.bavail) * Number(fs.bsize)
    const used = (Number(fs.blocks) - Number(fs.bfree)) * Number(fs.bsize)
    // Like df: what is used plus what an ordinary user may still write.
    return { name: path, size: used + avail, used, avail, declared: false }
  } catch {
    return null
  }
}

/** Total bytes of regular files under `root`, stopping after `limit` entries. */
async function directoryBytes(root: string, limit = 200_000): Promise<number | null> {
  let total = 0
  let seen = 0
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (++seen > limit) return
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) total += (await stat(path)).size
    }
  }
  try {
    await walk(root)
    return total
  } catch {
    return null
  }
}

async function optional<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch {
    return null
  }
}

/** `day` is a calendar day in `timeZone`; today's raw volume counts fetches inside that day. */
export async function collectReadings(
  db: Queryable,
  day: string,
  config: CapacityConfig,
  timeZone = 'Asia/Shanghai',
): Promise<CapacityReadings> {
  const database = await db.query(
    'SELECT current_database() AS name, pg_database_size(current_database())::bigint AS bytes',
  )
  const tables = await db.query(`
    SELECT c.relname AS name,
           pg_total_relation_size(c.oid)::bigint AS total,
           pg_relation_size(c.oid)::bigint AS main,
           pg_indexes_size(c.oid)::bigint AS idx,
           CASE WHEN c.reltoastrelid = 0 THEN 0 ELSE pg_total_relation_size(c.reltoastrelid) END::bigint AS toast,
           COALESCE(s.n_live_tup, 0)::bigint AS live,
           COALESCE(s.n_dead_tup, 0)::bigint AS dead
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
     WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p', 'm')
     ORDER BY 2 DESC, 1`)
  const wal = await optional(async () =>
    Number((await db.query('SELECT COALESCE(sum(size), 0)::bigint AS bytes FROM pg_ls_waldir()')).rows[0].bytes),
  )
  const sources = await db.query(
    `WITH bounds AS (
       SELECT ($1::date)::timestamp AT TIME ZONE $2 AS lo, ($1::date + 1)::timestamp AT TIME ZONE $2 AS hi
     ), raw AS (
       -- Bodies live once per content in raw_payloads (0045); a row keeps its own only from before that.
       SELECT r.source, count(*)::bigint AS records,
              avg(COALESCE(p.bytes, octet_length(r.payload::text)))::float8 AS avg_bytes
         FROM creator_raw r CROSS JOIN bounds b
         LEFT JOIN raw_payloads p ON p.hash = r.payload_hash
        WHERE r.fetched_at >= b.lo AND r.fetched_at < b.hi GROUP BY r.source
     )
     SELECT s.id, COALESCE(raw.records, 0)::bigint AS records, COALESCE(u.calls, 0)::bigint AS calls, raw.avg_bytes
       FROM ingest_sources s
       LEFT JOIN raw ON raw.source = s.id
       LEFT JOIN ingest_source_usage u ON u.source = s.id AND u.day = $1::date
      ORDER BY s.id`,
    [day, timeZone],
  )

  let disk: CapacityDiskReading | null = null
  if (config.dataPath) disk = await diskAt(config.dataPath)
  if (!disk) {
    const dataDirectory = await optional(async () => String((await db.query('SHOW data_directory')).rows[0].data_directory))
    if (dataDirectory) disk = await diskAt(dataDirectory)
  }
  const databaseBytes = Number(database.rows[0].bytes)
  if (!disk && config.declaredDiskBytes) {
    const used = databaseBytes + (wal ?? 0)
    disk = { name: 'declared', size: config.declaredDiskBytes, used, avail: Math.max(0, config.declaredDiskBytes - used), declared: true }
  }

  let backup: CapacityReadings['backup'] = null
  if (config.backupDir) {
    const bytes = await directoryBytes(config.backupDir)
    if (bytes != null) backup = { name: config.backupDir, bytes, disk: await diskAt(config.backupDir) }
  }

  return {
    day,
    databaseName: database.rows[0].name,
    databaseBytes,
    walBytes: wal,
    disk,
    backup,
    tables: tables.rows.map((row) => ({
      name: row.name,
      totalBytes: Number(row.total),
      tableBytes: Number(row.main),
      indexBytes: Number(row.idx),
      toastBytes: Number(row.toast),
      liveTuples: Number(row.live),
      deadTuples: Number(row.dead),
    })),
    sources: sources.rows.map((row) => ({
      id: row.id,
      records: Number(row.records),
      calls: Number(row.calls),
      avgRawBytes: row.avg_bytes == null ? null : Number(row.avg_bytes),
    })),
  }
}
