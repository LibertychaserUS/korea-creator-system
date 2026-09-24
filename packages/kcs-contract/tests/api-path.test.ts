import { describe, expect, it } from 'vitest'
import { API, apiPath } from '../src'

describe('apiPath', () => {
  it('returns a param-less path unchanged', () => {
    expect(apiPath(API.opsOverview)).toBe('/api/ops/overview')
  })

  it('fills and encodes params', () => {
    expect(apiPath(API.unassign, { id: 'p 1', creatorId: 'c/2' })).toBe('/api/select/projects/p%201/assignments/c%2F2')
  })

  it('appends a query and skips empty values', () => {
    expect(apiPath(API.opsCreators, {}, { stage: 'review', q: '', source: undefined, page: 2, flag: false })).toBe(
      '/api/ops/creators?stage=review&page=2&flag=false',
    )
    expect(apiPath(API.ingestJobs, {}, new URLSearchParams({ pageSize: '20' }))).toBe('/api/ingest/jobs?pageSize=20')
  })

  it('throws on a missing param instead of calling /undefined', () => {
    expect(() => apiPath(API.projectGet)).toThrow(/:id/)
  })

  it('every contract path is a /api path with only :param placeholders', () => {
    for (const entry of Object.values(API)) {
      expect(entry.path.startsWith('/api/')).toBe(true)
      expect(entry.path).not.toMatch(/[{}*]/)
    }
  })
})
