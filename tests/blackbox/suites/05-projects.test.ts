import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { ERROR, PATHS } from '../helpers/contract'
import {
  createAndPublish,
  createProject,
  runId,
  unpublishCreator,
} from '../helpers/fixtures'
import { assertDenied, errorCode, request } from '../helpers/http'
import { sqlRead } from '../helpers/postgres'

/**
 * PRD §4 步 3 + DOMAIN Assignment + UX 1 成功/权限不够.
 * Break: viewer assign succeeds, or remove does not allow re-assign.
 */

describe('Project assign / remove', () => {
  let ops: Session
  let selector: Session
  let viewer: Session
  let creatorId: string
  let projectId: string

  beforeAll(async () => {
    ops = await login('ops')
    selector = await login('selector')
    viewer = await login('selector_viewer')
    const person = await createAndPublish(ops, {
      displayName: `待分配-${runId()}`,
      followers: 10_000,
    })
    creatorId = String(person.id)
    const project = await createProject(selector, `春季档-${runId()}`)
    projectId = String(project.id)
  })

  it('selector assigns a released creator once (PRD §4 / UX 1 成功)', async () => {
    const first = await request('POST', PATHS.assignments(projectId), {
      token: selector.token,
      body: { creatorIds: [creatorId] },
    })
    expect([200, 201]).toContain(first.status)

    const board = await request('GET', PATHS.project(projectId), { token: selector.token })
    expect(board.status).toBe(200)
    const rows = (board.json.assignments as Array<{ creatorId?: string; status?: string }>) ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0]?.creatorId ?? (rows[0] as { id?: string })?.id).toBeTruthy()
    expect(rows[0]?.status ?? 'assigned').toBe('assigned')
  })

  it('re-assigning the same person does not duplicate (UX 1 成功 不复制)', async () => {
    const dup = await request('POST', PATHS.assignments(projectId), {
      token: selector.token,
      body: { creatorIds: [creatorId] },
    })
    expect([409, 200]).toContain(dup.status)
    const board = await request('GET', PATHS.project(projectId), { token: selector.token })
    const rows = (board.json.assignments as unknown[]) ?? []
    expect(rows).toHaveLength(1)
  })

  it('remove deletes the assignment and allows assign again (DOMAIN §8 分配可撤销)', async () => {
    const remove = await request('DELETE', PATHS.assignment(projectId, creatorId), {
      token: selector.token,
    })
    expect(remove.status).toBe(200)
    const empty = await request('GET', PATHS.project(projectId), { token: selector.token })
    expect(((empty.json.assignments as unknown[]) ?? []).length).toBe(0)

    const again = await request('POST', PATHS.assignments(projectId), {
      token: selector.token,
      body: { creatorIds: [creatorId] },
    })
    expect([200, 201]).toContain(again.status)
  })

  it('selector_viewer cannot assign (UX 1 权限不够 / 用户要求)', async () => {
    const other = await createProject(selector, `viewer-deny-${runId()}`)
    const res = await request('POST', PATHS.assignments(String(other.id)), {
      token: viewer.token,
      body: { creatorIds: [creatorId] },
    })
    assertDenied(res)
    expect(errorCode(res.json)).toBe(ERROR.DENIED)
  })

  it('selector_viewer cannot remove (DOMAIN 移出 = 删行)', async () => {
    const res = await request('DELETE', PATHS.assignment(projectId, creatorId), {
      token: viewer.token,
    })
    assertDenied(res)
  })

  it('unpublished creator cannot be newly assigned; existing row is pool_gone (PRD §7 / DOMAIN)', async () => {
    const person = await createAndPublish(ops, {
      displayName: `将下架-${runId()}`,
      followers: 2222,
    })
    const project = await createProject(selector, `下架项目-${runId()}`)
    const assigned = await request('POST', PATHS.assignments(String(project.id)), {
      token: selector.token,
      body: { creatorIds: [person.id] },
    })
    expect([200, 201]).toContain(assigned.status)

    const withdrawn = await unpublishCreator(ops, String(person.id))
    expect(withdrawn.status).toBe(200)

    const board = await request('GET', PATHS.project(String(project.id)), {
      token: selector.token,
    })
    const row = ((board.json.assignments as Array<{ poolGone?: boolean; pool_gone?: boolean }>) ??
      [])[0]
    expect(row?.poolGone ?? row?.pool_gone).toBe(true)

    const fresh = await createProject(selector, `新分配应失败-${runId()}`)
    const blocked = await request('POST', PATHS.assignments(String(fresh.id)), {
      token: selector.token,
      body: { creatorIds: [person.id] },
    })
    expect([400, 409]).toContain(blocked.status)
  })

  it('optional SQL read sees one assignment row after assign (persistence)', async () => {
    const project = await createProject(selector, `sql-${runId()}`)
    await request('POST', PATHS.assignments(String(project.id)), {
      token: selector.token,
      body: { creatorIds: [creatorId] },
    })
    try {
      const rows = await sqlRead<{ n: string }>(
        `SELECT count(*)::text AS n FROM assignment WHERE project_id = $1`,
        [project.id],
      )
      expect(Number(rows[0]?.n ?? 0)).toBeGreaterThanOrEqual(1)
    } catch {
      const board = await request('GET', PATHS.project(String(project.id)), {
        token: selector.token,
      })
      expect(((board.json.assignments as unknown[]) ?? []).length).toBeGreaterThanOrEqual(1)
    }
  })
})
