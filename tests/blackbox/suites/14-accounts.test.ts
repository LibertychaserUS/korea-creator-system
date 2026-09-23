import { beforeAll, describe, expect, it } from 'vitest'
import { AUTH, AUTH_URL, authed, getSession, login, signInWithBackoff, type Session } from '../helpers/auth'
import { PATHS, ROLES, type Role } from '../helpers/contract'
import { runId } from '../helpers/fixtures'
import { request } from '../helpers/http'

/**
 * 账号管理（05 接口说明 · 账号管理 / 07 验收 · 账号）。
 *
 * 在工作端源站上（和登录同一处），只有平台管理员能开账号、改角色、停用。
 * 新账号登录后按角色分流；改角色、停用在 API 上最多 10 秒（会话缓存）后生效；
 * 停用会删掉对方现有会话，登录直接被拒。
 *
 * Break: 运营 / 选人能给自己开管理员账号；停用后旧会话还能一直用；停用的人还能登录；
 * 改完角色 API 一直按旧角色放行；管理员把自己停用把平台锁死。
 */

const OPS_URL = (process.env.BLACKBOX_OPS_URL || 'http://localhost:7002').replace(/\/$/, '')
const CACHE_WAIT_MS = 15_000

type Account = { id: string; email: string; name: string; role: Role | null; disabled: boolean; self?: boolean }
type Res = { status: number; json: Record<string, unknown> }

async function admin(session: Session | null, method: string, path: string, body?: unknown): Promise<Res> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: AUTH_URL,
      ...(session ? { authorization: `Bearer ${session.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { _text: text }
  }
  return { status: res.status, json }
}

function codeOf(res: Res): string | undefined {
  const data = res.json.data as { error?: unknown } | undefined
  return typeof data?.error === 'string' ? data.error : undefined
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

async function signIn(email: string, password: string): Promise<Session & { status: number }> {
  const res = await signInWithBackoff(email, password)
  return { role: 'ops', email, token: res.token ?? '', status: res.status }
}

let platformAdmin: Session
const RUN = runId('bbacc')
const PASSWORD = `Kcs!${RUN}`

beforeAll(async () => {
  platformAdmin = await login('platform_admin')
})

describe('账号管理 — 只有平台管理员', () => {
  it('未登录 → 401，不给账号列表', async () => {
    const res = await admin(null, 'GET', PATHS.accounts)
    expect(res.status).toBe(401)
    expect(res.json.items).toBeUndefined()
  })

  it.each(ROLES.filter((role) => role !== 'platform_admin'))('%s 看列表 / 开账号 / 改角色都是 403', async (role) => {
    const session = await login(role)
    const list = await admin(session, 'GET', PATHS.accounts)
    expect(list.status, 'list').toBe(403)
    expect(list.json.items).toBeUndefined()
    const create = await admin(session, 'POST', PATHS.accounts, {
      email: `${RUN}-${role}@kcs.local`,
      password: PASSWORD,
      role: 'platform_admin',
    })
    expect(create.status, 'create').toBe(403)
    const patch = await admin(session, 'PATCH', PATHS.account('any'), { role: 'platform_admin' })
    expect(patch.status, 'patch').toBe(403)
    const after = await admin(platformAdmin, 'GET', PATHS.accounts)
    expect((after.json.items as Account[]).some((a) => a.email === `${RUN}-${role}@kcs.local`)).toBe(false)
  })

  it('平台管理员看到全部账号：角色、状态、最近登录；自己那行标出来', async () => {
    const res = await admin(platformAdmin, 'GET', PATHS.accounts)
    expect(res.status).toBe(200)
    const items = res.json.items as Array<Account & { lastLoginAt: string | null }>
    const me = items.find((a) => a.email === platformAdmin.email)
    expect(me?.role).toBe('platform_admin')
    expect(me?.self).toBe(true)
    expect(me?.lastLoginAt).toBeTruthy()
    expect(items.every((a) => typeof a.disabled === 'boolean')).toBe(true)
  })

  it('输入不对 → 400；邮箱重复 → 409；不能改自己的角色或停用自己', async () => {
    const bad = await admin(platformAdmin, 'POST', PATHS.accounts, { email: 'not-an-email', password: PASSWORD, role: 'ops' })
    expect([bad.status, codeOf(bad)]).toEqual([400, 'invalid_email'])
    const weak = await admin(platformAdmin, 'POST', PATHS.accounts, { email: `${RUN}-weak@kcs.local`, password: 'short', role: 'ops' })
    expect([weak.status, codeOf(weak)]).toEqual([400, 'weak_password'])
    const role = await admin(platformAdmin, 'POST', PATHS.accounts, { email: `${RUN}-role@kcs.local`, password: PASSWORD, role: 'admin' })
    expect([role.status, codeOf(role)]).toEqual([400, 'invalid_role'])
    const taken = await admin(platformAdmin, 'POST', PATHS.accounts, { email: platformAdmin.email, password: PASSWORD, role: 'ops' })
    expect([taken.status, codeOf(taken)]).toEqual([409, 'email_taken'])

    const list = await admin(platformAdmin, 'GET', PATHS.accounts)
    const me = (list.json.items as Account[]).find((a) => a.self)!
    const demote = await admin(platformAdmin, 'PATCH', PATHS.account(me.id), { role: 'selector' })
    expect([demote.status, codeOf(demote)]).toEqual([409, 'self'])
    const lockout = await admin(platformAdmin, 'PATCH', PATHS.account(me.id), { disabled: true })
    expect([lockout.status, codeOf(lockout)]).toEqual([409, 'self'])
    const missing = await admin(platformAdmin, 'PATCH', PATHS.account(`${RUN}-missing`), { role: 'ops' })
    expect(missing.status).toBe(404)
  })
})

describe('账号管理 — 新建、改角色、停用的完整一圈', () => {
  const email = `${RUN}@kcs.local`
  let id = ''
  let session: Session

  it('管理员新建运营账号 → 对方用初始密码登录，API 认出运营角色，宣传站交接去运营端', async () => {
    const created = await admin(platformAdmin, 'POST', PATHS.accounts, { email, name: '新同事', password: PASSWORD, role: 'ops' })
    expect(created.status).toBe(201)
    id = String(created.json.id)
    expect(created.json.role).toBe('ops')

    const signed = await signIn(email, PASSWORD)
    expect(signed.status).toBe(200)
    session = signed
    const me = await authed(session, 'GET', PATHS.me)
    expect(me.status).toBe(200)
    expect((me.json.user as { role?: string }).role).toBe('ops')
    expect((await authed(session, 'GET', PATHS.opsCreators)).status).toBe(200)
    expect((await authed(session, 'GET', PATHS.pool)).status).toBe(403)

    const form = await until(
      () =>
        fetch(`${AUTH_URL}${AUTH.formLogin}`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', origin: AUTH_URL, referer: `${AUTH_URL}/zh-CN/login` },
          body: new URLSearchParams({ email, password: PASSWORD, locale: 'zh-CN', app: 'marketing' }),
          redirect: 'manual',
        }),
      (res) => res.status !== 429,
      30_000,
    )
    expect(form.status).toBe(302)
    expect(form.headers.get('location')).toBe(`${OPS_URL}/zh-CN/`)

    const listed = await admin(platformAdmin, 'GET', PATHS.accounts)
    const row = (listed.json.items as Array<Account & { lastLoginAt: string | null }>).find((a) => a.email === email)
    expect(row).toMatchObject({ id, role: 'ops', disabled: false, name: '新同事' })
    expect(row?.lastLoginAt).toBeTruthy()
  })

  it('改成选人 → 最多 10 秒后 API 按新角色放行，旧角色的门关上', async () => {
    const patched = await admin(platformAdmin, 'PATCH', PATHS.account(id), { role: 'selector' })
    expect(patched.status).toBe(200)
    expect(patched.json.role).toBe('selector')
    const me = await until(
      () => authed(session, 'GET', PATHS.me),
      (res) => (res.json.user as { role?: string } | undefined)?.role === 'selector',
      CACHE_WAIT_MS,
    )
    expect((me.json.user as { role?: string }).role).toBe('selector')
    expect((await authed(session, 'GET', PATHS.pool)).status).toBe(200)
    expect((await authed(session, 'GET', PATHS.opsCreators)).status).toBe(403)
  })

  it('停用 → 旧会话马上作废、API 最多 10 秒后 401，再登录被拒；恢复后能用原密码登录', async () => {
    const disabled = await admin(platformAdmin, 'PATCH', PATHS.account(id), { disabled: true })
    expect(disabled.status).toBe(200)
    expect(disabled.json.disabled).toBe(true)

    expect((await getSession(session.token)).user).toBeNull()
    const me = await until(() => authed(session, 'GET', PATHS.me), (res) => res.status === 401, CACHE_WAIT_MS)
    expect(me.status).toBe(401)

    const again = await signIn(email, PASSWORD)
    expect(again.status).toBe(403)
    expect(again.token).toBe('')

    const restored = await admin(platformAdmin, 'PATCH', PATHS.account(id), { disabled: false })
    expect(restored.json.disabled).toBe(false)
    const back = await signIn(email, PASSWORD)
    expect(back.status).toBe(200)
    const meBack = await request('GET', PATHS.me, { token: back.token })
    expect((meBack.json.user as { role?: string }).role).toBe('selector')
  })
})
