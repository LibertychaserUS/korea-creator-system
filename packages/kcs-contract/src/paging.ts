/**
 * Every list endpoint pages the same way: `?page=1&pageSize=50`, 1-based,
 * `pageSize` capped at 100 and `page` capped at `PAGE_MAX`. Non-numeric values
 * fall back to the defaults; numbers past the caps are truncated to them, so
 * `page=1e20` can never reach SQL as an out-of-range bigint. The response
 * carries the total that matched before paging.
 *
 * The pool lists (`/api/select/pool`, `/api/select/queries/run`) also take
 * `?cursor=` — the `nextCursor` / `prevCursor` of an earlier response, opaque
 * and signed — for stepping one page at a time without an offset. `page` is
 * then ignored; a jump to page N still uses `page`. A cursor made for other
 * filters or tampered with is 400 `VALIDATION` (`cursor_mismatch` /
 * `cursor_invalid`): start again from page 1.
 */
export const PAGE_SIZE_DEFAULT = 50
export const PAGE_SIZE_MAX = 100
export const PAGE_MAX = 10_000

export type Page<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  /** Pool lists only; null at the end / at the start. */
  nextCursor?: string | null
  prevCursor?: string | null
}

export const CURSOR_MAX_LENGTH = 2_048

export type Paging = { page: number; pageSize: number; offset: number }

export function parsePaging(query: { page?: string | number | null; pageSize?: string | number | null }): Paging {
  const page = Math.floor(Number(query.page))
  const size = Math.floor(Number(query.pageSize))
  const pageSize = Number.isFinite(size) && size >= 1 ? Math.min(size, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
  const current = Number.isFinite(page) && page >= 1 ? Math.min(page, PAGE_MAX) : 1
  return { page: current, pageSize, offset: (current - 1) * pageSize }
}

/** `cursor` when one is given (non-empty), else null; paging as usual. */
export function parseCursorPaging(query: { page?: string | number | null; pageSize?: string | number | null; cursor?: string | null }): Paging & { cursor: string | null } {
  const paging = parsePaging(query)
  const cursor = typeof query.cursor === 'string' && query.cursor.trim() ? query.cursor.trim() : null
  return { ...paging, cursor }
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}
