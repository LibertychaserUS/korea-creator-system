import type { Context } from 'hono'
import { z } from 'zod'
import { CONTENT_FORMS, CURRENCIES, METRIC_KEYS, normalizeCurrency, type NumericMetricKey } from '@kcs/contract'

export type FieldError = { path: string; message: string }

export function validationError(context: Context, message: string, fields: FieldError[] = []) {
  return context.json({ error: { code: 'VALIDATION', message, fields } }, 400)
}

export function zodFields(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(body)',
    message: issue.message,
  }))
}

/**
 * Reads a JSON body and checks it against `schema`. An empty body counts as
 * `{}` so optional-only schemas work for bodiless POSTs. Callers must run
 * `requireAuth` first: strangers get 401/403 before any body is looked at.
 */
export async function readJson<T extends z.ZodType>(
  context: Context,
  schema: T,
): Promise<{ data: z.infer<T>; invalid: null } | { data: null; invalid: Response }> {
  const text = await context.req.text()
  let raw: unknown = {}
  if (text.trim()) {
    try {
      raw = JSON.parse(text)
    } catch {
      return { data: null, invalid: validationError(context, 'invalid_json') }
    }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { data: null, invalid: validationError(context, 'invalid_body', zodFields(parsed.error)) }
  }
  return { data: parsed.data, invalid: null }
}

const text = z.string().trim()
const optionalText = text.nullable().optional()
const count = z.number().int().min(0).max(2_147_483_647)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'expected YYYY-MM-DD')
const slugs = z.array(text.min(1))

const amount = z.number().finite().min(0).max(1e13)

/** `'krw'` is accepted and stored as `'KRW'`; anything outside `CURRENCIES` is a 400. */
const currency = z.preprocess(
  (value) => (typeof value === 'string' ? normalizeCurrency(value) ?? value : value),
  z.enum(CURRENCIES),
)

const price = z.looseObject({
  amountMin: amount.nullable().optional(),
  amountMax: amount.nullable().optional(),
  currency: currency.optional(),
  unit: text.min(1).max(32).optional(),
  /** 1 unit of `currency` in 人民币, as the person entering the quote saw it. */
  fxToCny: z.number().finite().positive().max(1e6).nullable().optional(),
}).refine((p) => p.amountMin == null || p.amountMax == null || p.amountMin <= p.amountMax, {
  message: 'amountMin must not exceed amountMax',
  path: ['amountMin'],
})

const collaboration = z.looseObject({
  brand: text.min(1),
  happenedAt: isoDate.nullable().optional(),
  note: optionalText,
})

/** Metrics that may be negative: 掉粉 is a real number. */
const SIGNED_METRICS = new Set<NumericMetricKey>(['followerGrowth', 'followerGrowthRate'])

/**
 * Every numeric metric is a finite JSON number or null — `"12"` or `1e400`
 * would otherwise sit in jsonb as something SQL and JS read differently.
 */
const metricsBody = z.looseObject({
  window: z.union([z.literal(30), z.literal(90)]).optional(),
  ...Object.fromEntries(METRIC_KEYS.map((key) => {
    const base = z.number().finite()
    return [key, (SIGNED_METRICS.has(key) ? base : base.min(0)).nullable().optional()]
  })),
  followers: count.nullable().optional(),
  health: z.preprocess(
    (value) => (value === 'excellent' || value === 'normal' ? 'healthy' : value),
    z.enum(['healthy', 'abnormal']).nullable().optional(),
  ),
  lowActive: z.boolean().nullable().optional(),
  contentForm: z.enum(CONTENT_FORMS).nullable().optional(),
  coopBrands: z.array(z.string()).optional(),
  platformRanks: z.partialRecord(z.enum(METRIC_KEYS as [NumericMetricKey, ...NumericMetricKey[]]), z.number().min(0).max(1)).nullable().optional(),
})

const creatorFields = {
  followers: count.nullable().optional(),
  followersUnknown: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
  verticals: z.array(z.string()).optional(),
  rating: z.number().min(0).max(99.9).nullable().optional(),
  note: optionalText,
  categories: slugs.optional(),
  collaborations: z.array(collaboration).optional(),
  price: price.nullable().optional(),
  metrics: metricsBody.nullable().optional(),
}

export const creatorCreateBody = z.looseObject({
  ...creatorFields,
  displayName: text.min(1, 'required'),
  creatorKey: text.min(1).max(200).optional(),
  avatarKey: optionalText,
  xhsId: optionalText,
  source: optionalText,
  externalId: optionalText,
})

export const creatorPatchBody = z.looseObject({
  ...creatorFields,
  displayName: text.min(1, 'required').optional(),
  qcNotes: optionalText,
  label: optionalText,
  needsReview: z.boolean().optional(),
})

const categoryName = text.min(1).max(100)

export const categoryPatchBody = z.looseObject({
  names: z.looseObject({
    'zh-CN': categoryName.optional(),
    en: categoryName.optional(),
    ko: categoryName.optional(),
  }).optional(),
  nameZh: categoryName.optional(),
  nameEn: categoryName.optional(),
  nameKo: categoryName.optional(),
  enabled: z.boolean().optional(),
  frontendVisible: z.boolean().optional(),
})

export const projectCreateBody = z.looseObject({
  name: text.min(1, 'required').max(200),
  note: optionalText,
})

export const assignmentsBody = z.looseObject({
  creatorIds: z.array(text.min(1)).min(1, 'required'),
  creatorKey: text.min(1).optional(),
})

export const kcsAssignmentBody = z.looseObject({
  projectId: text.min(1, 'required'),
  creatorId: text.min(1).optional(),
  creatorKey: text.min(1).optional(),
}).refine((body) => body.creatorId || body.creatorKey, {
  message: 'creatorId or creatorKey required',
  path: ['creatorId'],
})

export const shortlistBody = z.looseObject({
  creatorId: text.min(1, 'required'),
})

export const presignBody = z.looseObject({
  purpose: z.string().optional(),
  contentType: z.string().optional(),
})
