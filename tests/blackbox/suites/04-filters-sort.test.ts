import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { createAndPublish, runId } from '../helpers/fixtures'
import { itemsOf, request } from '../helpers/http'

/**
 * PRD §6 筛选 AND + 排序 SSOT.
 * Break: OR across fields, or sort order that ignores followers / collab_count / price.
 */

type Person = { id: string; displayName: string }

describe('Filter AND + sort (followers, collab count, price)', () => {
  let selector: Session
  let tag: string
  let high: Person
  let mid: Person
  let low: Person
  let unpriced: Person

  beforeAll(async () => {
    const ops = await login('ops')
    selector = await login('selector')
    tag = runId('flt')

    const seed = [
      {
        displayName: `${tag}-high`,
        followers: 200_000,
        rating: 4.9,
        categories: ['collaborated'] as string[],
        collaborations: [{ brand: '兰芝' }, { brand: '雪花秀' }, { brand: '悦诗风吟' }],
        price: { amountMin: 9000, amountMax: 12000, currency: 'CNY' },
        verticals: [tag],
      },
      {
        displayName: `${tag}-mid`,
        followers: 50_000,
        rating: 4.0,
        categories: ['collaborated'] as string[],
        collaborations: [{ brand: '兰芝' }],
        price: { amountMin: 5000, currency: 'CNY' },
        verticals: [tag],
      },
      {
        displayName: `${tag}-low`,
        followers: 3_000,
        rating: 3.1,
        categories: ['never_collaborated'] as string[],
        price: { amountMin: 2000, currency: 'CNY' },
        verticals: [tag],
      },
      {
        displayName: `${tag}-unpriced`,
        followers: 80_000,
        rating: 4.2,
        categories: ['never_collaborated'] as string[],
        verticals: [tag],
      },
    ]

    const created: Person[] = []
    for (const person of seed) {
      const row = await createAndPublish(ops, person)
      created.push({ id: String(row.id), displayName: person.displayName })
    }
    ;[high, mid, low, unpriced] = created
  })

  async function pool(query: Record<string, string | number | boolean | undefined>) {
    const res = await request('GET', PATHS.pool, {
      token: selector.token,
      query: { verticals: tag, ...query },
    })
    expect(res.status).toBe(200)
    return itemsOf(res.json).filter((row) => String(row.displayName).startsWith(tag))
  }

  it('defaults to rating desc then followers, unrated after rated (PRD §6.2 SEL-LIBRARY)', async () => {
    const rows = await pool({})
    const names = rows.map((row) => row.displayName)
    expect(names).toEqual([
      `${tag}-high`,
      `${tag}-unpriced`,
      `${tag}-mid`,
      `${tag}-low`,
    ])
  })

  it('ANDs followers + hasCollaborated + overlapping price (PRD §6)', async () => {
    const rows = await pool({
      followersMin: 10_000,
      hasCollaborated: true,
      priceMin: 8000,
      priceMax: 10000,
      currency: 'CNY',
    })
    expect(rows.map((row) => row.displayName)).toEqual([`${tag}-high`])
    expect(rows.some((row) => row.id === mid.id || row.id === low.id)).toBe(false)
  })

  it('ANDs followers range with collab_count range (PRD §6.1)', async () => {
    const rows = await pool({
      followersMin: 40_000,
      followersMax: 90_000,
      collabCountMin: 1,
      collabCountMax: 2,
    })
    expect(rows.map((row) => row.displayName)).toEqual([`${tag}-mid`])
  })

  it('sorts followers descending from the API (PRD §6.1 followers 可排序)', async () => {
    const rows = await pool({ sort: 'followers', order: 'desc' })
    expect(rows.map((row) => row.displayName)).toEqual([
      `${tag}-high`,
      `${tag}-unpriced`,
      `${tag}-mid`,
      `${tag}-low`,
    ])
  })

  it('sorts followers ascending from the API', async () => {
    const rows = await pool({ sort: 'followers', order: 'asc' })
    expect(rows.map((row) => row.displayName)).toEqual([
      `${tag}-low`,
      `${tag}-mid`,
      `${tag}-unpriced`,
      `${tag}-high`,
    ])
  })

  it('sorts collab_count descending from the API (PRD §6.1)', async () => {
    const rows = await pool({ sort: 'collab_count', order: 'desc' })
    const names = rows.map((row) => row.displayName)
    expect(names[0]).toBe(`${tag}-high`)
    expect(names[1]).toBe(`${tag}-mid`)
  })

  it('sorts price by amount_min and sinks missing prices (DOMAIN Price / PRD §6.1)', async () => {
    const rows = await pool({ sort: 'price', order: 'asc' })
    expect(rows.map((row) => row.displayName)).toEqual([
      `${tag}-low`,
      `${tag}-mid`,
      `${tag}-high`,
      `${tag}-unpriced`,
    ])
    expect(rows.at(-1)?.id).toBe(unpriced.id)
  })

  it('empty AND intersection is an empty list, not a 5xx (DOMAIN 边界 / UX 空态)', async () => {
    const rows = await pool({
      hasCollaborated: false,
      categories: 'collaborated',
    })
    expect(rows).toEqual([])
  })
})
