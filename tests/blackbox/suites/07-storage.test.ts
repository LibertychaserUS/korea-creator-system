import { beforeAll, describe, expect, it } from 'vitest'
import { login, type Session } from '../helpers/auth'
import { PATHS } from '../helpers/contract'
import { assertDenied, itemsOf, request } from '../helpers/http'

/**
 * User brief §7 + PRD §7 头像. Upload and list go through the HTTP API only — not AWS SDK.
 * Break: upload returns no URL, or list/metadata is only reachable via SDK.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('S3 via HTTP API', () => {
  let ops: Session
  let selector: Session
  let key: string
  let url: string

  beforeAll(async () => {
    ops = await login('ops')
    selector = await login('selector')
  })

  it('POST /api/assets (multipart) returns an http(s) URL and key', async () => {
    const form = new FormData()
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'avatar.png')
    form.append('purpose', 'avatar')
    const res = await request('POST', PATHS.assets, { token: ops.token, form })
    expect(res.status).toBe(201)
    expect(String(res.json.url)).toMatch(/^https?:\/\//)
    expect(typeof res.json.key).toBe('string')
    expect(String(res.json.key)).toMatch(/^(avatars|attachments)\//)
    key = String(res.json.key)
    url = String(res.json.url)
  })

  it('POST /api/assets/presign also returns a URL (contract path)', async () => {
    const res = await request('POST', PATHS.assetsPresign, {
      token: ops.token,
      body: { purpose: 'avatar', contentType: 'image/png' },
    })
    expect(res.status).toBe(200)
    expect(String(res.json.url)).toMatch(/^https?:\/\//)
    expect(String(res.json.key)).toMatch(/^(avatars|attachments)\//)
  })

  it('GET /api/assets lists the uploaded object metadata', async () => {
    const res = await request('GET', PATHS.assets, { token: ops.token })
    expect(res.status).toBe(200)
    const hit = itemsOf(res.json).find((row) => row.key === key)
    expect(hit).toBeTruthy()
    expect(String(hit?.url ?? url)).toMatch(/^https?:\/\//)
    expect(Number(hit?.size ?? 0)).toBeGreaterThan(0)
  })

  it('GET /api/assets/:key returns object metadata without using AWS SDK', async () => {
    const res = await request('GET', PATHS.asset(key), { token: ops.token })
    expect(res.status).toBe(200)
    expect(res.json.key).toBe(key)
    expect(String(res.json.url)).toMatch(/^https?:\/\//)
    expect(res.json.contentType === undefined || String(res.json.contentType).includes('png')).toBe(
      true,
    )
  })

  it('selector cannot upload (PRD §4 前台无录入)', async () => {
    const form = new FormData()
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'nope.png')
    const res = await request('POST', PATHS.assets, { token: selector.token, form })
    assertDenied(res)
  })

  it('returned URL is fetchable over HTTP', async () => {
    const res = await fetch(url, { redirect: 'follow' })
    expect(res.ok).toBe(true)
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.byteLength).toBeGreaterThan(0)
  })

  it('presigned upload: PUT the bytes to the returned URL, then read them back from publicUrl', async () => {
    const grant = await request('POST', PATHS.assetsPresign, {
      token: ops.token,
      body: { purpose: 'avatar', contentType: 'image/png' },
    })
    expect(grant.status).toBe(200)
    expect(grant.json).toMatchObject({ method: 'PUT', maxBytes: 5 * 1024 * 1024 })
    const put = await fetch(String(grant.json.url), {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array(PNG),
    })
    expect(put.status).toBe(201)
    const raw = await fetch(String(grant.json.publicUrl), { redirect: 'follow' })
    expect(raw.status).toBe(200)
    expect(Buffer.from(await raw.arrayBuffer()).equals(PNG)).toBe(true)
    const again = await fetch(String(grant.json.url), { method: 'PUT', body: new Uint8Array(PNG) })
    expect(again.status).toBe(409)
  })

  it('presigned upload is capped at 5 MB and bound to its token', async () => {
    const grant = await request('POST', PATHS.assetsPresign, {
      token: ops.token,
      body: { purpose: 'avatar', contentType: 'image/png' },
    })
    const big = await fetch(String(grant.json.url), {
      method: 'PUT',
      body: new Uint8Array(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])),
    })
    expect(big.status).toBe(413)
    const target = new URL(String(grant.json.url))
    target.searchParams.set('token', 'forged.token')
    expect((await fetch(target, { method: 'PUT', body: new Uint8Array(PNG) })).status).toBe(403)
  })
})
