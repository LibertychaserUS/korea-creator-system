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

/** Paper-ledger widgets the mockup set requires — generic tables are not enough. */
const LANDMARKS: Partial<Record<MockupId, RegExp[]>> = {
  'A-login': [/login-a/, /screen-a-login/],
  'A-home': [/metric-tile|ledger-metrics/, /近期批次|home\.recentBatches/],
  'A-batch-upload': [/dropzone/, /accept=["']\.xlsx/, /batch-file/],
  'A-batch-list': [/ledger-table/, /batch-status|status-chip/],
  'A-batch-clean': [/pipeline-steps/, /clean-progress|progress-bar/],
  'A-creator-form': [/ledger-form/, /creator-display-name/],
  'A-creator-qc': [/qc-split|qc-queue/, /qc-compare/, /qc\.excel|源Excel/],
  'A-score-preview': [/scoreCreator|RULE_DIMENSIONS/, /score-bar/, /percentileRank|score\.percentile/],
  'A-ai-queue': [/ai-queue-metrics|metric-tile/, /查看结论/],
  'A-ai-detail': [/score-lock|分数锁定/, /不改/],
  'A-human-label': [/label-choice|人工标注/, /score-lock|规则分/],
  'A-publish': [/publish-preview|发布预览/, /选人池|pub\.title/],
  'B-health': [/health-tiles|metric-tile/, /dev-sql-ok/],
  'B-jobs': [/pipeline-mini|pipeline-steps/, /table-jobs/],
  'B-failures': [/failure-stack|error-stack/, /btn-retry-job/],
  'B-pipeline': [/pipe-stage/, /Excel/],
  'B-audit': [/ledger-table/, /审计/],
  'B-i18n-theme': [/swatch|token-preview/, /zh-CN/],
  'C-login': [/login-c/, /screen-c-login/],
  'C-projects': [/table-projects/, /btn-create-project/],
  'C-project-new': [/ledger-form/, /project-name/],
  'C-project-board': [/row-project-assignment/, /btn-open-library/, /rank|报价|selectDesk\.quote/],
  'C-pool': [/table-pool/, /filter-followers-min/, /chip-grade/, /chip-collab|合作过/],
  'C-creator': [/clean-dossier|干净档案/, /hide-raw|不展示/],
  'C-shortlist': [/quote-sum|报价合计/, /短名单/, /quoteSum|quote-col/],
  'C-assign': [/assign-dialog/, /assign-overlay|assign-backdrop/, /select-assign-confirm|btn-assign-confirm/],
  'C-export': [/export-scope|范围/, /xlsx|Excel/],
}

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

  it('keeps paper-ledger landmarks so screens are not generic tables', () => {
    const weak: string[] = []
    for (const [id, patterns] of Object.entries(LANDMARKS)) {
      const route = screenPath(id as MockupId)
      const rel = PAGE_BY_ROUTE[route]
      const src = readFileSync(resolve(__dirname, '..', rel), 'utf8')
      for (const pattern of patterns) {
        if (!pattern.test(src)) weak.push(`${id} missing ${pattern}`)
      }
    }
    expect(weak, 'mockup-faithful landmarks').toEqual([])
  })
})
