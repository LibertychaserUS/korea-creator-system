import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AUTH,
  AUTH_URL,
  authed,
  getSession,
  login,
  loginAll,
  signInEmail,
  signInWithBackoff,
  signOut,
  signUpWithBackoff,
  type Session,
} from '../helpers/auth'
import { ERROR, PATHS, ROLES, SEED_PASSWORD, SEED_USERS, type Role } from '../helpers/contract'
import { assertLoginRequired, errorCode, leakedBusinessPayload, request } from '../helpers/http'

/**
 * 05_接口说明 §认证 + 07_测试与验收清单 §身份与权限.
 * Email + password is the real front door: every case here goes through TinyShip
 * (better-auth) on a workspace origin exactly as the browser does — no dev
 * tokens, no seeded sessions.
 *
 * Break this suite catches: a wrong password that still gets in, a stranger
 * who signs up and sees the pool, a signed-out token that keeps working, a
 * role that lands on the wrong workspace.
 */

const OPS_URL = (process.env.BLACKBOX_OPS_URL || 'http://localhost:7002').replace(/\/$/, '')
const DEV_URL = (process.env.BLACKBOX_DEV_URL || 'http://localhost:7003').replace(/\/$/, '')
const SELECT_URL = (process.env.BLACKBOX_SELECT_URL || AUTH_URL).replace(/\/$/, '')
const MARKETING_URL = (process.env.BLACKBOX_MARKETING_URL || 'http://localhost:7005').replace(/\/$/, '')

/** Provisioned by `pnpm db:seed:auth --stranger`: a TinyShip account with no KCS job. */
const STRANGER = {
  email: process.env.BLACKBOX_STRANGER_EMAIL || 'stranger@kcs.local',
  password: SEED_PASSWORD,
}

type FormLoginResult = {
  status: number
  location: string | null
  cookies: string[]
}

/** The `<form method="post" action="/__login">` the login page submits. */
async function formLogin(
  origin: string,
  fields: { email: string; password: string; locale?: string; app: string },
  cookie?: string,
): Promise<FormLoginResult> {
  const body = new URLSearchParams({
    email: fields.email,
    password: fields.password,
    locale: fields.locale ?? 'zh-CN',
    app: fields.app,
  })
  const res = await fetch(`${origin}${AUTH.formLogin}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin,
      referer: `${origin}/zh-CN/login`,
      ...(cookie ? { cookie } : {}),
    },
    body,
    redirect: 'manual',
  })
  await res.text()
  return {
    status: res.status,
    location: res.headers.get('location'),
    cookies: res.headers.getSetCookie(),
  }
}

function cookieNamed(cookies: string[], name: string): string | undefined {
  return cookies.find((c) => c.startsWith(`${name}=`))
}

async function reachable(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/zh-CN/login`, { redirect: 'manual' })
    return res.status < 500
  } catch {
    return false
  }
}

async function until<T>(probe: () => Promise<T>, ok: (v: T) => boolean, ms: number): Promise<T> {
  const deadline = Date.now() + ms
  let last = await probe()
  while (!ok(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    last = await probe()
  }
  return last
}

describe('登录 — 邮箱 + 密码（TinyShip）', () => {
  let sessions: Record<Role, Session>

  beforeAll(async () => {
    sessions = await loginAll()
  })

  it.each(ROLES)('%s 用种子邮箱 + 密码登录，拿到会话并映射到对应 KCS 角色', async (role) => {
    const session = sessions[role]
    expect(session.token.length).toBeGreaterThan(16)
    const me = await authed(session, 'GET', PATHS.me)
    expect(me.status).toBe(200)
    const user = me.json.user as { email?: string; role?: string; displayName?: string }
    expect(user.email).toBe(SEED_USERS[role].email)
    expect(user.role).toBe(role)
    expect(String(user.displayName ?? '')).not.toBe('')
  })

  it('会话在四端通用：选人端签发的会话，运营端 / 运维端源站同样认', async () => {
    const session = await login('platform_admin')
    for (const origin of [SELECT_URL, OPS_URL, DEV_URL]) {
      if (!(await reachable(origin))) continue
      const res = await fetch(`${origin}${AUTH.getSession}`, { headers: { authorization: `Bearer ${session.token}` } })
      expect(res.status, origin).toBe(200)
      const body = (await res.json()) as { user?: { email?: string } } | null
      expect(body?.user?.email, origin).toBe(session.email)
    }
  })

  it('密码错 → 401，不发 token，不返回用户', async () => {
    const res = await signInWithBackoff(SEED_USERS.ops.email, 'definitely-not-the-password')
    expect(res.status).toBe(401)
    expect(res.token).toBeNull()
    expect(res.user).toBeNull()
  })

  it('邮箱不存在与密码错误的回应一致，不暴露账号是否存在', async () => {
    const unknown = await signInWithBackoff(`nobody-${Date.now()}@kcs.local`, SEED_PASSWORD)
    const wrong = await signInWithBackoff(SEED_USERS.selector.email, 'wrong-password-1')
    expect(unknown.status).toBe(wrong.status)
    expect(unknown.code).toBe(wrong.code)
    expect(unknown.token).toBeNull()
  })

  it('邮箱格式不对 → 400，不会碰账号库', async () => {
    const res = await signInWithBackoff('not-an-email', SEED_PASSWORD)
    expect(res.status).toBe(400)
    expect(res.token).toBeNull()
  })

  it('API 只认 TinyShip 签发的会话：随机 token 与 dev: 伪 token 都是 401 AUTH-LOGIN', async () => {
    for (const token of ['not-a-real-session-token', `dev:${SEED_USERS.platform_admin.email}`]) {
      const res = await request('GET', PATHS.me, { token })
      assertLoginRequired(res)
      const pool = await request('GET', PATHS.pool, { token })
      expect(pool.status).toBe(401)
      expect(leakedBusinessPayload(pool.json)).toBe(false)
    }
  })

  it('退出后旧会话立刻在 TinyShip 失效，API 在缓存窗口内跟着失效', async () => {
    const fresh = await signInWithBackoff(SEED_USERS.selector_viewer.email, SEED_PASSWORD)
    expect(fresh.status).toBe(200)
    const token = fresh.token!
    const session: Session = { role: 'selector_viewer', email: SEED_USERS.selector_viewer.email, token }

    // Warm the API's introspection cache so the case covers the realistic path.
    expect((await authed(session, 'GET', PATHS.me)).status).toBe(200)

    expect(await signOut(token)).toBe(200)
    expect((await getSession(token)).user).toBeNull()

    const after = await until(() => authed(session, 'GET', PATHS.me), (r) => r.status === 401, 15_000)
    expect(after.status).toBe(401)
    expect(errorCode(after.json)).toBe(ERROR.LOGIN)
  })
})

describe('登录 — 工作端表单 /__login', () => {
  it('选人端：正确账号 → 302 到本端首页，同时下发 better-auth 会话 cookie（httpOnly）与 kcs_session（同样 httpOnly，页面脚本读不到）', async () => {
    const res = await formLogin(SELECT_URL, { email: SEED_USERS.selector.email, password: SEED_PASSWORD, app: 'select' })
    expect(res.status).toBe(302)
    expect(res.location).toBe('/zh-CN/')
    const ba = cookieNamed(res.cookies, 'better-auth.session_token') ?? cookieNamed(res.cookies, '__Secure-better-auth.session_token')
    expect(ba, 'better-auth session cookie').toBeDefined()
    expect(ba!.toLowerCase()).toContain('httponly')
    const mirror = cookieNamed(res.cookies, 'kcs_session')
    expect(mirror, 'kcs_session mirror').toBeDefined()
    expect(mirror!.toLowerCase()).toContain('httponly')
    expect(mirror!.split(';')[0]!.split('=')[1]!.length).toBeGreaterThan(16)
  })

  it('密码错 → 302 回登录页并带 error=1，不下发任何会话 cookie', async () => {
    const res = await formLogin(SELECT_URL, { email: SEED_USERS.selector.email, password: 'nope-nope-nope', app: 'select' })
    expect(res.status).toBe(302)
    expect(res.location).toBe('/zh-CN/login?error=1')
    expect(cookieNamed(res.cookies, 'kcs_session')).toBeUndefined()
    expect(res.cookies.some((c) => c.includes('session_token=') && !/session_token=;|Max-Age=0/i.test(c))).toBe(false)
  })

  it('语言跟着表单走：en 登录失败回 /en/login', async () => {
    const res = await formLogin(SELECT_URL, { email: SEED_USERS.selector.email, password: 'nope-nope-nope', locale: 'en', app: 'select' })
    expect(res.status).toBe(302)
    expect(res.location).toBe('/en/login?error=1')
  })

  it('宣传站登录按角色交接到对应工作端源站', async () => {
    if (!(await reachable(MARKETING_URL))) return
    const expectations: Array<[Role, string]> = [
      ['selector', SELECT_URL],
      ['selector_viewer', SELECT_URL],
      ['ops', OPS_URL],
      ['devops', DEV_URL],
    ]
    for (const [role, base] of expectations) {
      const res = await until(
        () => formLogin(MARKETING_URL, { email: SEED_USERS[role].email, password: SEED_PASSWORD, app: 'marketing' }),
        (r) => r.status !== 429,
        30_000,
      )
      expect(res.status, role).toBe(302)
      expect(res.location, role).toBe(`${base}/zh-CN/`)
    }
  })

  it('多工作区角色优先回到上次工作区（kcs_last_ws）', async () => {
    if (!(await reachable(MARKETING_URL))) return
    const res = await until(
      () =>
        formLogin(
          MARKETING_URL,
          { email: SEED_USERS.platform_admin.email, password: SEED_PASSWORD, app: 'marketing' },
          'kcs_last_ws=ops',
        ),
      (r) => r.status !== 429,
      30_000,
    )
    expect(res.status).toBe(302)
    expect(res.location).toBe(`${OPS_URL}/zh-CN/`)
  })
})

describe('登录 — 没有分工的账号', () => {
  let strangerToken: string | null = null

  beforeAll(async () => {
    const signIn = await signInWithBackoff(STRANGER.email, STRANGER.password)
    strangerToken = signIn.token
  })

  afterAll(async () => {
    if (strangerToken) await signOut(strangerToken).catch(() => undefined)
  })

  it('公开注册被拒：不建账号、不发会话，之后也登不进来', async () => {
    const email = `walk-in-${Date.now()}@kcs.local`
    const password = 'Walk-in!2026pass'
    const res = await signUpWithBackoff(email, password)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(res.status).not.toBe(429)
    expect(res.token).toBeNull()
    expect(res.user).toBeNull()
    expect(res.cookies.some((c) => /session_token=[^;]+/.test(c) && !/Max-Age=0/i.test(c))).toBe(false)
    const signIn = await signInWithBackoff(email, password)
    expect(signIn.status).toBe(401)
    expect(signIn.token).toBeNull()
  })

  it('由管理员开通、没有分工的账号能登录 TinyShip，但没有 KCS 角色', async () => {
    expect(strangerToken, `sign-in ${STRANGER.email} (run pnpm db:seed:auth --stranger)`).toBeTruthy()
    const session = await getSession(strangerToken!)
    expect(session.user?.email).toBe(STRANGER.email)
    expect(ROLES as readonly string[]).not.toContain(String(session.user?.role ?? ''))
  })

  it('没有分工的账号在 API 处处 403 AUTH-DENIED，看不到博主库', async () => {
    const me = await request('GET', PATHS.me, { token: strangerToken! })
    expect(me.status).toBe(403)
    expect(errorCode(me.json)).toBe(ERROR.DENIED)
    for (const path of [PATHS.pool, PATHS.opsCreators, PATHS.ingestJobs, PATHS.projects]) {
      const res = await request('GET', path, { token: strangerToken! })
      expect(res.status, path).toBe(403)
      expect(leakedBusinessPayload(res.json), path).toBe(false)
    }
  })

  it('没有分工的账号从表单登录 → 落到 /denied，而不是工作台首页', async () => {
    const res = await until(
      () => formLogin(SELECT_URL, { email: STRANGER.email, password: STRANGER.password, app: 'select' }),
      (r) => r.status !== 429,
      30_000,
    )
    expect(res.status).toBe(302)
    expect(res.location).toBe('/zh-CN/denied')
  })
})

describe('登录 — 暴力尝试被限速', () => {
  it('同一来源短时间连续猜密码，很快遇到 429 并给出重试等待', async () => {
    const seen: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const res = await signInEmail(SEED_USERS.ops.email, `wrong-guess-${i}`)
      seen.push(res.status)
      if (res.status === 429) {
        expect(res.retryAfterMs ?? 0).toBeGreaterThan(0)
        break
      }
    }
    expect(seen).toContain(429)
    expect(seen.filter((s) => s === 200)).toHaveLength(0)
    // Let the window pass so later suites are not paying for this case.
    await new Promise((resolve) => setTimeout(resolve, 10_500))
  }, 40_000)
})
