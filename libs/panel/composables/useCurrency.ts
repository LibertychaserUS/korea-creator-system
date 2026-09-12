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

  /** Format an amount stored in `source` currency into the user's display currency. */
  function formatPrice(amount?: number | null, source?: string | null): string {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
    const src = (source && source in TO_CNY ? source : 'CNY') as DisplayCurrency
    const dst = currency.value
    const value = (Number(amount) * TO_CNY[src]) / TO_CNY[dst]
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: dst,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return { currency, setCurrency, formatPrice }
}
