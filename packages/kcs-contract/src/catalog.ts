import type { CategoryView } from './responses'
import type { SourceId } from './source-adapter'

export const DICTIONARY_KINDS = ['category', 'region'] as const
export type DictionaryKind = (typeof DICTIONARY_KINDS)[number]

/**
 * One value the fetch form can send. `platform`: from the platform's own
 * filter options (safe to send as is). `seen`: only found on creators already
 * stored from that source — the spelling came from the platform, but it may be
 * a finer level than the filter accepts.
 */
export type DictionaryOption = {
  value: string
  group: string | null
  origin: 'platform' | 'seen'
  /** Creators stored from this source that carry the value. */
  creators: number
}

/** `GET /api/ops/dictionaries?source=` */
export type SourceDictionaries = {
  source: SourceId
  category: DictionaryOption[]
  region: DictionaryOption[]
  /** When the platform list was last replaced, per kind; null = never. */
  updatedAt: Record<DictionaryKind, string | null>
}

/** Body of `POST /api/ops/dictionaries/:source/:kind`. */
export type DictionaryReplaceBody = {
  items: { value: string; group?: string | null }[]
}

export const DICTIONARY_MAX_ITEMS = 5000

/** `GET /api/ops/categories/usage` */
export type CategoryUsage = { items: { slug: string; creators: number }[] }

/** Body of `POST /api/ops/categories`; answers with the new `CategoryView`. */
export type CategoryCreateBody = {
  slug: string
  names: { 'zh-CN': string; en: string; ko: string }
  frontendVisible?: boolean
}
export type CategoryCreated = CategoryView

export const CATEGORY_SLUG = /^[a-z][a-z0-9_]{1,39}$/
