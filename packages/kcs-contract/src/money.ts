/**
 * Money: an amount is stored in the currency's smallest unit (`bigint`, ISO
 * 4217 exponent: 分 for CNY / USD cents, 원 for KRW) next to an upper-case
 * currency code. Nothing converts between currencies silently: a non-CNY
 * amount becomes 人民币 only with a rate someone recorded.
 */
export const CURRENCIES = ['CNY', 'USD', 'KRW'] as const
export type Currency = (typeof CURRENCIES)[number]

const EXPONENT: Record<Currency, number> = { CNY: 2, USD: 2, KRW: 0 }

/** `' krw '` → `'KRW'`; anything not in `CURRENCIES` → null. */
export function normalizeCurrency(value: unknown): Currency | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return (CURRENCIES as readonly string[]).includes(code) ? code as Currency : null
}

export function currencyExponent(currency: string): number {
  return EXPONENT[normalizeCurrency(currency) ?? 'CNY']
}

/** Major units → smallest unit, rounded to the unit (never a float in storage). */
export function toMinorUnits(amount: number | null | undefined, currency: string): number | null {
  if (amount == null || !Number.isFinite(amount)) return null
  return Math.round(amount * 10 ** currencyExponent(currency))
}

export function fromMinorUnits(minor: number | string | bigint | null | undefined, currency: string): number | null {
  if (minor == null) return null
  const n = Number(minor)
  return Number.isFinite(n) ? n / 10 ** currencyExponent(currency) : null
}

/**
 * The amount in 人民币, or null when that cannot be said: no amount, an unknown
 * currency, or a foreign currency without a recorded rate. Never 0 for "unknown".
 */
export function priceInCny(amount: number | null | undefined, currency: string | null | undefined, fxToCny?: number | null): number | null {
  if (amount == null || !Number.isFinite(amount)) return null
  const code = normalizeCurrency(currency ?? 'CNY')
  if (code === 'CNY') return amount
  if (code && fxToCny != null && Number.isFinite(fxToCny) && fxToCny > 0) return amount * fxToCny
  return null
}
