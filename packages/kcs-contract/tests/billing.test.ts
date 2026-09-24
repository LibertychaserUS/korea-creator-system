import { describe, expect, it } from 'vitest'
import { microsToUsd, usdToMicros, vendorPriceUsd } from '../src/billing'
import { SOURCE_DEFAULTS } from '../src/source-adapter'

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
