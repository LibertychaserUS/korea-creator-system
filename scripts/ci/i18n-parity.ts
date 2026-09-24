/**
 * Three-language key parity for the product copy: every key in zh-CN exists
 * in en and ko (and nothing extra), none is blank, and `{placeholders}` match.
 * Same check as the ops console's copy page, run on the source files.
 *
 *   pnpm exec tsx scripts/ci/i18n-parity.ts
 */
import { checkLocaleKeys, type LocaleCheck } from '../../packages/kcs-contract/src/ops-console'
import { EXPORT_LABELS } from '../../packages/kcs-contract/src/export-sheet'
import { en } from '../../libs/i18n/locales/en'
import { ko } from '../../libs/i18n/locales/ko'
import { zhCN } from '../../libs/i18n/locales/zh-CN'

const SHOW = 40

function report(title: string, check: LocaleCheck): boolean {
  const lines: string[] = []
  for (const l of check.locales) {
    const problems: [string, string[]][] = [
      ['missing', l.missing],
      ['extra', l.extra],
      ['empty', l.empty],
      ['placeholder mismatch', l.placeholderMismatch],
    ]
    for (const [kind, keys] of problems) {
      if (!keys.length) continue
      lines.push(`  ${l.locale} · ${kind} (${keys.length}):`)
      for (const key of keys.slice(0, SHOW)) lines.push(`    ${key}`)
      if (keys.length > SHOW) lines.push(`    … ${keys.length - SHOW} more`)
    }
  }
  const counts = check.locales.map((l) => `${l.locale} ${l.keys}`).join(', ')
  console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${title} — ${counts} (reference ${check.reference})`)
  for (const line of lines) console.log(line)
  return check.ok
}

const results = [
  report('screen copy (kcs.*)', checkLocaleKeys({ 'zh-CN': zhCN.kcs, en: en.kcs, ko: ko.kcs }, 'zh-CN')),
  report('export headers', checkLocaleKeys(EXPORT_LABELS, 'zh-CN')),
]

if (results.some((ok) => !ok)) {
  console.log('\nAdd the missing text in every language (libs/i18n/locales, export-sheet.ts); keep {placeholders} identical.')
  process.exit(1)
}
