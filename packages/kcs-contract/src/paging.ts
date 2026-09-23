/**
 * Every list endpoint pages the same way: `?page=1&pageSize=50`, 1-based,
 * `pageSize` capped at 100. Out-of-range or non-numeric values fall back to
 * the defaults. The response carries the total that matched before paging.
 */
export const PAGE_SIZE_DEFAULT = 50
export const PAGE_SIZE_MAX = 100

export type Page<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type Paging = { page: number; pageSize: number; offset: number }

export function parsePaging(query: { page?: string | number | null; pageSize?: string | number | null }): Paging {
  const page = Math.floor(Number(query.page))
  const size = Math.floor(Number(query.pageSize))
  const pageSize = Number.isFinite(size) && size >= 1 ? Math.min(size, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
  const current = Number.isFinite(page) && page >= 1 ? page : 1
  return { page: current, pageSize, offset: (current - 1) * pageSize }
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}
