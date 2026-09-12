import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { login, loginAll, type Session } from '../helpers/auth'
import { ERROR, PATHS, PROTECTED_GETS, type Role } from '../helpers/contract'
import { createAndPublish, createCreator, createProject, runId } from '../helpers/fixtures'
import {
  assertDenied,
  assertLoginRequired,
  errorCode,
  leakedBusinessPayload,
  request,
} from '../helpers/http'
import { closePool } from '../helpers/postgres'

/**
 * PRD §2 visibility + UX「权限跳转」+ SCREEN AUTH-DENIED / AUTH-LOGIN.
 * Break this suite catches: a forbidden role receives 200, or 403 leaks drafts/jobs.
 */

const FAKE = 'bb-forbidden-probe'

type Denial = {
  name: string
  role: Role
  method: string
  path: string
  body?: unknown
  spec: string
}

describe('AuthN / AuthZ — five roles', () => {
  let sessions: Record<Role, Session>
  let draftId = FAKE
  let jobId = FAKE

  beforeAll(async () => {
    sessions = await loginAll()
    const draft = await createCreator(sessions.ops, {
      displayName: `authz-draft-${runId()}`,
      followersUnknown: true,
    })
    draftId = String(draft.id)
    await createAndPublish(sessions.ops, {
      displayName: `authz-released-${runId()}`,
      followers: 1111,
    })
    await createProject(sessions.selector, `authz-${runId()}`)
    const job = await request('POST', PATHS.ingestJobs, {
      token: sessions.ops.token,
      body: { sourceId: 'file-drop', schedule: 'once' },
    })
    if (typeof job.json.id === 'string') jobId = job.json.id
  })

  afterAll(async () => {
    await closePool()
  })

  describe('unauthenticated → 401 AUTH-LOGIN (DOMAIN 边界 / UX 未登录)', () => {
    it.each(PROTECTED_GETS)('GET %s', async (path) => {
      const res = await request('GET', path)
      assertLoginRequired(res)
    })

    it('POST ops create is AUTH-LOGIN and returns no creator id', async () => {
      const res = await request('POST', PATHS.opsCreators, {
        body: { displayName: 'anon' },
      })
      assertLoginRequired(res)
      expect(res.json.id).toBeUndefined()
    })

    it('GET selector pool does not return 发布池 JSON', async () => {
      const res = await request('GET', PATHS.pool)
      assertLoginRequired(res)
      expect(res.json.items).toBeUndefined()
    })
  })

  const denials: Denial[] = [
    {
      name: 'selector lists ops inventory',
      role: 'selector',
      method: 'GET',
      path: PATHS.opsCreators,
      spec: 'PRD §2 / UX 1 权限不够 / SCREEN AUTH-DENIED',
    },
    {
      name: 'selector_viewer lists ops inventory',
      role: 'selector_viewer',
      method: 'GET',
      path: PATHS.opsCreators,
      spec: 'PRD §2 / UX 1 权限不够',
    },
    {
      name: 'devops lists ops inventory',
      role: 'devops',
      method: 'GET',
      path: PATHS.opsCreators,
      spec: 'PRD §8.2 不见业务表',
    },
    {
      name: 'selector creates a creator',
      role: 'selector',
      method: 'POST',
      path: PATHS.opsCreators,
      body: { displayName: 'nope', regions: ['서울'], categories: ['never_collaborated'] },
      spec: 'UX 2 选人写录入接口 → 403',
    },
    {
      name: 'selector_viewer creates a creator',
      role: 'selector_viewer',
      method: 'POST',
      path: PATHS.opsCreators,
      body: { displayName: 'nope', regions: ['서울'] },
      spec: 'UX 2 选人写录入接口 → 403',
    },
    {
      name: 'devops creates a creator',
      role: 'devops',
      method: 'POST',
      path: PATHS.opsCreators,
      body: { displayName: 'nope', regions: ['서울'] },
      spec: 'PRD §8.2 / UX 3 运维写 Creator → 403',
    },
    {
      name: 'selector publishes',
      role: 'selector',
      method: 'POST',
      path: PATHS.opsPublish(FAKE),
      spec: 'PRD §2 选人禁止发布',
    },
    {
      name: 'devops publishes',
      role: 'devops',
      method: 'POST',
      path: PATHS.opsPublish(FAKE),
      spec: 'UX 3 运维调发布 → 403',
    },
    {
      name: 'selector_viewer publishes',
      role: 'selector_viewer',
      method: 'POST',
      path: PATHS.opsPublish(FAKE),
      spec: 'selector_viewer 仅 select.read',
    },
    {
      name: 'devops unpublishes',
      role: 'devops',
      method: 'POST',
      path: PATHS.opsUnpublish(FAKE),
      spec: 'UX 3 运维写业务字段 → 403',
    },
    {
      name: 'selector opens /dev jobs',
      role: 'selector',
      method: 'GET',
      path: PATHS.devJobs,
      spec: 'UX 1 / UX 3 选人进 /dev → AUTH-DENIED',
    },
    {
      name: 'selector_viewer opens /dev jobs',
      role: 'selector_viewer',
      method: 'GET',
      path: PATHS.devJobs,
      spec: 'UX 3 选人进 /dev → AUTH-DENIED',
    },
    {
      name: 'selector opens /ingest jobs',
      role: 'selector',
      method: 'GET',
      path: PATHS.ingestJobs,
      spec: 'UX 1 / UX 4 选人进 /ingest → AUTH-DENIED',
    },
    {
      name: 'selector_viewer opens /ingest sources',
      role: 'selector_viewer',
      method: 'GET',
      path: PATHS.ingestSources,
      spec: 'UX 4 选人进 /ingest → AUTH-DENIED',
    },
    {
      name: 'selector creates an ingest job',
      role: 'selector',
      method: 'POST',
      path: PATHS.ingestJobs,
      body: { sourceId: 'file-drop', schedule: 'once' },
      spec: 'UX 4 / PRD §8.3 选人不能开 Job',
    },
    {
      name: 'selector retries a job',
      role: 'selector',
      method: 'POST',
      path: PATHS.devRetry(FAKE),
      spec: 'PRD §8.3 重试仅运维',
    },
    {
      name: 'selector_viewer retries a job',
      role: 'selector_viewer',
      method: 'POST',
      path: PATHS.devRetry(FAKE),
      spec: 'PRD §8.3 重试仅运维',
    },
    {
      name: 'ops retries a job (M1)',
      role: 'ops',
      method: 'POST',
      path: PATHS.devRetry(FAKE),
      spec: 'UX 3 运营不重试（M1：重试仅运维）',
    },
    {
      name: 'ops assigns to a project',
      role: 'ops',
      method: 'POST',
      path: PATHS.assignments(FAKE),
      body: { creatorIds: [FAKE] },
      spec: 'PRD §2 / UX 权限跳转 运营不写别人的 Assignment',
    },
    {
      name: 'devops assigns to a project',
      role: 'devops',
      method: 'POST',
      path: PATHS.assignments(FAKE),
      body: { creatorIds: [FAKE] },
      spec: 'PRD §8.2 / UX 3 运维不写分配',
    },
    {
      name: 'selector_viewer assigns to a project',
      role: 'selector_viewer',
      method: 'POST',
      path: PATHS.assignments(FAKE),
      body: { creatorIds: [FAKE] },
      spec: 'DOMAIN §Assignment / 用户要求 viewer cannot assign',
    },
    {
      name: 'selector_viewer creates a project',
      role: 'selector_viewer',
      method: 'POST',
      path: PATHS.projects,
      body: { name: 'viewer-forbidden' },
      spec: 'selector_viewer 仅 select.read，无 select.write',
    },
    {
      name: 'devops creates a project',
      role: 'devops',
      method: 'POST',
      path: PATHS.projects,
      body: { name: 'devops-forbidden' },
      spec: 'PRD §8.2 监测页不做选人',
    },
    {
      name: 'ops creates a project',
      role: 'ops',
      method: 'POST',
      path: PATHS.projects,
      body: { name: 'ops-forbidden' },
      spec: 'PRD §8.1 录入区不做选人分配',
    },
    {
      name: 'selector_viewer removes an assignment',
      role: 'selector_viewer',
      method: 'DELETE',
      path: PATHS.assignment(FAKE, FAKE),
      spec: '移出 = 写 Assignment，viewer 禁止',
    },
    {
      name: 'devops patches creator price',
      role: 'devops',
      method: 'PATCH',
      path: PATHS.opsCreator(FAKE),
      body: { price: { amountMin: 1, currency: 'CNY' } },
      spec: 'UX 3 运维改报价 → 403',
    },
    {
      name: 'selector patches categories',
      role: 'selector',
      method: 'PATCH',
      path: PATHS.opsCategory('collaborated'),
      body: { names: { 'zh-CN': 'x' } },
      spec: 'PRD §4 前台不准改分类',
    },
    {
      name: 'selector_viewer presigns S3 upload',
      role: 'selector_viewer',
      method: 'POST',
      path: PATHS.assetsPresign,
      body: { purpose: 'avatar', contentType: 'image/png' },
      spec: '前台无录入/上传作业',
    },
    {
      name: 'selector presigns S3 upload',
      role: 'selector',
      method: 'POST',
      path: PATHS.assetsPresign,
      body: { purpose: 'avatar', contentType: 'image/png' },
      spec: 'PRD §4 选人禁止录入',
    },
    {
      name: 'devops lists select pool (业务表)',
      role: 'devops',
      method: 'GET',
      path: PATHS.pool,
      spec: 'PRD §2 / §8.2 监测不见业务表',
    },
  ]

  describe('forbidden action → 403 AUTH-DENIED, zero payload', () => {
    it.each(denials)('$name ($spec)', async (row) => {
      const res = await request(row.method, row.path, {
        token: sessions[row.role].token,
        body: row.body,
      })
      assertDenied(res)
    })
  })

  it('selector GET ops inventory is 403 even when drafts exist (no probe)', async () => {
    const res = await request('GET', PATHS.opsCreators, {
      token: sessions.selector.token,
    })
    assertDenied(res)
    expect(leakedBusinessPayload(res.json)).toBe(false)
    expect(JSON.stringify(res.json)).not.toContain(draftId)
  })

  it('platform_admin can login and read ops + select + ingest', async () => {
    const admin = sessions.platform_admin
    const me = await request('GET', PATHS.me, { token: admin.token })
    expect(me.status).toBe(200)
    expect((me.json.user as { role?: string } | undefined)?.role ?? me.json.role).toBe(
      'platform_admin',
    )
    expect((await request('GET', PATHS.opsCreators, { token: admin.token })).status).toBe(200)
    expect((await request('GET', PATHS.pool, { token: admin.token })).status).toBe(200)
    expect((await request('GET', PATHS.ingestSources, { token: admin.token })).status).toBe(200)
    expect((await request('GET', PATHS.devJobs, { token: admin.token })).status).toBe(200)
  })

  it('ops can read ingest and health but error.code on retry stays AUTH-DENIED', async () => {
    const ops = await login('ops')
    expect((await request('GET', PATHS.ingestSources, { token: ops.token })).status).toBe(200)
    expect((await request('GET', PATHS.devHealth, { token: ops.token })).status).toBe(200)
    const retry = await request('POST', PATHS.devRetry(jobId), { token: ops.token })
    expect(retry.status).toBe(403)
    expect(errorCode(retry.json)).toBe(ERROR.DENIED)
  })
})

