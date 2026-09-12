import { describe, expect, it } from 'vitest'
import { screenPath, type MockupId } from '../src/screens'

/**
 * Break this test catches: a mockup id from docs/product/mockups/README.md
 * has no reachable product route.
 */
const REQUIRED: MockupId[] = [
  'A-login',
  'A-home',
  'A-batch-upload',
  'A-batch-list',
  'A-batch-clean',
  'A-creator-form',
  'A-creator-qc',
  'A-score-preview',
  'A-ai-queue',
  'A-ai-detail',
  'A-human-label',
  'A-publish',
  'B-health',
  'B-jobs',
  'B-failures',
  'B-pipeline',
  'B-audit',
  'B-i18n-theme',
  'C-login',
  'C-projects',
  'C-project-new',
  'C-project-board',
  'C-pool',
  'C-creator',
  'C-shortlist',
  'C-assign',
  'C-export',
]

describe('mockup screen routes', () => {
  it('maps every mockup id to a path starting with /', () => {
    for (const id of REQUIRED) {
      const path = screenPath(id)
      expect(path, id).toMatch(/^\//)
    }
  })

  it('sends ops screens under /ops except shared login', () => {
    expect(screenPath('A-home')).toBe('/ops')
    expect(screenPath('A-login')).toBe('/login')
    expect(screenPath('A-publish')).toBe('/ops/publish')
  })

  it('sends monitoring screens under /dev', () => {
    expect(screenPath('B-health')).toBe('/dev')
    expect(screenPath('B-i18n-theme')).toBe('/dev/i18n-theme')
  })

  it('sends select screens under /select except shared login', () => {
    expect(screenPath('C-login')).toBe('/login')
    expect(screenPath('C-projects')).toBe('/select')
    expect(screenPath('C-pool')).toBe('/select/pool')
  })
})
