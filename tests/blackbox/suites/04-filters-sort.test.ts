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

  it('pages on the server: page / pageSize, total before paging, dir as an alias of order', async () => {
    const first = await request('GET', PATHS.pool, {
      token: selector.token,
      query: { region: tag, sort: 'followers', dir: 'desc', page: 1, pageSize: 2 },
    })
    const second = await request('GET', PATHS.pool, {
      token: selector.token,
      query: { region: tag, sort: 'followers', dir: 'desc', page: 2, pageSize: 2 },
    })
    expect(first.json.total).toBe(3)
    expect(first.json.pageSize).toBe(2)
    expect([...itemsOf(first.json), ...itemsOf(second.json)].map((row) => row.displayName)).toEqual([
      `${tag}-high`,
      `${tag}-mid`,
      `${tag}-low`,
    ])
    const capped = await request('GET', PATHS.pool, { token: selector.token, query: { pageSize: 9999 } })
    expect(capped.json.pageSize).toBe(100)
    expect(itemsOf(capped.json).length).toBeLessThanOrEqual(100)
  })

  it('empty AND intersection is an empty list', async () => {
    expect(await pool({ health: 'abnormal', source: 'qiangua' })).toEqual([])
  })
})
