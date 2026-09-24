import { en, zhCN, ko } from './locales'
import type { SupportedLocale } from './codes'

// Re-export from config for consistency
export { config } from '@config'

export { defaultLocale, locales, isValidLocale, type SupportedLocale } from './codes'

// 基于英文翻译自动推断类型
export type Translations = typeof en

export const translations = {
  en,
  'zh-CN': zhCN,
  ko,
} as const

// 类型安全的翻译函数
export function getTranslation(locale: SupportedLocale): Translations {
  return translations[locale] as Translations
}

export * from './locales' 