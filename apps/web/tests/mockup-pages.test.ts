import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOCKUP_IDS, screenPath, type MockupId } from '@kcs/contract'

/**
 * Break: a mockup route exists only as a JSON.stringify dump, not a screen.
 */
const PAGE_BY_ROUTE: Record<string, string> = {
  '/login': 'pages/login.vue',
  '/ops': 'pages/ops/index.vue',
  '/ops/batches/upload': 'pages/ops/batches/upload.vue',
  '/ops/batches': 'pages/ops/batches/index.vue',
  '/ops/batches/:id': 'pages/ops/batches/[id].vue',
  '/ops/creators/new': 'pages/ops/creators/new.vue',
  '/ops/qc': 'pages/ops/qc.vue',
  '/ops/rating': 'pages/ops/rating.vue',
  '/ops/review': 'pages/ops/review/index.vue',
  '/ops/review/:id': 'pages/ops/review/[id].vue',
  '/ops/label': 'pages/ops/label.vue',
  '/ops/publish': 'pages/ops/publish.vue',
  '/dev': 'pages/dev/index.vue',
  '/dev/jobs': 'pages/dev/jobs.vue',
  '/dev/failures': 'pages/dev/failures.vue',
  '/dev/pipeline': 'pages/dev/pipeline.vue',
  '/dev/audit': 'pages/dev/audit.vue',
  '/dev/i18n-theme': 'pages/dev/i18n-theme.vue',
  '/select': 'pages/select/index.vue',
  '/select/projects/new': 'pages/select/projects/new.vue',
  '/select/projects/:id': 'pages/select/projects/[id].vue',
  '/select/pool': 'pages/select/pool.vue',
  '/select/creators/:id': 'pages/select/creators/[id].vue',
  '/select/shortlist': 'pages/select/shortlist.vue',
  '/select/assign': 'pages/select/assign.vue',
  '/select/export': 'pages/select/export.vue',
}

const DUMP = /JSON\.stringify\(await request|dump\.value = 'ok'/

describe('mockup pages match screen ids', () => {
  it('maps every mockup id to a vue file that is not a JSON dump', () => {
    const missing: MockupId[] = []
    const dumps: MockupId[] = []
    for (const id of MOCKUP_IDS) {
      const route = screenPath(id)
      const rel = PAGE_BY_ROUTE[route]
      if (!rel) {
        missing.push(id)
        continue
      }
      const src = readFileSync(resolve(__dirname, '..', rel), 'utf8')
      if (DUMP.test(src)) dumps.push(id)
    }
    expect(missing, 'unmapped mockup routes').toEqual([])
    expect(dumps, 'JSON-dump stub screens').toEqual([])
  })
})
