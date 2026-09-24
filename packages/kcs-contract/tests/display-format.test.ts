import { describe, expect, it } from 'vitest'
import {
  exportCell,
  exportDay,
  exportMetric,
  exportTextCell,
  formatMetricValue,
  formatMoney,
  formatUnitValue,
  projectSheet,
} from '../src'

describe('screen formatting', () => {
  it('price abbreviations keep 3 significant digits (14,500 is not ¥1万)', () => {
    expect(formatMetricValue('priceImage', 14_500, 'zh-CN', { compact: true })).toBe('¥1.45万')
    expect(formatMetricValue('priceImage', 16_800, 'zh-CN', { compact: true })).toBe('¥1.68万')
    expect(formatMetricValue('priceImage', 14_500, 'en', { compact: true })).toBe('¥14.5K')
    expect(formatMetricValue('priceImage', 14_500, 'ko', { compact: true })).toBe('¥1.45만')
    expect(formatMetricValue('priceImage', 800, 'en', { compact: true })).toBe('¥800')
    expect(formatMetricValue('followers', 683_210, 'zh-CN', { compact: true })).toBe('68.3万')
  })

  it('English and Korean show ¥, not CN¥', () => {
    for (const locale of ['en', 'ko']) {
      expect(formatMetricValue('priceImage', 12_000, locale)).not.toMatch(/CN/)
      expect(formatMetricValue('cpe', 2.4, locale)).toBe('¥2.4')
      expect(formatMoney(5_000_000, 'KRW', locale)).toBe('₩5,000,000')
    }
  })

  it('shares: 1 decimal, 2 below 1%, 2 significant digits below 0.1%, never a false 0%', () => {
    expect(formatMetricValue('engagementRate', 0.0605, 'zh-CN')).toBe('6.1%')
    expect(formatMetricValue('engagementRate', 0.0042, 'zh-CN')).toBe('0.42%')
    expect(formatMetricValue('engagementRate', 0.00004, 'zh-CN')).toBe('0.004%')
    expect(formatMetricValue('engagementRate', 0, 'zh-CN')).toBe('0%')
    expect(formatMetricValue('followerGrowthRate', -0.008, 'en')).toBe('-0.8%')
    expect(formatMetricValue('followerGrowthRate', -0.25, 'en')).toBe('-25%')
  })

  it('unit costs: small values keep their digits (CPE 0.003 is not ¥0)', () => {
    expect(formatMetricValue('cpe', 0.003, 'zh-CN')).toBe('¥0.003')
    expect(formatMetricValue('cpe', 2.456, 'zh-CN')).toBe('¥2.46')
    expect(formatMetricValue('cpe', 13.25, 'zh-CN')).toBe('¥13.3')
    expect(formatMetricValue('cpm', 183.4, 'zh-CN')).toBe('¥183')
  })

  it('missing, NaN and infinite values read —', () => {
    expect(formatUnitValue('ratio', null, 'en')).toBe('—')
    expect(formatUnitValue('count', Number.NaN, 'en')).toBe('—')
    expect(formatUnitValue('cny', Number.POSITIVE_INFINITY, 'en')).toBe('—')
  })
})

describe('export matches the screen', () => {
  it('rounds the same way as the screen', () => {
    for (const value of [0.0605, 0.0671, 0.00004, 0.0042, 0.155, -0.008]) {
      const screen = formatMetricValue('engagementRate', value, 'en')
      expect(exportMetric('engagementRate', value)).toBe(screen)
    }
    expect(exportMetric('cpe', 0.003)).toBe('0.003')
    expect(exportMetric('cpe', 13.25)).toBe('13.3')
    expect(exportMetric('priceImage', 14_500)).toBe('14500')
    expect(exportMetric('followers', 1_234_567)).toBe('1234567')
  })

  it('keeps leading zeros and long digit strings as text', () => {
    expect(exportTextCell('0123')).toBe('"=""0123"""')
    expect(exportTextCell('12345678901234567')).toBe('"=""12345678901234567"""')
    expect(exportTextCell('123456')).toBe('123456')
    expect(exportTextCell('cheongdam_skin')).toBe('cheongdam_skin')
    expect(exportTextCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
  })

  it('a negative share stays a number, a leading minus in text is still defused', () => {
    expect(exportCell('-0.8%')).toBe('-0.8%')
    expect(exportCell('-12')).toBe('-12')
    expect(exportCell('-cmd')).toBe("'-cmd")
    expect(exportCell('-1+1')).toBe("'-1+1")
  })

  it('publish day is the Beijing calendar day', () => {
    expect(exportDay('2026-09-23T16:30:00Z')).toBe('2026-09-24')
    expect(exportDay('2026-09-23T15:59:00Z')).toBe('2026-09-23')
    expect(exportDay('2026-09-23T16:30:00Z', 'UTC')).toBe('2026-09-23')
    expect(exportDay(null)).toBe('')
  })

  it('whole rows use the text cell for the account and the day in Beijing time', () => {
    const sheet = projectSheet([
      { displayName: '零号', xhsId: '0123', source: 'qiangua', followers: 1000, metrics: { engagementRate: -0.008 } as never, poolGone: false, metricsLockedAt: '2026-09-23T17:00:00Z' },
    ])
    const row = sheet.slice(1).split('\r\n')[1]!
    expect(row.startsWith('零号,"=""0123""",')).toBe(true)
    expect(row.endsWith(',2026-09-24')).toBe(true)
  })
})
