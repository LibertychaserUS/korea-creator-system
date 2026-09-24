/** Locale codes only, no copy: safe to import from browser code that must not pull in the translations. */
export const defaultLocale = 'zh-CN'
export const locales = ['en', 'zh-CN', 'ko'] as const

export type SupportedLocale = typeof locales[number]

export function isValidLocale(locale: string): locale is SupportedLocale {
  return locales.includes(locale as SupportedLocale)
}
