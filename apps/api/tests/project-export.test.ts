import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/** 导出表格：带 BOM、表头随语言、数字用发布时的快照、公式字符被垫掉。 */
describe('project export', () => {
  let ctx: TestCtx
  let ops = ''
  let selector = ''
  let viewer = ''
  let projectId = ''
  let creatorId = ''

  const call = (token: string, method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const lines = (text: string) => text.replace(/^\uFEFF/, '').trim().split('\r\n')

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    selector = (await ctx.loginJson('selector@kcs.local')).token
    viewer = (await ctx.loginJson('viewer@kcs.local')).token
    const created = await call(ops, 'POST', '/api/ops/creators', {
      displayName: '=HYPERLINK("x")',
      xhsId: 'export_one',
      regions: ['서울'],
      followers: 80_000,
      price: { amountMin: 3500, currency: 'CNY' },
    })
    creatorId = (await created.json()).id
    expect((await call(ops, 'POST', `/api/ops/creators/${creatorId}/publish`)).status).toBe(200)
    // Latest moves after publish; the export must keep the snapshot.
    expect((await call(ops, 'PATCH', `/api/ops/creators/${creatorId}`, { followers: 900_000 })).status).toBe(200)
    const project = await call(selector, 'POST', '/api/select/projects', { name: '春季档/导出' })
    projectId = (await project.json()).id
    expect((await call(selector, 'POST', `/api/select/projects/${projectId}/assignments`, { creatorIds: [creatorId] })).status).toBe(200)
  })

  afterAll(() => ctx.close())

  it('downloads a UTF-8 sheet with Chinese headers by default', async () => {
    const res = await call(selector, 'GET', `/api/select/projects/${projectId}/export`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('春季档 导出')}.csv`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    const [header, row] = lines(text)
    expect(header!.split(',').slice(0, 5)).toEqual(['博主', '小红书号', '数据源', '粉丝量级', '粉丝数'])
    expect(header!.endsWith('状态,发布时间')).toBe(true)
    expect(row!.startsWith(`"'=HYPERLINK(""x"")",export_one,手动录入,腰部,80000,`)).toBe(true)
    expect(row).toContain(',已分派,')
    expect(row).not.toContain('900000')
  })

  it('follows the requested language and marks withdrawn creators', async () => {
    expect((await call(ops, 'POST', `/api/ops/creators/${creatorId}/unpublish`)).status).toBe(200)
    const en = lines(await (await call(viewer, 'GET', `/api/select/projects/${projectId}/export?locale=en`)).text())
    expect(en[0]!.startsWith('Creator,Xiaohongshu account,Source,Follower tier,Followers')).toBe(true)
    expect(en[1]).toContain(',Withdrawn,')
    const ko = lines(await (await call(viewer, 'GET', `/api/select/projects/${projectId}/export?locale=ko`)).text())
    expect(ko[0]!.startsWith('크리에이터,')).toBe(true)
    expect(ko[1]).toContain(',게시 중단,')
    const fallback = lines(await (await call(viewer, 'GET', `/api/select/projects/${projectId}/export?locale=xx`)).text())
    expect(fallback[0]!.startsWith('博主,')).toBe(true)
  })

  it('is closed to other roles and unknown projects', async () => {
    expect((await call(ops, 'GET', `/api/select/projects/${projectId}/export`)).status).toBe(403)
    expect((await call(selector, 'GET', '/api/select/projects/nope/export')).status).toBe(404)
    expect((await ctx.app.request(`/api/select/projects/${projectId}/export`)).status).toBe(401)
  })
})
