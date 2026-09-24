import { formatMoney } from '@kcs/contract'

export type DisplayCurrency = 'CNY' | 'USD' | 'KRW'

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ['CNY', 'USD', 'KRW'] as const

/**
 * Display-only approximate FX, expressed as "1 unit = X CNY".
 * Stored amounts keep their own currency (CNY/USD/KRW per creator);
 * conversion is for reading, never persisted. No live FX source wired yet.
 */
const TO_CNY: Record<DisplayCurrency, number> = {
  CNY: 1,
  USD: 7.1,
  KRW: 0.0053,
}

export function useCurrency() {
  const { locale } = useI18n()
  const { allowsPreferences } = useConsent()
  const stored = useCookie<DisplayCurrency | null>('kcs_currency', {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
  const currency = useState<DisplayCurrency>('kcs-currency', () =>
    allowsPreferences.value && stored.value && DISPLAY_CURRENCIES.includes(stored.value)
      ? stored.value
      : 'CNY',
  )

  function setCurrency(next: DisplayCurrency) {
    currency.value = next
    if (allowsPreferences.value) {
      stored.value = next
    }
  }

  function sourceCurrency(source?: string | null): DisplayCurrency {
    const code = source?.trim().toUpperCase()
    return (code && code in TO_CNY ? code : 'CNY') as DisplayCurrency
  }

  /** Format an amount stored in `source` currency into the user's display currency. */
  function formatPrice(amount?: number | null, source?: string | null, options: { compact?: boolean } = {}): string {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
    const dst = currency.value
    const value = (Number(amount) * TO_CNY[sourceCurrency(source)]) / TO_CNY[dst]
    return formatMoney(value, dst, locale.value, options)
  }

  /**
   * 把任意来源币种的金额折成 CNY（用于汇总）：有记录汇率用记录汇率，否则用展示用的近似汇率。
   * 没有报价返回 null，由调用方决定怎么计。
   */
  function toCny(amount?: number | null, source?: string | null, fxToCny?: number | null): number | null {
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return null
    const src = sourceCurrency(source)
    const rate = src !== 'CNY' && fxToCny != null && Number.isFinite(fxToCny) && fxToCny > 0 ? fxToCny : TO_CNY[src]
    return Number(amount) * rate
  }

  /** 合计报价；没报价的人数单独给出，不当 0 混进合计。 */
  function sumCny(rows: { amount?: number | null; currency?: string | null; fxToCny?: number | null }[]): { total: number | null; missing: number } {
    let total: number | null = null
    let missing = 0
    for (const row of rows) {
      const cny = toCny(row.amount, row.currency, row.fxToCny)
      if (cny == null) missing += 1
      else total = (total ?? 0) + cny
    }
    return { total, missing }
  }

  return { currency, setCurrency, formatPrice, toCny, sumCny }
}
