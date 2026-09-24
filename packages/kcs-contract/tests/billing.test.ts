import { describe, expect, it } from 'vitest'
import { microsToUsd, usdToMicros, vendorPriceUsd } from '../src/billing'
import { SOURCE_DEFAULTS, SOURCE_PAUSING_FAILURES, classifyIngestFailure } from '../src/source-adapter'

describe('vendor prices', () => {
  it('uses the longest matching prefix of the TikHub list prices', () => {
    expect(vendorPriceUsd('tikhub:/api/v1/xiaohongshu/pgy/get_blogger_detail')).toBe(0.02)
    expect(vendorPriceUsd('tikhub:/api/v1/xiaohongshu/pgy/get_note_comments')).toBe(0.01)
    expect(vendorPriceUsd('tikhub:/api/v1/xiaohongshu/pgy/get_note_components')).toBe(0)
    expect(vendorPriceUsd('tikhub:/api/v1/xiaohongshu/app_v2/get_user_info')).toBe(0.01)
    expect(vendorPriceUsd('tikhub:/api/v1/tikhub/user/get_user_info')).toBe(0)
  })

  it('has no price for vendors that publish none, until an override sets one', () => {
    expect(vendorPriceUsd('justoneapi:/api/xiaohongshu-pgy/api/solar/kol/dataV3/notesRate/v1')).toBeNull()
    expect(vendorPriceUsd('qiangua:/v1/xhs/creators/search')).toBeNull()
    expect(vendorPriceUsd('justoneapi:/api/xiaohongshu-pgy/x', { 'justoneapi:/api/xiaohongshu-pgy/': 0.015 })).toBe(0.015)
    expect(vendorPriceUsd('tikhub:/api/v1/xiaohongshu/pgy/x', { 'tikhub:/api/v1/xiaohongshu/pgy/': 0.03 })).toBe(0.03)
  })

  it('counts money in whole micro-dollars', () => {
    expect(usdToMicros(0.02)).toBe(20_000)
    expect(usdToMicros(0.1 + 0.2)).toBe(300_000)
    expect(microsToUsd(140_000)).toBe(0.14)
  })

  it('starts 蒲公英 at a $5 day and the vendors without a price at no money cap', () => {
    expect(SOURCE_DEFAULTS.pugongying.dailyBudgetUsd).toBe(5)
    expect(SOURCE_DEFAULTS.qiangua.dailyBudgetUsd).toBeNull()
  })
})

describe('vendor failure classes', () => {
  it.each([
    ['pugongying HTTP 402', 'BALANCE_EXHAUSTED', true],
    ['pugongying HTTP 401', 'CREDENTIAL_INVALID', true],
    ['pugongying HTTP 400', 'VENDOR_REJECTED', true],
    ['pugongying HTTP 403', 'VENDOR_REJECTED', true],
    ['pugongying HTTP 429', 'SOURCE_UNAVAILABLE', false],
    ['pugongying HTTP 503', 'SOURCE_UNAVAILABLE', false],
    ['pugongying timeout after 60000ms (may have been billed)', 'VENDOR_TIMEOUT', false],
    ['pugongying inner error -1: 参数错误', 'VENDOR_INNER_ERROR', true],
    ['pugongying unreachable (ECONNREFUSED)', 'SOURCE_UNAVAILABLE', false],
  ] as const)('%s → %s', (message, code, permanent) => {
    expect(classifyIngestFailure(message)).toEqual({ code, permanent })
  })

  it('only a spent balance pauses the source', () => {
    expect(SOURCE_PAUSING_FAILURES).toEqual(['BALANCE_EXHAUSTED'])
  })
})
