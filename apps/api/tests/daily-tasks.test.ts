import { afterEach, describe, expect, it } from 'vitest'
import {
  dailyConfig,
  dailyTaskNames,
  localDayHour,
  registerDailyTask,
  runDueDailyTasks,
} from '../src/ingest/daily'
import { createTestApp, type TestCtx } from './helpers'

const contexts: TestCtx[] = []
const unregister: (() => void)[] = []

afterEach(async () => {
  unregister.splice(0).forEach((fn) => fn())
  await Promise.all(contexts.splice(0).map(async (context) => {
    await context.db.query("DELETE FROM ingest_daily_runs WHERE task LIKE 'test-%'")
    await context.close()
  }))
})

async function setup() {
  const context = await createTestApp()
  contexts.push(context)
  await context.db.query("DELETE FROM ingest_daily_runs WHERE task LIKE 'test-%'")
  return context
}

const config = { enabled: true, hour: 4, timeZone: 'Asia/Shanghai' }

describe('daily task hook', () => {
  it('reads its settings from the environment, with Beijing 04:00 as the default', () => {
    expect(dailyConfig({})).toEqual({ enabled: true, hour: 4, timeZone: 'Asia/Shanghai' })
    expect(dailyConfig({ DAILY_TASKS: '0', DAILY_TASKS_HOUR: '23', DAILY_TASKS_TZ: 'Asia/Seoul' }))
      .toEqual({ enabled: false, hour: 23, timeZone: 'Asia/Seoul' })
    expect(dailyConfig({ DAILY_TASKS_HOUR: '99', DAILY_TASKS_TZ: 'Mars/Base' })).toEqual({ enabled: true, hour: 4, timeZone: 'Asia/Shanghai' })
    // 19:30 UTC on the 23rd is 03:30 on the 24th in Beijing.
    expect(localDayHour(new Date('2026-09-23T19:30:00Z'), 'Asia/Shanghai')).toEqual({ day: '2026-09-24', hour: 3 })
  })

  it('runs each registered task once per local day, from the configured hour on', async () => {
    const context = await setup()
    const seen: string[] = []
    unregister.push(registerDailyTask('test-capacity', async () => {
      seen.push(context.env.now().toISOString())
      return { rows: 3 }
    }))
    expect(dailyTaskNames()).toContain('test-capacity')
    let clock = new Date('2026-09-23T19:30:00Z') // 03:30 Beijing: too early
    context.env.now = () => clock
    expect(await runDueDailyTasks(context.env, config)).toEqual([])

    clock = new Date('2026-09-23T20:05:00Z') // 04:05 Beijing
    const first = await runDueDailyTasks(context.env, config)
    expect(first.map((o) => [o.task, o.day, o.ok])).toContainEqual(['test-capacity', '2026-09-24', true])
    clock = new Date('2026-09-24T09:00:00Z') // later the same Beijing day
    expect((await runDueDailyTasks(context.env, config)).some((o) => o.task === 'test-capacity')).toBe(false)
    clock = new Date('2026-09-24T20:10:00Z') // next Beijing day
    expect((await runDueDailyTasks(context.env, config)).some((o) => o.task === 'test-capacity')).toBe(true)
    expect(seen).toHaveLength(2)

    const { rows } = await context.db.query("SELECT day::text, ok, result FROM ingest_daily_runs WHERE task = 'test-capacity' ORDER BY day")
    expect(rows).toEqual([
      { day: '2026-09-24', ok: true, result: { rows: 3 } },
      { day: '2026-09-25', ok: true, result: { rows: 3 } },
    ])
    expect(await runDueDailyTasks(context.env, { ...config, enabled: false })).toEqual([])
  })

  it('records a failure without stopping the other tasks, and ops can run a task again by hand', async () => {
    const context = await setup()
    let attempts = 0
    unregister.push(registerDailyTask('test-broken', async () => {
      attempts += 1
      if (attempts === 1) throw new Error('disk probe failed')
      return 'fine'
    }))
    unregister.push(registerDailyTask('test-other', async () => 'ok'))
    context.env.now = () => new Date('2026-09-24T01:00:00Z') // 09:00 Beijing
    const outcomes = await runDueDailyTasks(context.env, config)
    expect(outcomes.find((o) => o.task === 'test-broken')).toMatchObject({ ok: false, error: 'disk probe failed' })
    expect(outcomes.find((o) => o.task === 'test-other')).toMatchObject({ ok: true })

    const status = await context.app.request('/api/ingest/daily', { headers: { authorization: 'Bearer test:devops@kcs.local' } })
    const items = (await status.json()).items as { task: string; ok: boolean; error: string | null }[]
    expect(items.find((i) => i.task === 'test-broken')).toMatchObject({ ok: false, error: 'disk probe failed' })

    const denied = await context.app.request('/api/ingest/daily/test-broken/run', { method: 'POST', headers: { authorization: 'Bearer test:selector@kcs.local' } })
    expect(denied.status).toBe(403)
    const rerun = await context.app.request('/api/ingest/daily/test-broken/run', { method: 'POST', headers: { authorization: 'Bearer test:devops@kcs.local' } })
    expect(rerun.status).toBe(200)
    expect(await rerun.json()).toMatchObject({ task: 'test-broken', ok: true, result: 'fine' })
    const missing = await context.app.request('/api/ingest/daily/test-nope/run', { method: 'POST', headers: { authorization: 'Bearer test:devops@kcs.local' } })
    expect(missing.status).toBe(404)
  })

  it('rejects names that cannot be a task key', () => {
    expect(() => registerDailyTask('Bad Name', async () => null)).toThrow()
  })
})
