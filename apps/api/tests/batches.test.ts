import { crc32 } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestCtx } from './helpers'

/** Tiny stored-method xlsx so the test does not need Excel. */
function colName(index: number): string {
  let n = index
  let name = ''
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

function zipStore(files: Record<string, string>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data) >>> 0
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(local, 30)
    locals.push(local, data)
    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBuf.copy(central, 46)
    centrals.push(central)
    offset += local.length + data.length
  }
  const names = Object.keys(files)
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(names.length, 8)
  end.writeUInt16LE(names.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuf, end])
}

function buildXlsx(rows: string[][]): Buffer {
  const sheetRows = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map((value, c) => {
            const ref = `${colName(c)}${r + 1}`
            const safe = value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            return `<c r="${ref}" t="inlineStr"><is><t>${safe}</t></is></c>`
          })
          .join('')}</row>`,
    )
    .join('')
  return zipStore({
    '[Content_Types].xml':
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`,
    '_rels/.rels':
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    'xl/workbook.xml':
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  })
}

describe('ops batch upload', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx.close()
  })

  it('needs a workbook: a batch without a file is 400 and opens no job', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const jobsBefore = await ctx.db.query('SELECT count(*)::int AS n FROM ingest_jobs')
    const res = await ctx.app.request('/api/ops/batches', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'VALIDATION', message: 'file_required' })
    expect((await ctx.db.query('SELECT count(*)::int AS n FROM ingest_jobs')).rows[0].n).toBe(jobsBefore.rows[0].n)
  })

  it('accepts an xlsx drop and persists parsed creator rows', async () => {
    const ops = await ctx.loginJson('ops@kcs.local')
    const xlsx = buildXlsx([
      ['昵称', '小红书号', '粉丝数', '报价', '抓取关键词'],
      ['韩妆空瓶_Mina', '582910384', '186000', '8000', '설화수 雪花秀'],
    ])
    const form = new FormData()
    form.append(
      'file',
      new File([Uint8Array.from(xlsx)], 'jeju-beauty.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    form.append('batchName', '济州韩妆')
    const res = await ctx.app.request('/api/ops/batches', {
      method: 'POST',
      headers: { authorization: `Bearer ${ops.token}` },
      body: form,
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.fileName).toBe('jeju-beauty.xlsx')
    expect(body.batchName).toBe('济州韩妆')
    expect(body.writtenCount).toBeGreaterThanOrEqual(1)

    const list = await ctx.app.request('/api/ops/creators', {
      headers: { authorization: `Bearer ${ops.token}` },
    })
    const items = (await list.json()).items as Array<{ displayName: string; followers: number | null }>
    const mina = items.find((row) => row.displayName === '韩妆空瓶_Mina')
    expect(mina, 'parsed xlsx row must become a creator').toBeTruthy()
    expect(mina?.followers).toBe(186000)
  })
})
