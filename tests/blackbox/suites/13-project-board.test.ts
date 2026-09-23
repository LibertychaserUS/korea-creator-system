import { beforeAll, describe, expect, it } from 'vitest'
import { authed, login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { createAndPublish, createProject, runId } from '../helpers/fixtures'
import { BASE_URL, assertLoginRequired, request } from '../helpers/http'

/**
 * 项目候选名单：导出表格与移出项目（05 接口说明 · 项目导出 / 移出分派）。
 *
 * 导出是带 BOM 的 UTF-8 表格，表头跟着 `?locale=`，数字用发布时的快照（和
 * 博主库一致），昵称里的公式字符被垫掉；移出只删这一条分派。
 *
 * Break: 表格用 Excel 打开乱码 / 表头是英文字段名；导出的是抓取后的最新数字；
 * 只读账号能移出分派；移出后导出里还有这位博主。
 */

let ops: Session
let selector: Session
let viewer: Session
const RUN = runId('bbexp')
let projectId = ''
let creatorId = ''
const displayName = `=${RUN}`

async function rawExport(session: Session | null, locale?: string) {
  const url = new URL(`${BASE_URL}${PATHS.projectExport(projectId)}`)
  if (locale) url.searchParams.set('locale', locale)
  const res = await fetch(url, { headers: session ? { authorization: `Bearer ${session.token}` } : {} })
  const bytes = new Uint8Array(await res.arrayBuffer())
  const text = new TextDecoder().decode(bytes)
  return { res, bytes, lines: text.trim().split('\r\n') }
}

beforeAll(async () => {
  ops = await login('ops')
  selector = await login('selector')
  viewer = await login('selector_viewer')
  const creator = await createAndPublish(ops, { displayName, followers: 80_000, regions: ['서울'] })
  creatorId = String(creator.id)
  // The latest number moves after publish; the sheet must keep the published one.
  const patched = await authed(ops, 'PATCH', PATHS.opsCreator(creatorId), { followers: 900_000 })
  expect(patched.status).toBe(200)
  projectId = String((await createProject(selector, `${RUN} 项目`)).id)
  const assigned = await authed(selector, 'POST', PATHS.assignments(projectId), { creatorIds: [creatorId] })
  expect(assigned.status).toBe(200)
}, 60_000)

describe('导出表格', () => {
  it('UTF-8 带 BOM、中文表头、发布时的数字、公式被垫掉', async () => {
    const { res, bytes, lines } = await rawExport(selector)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(lines[0]!.replace(/^\uFEFF/, '').split(',').slice(0, 5)).toEqual(['博主', '小红书号', '数据源', '粉丝量级', '粉丝数'])
    const row = lines.find((line) => line.includes(RUN))
    expect(row, 'assigned creator is in the sheet').toBeTruthy()
    expect(row!.startsWith(`'=${RUN},`)).toBe(true)
    expect(row).toContain(',腰部,80000,')
    expect(row).not.toContain('900000')
    expect(row).toContain(',已分派,')
  })

  it('表头跟着语言走：en / ko，不认识的语言退回中文', async () => {
    expect((await rawExport(selector, 'en')).lines[0]).toMatch(/^\uFEFF?Creator,Xiaohongshu account,Source,Follower tier,Followers,/)
    expect((await rawExport(selector, 'ko')).lines[0]).toMatch(/^\uFEFF?크리에이터,/)
    expect((await rawExport(selector, 'xx')).lines[0]).toMatch(/^\uFEFF?博主,/)
  })

  it('只读选人能导出；运营、匿名不行', async () => {
    expect((await rawExport(viewer)).res.status).toBe(200)
    expect((await rawExport(ops)).res.status).toBe(403)
    assertLoginRequired(await request('GET', PATHS.projectExport(projectId)))
  })
})

describe('移出项目', () => {
  it('只读选人不能移出', async () => {
    const res = await authed(viewer, 'DELETE', PATHS.assignment(projectId, creatorId))
    expect(res.status).toBe(403)
  })

  it('选人移出后，名单和导出里都没有这位博主；再移一次 404', async () => {
    const removed = await authed(selector, 'DELETE', PATHS.assignment(projectId, creatorId))
    expect(removed.status).toBe(200)
    const board = await authed(selector, 'GET', PATHS.project(projectId))
    expect((board.json.assignments as unknown[]).length).toBe(0)
    const { lines } = await rawExport(selector)
    expect(lines.some((line) => line.includes(RUN))).toBe(false)
    expect((await authed(selector, 'DELETE', PATHS.assignment(projectId, creatorId))).status).toBe(404)
  })
})

describe('运营看趋势', () => {
  it('运营能读博主的历史记录，选人不能', async () => {
    const own = await authed(ops, 'GET', PATHS.opsCreatorHistory(creatorId))
    expect(own.status).toBe(200)
    expect(Array.isArray(own.json.snapshots)).toBe(true)
    expect((await authed(selector, 'GET', PATHS.opsCreatorHistory(creatorId))).status).toBe(403)
  })
})
