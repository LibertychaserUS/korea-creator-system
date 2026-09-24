import { describe, expect, it } from 'vitest'
import { PAGE_MAX, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, pageCount, parseCursorPaging, parsePaging } from '../src/paging'

describe('paging', () => {
  it('defaults, caps and offsets', () => {
    expect(parsePaging({})).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT, offset: 0 })
    expect(parsePaging({ page: '3', pageSize: '20' })).toEqual({ page: 3, pageSize: 20, offset: 40 })
    expect(parsePaging({ pageSize: '5000' }).pageSize).toBe(PAGE_SIZE_MAX)
  })

  it('ignores junk instead of failing', () => {
    expect(parsePaging({ page: 'x', pageSize: '-4' })).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT, offset: 0 })
    expect(parsePaging({ page: '0', pageSize: '0' })).toEqual({ page: 1, pageSize: PAGE_SIZE_DEFAULT, offset: 0 })
    expect(parsePaging({ page: 2.7, pageSize: 10.2 })).toEqual({ page: 2, pageSize: 10, offset: 10 })
  })

  it('truncates absurd page numbers instead of overflowing SQL', () => {
    for (const page of ['2e17', '1e20', '1e308', 1e20]) {
      const paging = parsePaging({ page, pageSize: '100' })
      expect(paging.page).toBe(PAGE_MAX)
      expect(Number.isSafeInteger(paging.offset)).toBe(true)
    }
    expect(parsePaging({ page: 'Infinity' }).page).toBe(1)
    expect(parsePaging({ page: String(PAGE_MAX) }).page).toBe(PAGE_MAX)
  })

  it('page count is at least one', () => {
    expect(pageCount(0, 50)).toBe(1)
    expect(pageCount(101, 50)).toBe(3)
  })

  it('a cursor is taken when non-empty; paging still parsed for the jump case', () => {
    expect(parseCursorPaging({ cursor: ' abc ', pageSize: '20' })).toEqual({ page: 1, pageSize: 20, offset: 0, cursor: 'abc' })
    expect(parseCursorPaging({ cursor: '', page: '2' }).cursor).toBeNull()
    expect(parseCursorPaging({ page: '2' })).toMatchObject({ page: 2, cursor: null })
  })
})
