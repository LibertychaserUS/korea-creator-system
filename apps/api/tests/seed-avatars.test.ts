import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('seed talent avatars and photos', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('gives every seed talent an avatar_url and at least one photo_url served as a real PNG', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const res = await ctx.app.request('/api/ops/creators', {
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()).items as Array<{
      id: string
      avatarUrl?: string | null
      photoUrls?: string[] | null
    }>
    const seeded = items.filter((row) => String(row.id).startsWith('seed_'))
    expect(seeded).toHaveLength(27)

    let withBoth = 0
    for (const row of seeded) {
      expect(row.avatarUrl, row.id).toMatch(/\/api\/assets\/raw\/fixtures\//)
      expect(row.photoUrls?.length ?? 0, row.id).toBeGreaterThanOrEqual(1)
      const photoUrl = row.photoUrls![0]
      expect(photoUrl, row.id).toMatch(/\/api\/assets\/raw\/fixtures\//)

      const avatar = await ctx.app.request(assetPath(row.avatarUrl!))
      const photo = await ctx.app.request(assetPath(photoUrl))
      expect(avatar.status, `${row.id} avatar`).toBe(200)
      expect(photo.status, `${row.id} photo`).toBe(200)
      const avatarBuf = Buffer.from(await avatar.arrayBuffer())
      const photoBuf = Buffer.from(await photo.arrayBuffer())
      expect(avatarBuf.subarray(0, 8).equals(PNG_SIG), `${row.id} avatar png`).toBe(true)
      expect(photoBuf.subarray(0, 8).equals(PNG_SIG), `${row.id} photo png`).toBe(true)
      expect(avatarBuf.length, `${row.id} avatar size`).toBeGreaterThan(2000)
      expect(photoBuf.length, `${row.id} photo size`).toBeGreaterThan(2000)
      withBoth += 1
    }
    expect(withBoth).toBe(27)
  })

  it('exposes the same image fields on the selector pool', async () => {
    const sel = await ctx.loginJson('selector@kcs.local')
    const res = await ctx.app.request('/api/select/pool', {
      headers: { authorization: `Bearer ${sel.token}` },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()).items as Array<{
      id: string
      avatarUrl?: string | null
      photoUrls?: string[] | null
    }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((row) => row.avatarUrl && (row.photoUrls?.length ?? 0) > 0)).toBe(true)
  })
})

function assetPath(url: string) {
  const parsed = new URL(url, 'http://localhost:7100')
  return parsed.pathname
}
