import { afterEach, describe, expect, it } from 'vitest'
import { RETENTION_DEFAULTS, retentionConfig, runRetention, type RetentionConfig } from '../src/ingest/retention'
import { startIngestWorker } from '../src/ingest/worker'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

const NOW = new Date('2026-09-23T00:00:00.000Z')
const DAY = 86_400_000
const CREATOR = 'seed_qiangua_qg_002'

async function setup() {
  const context = await createTestApp()
  contexts.push(context)
  const db = context.db
  await db.query('DELETE FROM creator_raw WHERE creator_id = $1', [CREATOR])
  await db.query('DELETE FROM ingest_dead_letters')
  await db.query('DELETE FROM audit_logs')
  return context
}

async function addRaw(context: TestCtx, source: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    await context.db.query(
      `INSERT INTO creator_raw (id, creator_id, source, external_id, fetched_at, payload)
       VALUES ($1,$2,$3,'ext',$4,'{}'::jsonb)`,
      [`raw-${source}-${String(i).padStart(2, '0')}`, CREATOR, source, new Date(NOW.getTime() - i * DAY)],
    )
  }
}

async function addDeadLetter(context: TestCtx, id: string, state: string, resolvedDaysAgo: number | null) {
  await context.db.query(
    `INSERT INTO ingest_dead_letters (id, kind, state, source, code, message, resolved_at, created_at)
     VALUES ($1,'job',$2,'qiangua','SOURCE_UNAVAILABLE','x',$3,$4)`,
    [
      id,
      state,
      resolvedDaysAgo === null ? null : new Date(NOW.getTime() - resolvedDaysAgo * DAY),
      new Date(NOW.getTime() - 400 * DAY),
    ],
  )
}

async function addAudit(context: TestCtx, id: string, daysAgo: number) {
  await context.db.query(
    `INSERT INTO audit_logs (id, action, entity_type, summary, created_at) VALUES ($1,'x','creator','x',$2)`,
    [id, new Date(NOW.getTime() - daysAgo * DAY)],
  )
}

const ids = async (context: TestCtx, sql: string, params: unknown[] = []) =>
  (await context.db.query(sql, params)).rows.map((row) => row.id).sort()

describe('retention config', () => {
  it('defaults to 10 raw per source, 90 / 365 days, once a day', () => {
    expect(retentionConfig({})).toEqual(RETENTION_DEFAULTS)
    expect(RETENTION_DEFAULTS).toEqual({ rawPerSource: 10, deadLetterDays: 90, auditDays: 365, intervalMs: DAY })
  })

  it('reads the env knobs; 0 is kept, junk falls back to the default', () => {
    expect(
      retentionConfig({
        RETENTION_RAW_PER_SOURCE: '3',
        RETENTION_DEAD_LETTER_DAYS: '0',
        RETENTION_AUDIT_DAYS: 'soon',
        RETENTION_INTERVAL_HOURS: '6',
      }),
    ).toEqual({ rawPerSource: 3, deadLetterDays: 0, auditDays: 365, intervalMs: 6 * 3_600_000 })
    expect(retentionConfig({ RETENTION_RAW_PER_SOURCE: '-1' }).rawPerSource).toBe(10)
  })
})

describe('runRetention', () => {
  it('keeps the newest N raw payloads per (creator, source) and never touches history', async () => {
    const context = await setup()
    await addRaw(context, 'qiangua', 13)
    await addRaw(context, 'xinhong', 4)
    const history = await context.db.query('SELECT count(*)::int AS n FROM creator_metrics_history')

    const result = await runRetention(context.db, { ...RETENTION_DEFAULTS }, NOW)

    expect(result.raw).toBe(3)
    const kept = await ids(context, 'SELECT id FROM creator_raw WHERE creator_id = $1', [CREATOR])
    expect(kept.filter((id) => id.startsWith('raw-qiangua'))).toEqual(
      Array.from({ length: 10 }, (_, i) => `raw-qiangua-${String(i).padStart(2, '0')}`),
    )
    expect(kept.filter((id) => id.startsWith('raw-xinhong'))).toHaveLength(4)
    const after = await context.db.query('SELECT count(*)::int AS n FROM creator_metrics_history')
    expect(after.rows[0].n).toBe(history.rows[0].n)
  })

  it('drops settled dead letters past the window; open ones stay however old', async () => {
    const context = await setup()
    await addDeadLetter(context, 'dl-open-old', 'open', null)
    await addDeadLetter(context, 'dl-replayed-old', 'replayed', 91)
    await addDeadLetter(context, 'dl-dismissed-old', 'dismissed', 200)
    await addDeadLetter(context, 'dl-dismissed-new', 'dismissed', 89)

    const result = await runRetention(context.db, { ...RETENTION_DEFAULTS }, NOW)

    expect(result.deadLetters).toBe(2)
    expect(await ids(context, 'SELECT id FROM ingest_dead_letters')).toEqual(['dl-dismissed-new', 'dl-open-old'])
  })

  it('drops audit rows older than the window', async () => {
    const context = await setup()
    await addAudit(context, 'audit-old', 366)
    await addAudit(context, 'audit-new', 364)

    const result = await runRetention(context.db, { ...RETENTION_DEFAULTS }, NOW)

    expect(result.auditLogs).toBe(1)
    expect(await ids(context, 'SELECT id FROM audit_logs')).toEqual(['audit-new'])
  })

  it('0 keeps everything of that kind', async () => {
    const context = await setup()
    await addRaw(context, 'qiangua', 12)
    await addDeadLetter(context, 'dl-dismissed-old', 'dismissed', 500)
    await addAudit(context, 'audit-old', 2_000)

    const result = await runRetention(
      context.db,
      { rawPerSource: 0, deadLetterDays: 0, auditDays: 0, intervalMs: DAY },
      NOW,
    )

    expect(result).toEqual({ raw: 0, deadLetters: 0, auditLogs: 0 })
    expect((await ids(context, 'SELECT id FROM creator_raw WHERE creator_id = $1', [CREATOR])).length).toBe(12)
  })

  it('is idempotent', async () => {
    const context = await setup()
    await addRaw(context, 'qiangua', 12)
    await runRetention(context.db, { ...RETENTION_DEFAULTS }, NOW)
    expect(await runRetention(context.db, { ...RETENTION_DEFAULTS }, NOW)).toEqual({ raw: 0, deadLetters: 0, auditLogs: 0 })
  })
})

describe('retention in the worker', () => {
  it('only the queue lock holder sweeps; the standby sweeps once it takes over', async () => {
    const context = await setup()
    await context.db.query('DELETE FROM ingest_jobs')
    await addAudit(context, 'audit-old', 400)
    const off: RetentionConfig = { ...RETENTION_DEFAULTS, intervalMs: 0 }
    const on: RetentionConfig = { ...RETENTION_DEFAULTS, intervalMs: DAY }

    const stopHolder = startIngestWorker(context.env, { intervalMs: 30, retention: off })
    await new Promise((resolve) => setTimeout(resolve, 200))
    const stopStandby = startIngestWorker(context.env, { intervalMs: 30, retention: on })
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(await ids(context, 'SELECT id FROM audit_logs')).toEqual(['audit-old'])

      stopHolder()
      const deadline = Date.now() + 5_000
      let left = ['audit-old']
      while (Date.now() < deadline && left.length) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        left = await ids(context, 'SELECT id FROM audit_logs')
      }
      expect(left).toEqual([])
    } finally {
      stopHolder()
      stopStandby()
    }
  }, 20_000)
})
