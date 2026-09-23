import { describe, expect, it } from 'vitest'
import { EXPORT_LABELS, EXPORT_LOCALES, EXPORT_METRICS, exportCell, exportLocale, exportMetric, projectSheet } from '../src'

describe('project export sheet', () => {
  it('starts with a BOM and uses CRLF rows', () => {
    const sheet = projectSheet([])
    expect(sheet.charCodeAt(0)).toBe(0xfeff)
    expect(sheet.endsWith('\r\n')).toBe(true)
    expect(sheet.slice(1).split('\r\n')[0]!.split(',')[0]).toBe('博主')
  })

  it('labels every exported metric in every language', () => {
    for (const locale of EXPORT_LOCALES) {
      for (const key of EXPORT_METRICS) expect(EXPORT_LABELS[locale].metrics[key], `${locale}.${key}`).toBeTruthy()
    }
  })

  it('formats ratios as percent, money with cents, counts as integers', () => {
    expect(exportMetric('engagementRate', 0.0671)).toBe('6.7%')
    expect(exportMetric('cpe', 2.456)).toBe('2.46')
    expect(exportMetric('followers', 12345.6)).toBe('12346')
    expect(exportMetric('followers', null)).toBe('')
  })

  it('quotes separators and defuses formulas', () => {
    expect(exportCell('a,b')).toBe('"a,b"')
    expect(exportCell('say "hi"')).toBe('"say ""hi"""')
    expect(exportCell('=1+1')).toBe("'=1+1")
    expect(exportCell('@cmd')).toBe("'@cmd")
    expect(exportCell(-3)).toBe('-3')
  })

  it('writes one row per creator with tier, source and status', () => {
    const sheet = projectSheet(
      [
        { displayName: '小海', xhsId: 'hae', source: 'qiangua', followers: 60_000, metrics: { engagementRate: 0.05 } as never, poolGone: false, metricsLockedAt: '2026-09-01T08:00:00Z' },
        { displayName: 'Mina', xhsId: null, source: null, followers: 400, metrics: null, poolGone: true, metricsLockedAt: null },
      ],
      'en',
    )
    const [, first, second] = sheet.slice(1).trim().split('\r\n')
    expect(first!.startsWith('小海,hae,Qiangua,Mid,60000,')).toBe(true)
    expect(first).toContain(',5%,')
    expect(first!.endsWith(',Assigned,2026-09-01')).toBe(true)
    expect(second!.startsWith('Mina,,Added by hand,Amateur,400,')).toBe(true)
    expect(second!.endsWith(',Withdrawn,')).toBe(true)
  })

  it('falls back to Chinese for unknown languages', () => {
    expect(exportLocale('ko')).toBe('ko')
    expect(exportLocale('fr')).toBe('zh-CN')
    expect(exportLocale(undefined)).toBe('zh-CN')
  })
})
