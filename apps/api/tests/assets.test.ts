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
  const puts: string[] = []
  const store: ObjectStore = {
    durable: true,
    presign: async (key) => ({ url: `https://s3.example.test/bucket/${key}?sig=1`, key }),
    put: async (key) => {
      puts.push(key)
      return { url: `https://s3.example.test/bucket/${key}`, key }
    },
  }

  beforeAll(async () => {
    ctx = await createTestApp({ store })
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('keeps the bytes in S3 only, not also in Postgres', async () => {
    const ops = (await ctx.loginJson('ops@kcs.local')).token
    const res = await ctx.app.request('/api/assets', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops}` },
      body: form(PNG, 'image/png'),
    })
    expect(res.status).toBe(201)
    const { key, url } = await res.json()
    expect(puts).toContain(key)
    expect(url).toBe(`https://s3.example.test/bucket/${key}`)
    const { rows } = await ctx.db.query('SELECT bytes, size, content_type FROM assets WHERE key = $1', [key])
    expect(rows[0]).toEqual({ bytes: null, size: PNG.length, content_type: 'image/png' })
  })
})
