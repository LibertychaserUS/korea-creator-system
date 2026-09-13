/** 按当前语言格式化数字；空值统一显示 —。 */
export function useFormat() {
  const { locale } = useI18n()

  function formatNumber(value?: number | string | null, opts: Intl.NumberFormatOptions = {}): string {
    if (value === null || value === undefined || value === '') return '—'
    const n = Number(value)
    if (Number.isNaN(n)) return String(value)
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0, ...opts }).format(n)
  }

  /** 分数类小数：保留一位。 */
  function formatScore(value?: number | string | null): string {
    return formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }

  return { formatNumber, formatScore }
}
