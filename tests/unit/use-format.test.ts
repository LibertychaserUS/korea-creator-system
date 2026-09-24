/**
 * 运维端「调用与额度」页的清零时间按来源自己的时区显示，而不是浏览器所在时区。
 *
 * Break: 韩国的同事看到「北京时间零点」旁边却是首尔的钟点（差一小时）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const locale = { value: 'en' }
vi.stubGlobal('useI18n', () => ({ locale }))
const { useFormat } = await import('../../libs/panel/composables/useFormat')

afterEach(() => {
  locale.value = 'en'
})

describe('useFormat time zones', () => {
  const midnightShanghai = '2026-09-24T16:00:00.000Z'

  it('shows the clock of the given zone', () => {
    locale.value = 'zh-CN'
    const { formatDateTime } = useFormat()
    expect(formatDateTime(midnightShanghai, 'Asia/Shanghai')).toBe('9月25日 00:00')
    expect(formatDateTime(midnightShanghai, 'Asia/Seoul')).toBe('9月25日 01:00')
    expect(formatDateTime(midnightShanghai, 'UTC')).toBe('9月24日 16:00')
  })

  it('falls back to the browser zone for an unknown zone, and — for nothing', () => {
    const { formatDateTime } = useFormat()
    expect(formatDateTime(midnightShanghai, 'Not/AZone')).toBe(formatDateTime(midnightShanghai))
    expect(formatDateTime(null, 'Asia/Shanghai')).toBe('—')
  })

  it('names the zone in the reader’s language', () => {
    const { formatTimeZone } = useFormat()
    expect(formatTimeZone('Asia/Shanghai')).toBe('China Standard Time')
    locale.value = 'zh-CN'
    expect(formatTimeZone('Asia/Shanghai')).toBe('中国标准时间')
    locale.value = 'ko'
    expect(formatTimeZone('Asia/Seoul')).toMatch(/한민국 표준시|한국 표준시/)
    expect(formatTimeZone('Not/AZone')).toBe('Not/AZone')
  })
})
