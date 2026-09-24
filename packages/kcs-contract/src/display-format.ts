import { metricField, type MetricUnit, type NumericMetricKey } from './metrics'

/**
 * How many digits a number shows, in one place for the screen and the
 * spreadsheet export so both round the same way.
 *
 * - ratio (shown as %): 1 decimal from 1% up, 2 decimals from 0.1%, below
 *   that 2 significant digits — a non-zero share never reads "0%". Negative
 *   values follow the same rule by size.
 * - cnyPerUnit (CPE / CPM / per-read cost): no decimals from ¥100, 1 from ¥10,
 *   2 from ¥0.01, below that 2 significant digits.
 * - cny (quotes): whole yuan; compact = 3 significant digits (14,500 → 1.45万).
 * - count / days: whole numbers; compact = 3 significant digits.
 */
export function digitsFor(unit: MetricUnit, value: number, compact = false): Intl.NumberFormatOptions {
  const size = Math.abs(value)
  switch (unit) {
    case 'ratio': {
      const pct = size * 100
      if (pct === 0 || pct >= 1) return { minimumFractionDigits: 0, maximumFractionDigits: 1 }
      if (pct >= 0.1) return { minimumFractionDigits: 0, maximumFractionDigits: 2 }
      return { maximumSignificantDigits: 2 }
    }
    case 'cnyPerUnit':
      if (size === 0 || size >= 100) return { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      if (size >= 10) return { minimumFractionDigits: 0, maximumFractionDigits: 1 }
      if (size >= 0.01) return { minimumFractionDigits: 0, maximumFractionDigits: 2 }
      return { maximumSignificantDigits: 2 }
    case 'cny':
    case 'count':
    case 'days':
    default:
      return compact && size >= 1000
        ? { notation: 'compact', maximumSignificantDigits: 3 }
        : { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  }
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let nf = formatters.get(key)
  if (!nf) {
    nf = new Intl.NumberFormat(locale, options)
    formatters.set(key, nf)
  }
  return nf
}

/** `¥` everywhere: English and Korean would otherwise print `CN¥`. */
const MONEY: Intl.NumberFormatOptions = { style: 'currency', currency: 'CNY', currencyDisplay: 'narrowSymbol' }

export function formatUnitValue(
  unit: MetricUnit,
  value: number | null | undefined,
  locale: string,
  options: { compact?: boolean } = {},
): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const digits = digitsFor(unit, value, options.compact)
  switch (unit) {
    case 'ratio':
      return formatter(locale, { style: 'percent', ...digits }).format(value)
    case 'cny':
    case 'cnyPerUnit':
      return formatter(locale, { ...MONEY, ...digits }).format(value)
    default:
      return formatter(locale, digits).format(value)
  }
}

export function formatMetricValue(
  key: NumericMetricKey,
  value: number | null | undefined,
  locale: string,
  options: { compact?: boolean } = {},
): string {
  return formatUnitValue(metricField(key).unit, value, locale, options)
}

/**
 * The same digits as the screen, written so a spreadsheet reads a number:
 * no grouping, `.` decimals, `%` kept on ratios, no currency sign.
 */
export function exportUnitValue(unit: MetricUnit, value: number | null | undefined): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return ''
  const digits = digitsFor(unit, value)
  if (unit === 'ratio') return formatter('en-US', { style: 'percent', useGrouping: false, ...digits }).format(value)
  return formatter('en-US', { useGrouping: false, ...digits }).format(value)
}

/** Price in any supported currency, compact or full, `¥` / `$` / `₩` without a country prefix. */
export function formatMoney(
  amount: number | null | undefined,
  currency: string,
  locale: string,
  options: { compact?: boolean } = {},
): string {
  if (amount == null || typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
  const compact = options.compact && Math.abs(amount) >= 1000
  return formatter(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    ...(compact ? { notation: 'compact', maximumSignificantDigits: 3 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  }).format(amount)
}
