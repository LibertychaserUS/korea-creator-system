/** 按当前语言格式化数字；空值统一显示 —。 */
export function useFormat() {
  const { locale } = useI18n()

  function formatNumber(value?: number | string | null, opts: Intl.NumberFormatOptions = {}): string {
    if (value === null || value === undefined || value === '') return '—'
    const n = Number(value)
    if (Number.isNaN(n)) return String(value)
    if (opts.notation === 'compact') {
      const digits = Math.abs(n) >= 1000 ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: 0 }
      return new Intl.NumberFormat(locale.value, { ...digits, ...opts }).format(n)
    }
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0, ...opts }).format(n)
  }

  /** 分数类小数：保留一位。 */
  function formatScore(value?: number | string | null): string {
    return formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }

  /** 字节数：按 1024 进位，3 位有效数字（12.3 GB）。 */
  function formatBytes(value?: number | null): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const
    let n = Math.abs(value)
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024
      i += 1
    }
    const text = new Intl.NumberFormat(locale.value, {
      style: 'unit',
      unit: units[i],
      unitDisplay: 'short',
      maximumSignificantDigits: 3,
    }).format(n)
    return value < 0 ? `-${text}` : text
  }

  /** 日期时间：月日 + 时分，按当前语言。 */
  function formatDateTime(value?: string | null): string {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
  }

  return { formatNumber, formatScore, formatBytes, formatDateTime }
}
