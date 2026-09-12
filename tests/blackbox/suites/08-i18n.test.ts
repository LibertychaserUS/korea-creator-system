import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { ERROR, PATHS } from '../helpers/contract'
import { createAndPublish, runId } from '../helpers/fixtures'
import { errorCode, itemsOf, request } from '../helpers/http'

/**
 * PRD §9 / DOMAIN §7: locale switches chrome only. Scores, ids, display_name stay put.
 * Break: Accept-Language or ?locale= rewrites creator_key, id, or rating.
 */

const LOCALES = ['zh-CN', 'en', 'ko'] as const

describe('i18n — stable codes, ids, and scores', () => {
  let ops: Session
  let selector: Session
  let id: string
  let creatorKey: string

  beforeAll(async () => {
    ops = await login('ops')
    selector = await login('selector')
    const key = runId('i18n')
    const created = await createAndPublish(ops, {
      creatorKey: key,
      displayName: '서울살림노트',
      followers: 17250,
      rating: 4.2,
      regions: ['서울'],
      verticals: ['life'],
      categories: ['never_collaborated'],
    })
    id = String(created.id)
    creatorKey = String(created.creatorKey ?? key)
  })

  it('AUTH-DENIED code is identical across Accept-Language (PRD §2 / SCREEN AUTH-DENIED)', async () => {
    const codes: string[] = []
    for (const lang of LOCALES) {
      const res = await request('GET', PATHS.opsCreators, {
        token: selector.token,
        acceptLanguage: lang,
        query: { locale: lang },
      })
      expect(res.status).toBe(403)
      const code = errorCode(res.json)
      expect(code).toBe(ERROR.DENIED)
      codes.push(String(code))
    }
    expect(new Set(codes).size).toBe(1)
  })

  it('AUTH-LOGIN code is identical across locales (UX 未登录)', async () => {
    const codes: string[] = []
    for (const lang of LOCALES) {
      const res = await request('GET', PATHS.pool, {
        acceptLanguage: lang,
        query: { locale: lang },
      })
      expect(res.status).toBe(401)
      expect(errorCode(res.json)).toBe(ERROR.LOGIN)
      codes.push(String(errorCode(res.json)))
    }
    expect(new Set(codes).size).toBe(1)
  })

  it('pool ids, creator_key, rating, followers do not change with Accept-Language (DOMAIN §7)', async () => {
    const snapshots: Array<{ id: unknown; key: unknown; rating: unknown; followers: unknown; name: unknown }> =
      []
    for (const lang of LOCALES) {
      const res = await request('GET', PATHS.pool, {
        token: selector.token,
        acceptLanguage: lang,
        query: { locale: lang },
      })
      expect(res.status).toBe(200)
      const hit = itemsOf(res.json).find((row) => row.id === id || row.creatorKey === creatorKey)
      expect(hit).toBeTruthy()
      snapshots.push({
        id: hit?.id,
        key: hit?.creatorKey,
        rating: hit?.rating,
        followers: hit?.followers,
        name: hit?.displayName,
      })
    }
    for (const snap of snapshots) {
      expect(snap.id).toBe(id)
      expect(snap.key).toBe(creatorKey)
      expect(Number(snap.rating)).toBe(4.2)
      expect(Number(snap.followers)).toBe(17250)
      expect(snap.name).toBe('서울살림노트')
    }
  })

  it('selector creator detail keeps original display_name under ?locale=ko (PRD §9)', async () => {
    const res = await request('GET', PATHS.poolCreator(id), {
      token: selector.token,
      acceptLanguage: 'en',
      query: { locale: 'ko' },
    })
    expect(res.status).toBe(200)
    expect(res.json.displayName).toBe('서울살림노트')
    expect(res.json.id).toBe(id)
    expect(Number(res.json.rating)).toBe(4.2)
  })
})
