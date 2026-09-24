import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * TikHub, the way its docs describe it (蒲公英 relay):
 *   POST /api/v1/xiaohongshu/pgy/<endpoint>   Bearer key, JSON body
 *   GET  /api/v1/tikhub/user/get_user_info    free; account balance
 * Answers carry two layers — outer `{code: 200, request_id, data}`, inner
 * 蒲公英 `{code: 0, success, msg, data}` — and only HTTP 200 is billed.
 *
 * The API reaches it with `TIKHUB_API_KEY=<token> TIKHUB_BASE_URL=http://127.0.0.1:<port>`
 * (blackbox-up.sh). Behaviour follows the search `keyword`:
 *   `th-pages-N`     N pages of 20 kols (page_num 1..N), then nothing more
 *   `th-empty`       200 with an empty kol list (查无结果, still billed)
 *   `th-inner`       200 whose inner answer is `success: false` (billed, not worth sending again)
 *   `th-400`         always HTTP 400;   `th-400once` HTTP 400 once, then a page
 *   `th-401`         HTTP 401 (bad key)
 *   `th-402`         always HTTP 402;   `th-402once` HTTP 402 once, then a page (after a top-up)
 *   `th-429-S`       HTTP 429 with `Retry-After: S` once, then a page
 *   `th-500`         always HTTP 500
 *   `th-slow-MS`     a page, answered after MS milliseconds (timeouts)
 *   anything else    1 page of 2 kols
 * Every answer has a `request_id` of `th-<n>`; the call log records it.
 */
export type TikhubCall = { at: number; keyword: string; cursor: string | null; status: number; path: string; requestId: string }

const PAGE_SIZE = 20
const counters = new Map<string, number>()
let sequence = 0

export function resetTikhub() {
  counters.clear()
}

function kol(keyword: string, page: number, index: number) {
  const id = `${keyword}-p${page}-${index}`
  return {
    userId: id,
    name: `蒲公英博主 ${page}-${index}`,
    redId: `red_${id}`,
    fansNum: 20_000 + page * 100 + index,
    location: '上海',
    contentTags: [{ taxonomy1Tag: '美妆', taxonomy2Tags: ['护肤'] }],
    picturePrice: 3_000,
    videoPrice: 5_000,
    clickMidNum: 1_800,
    interMidNum: 120,
  }
}

function seen(key: string): number {
  const n = (counters.get(key) ?? 0) + 1
  counters.set(key, n)
  return n
}

export async function handleTikhub(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  token: string,
  readBody: (req: IncomingMessage) => Promise<string>,
  log: (call: TikhubCall) => void,
): Promise<void> {
  const requestId = `th-${(sequence += 1)}`
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>
  } catch {
    body = {}
  }
  const keyword = String(body.keyword ?? body.user_id ?? '')
  const page = Number(body.page_num ?? 1) || 1
  const send = (status: number, payload: unknown, headers: Record<string, string> = {}) => {
    log({ at: Date.now(), keyword, cursor: body.page_num == null ? null : String(page), status, path: url.pathname, requestId })
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
    res.end(JSON.stringify(payload))
  }
  const ok = (data: unknown) => send(200, { code: 200, request_id: requestId, message: 'Request successful.', data: { code: 0, success: true, msg: '', data } })
  const refused = (status: number, detail: string, headers: Record<string, string> = {}) =>
    send(status, { detail: { code: status, message: detail, request_id: requestId }, request_id: requestId }, headers)

  if (req.headers.authorization !== `Bearer ${token}` || keyword.includes('th-401')) return refused(401, 'Invalid API key')

  if (url.pathname === '/api/v1/tikhub/user/get_user_info') {
    return send(200, { code: 200, request_id: requestId, data: { user_data: { email: 'blackbox@kcs.local', balance: 42.5, free_credit: 0 } } })
  }
  if (req.method !== 'POST' || !url.pathname.startsWith('/api/v1/xiaohongshu/pgy/')) return refused(404, 'Not Found')

  const endpoint = url.pathname.split('/').at(-1)
  if (endpoint !== 'get_blogger_list') {
    if (endpoint === 'get_blogger_detail') return ok({ ...kol(keyword, 1, 1), userId: keyword, redId: `red_${keyword}` })
    return ok({ noteNumber: 6, readMedian: 1_800 })
  }

  if (keyword.includes('th-402once') ? seen(`${keyword}:402`) === 1 : keyword.includes('th-402')) {
    return refused(402, 'Insufficient balance')
  }
  if (keyword.includes('th-400once') ? seen(`${keyword}:400`) === 1 : keyword.includes('th-400')) {
    return refused(400, 'Bad request')
  }
  if (keyword.includes('th-500')) return refused(500, 'Internal server error')
  const limited = keyword.match(/th-429-(\d+)/)
  if (limited && seen(`${keyword}:429`) === 1) return refused(429, 'Too many requests', { 'retry-after': limited[1]! })
  if (keyword.includes('th-inner')) {
    return send(200, { code: 200, request_id: requestId, data: { code: -1, success: false, msg: '参数错误', data: null } })
  }
  if (keyword.includes('th-empty')) return ok({ kols: [], total: 0 })
  const slow = keyword.match(/th-slow-(\d+)/)
  if (slow) await new Promise((resolve) => setTimeout(resolve, Number(slow[1])))

  const paged = keyword.match(/th-pages-(\d+)/)
  if (paged) {
    const pages = Math.max(1, Number(paged[1]))
    if (page > pages) return ok({ kols: [], total: 5000 })
    return ok({ kols: Array.from({ length: PAGE_SIZE }, (_, i) => kol(keyword, page, i + 1)), total: 5000 })
  }
  return ok({ kols: [kol(keyword, page, 1), kol(keyword, page, 2)], total: 5000 })
}
