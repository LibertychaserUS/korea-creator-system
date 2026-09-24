import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { IMAGE_MAX_BYTES, sniffImage } from '../src/http/uploads'
import type { ObjectStore } from '../src/store'
import { createTestApp, type TestCtx } from './helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const HTML = Buffer.from('<!doctype html><script>alert(document.cookie)</script>')

function form(bytes: Buffer, type: string, name = 'avatar.png') {
  const body = new FormData()
  body.append('file', new Blob([new Uint8Array(bytes)], { type }), name)
  body.append('purpose', 'avatar')
  return body
}

describe('asset uploads', () => {
  let ctx: TestCtx
  let ops: string
  let selector: string

  beforeAll(async () => {
    ctx = await createTestApp()
    ops = (await ctx.loginJson('ops@kcs.local')).token
    selector = (await ctx.loginJson('selector@kcs.local')).token
  })

  afterAll(async () => {
    await ctx.close()
  })

  const upload = (token: string | null, body: FormData) =>
    ctx.app.request('/api/assets', {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body,
    })

  it('sniffs the four image types from their bytes, nothing else', () => {
    expect(sniffImage(PNG)).toBe('image/png')
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg')
    expect(sniffImage(Buffer.from('GIF89a\x01\x00', 'latin1'))).toBe('image/gif')
    expect(sniffImage(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1'))).toBe('image/webp')
    expect(sniffImage(HTML)).toBeNull()
    expect(sniffImage(Buffer.from('%PDF-1.7'))).toBeNull()
    expect(sniffImage(Buffer.alloc(0))).toBeNull()
  })

  it('stores a PNG and reads it back with safe headers', async () => {
    const res = await upload(ops, form(PNG, 'image/png'))
    expect(res.status).toBe(201)
    const { key, url } = await res.json()
    expect(key).toMatch(/^avatars\/[0-9a-f-]+\.png$/)
    expect(url).toMatch(/\/api\/assets\/raw\//)
    const raw = await ctx.app.request(`/api/assets/raw/${key}`)
    expect(raw.status).toBe(200)
    expect(raw.headers.get('content-type')).toBe('image/png')
    expect(raw.headers.get('x-content-type-options')).toBe('nosniff')
    expect(raw.headers.get('content-disposition')).toBe('inline')
    expect(raw.headers.get('content-security-policy')).toBe("default-src 'none'")
    expect(Buffer.from(await raw.arrayBuffer()).equals(PNG)).toBe(true)
  })

  it('rejects HTML with 415 whether it is labelled text/html or image/png', async () => {
    for (const type of ['text/html', 'image/png']) {
      const before = await ctx.db.query('SELECT count(*)::int AS n FROM assets')
      const res = await upload(ops, form(HTML, type, 'x.html'))
      expect(res.status, type).toBe(415)
      expect((await res.json()).error.code).toBe('UPLOAD-TYPE')
      const after = await ctx.db.query('SELECT count(*)::int AS n FROM assets')
      expect(after.rows[0].n).toBe(before.rows[0].n)
    }
  })

  it('rejects a real PNG declared as something that is not an image', async () => {
    const res = await upload(ops, form(PNG, 'text/html'))
    expect(res.status).toBe(415)
  })

  it('rejects files over 5 MB with 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(IMAGE_MAX_BYTES + 1)])
    const res = await upload(ops, form(big, 'image/png'))
    expect(res.status).toBe(413)
    expect((await res.json()).error.code).toBe('UPLOAD-TOO-LARGE')
  })

  it('checks the role before the size: strangers get 401 / 403, not 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(IMAGE_MAX_BYTES + 1)])
    expect((await upload(null, form(big, 'image/png'))).status).toBe(401)
    expect((await upload(selector, form(big, 'image/png'))).status).toBe(403)
  })

  it('never serves back stored bytes that are not an image (rows from before the fix)', async () => {
    await ctx.db.query(
      `INSERT INTO assets (key, url, content_type, size, bytes) VALUES ('avatars/legacy-html', 'x', 'text/html', $1, $2)
       ON CONFLICT (key) DO UPDATE SET bytes = EXCLUDED.bytes, content_type = EXCLUDED.content_type`,
      [HTML.length, HTML],
    )
    const raw = await ctx.app.request('/api/assets/raw/avatars/legacy-html')
    expect(raw.status).toBe(404)
    expect(raw.headers.get('content-type')).not.toContain('text/html')
    expect((await ctx.app.request('/api/assets/raw/%E0%A4%A')).status).toBe(404)
  })

  it('presign only signs image types', async () => {
    const presign = (contentType: string) =>
      ctx.app.request('/api/assets/presign', {
        method: 'POST',
        headers: { authorization: `Bearer ${ops}`, 'content-type': 'application/json' },
        body: JSON.stringify({ purpose: 'avatar', contentType }),
      })
    expect((await presign('text/html')).status).toBe(415)
    expect((await presign('image/webp')).status).toBe(200)
  })
})

describe('asset uploads with an S3-style store', () => {
  let ctx: TestCtx
  let ops: string
  const objects = new Map<string, Buffer>()
  const store: ObjectStore = {
    durable: true,
    put: async (key, body) => {
      objects.set(key, body)
    },
    get: async (key) => objects.get(key) ?? null,
    signedGetUrl: async (key, seconds) => `https://bucket.example.test/${key}?X-Amz-Expires=${seconds}`,
  }

  beforeAll(async () => {
    ctx = await createTestApp({ store })
    ops = (await ctx.loginJson('ops@kcs.local')).token
  })

  afterAll(async () => {
    delete process.env.S3_READ_MODE
    await ctx.close()
  })

  const presign = async (contentType = 'image/png') => {
    const res = await ctx.app.request('/api/assets/presign', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops}`, 'content-type': 'application/json' },
      body: JSON.stringify({ purpose: 'avatar', contentType }),
    })
    expect(res.status).toBe(200)
    return res.json() as Promise<{ url: string; key: string; method: string; maxBytes: number; publicUrl: string }>
  }
  const put = (url: string, body: Buffer, type = 'image/png') => {
    const { pathname, search } = new URL(url)
    return ctx.app.request(`${pathname}${search}`, { method: 'PUT', headers: { 'content-type': type }, body: new Uint8Array(body) })
  }

  it('keeps the bytes in the bucket only, and serves them through the API (private bucket)', async () => {
    const res = await ctx.app.request('/api/assets', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops}` },
      body: form(PNG, 'image/png'),
    })
    expect(res.status).toBe(201)
    const { key, url } = await res.json()
    expect(objects.get(key)?.equals(PNG)).toBe(true)
    expect(url).toMatch(new RegExp(`/api/assets/raw/${key}$`))
    const { rows } = await ctx.db.query('SELECT bytes, size, content_type FROM assets WHERE key = $1', [key])
    expect(rows[0]).toEqual({ bytes: null, size: PNG.length, content_type: 'image/png' })
    const raw = await ctx.app.request(`/api/assets/raw/${key}`)
    expect(raw.status).toBe(200)
    expect(raw.headers.get('content-type')).toBe('image/png')
    expect(raw.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await raw.arrayBuffer()).equals(PNG)).toBe(true)
  })

  it('S3_READ_MODE=redirect answers with a short-lived signed bucket URL', async () => {
    process.env.S3_READ_MODE = 'redirect'
    try {
      const { key } = await (await ctx.app.request('/api/assets', {
        method: 'POST',
        headers: { authorization: `Bearer ${ops}` },
        body: form(PNG, 'image/png'),
      })).json()
      const raw = await ctx.app.request(`/api/assets/raw/${key}`)
      expect(raw.status).toBe(302)
      expect(raw.headers.get('location')).toBe(`https://bucket.example.test/${key}?X-Amz-Expires=300`)
    } finally {
      delete process.env.S3_READ_MODE
    }
  })

  it('presign hands out the API upload URL, not a bucket URL, with the size cap', async () => {
    const grant = await presign()
    expect(grant.method).toBe('PUT')
    expect(grant.maxBytes).toBe(IMAGE_MAX_BYTES)
    expect(new URL(grant.url).pathname).toBe(`/api/assets/upload/${grant.key}`)
    expect(grant.url).not.toContain('bucket.example.test')
    const done = await put(grant.url, PNG)
    expect(done.status).toBe(201)
    expect((await done.json()).url).toBe(grant.publicUrl)
    expect(objects.get(grant.key)?.equals(PNG)).toBe(true)
    const raw = await ctx.app.request(`/api/assets/raw/${grant.key}`)
    expect(Buffer.from(await raw.arrayBuffer()).equals(PNG)).toBe(true)
  })

  it('a presigned URL takes one upload, of its own type, within the size cap, and cannot be forged', async () => {
    const grant = await presign()
    const big = Buffer.concat([PNG, Buffer.alloc(IMAGE_MAX_BYTES)])
    expect((await put(grant.url, big)).status).toBe(413)
    expect((await put(grant.url, HTML)).status).toBe(415)
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
    expect((await put(grant.url, jpeg, 'image/jpeg')).status).toBe(415)
    expect(objects.has(grant.key)).toBe(false)

    const other = await presign()
    const token = new URL(other.url).searchParams.get('token')
    const forged = await ctx.app.request(`/api/assets/upload/${grant.key}?token=${token}`, {
      method: 'PUT', body: new Uint8Array(PNG),
    })
    expect(forged.status).toBe(403)
    expect((await ctx.app.request(`/api/assets/upload/${grant.key}?token=x.y`, { method: 'PUT', body: new Uint8Array(PNG) })).status).toBe(403)

    expect((await put(grant.url, PNG)).status).toBe(201)
    expect((await put(grant.url, PNG)).status).toBe(409)
  })

  it('an unfinished presign reads back 404, not an empty image', async () => {
    const grant = await presign()
    expect((await ctx.app.request(`/api/assets/raw/${grant.key}`)).status).toBe(404)
  })
})
