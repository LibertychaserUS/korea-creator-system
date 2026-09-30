import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/**
 * Break: a page past the end (numeric jump, or a next-cursor step into a
 * gap) returns empty items with prevCursor null, and the pager has no way
 * back.
 */
describe('pool empty-page cursors', () => {
  let ctx: TestCtx
  let token: string
  let ops: string
  const region = '游标测试区'
  // cpe = 1+i, the pool default sort is cpe ascending: this is also pool order.
  const names = ['游标一', '游标二', '游标三', '游标四', '游标五', '游标六']

  type PageBody = {
    items: Array<{ id: string; displayName: string }>
    total: number
    page: number
    nextCursor: string | null
    prevCursor: string | null
  }

  const get = async (query: string): Promise<PageBody> => {
    const res = await ctx.app.request(`/api/select/pool?region=${encodeURIComponent(region)}&${query}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    return res.json()
  }

  const ids = (page: PageBody) => page.items.map((row) => row.id)

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    for (let i = 0; i < names.length; i += 1) {
      const created = await ctx.app.request('/api/ops/creators', {
        method: 'POST',
        headers: { authorization: `Bearer ${ops}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: names[i],
          followers: 10_000 + i,
          regions: [region],
          verticals: ['cursor-test'],
          categories: ['never_collaborated'],
          metrics: { window: 30, followers: 10_000 + i, cpe: 1 + i, readMedian: 4000, interactionMedian: 400 },
        }),
      })
      const { id } = await created.json()
      const published = await ctx.app.request(`/api/ops/creators/${id}/publish`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ops}` },
      })
      expect(published.status).toBe(200)
    }
    token = (await ctx.loginJson('selector@kcs.local')).token
  })

  afterAll(() => ctx.close())

  it('the exact next page after the last one is empty but walks back page by page', async () => {
    const page3 = await get('page=3&pageSize=2')
    expect(page3.items.map((row) => row.displayName)).toEqual(['游标五', '游标六'])
    expect(page3.nextCursor).toBeNull()

    // Page 4 starts exactly at the total; page 1 gets no prevCursor.
    const empty = await get('page=4&pageSize=2')
    expect(empty.items).toEqual([])
    expect(empty.total).toBe(6)
    expect(empty.page).toBe(4)
    expect(empty.nextCursor).toBeNull()
    expect(empty.prevCursor).toBeTruthy()
    const first = await get('page=1&pageSize=2')
    expect(first.prevCursor ?? null).toBeNull()

    // Each step back matches the numeric page, all the way to page 1.
    const back = await get(`cursor=${encodeURIComponent(empty.prevCursor!)}&pageSize=2`)
    expect(back.page).toBe(3)
    expect(ids(back)).toEqual(ids(page3))
    const numeric2 = await get('page=2&pageSize=2')
    const further = await get(`cursor=${encodeURIComponent(back.prevCursor!)}&pageSize=2`)
    expect(further.page).toBe(2)
    expect(ids(further)).toEqual(ids(numeric2))
    const top = await get(`cursor=${encodeURIComponent(further.prevCursor!)}&pageSize=2`)
    expect(top.page).toBe(1)
    expect(ids(top)).toEqual(ids(first))
    expect(top.prevCursor).toBeNull()
  })

  it('a numeric jump far past the end still lands on real rows, not a dead end', async () => {
    const empty = await get('page=7&pageSize=2')
    expect(empty.items).toEqual([])
    expect(empty.prevCursor).toBeTruthy()
    const back = await get(`cursor=${encodeURIComponent(empty.prevCursor!)}&pageSize=2`)
    expect(back.items.length).toBeGreaterThan(0)
    // The landing window is the tail of the list, newest last-page rows included.
    const numeric3 = await get('page=3&pageSize=2')
    expect(ids(back)).toEqual(ids(numeric3))
    const again = await get(`cursor=${encodeURIComponent(back.prevCursor!)}&pageSize=2`)
    expect(again.items.length).toBeGreaterThan(0)
  })

  it('a next-cursor step into a gap (rows vanished mid-walk) flips back to the page it came from', async () => {
    const p1 = await get('page=1&pageSize=2')
    expect(p1.nextCursor).toBeTruthy()
    // Everything after the first page disappears before the client steps on.
    for (const name of names.slice(2)) {
      const row = (await ctx.db.query('SELECT id FROM creators WHERE display_name = $1', [name])).rows[0]
      await ctx.app.request(`/api/ops/creators/${row.id}/unpublish`, { method: 'POST', headers: { authorization: `Bearer ${ops}` } })
    }
    const empty = await get(`cursor=${encodeURIComponent(p1.nextCursor!)}&pageSize=2`)
    expect(empty.items).toEqual([])
    expect(empty.page).toBe(2)
    expect(empty.nextCursor).toBeNull()
    expect(empty.prevCursor).toBeTruthy()
    const back = await get(`cursor=${encodeURIComponent(empty.prevCursor!)}&pageSize=2`)
    expect(back.page).toBe(1)
    expect(ids(back)).toEqual(ids(p1))
  })

  it('synthesized cursors stay bound to the list: another region\'s cursor is rejected', async () => {
    // After the gap test only two pool rows remain; page 2 starts at the
    // total, so it is empty with a synthesized prevCursor.
    const empty = await get('page=2&pageSize=2')
    expect(empty.items).toEqual([])
    expect(empty.prevCursor).toBeTruthy()
    const res = await ctx.app.request(
      `/api/select/pool?region=${encodeURIComponent('别的区')}&cursor=${encodeURIComponent(empty.prevCursor!)}`,
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(res.status).toBe(400)
  })
})
