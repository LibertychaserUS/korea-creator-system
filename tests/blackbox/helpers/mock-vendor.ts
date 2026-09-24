import { createServer, type Server } from 'node:http'
import { handleTikhub, resetTikhub } from './mock-tikhub'

/**
 * A stand-in for a paid vendor (千瓜-shaped: POST JSON in, `{ data: [...], next_cursor }` out).
 *
 * The API is pointed at it with `QIANGUA_BASE_URL=http://127.0.0.1:<port>` and
 * `QIANGUA_TOKEN=<token>`, which flips the 千瓜 adapter from demo data to live
 * calls — the only way to drive the queue through several pages, a slow page,
 * a vendor outage or a quota wall over plain HTTP.
 *
 * Behaviour is chosen by the `keyword` the job carries:
 *   `bb-pages-N`      N pages of 2 creators (cursor "2".."N")
 *   `bb-slow-MS`      4 pages, each answered after MS milliseconds
 *   `bb-fail`         always HTTP 500 (transient — worth retrying)
 *   `bb-flaky-K`      first K calls HTTP 500, then 1 page
 *   `bb-reject`       always HTTP 403 (permanent — retrying changes nothing)
 *   `bb-429-S`        first call HTTP 429 with `Retry-After: S` (seconds), then 1 page
 *   `bb-shape`        HTTP 200 with a body that has no record list at all
 *   `bb-badrecord`    1 page where the first creator has no name (unreadable)
 *   `bb-grow`         1 page of the same 2 creators, 40 000 more followers on every call
 *   anything else     1 page of 2 creators
 * Every keyword is namespaced by the caller so creators never collide across runs.
 *
 * `/api/v1/…` is TikHub-shaped instead (蒲公英 relay, see ./mock-tikhub.ts).
 *
 * `GET /__calls?keyword=…` returns the call log (for quota / rate assertions);
 * `POST /__reset` clears it.
 */
export type VendorCall = { at: number; keyword: string; cursor: string | null; status: number; path?: string; requestId?: string }

export const VENDOR_PORT = Number(process.env.BLACKBOX_VENDOR_PORT || 7190)
export const VENDOR_TOKEN = process.env.BLACKBOX_VENDOR_TOKEN || 'blackbox-vendor-token'
export const VENDOR_URL = `http://127.0.0.1:${VENDOR_PORT}`

const calls: VendorCall[] = []
const flakyCounters = new Map<string, number>()
const growCounters = new Map<string, number>()

function record(keyword: string, page: number, index: number, extraFollowers = 0) {
  const id = `${keyword}-p${page}-${index}`
  return {
    author_id: id,
    nickname: `队列博主 ${page}-${index}`,
    小红书号: `xhs_${id}`,
    粉丝数: 12_000 + page * 1_000 + index + extraFollowers,
    近30天涨粉: 300 + index,
    阅读中位数: 2_400 + page * 10,
    互动中位数: 180,
    点赞中位数: 120,
    收藏中位数: 40,
    评论中位数: 20,
    近30天发文: 12,
    爆文数: 1,
    爆文率: '8.3',
    预估报价: 2_000,
    视频报价: 3_500,
    粉丝真实度: '91',
    千瓜指数: 640,
    地区: '首尔',
    垂类: '美妆',
    健康等级: 'excellent',
  }
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw))
  })
}

export function startMockVendor(port = VENDOR_PORT): Promise<Server> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', VENDOR_URL)
    if (url.pathname === '/__calls') {
      const keyword = url.searchParams.get('keyword')
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(keyword ? calls.filter((c) => c.keyword === keyword) : calls))
      return
    }
    if (url.pathname === '/__reset') {
      calls.length = 0
      flakyCounters.clear()
      growCounters.clear()
      resetTikhub()
      res.end('{}')
      return
    }
    if (url.pathname.startsWith('/api/v1/')) {
      await handleTikhub(req, res, url, VENDOR_TOKEN, readBody, (call) => calls.push(call))
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    if (req.headers.authorization !== `Bearer ${VENDOR_TOKEN}`) {
      res.statusCode = 401
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>
    } catch {
      body = {}
    }
    const keyword = String(body.keyword ?? '')
    const cursor = body.cursor == null || body.cursor === '' ? null : String(body.cursor)
    const page = cursor ? Number(cursor) : 1

    const reply = (status: number, payload: unknown, headers: Record<string, string> = {}) => {
      calls.push({ at: Date.now(), keyword, cursor, status })
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
      res.end(JSON.stringify(payload))
    }

    if (keyword.includes('bb-fail')) return reply(500, { error: 'vendor down' })
    if (keyword.includes('bb-reject')) {
      return reply(403, { error: 'forbidden', hint: 'token=super-secret-should-not-leak' })
    }
    if (keyword.includes('bb-shape')) return reply(200, { ok: true, unexpected: 'no list here' })
    if (keyword.includes('bb-badrecord')) {
      const broken = { ...record(keyword, page, 1), nickname: '', 昵称: '' }
      return reply(200, { data: [broken, record(keyword, page, 2)], next_cursor: null })
    }

    const limited = keyword.match(/bb-429-(\d+)/)
    if (limited) {
      const seen = (flakyCounters.get(keyword) ?? 0) + 1
      flakyCounters.set(keyword, seen)
      if (seen === 1) return reply(429, { error: 'slow down' }, { 'retry-after': limited[1] })
    }

    const flaky = keyword.match(/bb-flaky-(\d+)/)
    if (flaky) {
      const seen = (flakyCounters.get(keyword) ?? 0) + 1
      flakyCounters.set(keyword, seen)
      if (seen <= Number(flaky[1])) return reply(500, { error: 'vendor hiccup' })
    }

    if (keyword.includes('bb-grow')) {
      const seen = (growCounters.get(keyword) ?? 0) + 1
      growCounters.set(keyword, seen)
      const extra = (seen - 1) * 40_000
      return reply(200, { data: [record(keyword, 1, 1, extra), record(keyword, 1, 2, extra)], next_cursor: null })
    }

    let pages = 1
    const paged = keyword.match(/bb-pages-(\d+)/)
    if (paged) pages = Math.max(1, Number(paged[1]))
    const slow = keyword.match(/bb-slow-(\d+)/)
    if (slow) {
      pages = 4
      await new Promise((resolve) => setTimeout(resolve, Number(slow[1])))
    }

    const data = [record(keyword, page, 1), record(keyword, page, 2)]
    return reply(200, {
      data,
      next_cursor: page < pages ? String(page + 1) : null,
      quota_remaining: 999,
    })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

export async function vendorCalls(keyword?: string): Promise<VendorCall[]> {
  const url = keyword ? `${VENDOR_URL}/__calls?keyword=${encodeURIComponent(keyword)}` : `${VENDOR_URL}/__calls`
  const res = await fetch(url)
  return (await res.json()) as VendorCall[]
}
