import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { ERROR, PATHS } from '../helpers/contract'
import { createAndPublish, createCreator, poolItems, runId } from '../helpers/fixtures'
import { errorCode, itemsOf, request } from '../helpers/http'

/**
 * PRD §5 分类多标签 + DOMAIN Category / 边界场景.
 * Break: pool contains blacklist, or a creator carries both coop_history slugs.
 */

describe('Categories — coop_history mutex and blacklist', () => {
  let ops: Session
  let selector: Session

  beforeAll(async () => {
    ops = await login('ops')
    selector = await login('selector')
  })

  it('lists builtin collaborated and never_collaborated (PRD §5 / SCREEN OPS-CATEGORY)', async () => {
    const res = await request('GET', PATHS.opsCategories, { token: ops.token })
    expect(res.status).toBe(200)
    const slugs = itemsOf(res.json).map((row) => row.slug)
    expect(slugs).toEqual(expect.arrayContaining(['collaborated', 'never_collaborated']))
  })

  it('rejects collaborated + never_collaborated on the same creator (PRD §5 coop_history 互斥)', async () => {
    const res = await request('POST', PATHS.opsCreators, {
      token: ops.token,
      body: {
        displayName: `mutex-${runId()}`,
        regions: ['서울'],
        followersUnknown: true,
        categories: ['collaborated', 'never_collaborated'],
      },
    })
    expect(res.status).toBe(400)
    expect([ERROR.VALIDATION, 'CATEGORY-MUTEX']).toContain(errorCode(res.json) ?? ERROR.VALIDATION)
  })

  it('switching coop_history replaces the previous slug instead of stacking (PRD §5 组内最多一个)', async () => {
    const created = await createCreator(ops, {
      displayName: `switch-${runId()}`,
      followersUnknown: true,
      categories: ['collaborated'],
    })
    const patched = await request('PATCH', PATHS.opsCreator(String(created.id)), {
      token: ops.token,
      body: { categories: ['never_collaborated'] },
    })
    expect(patched.status).toBe(200)
    const detail = await request('GET', PATHS.opsCreator(String(created.id)), {
      token: ops.token,
    })
    const cats = (detail.json.categories as string[]) ?? []
    expect(cats).toContain('never_collaborated')
    expect(cats).not.toContain('collaborated')
  })

  it('never puts a released blacklist creator in the selector pool (PRD §5 / DOMAIN §1 / §边界)', async () => {
    const key = runId('bl')
    const created = await createAndPublish(ops, {
      creatorKey: key,
      displayName: `黑名单-${key}`,
      followersUnknown: true,
      categories: ['collaborated', 'blacklist'],
    })
    const pool = await poolItems(selector)
    expect(pool.some((row) => row.id === created.id || row.creatorKey === key)).toBe(false)

    const front = await request('GET', PATHS.poolCreator(String(created.id)), {
      token: selector.token,
    })
    expect(front.status).toBe(404)
  })

  it('refuses to disable builtin collaborated / never_collaborated (SCREEN OPS-CATEGORY)', async () => {
    for (const slug of ['collaborated', 'never_collaborated']) {
      const res = await request('PATCH', PATHS.opsCategory(slug), {
        token: ops.token,
        body: { enabled: false },
      })
      expect(res.status, slug).toBe(400)
    }
  })

  it('has_collaborated follows Collaboration count, not the category tag (PRD §6.1 / DOMAIN §3)', async () => {
    const key = runId('hc')
    const created = await createAndPublish(ops, {
      creatorKey: key,
      displayName: `履历冲突-${key}`,
      followers: 2000,
      categories: ['never_collaborated'],
      collaborations: [{ brand: '兰芝' }],
    })
    const detail = await request('GET', PATHS.opsCreator(String(created.id)), {
      token: ops.token,
    })
    expect(detail.json.hasCollaborated).toBe(true)
    expect(detail.json.collabCount).toBeGreaterThanOrEqual(1)

    const pool = await request('GET', PATHS.pool, {
      token: selector.token,
      query: { hasCollaborated: true },
    })
    expect(pool.status).toBe(200)
    expect(itemsOf(pool.json).some((row) => row.id === created.id)).toBe(true)
  })
})
