import { ERROR } from './contract'

export const BASE_URL = (
  process.env.BLACKBOX_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:7100'
).replace(/\/$/, '')

export type Json = Record<string, unknown>

export type ApiRes = {
  status: number
  json: Json
  raw: string
  headers: Headers
}

export function errorCode(body: Json): string | undefined {
  const err = body.error
  if (err && typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  if (typeof body.code === 'string') return body.code
  return undefined
}

export function itemsOf(body: Json): Json[] {
  if (Array.isArray(body.items)) return body.items as Json[]
  if (Array.isArray(body.data)) return body.data as Json[]
  return []
}

/** PRD §2 / UX 权限跳转: AUTH-DENIED must not leak inventory or failure stacks. */
export function leakedBusinessPayload(body: Json): boolean {
  if (itemsOf(body).length > 0) return true
  for (const key of ['creators', 'jobs', 'assignments', 'sources', 'objects']) {
    if (Array.isArray(body[key]) && (body[key] as unknown[]).length > 0) return true
  }
  const stack = body.errorStack ?? body.stack ?? body.trace
  if (typeof stack === 'string' && stack.length > 0) return true
  const summary = String(body.errorSummary ?? '')
  if (/password|secret|api[_-]?key|cookie/i.test(summary)) return true
  return false
}

export async function request(
  method: string,
  path: string,
  opts: {
    token?: string
    body?: unknown
    form?: FormData
    acceptLanguage?: string
    query?: Record<string, string | number | boolean | undefined>
  } = {},
): Promise<ApiRes> {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`)
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  if (opts.acceptLanguage) headers['accept-language'] = opts.acceptLanguage
  if (opts.body !== undefined) headers['content-type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    body: opts.form ? opts.form : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual',
  })

  const raw = await res.text()
  let json: Json = {}
  if (raw) {
    try {
      json = JSON.parse(raw) as Json
    } catch {
      json = { _text: raw }
    }
  }

  return { status: res.status, json, raw, headers: res.headers }
}

export function assertLoginRequired(res: ApiRes) {
  if (res.status !== 401) {
    throw new Error(`expected 401 AUTH-LOGIN, got ${res.status} ${res.raw.slice(0, 240)}`)
  }
  const code = errorCode(res.json)
  if (code !== ERROR.LOGIN) {
    throw new Error(`expected error.code ${ERROR.LOGIN}, got ${String(code)}`)
  }
  if (leakedBusinessPayload(res.json)) {
    throw new Error('AUTH-LOGIN response leaked inventory or failure payload')
  }
}

export function assertDenied(res: ApiRes) {
  if (res.status !== 403) {
    throw new Error(`expected 403 AUTH-DENIED, got ${res.status} ${res.raw.slice(0, 240)}`)
  }
  const code = errorCode(res.json)
  if (code !== ERROR.DENIED) {
    throw new Error(`expected error.code ${ERROR.DENIED}, got ${String(code)}`)
  }
  if (leakedBusinessPayload(res.json)) {
    throw new Error('AUTH-DENIED response leaked inventory or failure payload')
  }
}
