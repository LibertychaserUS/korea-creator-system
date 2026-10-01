import { beforeAll, describe, expect, it } from 'vitest'
import { authed, login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { createAndPublish, createCreator, createProject, runId } from '../helpers/fixtures'
import { errorCode, itemsOf } from '../helpers/http'
import { sqlExec } from '../helpers/postgres'

/**
 * 选人任务空间（missions）：brief 随任务保存/校验、工作区漏斗（workspace）、
 * 0 结果归因（explain）、只读角色边界，以及上线后旧分派端点的回归锚点。
 *
 * Break: brief 存进去变了样；校验错误不是「码: 说明」；漏斗数错；不在池的
 * 达人混进篮子；viewer 能写任务；PATCH 清不掉 brief；旧 /api/kcs/assignments 挂了。
 *
 * 注：实现没有「改分派状态」的 HTTP 端点，已定计数用例按 apps/api/tests
 * 里 workspace 单测的同一途径布置场景（直接 UPDATE assignments.status），
 * 断言一律走 HTTP。
 */

const RUN = runId('bbmis')
const workspaceOf = (id: string) => `/api/select/projects/${id}/workspace`
const explainOf = (id: string) => `/api/select/projects/${id}/explain`

const FULL_BRIEF = {
  category: '美妆',
  targetCount: 30,
  budgetMin: 5_000,
  budgetMax: 80_000,
  focus: 'reach',
  deadline: '2026-12-31',
}

let admin: Session
let ops: Session
let viewer: Session

// 昨天之后、但格式不是 YYYY-MM-DD 的日期（走 YYYY/MM/DD 坏格式）。
const tomorrowBad = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10).replaceAll('-', '/')

async function createMission(session: Session, name: string, brief?: unknown) {
  const res = await authed(session, 'POST', PATHS.projects, {
    name,
    note: `note-${name}`,
    ...(brief === undefined ? {} : { brief }),
  })
  expect(res.status).toBe(201)
  return String(res.json.id)
}

beforeAll(async () => {
  admin = await login('platform_admin')
  ops = await login('ops')
  viewer = await login('selector_viewer')
}, 60_000)

describe('任务创建与 brief 回放', () => {
  it('platform_admin 建带完整 brief 的任务，列表与详情原样带回', async () => {
    const projectId = await createMission(admin, `任务-${RUN}`, FULL_BRIEF)
    const detail = await authed(admin, 'GET', PATHS.project(projectId))
    expect(detail.status).toBe(200)
    expect(detail.json.brief).toEqual(FULL_BRIEF)

    const list = await authed(admin, 'GET', PATHS.projects)
    expect(list.status).toBe(200)
    const mine = itemsOf(list.json).find((item) => item.id === projectId)
    expect(mine?.brief).toEqual(FULL_BRIEF)
  })
})

describe('brief 校验矩阵', () => {
  const cases: Array<[string, unknown, string]> = [
    ['targetCount=0', { ...FULL_BRIEF, targetCount: 0 }, 'brief.targetCount'],
    ['budgetMin>budgetMax', { ...FULL_BRIEF, budgetMin: 100, budgetMax: 50 }, 'brief.budget'],
    ['focus=bogus', { ...FULL_BRIEF, focus: 'bogus' }, 'brief.focus'],
    ['deadline 昨天之后但格式坏', { ...FULL_BRIEF, deadline: tomorrowBad }, 'brief.deadline'],
  ]
  for (const [label, brief, code] of cases) {
    it(`${label} → 400，message 是「码: 说明」`, async () => {
      const res = await authed(admin, 'POST', PATHS.projects, { name: `bad-${label}-${RUN}`, brief })
      expect(res.status).toBe(400)
      expect(errorCode(res.json)).toBe('VALIDATION')
      const fields = (res.json.error as { fields?: Array<{ path: string; message: string }> }).fields ?? []
      const hit = fields.find((field) => field.message.startsWith(`${code}:`))
      expect(hit, `fields 里应有 ${code} 开头的「码: 说明」`).toBeTruthy()
    })
  }
})

describe('workspace 漏斗与篮子', () => {
  let projectId = ''
  let creatorA = ''
  let creatorB = ''

  beforeAll(async () => {
    const a = await createAndPublish(ops, {
      displayName: `空间甲-${RUN}`,
      creatorKey: `key-a-${RUN}`,
      followers: 10_000,
      metrics: { engagementRate: 5.5, readMedian: 12000, cpr: 8, cpe: 2 },
    })
    const b = await createAndPublish(ops, {
      displayName: `空间乙-${RUN}`,
      creatorKey: `key-b-${RUN}`,
      followers: 60_000,
      metrics: { engagementRate: 3, readMedian: 50000, cpr: 20, cpe: 5 },
    })
    creatorA = String(a.id)
    creatorB = String(b.id)
    projectId = await createMission(admin, `空间-${RUN}`)
    const assigned = await authed(admin, 'POST', PATHS.assignments(projectId), {
      creatorIds: [creatorA, creatorB],
    })
    expect(assigned.status).toBe(200)
  }, 60_000)

  it('入篮 2 人后 funnel.basket=2，篮子行字段齐全', async () => {
    const res = await authed(admin, 'GET', workspaceOf(projectId))
    expect(res.status).toBe(200)
    expect(res.json.funnel).toMatchObject({ basket: 2, decided: 0 })
    const basket = res.json.basket as Array<Record<string, unknown>>
    expect(basket).toHaveLength(2)
    for (const row of basket) {
      expect(row).toEqual(
        expect.objectContaining({
          creatorId: expect.any(String),
          displayName: expect.any(String),
          assignmentStatus: 'assigned',
          poolGone: false,
          addedAt: expect.any(String),
        }),
      )
      const metrics = row.metrics as Record<string, unknown>
      for (const key of ['engagementRate', 'readMedian', 'cpr', 'cpe']) {
        expect(metrics, `metrics.${key}`).toHaveProperty(key)
      }
      const percentile = (row.percentiles as { engagementRate?: number | null }).engagementRate
      expect(percentile === null || (percentile! >= 0 && percentile! <= 100)).toBe(true)
    }
  })

  it('重复入篮 409 already_assigned（幂等）', async () => {
    const res = await authed(admin, 'POST', PATHS.assignments(projectId), { creatorIds: [creatorA] })
    expect(res.status).toBe(409)
    expect((res.json.error as { message?: string }).message).toBe('already_assigned')
  })

  it('不在池的 creator 入篮被拒绝：400 not_in_pool，不产出 poolGone 行', async () => {
    // 语义（select-projects.ts assign 实现）：不在选人池的 id 在写入前整批拒绝
    // （400 VALIDATION / not_in_pool）；poolGone 只标记「入篮之后才离开池」的旧行。
    const draft = await createCreator(ops, { displayName: `未上架-${RUN}`, followers: 1_000 })
    const res = await authed(admin, 'POST', PATHS.assignments(projectId), { creatorIds: [String(draft.id)] })
    expect(res.status).toBe(400)
    expect((res.json.error as { message?: string }).message).toBe('not_in_pool')
    const workspace = await authed(admin, 'GET', workspaceOf(projectId))
    expect((workspace.json.funnel as { basket: number }).basket).toBe(2)
  })

  it('已定计数：一条 assignment 置 decided 后 funnel.decided=1', async () => {
    await sqlExec(
      `UPDATE assignments SET status = 'decided' WHERE project_id = $1 AND creator_id = $2`,
      [projectId, creatorA],
    )
    const res = await authed(admin, 'GET', workspaceOf(projectId))
    expect(res.status).toBe(200)
    expect(res.json.funnel).toMatchObject({ basket: 2, decided: 1 })
  })
})

describe('explain 0 结果归因', () => {
  let projectId = ''

  beforeAll(async () => {
    projectId = await createMission(admin, `归因-${RUN}`)
  })

  it('search + followers 组合：单条件 count ≥ 组合 total', async () => {
    const spec = {
      search: `key-a-${RUN}`,
      filters: [{ key: 'followers', op: 'gte', value: 0 }],
    }
    const res = await authed(admin, 'POST', explainOf(projectId), { spec })
    expect(res.status).toBe(200)
    const body = res.json as { total: number; clauses: Array<{ key: string; count: number | null }> }
    expect(typeof body.total).toBe('number')
    const search = body.clauses.find((clause) => clause.key === 'search')
    const followers = body.clauses.find((clause) => clause.key === 'filters.followers')
    expect(search?.count).not.toBeNull()
    expect(followers?.count).not.toBeNull()
    expect(search!.count!).toBeGreaterThanOrEqual(body.total)
    expect(followers!.count!).toBeGreaterThanOrEqual(body.total)
  })

  it('垃圾 spec → 400 VALIDATION', async () => {
    const res = await authed(admin, 'POST', explainOf(projectId), { spec: { filters: 'nope' } })
    expect(res.status).toBe(400)
    expect(errorCode(res.json)).toBe('VALIDATION')
  })
})

describe('只读角色边界', () => {
  let projectId = ''

  beforeAll(async () => {
    projectId = await createMission(admin, `权限-${RUN}`)
  })

  it('selector_viewer 建任务 / 改 brief 403，读 workspace 200', async () => {
    expect((await authed(viewer, 'POST', PATHS.projects, { name: `viewer-${RUN}` })).status).toBe(403)
    expect((await authed(viewer, 'PATCH', PATHS.project(projectId), { brief: { focus: 'cost' } })).status).toBe(403)
    expect((await authed(viewer, 'GET', workspaceOf(projectId))).status).toBe(200)
  })
})

describe('PATCH brief', () => {
  it('改 focus=cost 详情反映；brief:null 清空', async () => {
    const projectId = await createMission(admin, `补丁-${RUN}`, FULL_BRIEF)
    const patched = await authed(admin, 'PATCH', PATHS.project(projectId), { brief: { ...FULL_BRIEF, focus: 'cost' } })
    expect(patched.status).toBe(200)
    const detail = await authed(admin, 'GET', PATHS.project(projectId))
    expect((detail.json.brief as { focus?: string }).focus).toBe('cost')

    const cleared = await authed(admin, 'PATCH', PATHS.project(projectId), { brief: null })
    expect(cleared.status).toBe(200)
    const after = await authed(admin, 'GET', PATHS.project(projectId))
    expect(after.json.brief).toBeNull()
  })
})

describe('回归锚点：旧分派端点', () => {
  it('POST /api/kcs/assignments 单达人分派仍 200', async () => {
    const person = await createAndPublish(ops, {
      displayName: `旧端点-${RUN}`,
      creatorKey: `legacy-${RUN}`,
      followers: 20_000,
    })
    const project = await createProject(admin, `旧端点项目-${RUN}`)
    const res = await authed(admin, 'POST', '/api/kcs/assignments', {
      projectId: String(project.id),
      creatorId: String(person.id),
    })
    expect(res.status).toBe(200)
  })
})
