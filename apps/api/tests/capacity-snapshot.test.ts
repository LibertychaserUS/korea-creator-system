import { tmpdir } from 'node:os'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { API, INGEST_QUEUE_LOCK, type CapacityReport } from '@kcs/contract'
import { createTestApp, type TestCtx } from './helpers'
import {
  capacityDay,
  capacityReport,
  collectReadings,
  runDailyCapacitySnapshot,
  type CapacityReadings,
} from '../src/ops/capacity'
import { holdsQueueLock, runCapacityIfDue } from '../src/ops/capacity/daily'
import { dayNumber, dayString } from '../src/ops/capacity/forecast'

const GB = 1024 ** 3
let ctx: TestCtx
let devops: string

beforeAll(async () => {
  ctx = await createTestApp()
  devops = (await ctx.loginJson('devops@kcs.local')).token
})

afterAll(async () => {
  await ctx.close()
})

beforeEach(async () => {
  await ctx.db.query('DELETE FROM ops_capacity_daily')
  await ctx.db.query("DELETE FROM audit_logs WHERE entity_type = 'capacity'")
  ctx.env.now = () => new Date()
})

const today = () => capacityDay(new Date())

function readings(day: string, used: number, extra: Partial<CapacityReadings> = {}): CapacityReadings {
  return {
    day,
    databaseName: 'kcs_test',
    databaseBytes: used / 4,
    walBytes: 64 * 1024 ** 2,
    disk: { name: '/synthetic', size: 100 * GB, used, avail: 100 * GB - used, declared: false },
    backup: null,
    tables: [
      { name: 'creator_raw', totalBytes: used / 8, tableBytes: used / 16, indexBytes: used / 64, toastBytes: used / 32, liveTuples: 10, deadTuples: 1 },
    ],
    sources: [{ id: 'qiangua', records: 400, calls: 20, avgRawBytes: 3000 }],
    ...extra,
  }
}

/** Fill `days` past days of synthetic disk readings ending yesterday. */
async function history(days: number, used: (i: number) => number) {
  const start = dayNumber(today()) - days
  for (let i = 0; i < days; i++) {
    const day = dayString(start + i)
    await ctx.db.query(
      `INSERT INTO ops_capacity_daily (day, scope, name, fs_size_bytes, fs_used_bytes, fs_avail_bytes)
       VALUES ($1, 'disk', '/synthetic', $2::bigint, $3::bigint, $2::bigint - $3::bigint)`,
      [day, 100 * GB, Math.round(used(i))],
    )
    await ctx.db.query(
      `INSERT INTO ops_capacity_daily (day, scope, name, total_bytes) VALUES ($1, 'database', 'kcs_test', $2)`,
      [day, Math.round(used(i) / 4)],
    )
  }
}

describe('collectReadings (real database)', () => {
  it('measures the database, every table with its indexes and TOAST, and today’s raw volume per source', async () => {
    const r = await collectReadings(ctx.db, today(), { dataPath: tmpdir(), declaredDiskBytes: null, backupDir: tmpdir() })
    expect(r.databaseBytes).toBeGreaterThan(0)
    const raw = r.tables.find((t) => t.name === 'creator_raw')!
    expect(raw.totalBytes).toBeGreaterThanOrEqual(raw.tableBytes + raw.indexBytes)
    expect(r.tables.map((t) => t.name)).toContain('ops_capacity_daily')
    expect(r.disk).toMatchObject({ name: tmpdir(), declared: false })
    expect(r.disk!.size).toBeGreaterThan(r.disk!.used)
    expect(r.backup?.bytes).toBeGreaterThanOrEqual(0)
    expect(r.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['pugongying', 'qiangua', 'xinhong']))
  })

  it('a disk that cannot be read locally falls back to the declared size, used = database + WAL', async () => {
    const r = await collectReadings(ctx.db, today(), { dataPath: '/nonexistent/kcs', declaredDiskBytes: 50 * GB, backupDir: '/nonexistent/backups' })
    if (r.disk?.declared) {
      expect(r.disk).toMatchObject({ name: 'declared', size: 50 * GB })
      expect(r.disk.used).toBe(r.databaseBytes + (r.walBytes ?? 0))
    } else {
      // This host can read the server's data_directory, which wins over a declared size.
      expect(r.disk).not.toBeNull()
    }
    expect(r.backup).toBeNull()
  })

  it('counts records fetched today and their average stored size', async () => {
    const creator = (await ctx.db.query('SELECT id FROM creators ORDER BY id LIMIT 1')).rows[0].id
    await ctx.db.query(
      `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
       VALUES ('cap_r1', $1, 'xinhong', 'x1', now(), '{"a": 1}'), ('cap_r2', $1, 'xinhong', 'x2', now(), '{"a": 2}')
       ON CONFLICT (id) DO NOTHING`,
      [creator],
    )
    const r = await collectReadings(ctx.db, today(), { dataPath: tmpdir(), declaredDiskBytes: null, backupDir: null })
    const xinhong = r.sources.find((s) => s.id === 'xinhong')!
    expect(xinhong.records).toBeGreaterThanOrEqual(2)
    expect(xinhong.avgRawBytes).toBeGreaterThan(0)
  })
})

describe('runDailyCapacitySnapshot', () => {
  it('stores one reading per day and scope; taking it again the same day replaces it', async () => {
    await runDailyCapacitySnapshot(ctx.env, { config: { dataPath: tmpdir(), declaredDiskBytes: null, backupDir: null } })
    await runDailyCapacitySnapshot(ctx.env, { config: { dataPath: tmpdir(), declaredDiskBytes: null, backupDir: null } })
    const dupes = await ctx.db.query(
      'SELECT day, scope, name, count(*) FROM ops_capacity_daily GROUP BY 1, 2, 3 HAVING count(*) > 1',
    )
    expect(dupes.rows).toEqual([])
    const scopes = (await ctx.db.query('SELECT DISTINCT scope FROM ops_capacity_daily ORDER BY scope')).rows.map((r) => r.scope)
    expect(scopes).toEqual(expect.arrayContaining(['database', 'disk', 'forecast', 'source', 'table']))
    const report = await capacityReport(ctx.env)
    expect(report.forecast.status).toBe('insufficient')
    expect(report.latest?.day).toBe(today())
    expect(report.latest?.tables.length).toBeGreaterThan(5)
  })

  it('writes an audit row when the level moves, and not again while it stays', async () => {
    // 28 days at ~1 GB/day from 40 GB: tomorrow's reading at 68 GB → 70% in about two days.
    await history(28, (i) => 40 * GB + i * GB)
    const first = await runDailyCapacitySnapshot(ctx.env, { collect: async (day) => readings(day, 68 * GB) })
    expect(first.level).toBe('warning')
    expect(first.audited).toEqual(['capacity.alert'])
    const again = await runDailyCapacitySnapshot(ctx.env, { collect: async (day) => readings(day, 68 * GB) })
    expect(again.audited).toEqual([])
    const rows = (await ctx.db.query("SELECT actor_id, summary FROM audit_logs WHERE action = 'capacity.alert'")).rows
    expect(rows).toHaveLength(1)
    expect(rows[0].actor_id).toBeNull()
    expect(rows[0].summary).toMatch(/^ok→warning/)
  })

  it('usage above 90% is critical; a jump in growth speed is written down once', async () => {
    await history(20, (i) => 30 * GB + (i < 12 ? 0.2 * GB * i : 2.4 * GB + 4 * GB * (i - 12)))
    const result = await runDailyCapacitySnapshot(ctx.env, { collect: async (day) => readings(day, 92 * GB) })
    expect(result.level).toBe('critical')
    expect(result.forecast.changePoint).not.toBeNull()
    expect(result.audited).toEqual(['capacity.alert', 'capacity.change'])
    const repeat = await runDailyCapacitySnapshot(ctx.env, { collect: async (day) => readings(day, 92 * GB) })
    expect(repeat.audited).toEqual([])
  })

  it('worst case = quota × records per call × average bytes × (1 + index share)', async () => {
    await ctx.db.query("UPDATE ingest_sources SET quota = 1000 WHERE id = 'qiangua'")
    await history(3, (i) => 40 * GB + i * GB)
    await runDailyCapacitySnapshot(ctx.env, { collect: async (day) => readings(day, 44 * GB) })
    const report = await capacityReport(ctx.env)
    const qiangua = report.worstCase.sources.find((s) => s.id === 'qiangua')!
    // creator_raw: index = used/64, heap = used/16 + used/32 → share 1/6.
    expect(report.worstCase.indexOverhead).toBeCloseTo(1 / 6, 6)
    expect(qiangua).toMatchObject({ quota: 1000, recordsPerCall: 20, avgRawBytes: 3000 })
    expect(qiangua.perDay).toBeCloseTo(1000 * 20 * 3000 * (7 / 6), 3)
    expect(report.worstCase.sources.map((s) => s.id)).not.toContain('file-drop')
    expect(report.forecast.worstCasePerDay).toBeCloseTo(report.worstCase.perDay!, 3)
  })

  it('lists the three tables growing fastest', async () => {
    const start = dayNumber(today()) - 10
    for (let i = 0; i < 10; i++) {
      for (const [name, perDay] of [['creator_raw', 5e8], ['creator_metrics_history', 2e8], ['audit_logs', 1e6], ['creators', 3e7], ['assets', 0]] as const) {
        await ctx.db.query(
          "INSERT INTO ops_capacity_daily (day, scope, name, total_bytes) VALUES ($1, 'table', $2, $3)",
          [dayString(start + i), name, 1e9 + perDay * i],
        )
      }
    }
    const report = await capacityReport(ctx.env)
    expect(report.topGrowing.map((t) => t.name)).toEqual(['creator_raw', 'creator_metrics_history', 'creators'])
  })
})

describe('GET /api/dev/capacity · POST /api/dev/capacity/snapshot', () => {
  const call = (token: string, method: string, path: string) =>
    ctx.app.request(path, { method, headers: { authorization: `Bearer ${token}` } })

  it('ops console reads the report; devops can take a reading now, and it is recorded', async () => {
    await history(10, (i) => 40 * GB + i * 0.1 * GB)
    const res = await call(devops, 'GET', API.devCapacity.path)
    expect(res.status).toBe(200)
    const report = (await res.json()) as CapacityReport
    expect(report.forecast.status).toBe('ok')
    expect(report.history).toHaveLength(10)
    expect(report.forecast.etas.map((e) => e.threshold)).toEqual([0.7, 0.9])

    const taken = await call(devops, 'POST', API.devCapacitySnapshot.path)
    expect(taken.status).toBe(200)
    const body = await taken.json()
    expect(body.day).toBe(today())
    expect(body.report.latest.day).toBe(today())
    const trail = await ctx.db.query("SELECT actor_id FROM audit_logs WHERE action = 'capacity.snapshot'")
    expect(trail.rows.map((r) => r.actor_id)).toEqual(['user_devops'])
  })

  it('selector cannot see it; ops can read but not trigger', async () => {
    const selector = (await ctx.loginJson('selector@kcs.local')).token
    const ops = (await ctx.loginJson('ops@kcs.local')).token
    expect((await call(selector, 'GET', API.devCapacity.path)).status).toBe(403)
    expect((await call(ops, 'GET', API.devCapacity.path)).status).toBe(200)
    expect((await call(ops, 'POST', API.devCapacitySnapshot.path)).status).toBe(403)
  })
})

describe('once a day, in the queue holder only', () => {
  it('files readings under the Beijing calendar day', () => {
    expect(capacityDay(new Date('2026-09-23T16:30:00Z'))).toBe('2026-09-24')
    expect(capacityDay(new Date('2026-09-23T15:59:00Z'))).toBe('2026-09-23')
  })

  it('runs when this process holds the ingest queue lock, and not again that day', async () => {
    expect(await holdsQueueLock(ctx.db)).toBe(false)
    expect(await runCapacityIfDue(ctx.env)).toBeNull()
    const holder = await ctx.db.connect()
    try {
      await holder.query('SELECT pg_advisory_lock($1)', [INGEST_QUEUE_LOCK])
      expect(await holdsQueueLock(ctx.db)).toBe(true)
      const first = await runCapacityIfDue(ctx.env)
      expect(first?.day).toBe(today())
      expect(await runCapacityIfDue(ctx.env)).toBeNull()
    } finally {
      await holder.query('SELECT pg_advisory_unlock($1)', [INGEST_QUEUE_LOCK])
      holder.release()
    }
  })

  it('stays quiet when another process holds the lock', async () => {
    const other = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://kcs:kcs@127.0.0.1:5432/kcs_test',
      application_name: 'kcs-api:other-host:1',
    })
    await other.connect()
    try {
      await other.query('SELECT pg_advisory_lock($1)', [INGEST_QUEUE_LOCK])
      expect(await holdsQueueLock(ctx.db)).toBe(false)
      expect(await runCapacityIfDue(ctx.env)).toBeNull()
    } finally {
      await other.end()
    }
  })
})
