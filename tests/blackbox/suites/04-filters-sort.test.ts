import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { createAndPublish, runId } from '../helpers/fixtures'
import { itemsOf, request } from '../helpers/http'

describe('Metric filter AND + sort', () => {
  let selector: Session
  let tag: string

  beforeAll(async () => {
    const ops = await login('ops')
    selector = await login('selector')
    tag = runId('metric')
    for (const row of [
      { name: 'high', followers: 200_000, cpe: 4.2, health: 'normal', source: 'pugongying' as const },
      { name: 'mid', followers: 30_000, cpe: 1.8, health: 'excellent', source: 'qiangua' as const },
      { name: 'low', followers: 3_000, cpe: 2.7, health: 'excellent', source: 'xinhong' as const },
    ]) {
      await createAndPublish(ops, {
        displayName: `${tag}-${row.name}`,
        followers: row.followers,
        source: row.source,
        regions: [tag],
        verticals: [tag],
        metrics: {
          window: 30,
          followers: row.followers,
          cpe: row.cpe,
          health: row.health,
          readMedian: row.followers / 4,
          interactionMedian: row.followers / 50,
        },
      })
    }
  })

  async function pool(query: Record<string, string | number | boolean | undefined>) {
    const res = await request('GET', PATHS.pool, {
      token: selector.token,
      query: { region: tag, ...query },
    })
    expect(res.status).toBe(200)
    return itemsOf(res.json)
  }

  it('defaults to CPE ascending and exposes no grade/final/rank', async () => {
    const rows = await pool({})
    expect(rows.map((row) => row.displayName)).toEqual([`${tag}-mid`, `${tag}-low`, `${tag}-high`])
    expect(rows[0].grade).toBeUndefined()
    expect(rows[0].final).toBeUndefined()
    expect(rows[0].rank).toBeUndefined()
  })

  it('sorts followers descending', async () => {
    const rows = await pool({ sort: 'followers', order: 'desc' })
    expect(rows.map((row) => row.displayName)).toEqual([`${tag}-high`, `${tag}-mid`, `${tag}-low`])
  })

  it('ANDs tier, health, source and CPE bounds', async () => {
    const rows = await pool({ tier: 'junior', health: 'excellent', source: 'qiangua', cpeMax: 2 })
    expect(rows.map((row) => row.displayName)).toEqual([`${tag}-mid`])
  })

  it('returns derived metrics and percentile objects', async () => {
    const rows = await pool({})
    expect(rows.every((row) => Number(row.metrics.engagementRate) > 0)).toBe(true)
    expect(rows.every((row) => typeof row.percentiles === 'object')).toBe(true)
  })

  it('empty AND intersection is an empty list', async () => {
    expect(await pool({ health: 'abnormal', source: 'qiangua' })).toEqual([])
  })
})
