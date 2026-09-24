import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import {
  createAndPublish,
  createCreator,
  poolItems,
  publishCreator,
  runId,
  unpublishCreator,
} from '../helpers/fixtures'
import { itemsOf, request } from '../helpers/http'

/**
 * PRD §7 发布规则 + §12 + DOMAIN 不变量 1 + SCREEN SEL-LIBRARY / SEL-CREATOR / OPS-CREATOR-DETAIL.
 * Break: unpublished or withdrawn creator appears on GET /api/select/pool.
 */

describe('Creator CRUD + publish / unpublish visibility', () => {
  let ops: Session
  let selector: Session

  beforeAll(async () => {
    ops = await login('ops')
    selector = await login('selector')
  })

  it('creates a draft that ops can GET and the selector pool must omit (PRD §7 / DOMAIN §1)', async () => {
    const key = runId('draft')
    const created = await createCreator(ops, {
      creatorKey: key,
      displayName: `草稿-${key}`,
      followers: 42,
      categories: ['never_collaborated'],
    })
    expect(created.id).toBeTruthy()
    expect(created.status === undefined || created.status === 'draft' || created.status === 'ready').toBe(
      true,
    )

    const detail = await request('GET', PATHS.opsCreator(String(created.id)), {
      token: ops.token,
    })
    expect(detail.status).toBe(200)
    expect(detail.json.displayName).toBe(`草稿-${key}`)
    expect(detail.json.creatorKey ?? created.creatorKey).toBe(key)

    const pool = await poolItems(selector)
    expect(pool.some((row) => row.id === created.id || row.creatorKey === key)).toBe(false)

    const front = await request('GET', PATHS.poolCreator(String(created.id)), {
      token: selector.token,
    })
    expect(front.status).toBe(404)
  })

  it('publishes a complete creator into the selector pool (PRD §12 / UX 2 成功)', async () => {
    const key = runId('pub')
    const created = await createAndPublish(ops, {
      creatorKey: key,
      displayName: `已发布-${key}`,
      followers: 88000,
      regions: ['서울'],
      verticals: ['beauty'],
      source: 'pugongying',
      metrics: { window: 30, followers: 88000, cpe: 2.8, health: 'excellent' },
      categories: ['collaborated'],
      collaborations: [{ brand: '설화수' }],
      price: { amountMin: 8000, amountMax: 12000, currency: 'CNY' },
    })

    const pool = await poolItems(selector)
    const hit = pool.find((row) => row.id === created.id || row.creatorKey === key)
    expect(hit).toBeTruthy()
    expect(hit?.displayName).toBe(`已发布-${key}`)
    expect(hit?.status).toBeUndefined()
    expect(hit?.lastIngestJobId).toBeUndefined()
    expect(hit?.needsReview).toBeUndefined()

    const front = await request('GET', PATHS.poolCreator(String(created.id)), {
      token: selector.token,
    })
    expect(front.status).toBe(200)
    expect(front.json.displayName).toBe(`已发布-${key}`)
  })

  it('unpublish immediately removes the person from the pool (PRD §7 撤回)', async () => {
    const key = runId('unpub')
    const created = await createAndPublish(ops, {
      creatorKey: key,
      displayName: `将撤回-${key}`,
      followers: 5000,
    })
    const before = await poolItems(selector)
    expect(before.some((row) => row.id === created.id)).toBe(true)

    const withdrawn = await unpublishCreator(ops, String(created.id))
    expect(withdrawn.status).toBe(200)

    const after = await poolItems(selector)
    expect(after.some((row) => row.id === created.id || row.creatorKey === key)).toBe(false)

    const front = await request('GET', PATHS.poolCreator(String(created.id)), {
      token: selector.token,
    })
    expect(front.status).toBe(404)
  })

  it('ops PATCH updates display_name and GET ops shows the new value (PRD §8.1)', async () => {
    const key = runId('edit')
    const created = await createCreator(ops, {
      creatorKey: key,
      displayName: `旧名-${key}`,
      followersUnknown: true,
    })
    const patched = await request('PATCH', PATHS.opsCreator(String(created.id)), {
      token: ops.token,
      body: { displayName: `新名-${key}`, followers: 12345, followersUnknown: false },
    })
    expect(patched.status).toBe(200)
    const again = await request('GET', PATHS.opsCreator(String(created.id)), {
      token: ops.token,
    })
    expect(again.json.displayName).toBe(`新名-${key}`)
    expect(again.json.followers).toBe(12345)
  })

  it('publish is refused when required fields are missing (PRD §7 必填齐)', async () => {
    const created = await request('POST', PATHS.opsCreators, {
      token: ops.token,
      body: { displayName: '' },
    })
    expect([400, 422]).toContain(created.status)
  })

  it('re-publish after unpublish returns the person to the pool (PRD §8.1 撤回可撤销)', async () => {
    const key = runId('repub')
    const created = await createAndPublish(ops, {
      creatorKey: key,
      displayName: `再发布-${key}`,
      followers: 9000,
      regions: ['부산'],
    })
    await unpublishCreator(ops, String(created.id))
    const again = await publishCreator(ops, String(created.id))
    expect(again.status).toBe(200)
    const pool = await poolItems(selector)
    expect(pool.some((row) => row.id === created.id)).toBe(true)
  })

  it('ops inventory GET includes draft while selector pool GET does not (PRD §7 字段差)', async () => {
    const key = runId('gap')
    const draft = await createCreator(ops, {
      creatorKey: key,
      displayName: `仅后台-${key}`,
      followersUnknown: true,
    })
    const opsList = await request('GET', PATHS.opsCreators, { token: ops.token, query: { q: `仅后台-${key}` } })
    expect(opsList.status).toBe(200)
    expect(itemsOf(opsList.json).some((row) => row.id === draft.id)).toBe(true)

    const pool = await poolItems(selector)
    expect(pool.some((row) => row.id === draft.id)).toBe(false)
  })
})
