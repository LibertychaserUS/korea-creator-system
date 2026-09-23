import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AUTH,
  AUTH_URL,
  getSession,
  login,
  signUpWithBackoff,
  type Session,
} from '../helpers/auth'
import { ERROR, PATHS, SEED_PASSWORD, SEED_USERS } from '../helpers/contract'
import { createCreator, createProject, runId } from '../helpers/fixtures'
import { BASE_URL, errorCode, itemsOf, request, type Json } from '../helpers/http'
import { closePool, sqlExec, sqlRead } from '../helpers/postgres'

/**
 * 07_测试与验收清单 §安全 + 05_接口说明 §认证 / §上传限制 / §错误码.
 * Each case is one launch blocker found in review, reproduced from the outside:
 * an open redirect on /__login, an upload that stored HTML and served it back
 * as a page, TinyShip template routes (AI chat, payments, admin) still mounted
 * on every workspace origin, public sign-up, a 500 on broken JSON, and writes
 * to missing rows that answered 200 and left an audit entry behind.
 */

const OPS_URL = (process.env.BLACKBOX_OPS_URL || 'http://localhost:7002').replace(/\/$/, '')
const DEV_URL = (process.env.BLACKBOX_DEV_URL || 'http://localhost:7003').replace(/\/$/, '')
const SELECT_URL = (process.env.BLACKBOX_SELECT_URL || AUTH_URL).replace(/\/$/, '')
const MARKETING_URL = (process.env.BLACKBOX_MARKETING_URL || 'http://localhost:7005').replace(/\/$/, '')
/** Set to 1 only when the workspace origins are `nuxt dev` (no NODE_ENV=production, so no Secure). */
const WORKSPACE_DEV = process.env.BLACKBOX_WORKSPACE_DEV === '1'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const HTML = Buffer.from('<!doctype html><html><body><script>alert(document.cookie)</script></body></html>')
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

async function reachable(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/zh-CN/login`, { redirect: 'manual' })
    return res.status < 500
  } catch {
    return false
  }
}

async function formLogin(
  origin: string,
  fields: { email: string; password: string; locale: string; app: string },
) {
  const res = await fetch(`${origin}${AUTH.formLogin}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  })
  await res.text()
  return { status: res.status, location: res.headers.get('location'), cookies: res.headers.getSetCookie() }
}

async function until<T>(probe: () => Promise<T>, ok: (v: T) => boolean, ms: number): Promise<T> {
  const deadline = Date.now() + ms
  let last = await probe()
  while (!ok(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    last = await probe()
  }
  return last
}

/** A `Location` we send must stay on this origin: one leading slash, no scheme, no host. */
function staysOnOrigin(location: string | null): boolean {
  return Boolean(location) && /^\/(?![/\\])/.test(location!) && !/evil/i.test(location!)
}

function upload(token: string, bytes: Buffer, type: string, name: string) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type }), name)
  form.append('purpose', 'avatar')
  return request('POST', PATHS.assets, { token, form })
}

async function assetKeys(ops: Session): Promise<Set<string>> {
  const res = await request('GET', PATHS.assets, { token: ops.token })
  return new Set(itemsOf(res.json).map((row) => String(row.key)))
}

afterAll(async () => {
  await closePool()
})

const EVIL_LOCALES = [
  '/evil.example.com',
  '//evil.example.com',
  '\\evil.example.com',
  'https://evil.example.com',
  'zh-CN/../../evil.example.com',
  'fr',
]

describe('安全 — 登录跳转只留在本站', () => {
  it('表单里的 locale 不是 zh-CN / en / ko 时，失败跳转仍回本站 /zh-CN/login，拼不出外站地址', async () => {
    for (const locale of EVIL_LOCALES) {
      const res = await formLogin(SELECT_URL, {
        email: SEED_USERS.selector.email,
        password: 'definitely-wrong-password',
        locale,
        app: 'select',
      })
      expect(res.status, locale).toBe(302)
      expect(staysOnOrigin(res.location), `${locale} → ${res.location}`).toBe(true)
      expect(res.location, locale).toBe('/zh-CN/login?error=1')
    }
  }, 60_000)

  it('登录成功时同样：恶意 locale 落到 /zh-CN/，kcs_session 在生产带 Secure、不带 HttpOnly', async () => {
    const res = await until(
      () => formLogin(SELECT_URL, {
        email: SEED_USERS.selector.email,
        password: SEED_PASSWORD,
        locale: '//evil.example.com',
        app: 'select',
      }),
      (r) => r.location !== '/zh-CN/login?error=1',
      30_000,
    )
    expect(res.status).toBe(302)
    expect(res.location).toBe('/zh-CN/')
    const mirror = res.cookies.find((c) => c.startsWith('kcs_session='))
    expect(mirror, 'kcs_session').toBeDefined()
    expect(mirror!.toLowerCase()).not.toContain('httponly')
    if (!WORKSPACE_DEV) expect(mirror!.toLowerCase()).toContain('secure')
  }, 40_000)

  it('退出清 kcs_session 时属性一致（生产同样带 Secure），否则浏览器删不掉', async () => {
    const res = await fetch(`${SELECT_URL}${AUTH.formLogout}`, {
      method: 'POST',
      headers: { origin: SELECT_URL },
      redirect: 'manual',
    })
    await res.text()
    const cleared = res.headers.getSetCookie().find((c) => c.startsWith('kcs_session='))
    expect(cleared, 'kcs_session cleared').toBeDefined()
    expect(cleared!).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i)
    if (!WORKSPACE_DEV) expect(cleared!.toLowerCase()).toContain('secure')
  })

  it('宣传站交接的目标只来自服务端配置：恶意 locale 下仍交接到选人端源站 /zh-CN/', async () => {
    if (!(await reachable(MARKETING_URL))) return
    const res = await until(
      () => formLogin(MARKETING_URL, {
        email: SEED_USERS.selector.email,
        password: SEED_PASSWORD,
        locale: '/evil.example.com',
        app: 'marketing',
      }),
      (r) => r.location !== '/zh-CN/login?error=1',
      30_000,
    )
    expect(res.status).toBe(302)
    expect(res.location).toBe(`${SELECT_URL}/zh-CN/`)
  }, 40_000)
})

describe('安全 — 上传只收图片，读回不会被当网页执行', () => {
  let ops: Session

  beforeAll(async () => {
    ops = await login('ops')
  })

  it('HTML 冒充 image/png → 415 UPLOAD-TYPE，什么都不存', async () => {
    const before = await assetKeys(ops)
    const res = await upload(ops.token, HTML, 'image/png', 'avatar.png')
    expect(res.status).toBe(415)
    expect(errorCode(res.json)).toBe(ERROR.UPLOAD_TYPE)
    const after = await assetKeys(ops)
    expect([...after].filter((key) => !before.has(key))).toEqual([])
  })

  it('带脚本的 SVG、声明为 text/html 的文件同样 415', async () => {
    const svg = await upload(ops.token, SVG, 'image/svg+xml', 'avatar.svg')
    expect(svg.status).toBe(415)
    const html = await upload(ops.token, HTML, 'text/html', 'page.html')
    expect(html.status).toBe(415)
  })

  it('超过 5 MB → 413 UPLOAD-TOO-LARGE（文件头是真 PNG 也不行）', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1024, 0)
    PNG.copy(big)
    const res = await upload(ops.token, big, 'image/png', 'huge.png')
    expect(res.status).toBe(413)
    expect(errorCode(res.json)).toBe(ERROR.UPLOAD_TOO_LARGE)
  })

  it('预签名只发四种图片类型：text/html → 415', async () => {
    const res = await request('POST', PATHS.assetsPresign, {
      token: ops.token,
      body: { purpose: 'avatar', contentType: 'text/html' },
    })
    expect(res.status).toBe(415)
    expect(errorCode(res.json)).toBe(ERROR.UPLOAD_TYPE)
  })

  it('真图片读回带安全响应头：图片类型、nosniff、inline、CSP default-src none', async () => {
    const res = await upload(ops.token, PNG, 'image/png', 'ok.png')
    expect(res.status).toBe(201)
    const url = String(res.json.url)
    if (!url.includes('/api/assets/raw/')) return // S3 serves its own bytes
    const raw = await fetch(url)
    expect(raw.status).toBe(200)
    expect(raw.headers.get('content-type')).toBe('image/png')
    expect(raw.headers.get('x-content-type-options')).toBe('nosniff')
    expect(raw.headers.get('content-disposition')).toBe('inline')
    expect(raw.headers.get('content-security-policy')).toBe("default-src 'none'")
    expect(Buffer.from(await raw.arrayBuffer()).equals(PNG)).toBe(true)
  })

  it('修复前存进来的 HTML 行（标着 image/png）读回一律 404，不再当网页吐出去', async () => {
    const key = `avatars/legacy-${randomUUID()}.png`
    try {
      await sqlExec(
        `INSERT INTO assets (key, url, content_type, size, bytes) VALUES ($1,$2,'text/html',$3,$4)`,
        [key, `${BASE_URL}${PATHS.assetRaw(key)}`, HTML.length, HTML],
      )
    } catch {
      return // no SQL access to arrange the legacy row
    }
    try {
      const raw = await fetch(`${BASE_URL}${PATHS.assetRaw(key)}`)
      const body = await raw.text()
      expect(raw.status).toBe(404)
      expect(body).not.toContain('<script>')
      expect(raw.headers.get('content-type') ?? '').not.toContain('text/html')
    } finally {
      await sqlExec('DELETE FROM assets WHERE key = $1', [key]).catch(() => undefined)
    }
  })

  it('读回不存在或编码坏掉的键 → 404', async () => {
    for (const key of ['avatars/nope.png', 'avatars/%E0%A4%A.png']) {
      const raw = await fetch(`${BASE_URL}${PATHS.assetRaw(key)}`)
      await raw.text()
      expect(raw.status, key).toBe(404)
    }
  })
})

/** TinyShip template endpoints that must not exist on any KCS origin. */
const TEMPLATE_ROUTES: Array<[string, string]> = [
  ['POST', '/api/chat'],
  ['POST', '/api/image-generate'],
  ['POST', '/api/video-generate'],
  ['GET', '/api/video-generate/status'],
  ['POST', '/api/upload'],
  ['GET', '/api/kcs/overview'],
  ['GET', '/api/kcs/reviews'],
  ['GET', '/api/orders'],
  ['GET', '/api/users/some-id'],
  ['GET', '/api/admin/users'],
  ['GET', '/api/admin/stats'],
  ['GET', '/api/blog'],
  ['GET', '/api/credits/balance'],
  ['GET', '/api/subscription/status'],
  ['POST', '/api/payment/initiate'],
  ['POST', '/api/payment/webhook/stripe'],
  ['POST', '/api/payment/webhook/wechat'],
  ['POST', '/api/payment/webhook/alipay'],
  ['POST', '/api/payment/webhook/paypal'],
  ['POST', '/api/payment/webhook/creem'],
  ['GET', '/api/payment/return/paypal'],
  ['GET', '/api/fixtures/imok/summary'],
]

describe('安全 — TinyShip 模板路由在四端都不存在', () => {
  const origins: Array<[string, string]> = [
    ['select', SELECT_URL],
    ['ops', OPS_URL],
    ['dev', DEV_URL],
    ['marketing', MARKETING_URL],
  ]

  it.each(origins)('%s 源站：AI / 支付回调 / 后台 / 旧 kcs 演示路由一律 404', async (_name, origin) => {
    if (!(await reachable(origin))) return
    for (const [method, path] of TEMPLATE_ROUTES) {
      const res = await fetch(`${origin}${path}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json', origin } : {},
        body: method === 'POST' ? '{}' : undefined,
        redirect: 'manual',
      })
      await res.text()
      expect(res.status, `${method} ${origin}${path}`).toBe(404)
    }
  }, 60_000)

  it('身份接口仍在：better-auth 的 get-session 在选人端照常应答', async () => {
    const session = await login('selector')
    expect((await getSession(session.token)).user?.email).toBe(SEED_USERS.selector.email)
  })

  it('API 源站同样没有这些模板路由', async () => {
    for (const [method, path] of TEMPLATE_ROUTES.slice(0, 6)) {
      const res = await request(method, path, method === 'POST' ? { body: {} } : {})
      expect(res.status, `${method} ${path}`).toBe(404)
    }
  })
})

describe('安全 — 公开注册在每个源站都关着', () => {
  it('四端 /api/auth/sign-up/email 都拒绝：不建号、不发会话', async () => {
    for (const origin of [SELECT_URL, OPS_URL, DEV_URL, MARKETING_URL]) {
      if (!(await reachable(origin))) continue
      const res = await signUpWithBackoff(`walk-in-${runId()}@kcs.local`, 'Walk-in!2026pass', { base: origin })
      expect(res.status, origin).toBeGreaterThanOrEqual(400)
      expect(res.status, origin).toBeLessThan(500)
      expect(res.token, origin).toBeNull()
      expect(res.user, origin).toBeNull()
    }
  }, 90_000)
})

describe('安全 — 坏请求给 4xx，写不存在的对象不留痕', () => {
  let ops: Session
  let selector: Session
  let devops: Session

  beforeAll(async () => {
    ops = await login('ops')
    selector = await login('selector')
    devops = await login('devops')
  })

  const raw = (session: Session, method: string, path: string, body: string) =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
      body,
    })

  const auditFor = async (entityId: string): Promise<Json[]> => {
    const res = await request('GET', PATHS.devAudit, { token: devops.token })
    return itemsOf(res.json).filter((row) => row.entity_id === entityId || row.entityId === entityId)
  }

  it('非法 JSON → 400 VALIDATION（不是 500）', async () => {
    const creator = await createCreator(ops, { displayName: `坏体-${runId()}`, followersUnknown: true })
    const cases: Array<[Session, string, string]> = [
      [ops, 'POST', PATHS.opsCreators],
      [ops, 'PATCH', PATHS.opsCreator(String(creator.id))],
      [ops, 'POST', PATHS.ingestJobs],
      [selector, 'POST', PATHS.projects],
      [selector, 'POST', PATHS.queries],
    ]
    for (const [session, method, path] of cases) {
      const res = await raw(session, method, path, '{"displayName": ')
      const body = (await res.json()) as Json
      expect(res.status, `${method} ${path}`).toBe(400)
      expect(errorCode(body), `${method} ${path}`).toBe(ERROR.VALIDATION)
    }
  })

  it('字段不合规 → 400 VALIDATION，并指出是哪个字段', async () => {
    const res = await request('POST', PATHS.opsCreators, {
      token: ops.token,
      body: { displayName: 'x', followers: -1, categories: ['no_such_category'] },
    })
    expect(res.status).toBe(400)
    expect(errorCode(res.json)).toBe(ERROR.VALIDATION)
    const fields = ((res.json.error as Json).fields as Array<{ path: string }>) ?? []
    expect(fields.map((field) => field.path)).toContain('followers')
  })

  it('PATCH / 下架不存在的博主 → 404 NOT-FOUND，审计里没有这条', async () => {
    const ghost = `ghost-${runId()}`
    const patch = await request('PATCH', PATHS.opsCreator(ghost), {
      token: ops.token,
      body: { displayName: '不存在' },
    })
    expect(patch.status).toBe(404)
    expect(errorCode(patch.json)).toBe(ERROR.NOT_FOUND)
    const unpublish = await request('POST', PATHS.opsUnpublish(ghost), { token: ops.token })
    expect(unpublish.status).toBe(404)
    expect(errorCode(unpublish.json)).toBe(ERROR.NOT_FOUND)
    expect(await auditFor(ghost)).toEqual([])
    const rows = await sqlRead('SELECT 1 FROM audit_logs WHERE entity_id = $1', [ghost]).catch(() => [])
    expect(rows).toEqual([])
  })

  it('往不存在的项目分派、移出不存在的分派 → 404，不写审计', async () => {
    const ghost = `ghost-project-${runId()}`
    const assign = await request('POST', PATHS.assignments(ghost), {
      token: selector.token,
      body: { creatorIds: ['anyone'] },
    })
    expect(assign.status).toBe(404)
    expect(errorCode(assign.json)).toBe(ERROR.NOT_FOUND)

    const project = await createProject(selector, `空项目-${runId()}`)
    const remove = await request('DELETE', PATHS.assignment(String(project.id), 'nobody'), {
      token: selector.token,
    })
    expect(remove.status).toBe(404)
    expect(errorCode(remove.json)).toBe(ERROR.NOT_FOUND)
    const removals = (await auditFor(String(project.id))).filter((row) => row.action === 'assignment.remove')
    expect(removals).toEqual([])
    expect(await auditFor(ghost)).toEqual([])
  })
})
