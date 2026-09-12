export type QuotePrice = {
  amountMin?: number | string | null
  amountMax?: number | string | null
  currency?: string | null
}

export function quoteAmount(price?: QuotePrice | null): number {
  if (!price) return 0
  const min = Number(price.amountMin)
  if (Number.isFinite(min) && min > 0) return min
  const max = Number(price.amountMax)
  return Number.isFinite(max) ? max : 0
}

export function quoteSum(items: Array<{ price?: QuotePrice | null }>): number {
  return items.reduce((acc, row) => acc + quoteAmount(row.price), 0)
}
