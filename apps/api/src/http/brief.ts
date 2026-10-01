/**
 * 选人任务的 brief：随项目保存的数字化需求说明。POST / PATCH 共用的
 * 白名单校验 —— 纯对象、序列化后 ≤4KB，字段只有 category / targetCount /
 * budgetMin / budgetMax / focus / deadline。错误是字段级的，message 用
 * 「码: 说明」格式，命中不了 kcs.apiError 文案时也能直接给人看。
 */
import type { FieldError } from './body'

export const BRIEF_FOCUS = ['reach', 'cost', 'balance'] as const
const BRIEF_MAX_BYTES = 4 * 1024
const BRIEF_FIELDS = new Set(['category', 'targetCount', 'budgetMin', 'budgetMax', 'focus', 'deadline'])
const DEADLINE = /^\d{4}-\d{2}-\d{2}$/

export type ProjectBrief = {
  category?: string
  targetCount?: number
  budgetMin?: number
  budgetMax?: number
  focus?: (typeof BRIEF_FOCUS)[number]
  deadline?: string | null
}

const err = (path: string, message: string): FieldError => ({ path, message })

function validDeadline(value: string): boolean {
  if (!DEADLINE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/**
 * `undefined` = 请求没带 brief（PATCH 不动它），`null` = 清空，
 * 对象 = 按原样存进 jsonb 的那份。任何字段不合法都会带一条字段级错误。
 */
export function validateBrief(raw: unknown): { brief: ProjectBrief | null | undefined; fields: FieldError[] } {
  if (raw === undefined) return { brief: undefined, fields: [] }
  if (raw === null) return { brief: null, fields: [] }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { brief: undefined, fields: [err('brief', 'brief.type: expected an object')] }
  }
  const fields: FieldError[] = []
  if (JSON.stringify(raw).length > BRIEF_MAX_BYTES) {
    fields.push(err('brief', `brief.size: must serialize to at most ${BRIEF_MAX_BYTES} bytes`))
  }
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!BRIEF_FIELDS.has(key)) fields.push(err(`brief.${key}`, `brief.field: ${key} is not allowed`))
  }
  const intIn = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

  const brief: ProjectBrief = {}
  if (input.category !== undefined) {
    if (typeof input.category !== 'string' || input.category.length > 50) {
      fields.push(err('brief.category', 'brief.category: expected a text of at most 50 chars'))
    } else brief.category = input.category
  }
  if (input.targetCount !== undefined) {
    if (!intIn(input.targetCount, 1, 1000)) {
      fields.push(err('brief.targetCount', 'brief.targetCount: expected an integer between 1 and 1000'))
    } else brief.targetCount = input.targetCount as number
  }
  for (const key of ['budgetMin', 'budgetMax'] as const) {
    const value = input[key]
    if (value === undefined) continue
    if (!intIn(value, 0, 1_000_000)) {
      fields.push(err(`brief.${key}`, `brief.${key}: expected an integer between 0 and 1000000`))
    } else brief[key] = value as number
  }
  if (brief.budgetMin != null && brief.budgetMax != null && brief.budgetMin > brief.budgetMax) {
    fields.push(err('brief.budgetMin', 'brief.budget: budgetMin must not exceed budgetMax'))
  }
  if (input.focus !== undefined) {
    if (!BRIEF_FOCUS.includes(input.focus as (typeof BRIEF_FOCUS)[number])) {
      fields.push(err('brief.focus', `brief.focus: expected one of ${BRIEF_FOCUS.join(' | ')}`))
    } else brief.focus = input.focus as (typeof BRIEF_FOCUS)[number]
  }
  if (input.deadline !== undefined) {
    if (input.deadline !== null
      && (typeof input.deadline !== 'string' || !validDeadline(input.deadline))) {
      fields.push(err('brief.deadline', 'brief.deadline: expected YYYY-MM-DD or null'))
    } else brief.deadline = input.deadline
  }
  return { brief: fields.length ? undefined : brief, fields }
}
