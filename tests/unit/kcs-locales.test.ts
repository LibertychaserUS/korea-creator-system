import { baseCompile } from '@intlify/message-compiler'
import { describe, expect, it } from 'vitest'
import { EXPORT_LABELS, EXPORT_METRICS, type ExportLocale } from '../../packages/kcs-contract/src'
import { en } from '../../libs/i18n/locales/en'
import { ko } from '../../libs/i18n/locales/ko'
import { zhCN } from '../../libs/i18n/locales/zh-CN'

const LOCALES = { 'zh-CN': zhCN, en, ko } as Record<ExportLocale, any>

function flatten(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node }
  if (!node || typeof node !== 'object') return {}
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, value]) => Object.assign(out, flatten(value, prefix ? `${prefix}.${key}` : key)),
    {},
  )
}

/** Namespaces written for the ops review / accounts / export work; must stay free of engineering words. */
const REVIEWED = ['opsCreators', 'opsCreator', 'compare', 'projectBoard', 'accounts']
const TECH_WORDS = /fixture|worker|json|\bapi\b|cursor|p75|snapshot|locked|payload|token|session|webhook|schema|null|undefined|uuid|快照|接口|字段名|数据库/i

describe('KCS copy in three languages', () => {
  it('has the same keys in zh-CN, en and ko', () => {
    const zh = Object.keys(flatten(zhCN.kcs)).sort()
    for (const [name, messages] of Object.entries(LOCALES)) {
      const keys = Object.keys(flatten(messages.kcs)).sort()
      expect(keys.filter((k) => !zh.includes(k)), `${name} has keys zh-CN lacks`).toEqual([])
      expect(zh.filter((k) => !keys.includes(k)), `${name} is missing keys`).toEqual([])
    }
  })

  it('keeps engineering words out of the review, accounts and export copy', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of REVIEWED) {
        for (const [key, text] of Object.entries(flatten(messages.kcs[ns], `kcs.${ns}`))) {
          expect(text, `${name} ${key}`).not.toMatch(TECH_WORDS)
          expect(text.trim(), `${name} ${key} is empty`).not.toBe('')
        }
      }
    }
  })

  it('every reviewed message compiles (a bare @ or | breaks the page at runtime)', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of REVIEWED) {
        for (const [key, text] of Object.entries(flatten(messages.kcs[ns], `kcs.${ns}`))) {
          const errors: string[] = []
          baseCompile(text, { onError: (error) => errors.push(error.message) })
          expect(errors, `${name} ${key}`).toEqual([])
        }
      }
    }
  })

  it('export headers read the same as the screen labels', () => {
    for (const [name, messages] of Object.entries(LOCALES) as [ExportLocale, any][]) {
      const labels = EXPORT_LABELS[name]
      for (const key of EXPORT_METRICS) expect(labels.metrics[key], `${name} metric ${key}`).toBe(messages.kcs.metric[key])
      for (const tier of Object.keys(labels.tiers)) expect(labels.tiers[tier as 'head'], `${name} tier ${tier}`).toBe(messages.kcs.tier[tier])
      for (const source of ['pugongying', 'qiangua', 'xinhong'] as const) {
        expect(labels.sources[source], `${name} source ${source}`).toBe(messages.kcs.source[source])
      }
      expect(labels.sources.manual).toBe(messages.kcs.opsCreators.manual)
      expect(labels.statuses.withdrawn).toBe(messages.kcs.opsCreators.stage.withdrawn)
      expect(labels.statuses.assigned).toBe(messages.kcs.panel.assignmentStatus.assigned)
    }
  })
})
