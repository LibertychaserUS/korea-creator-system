import { crc32, deflateRawSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readSheetRow } from '../src/ingest/persist'
import { runWorkbookIngest } from '../src/ingest/workbook'
import { replayRecord } from '../src/ingest/worker'
import { parseXlsx } from '../src/xlsx-sheet'
import { createTestApp, type TestCtx } from './helpers'

/**
 * Deflated entries whose local headers carry zero sizes (bit 3, sizes in a
 * data descriptor) — what streaming writers produce. Only the central
 * directory knows the real sizes.
 */
function zipStreamed(files: Record<string, string>): Buffer {
  const parts: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, 'utf8')
    const data = deflateRawSync(raw)
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(raw) >>> 0
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x8, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(local, 30)
    const descriptor = Buffer.alloc(16)
    descriptor.writeUInt32LE(0x08074b50, 0)
    descriptor.writeUInt32LE(crc, 4)
    descriptor.writeUInt32LE(data.length, 8)
    descriptor.writeUInt32LE(raw.length, 12)
    parts.push(local, data, descriptor)
    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x8, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBuf.copy(central, 46)
    centrals.push(central)
    offset += local.length + data.length + descriptor.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centrals.length, 8)
  end.writeUInt16LE(centrals.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, end])
}

const inline = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`
const num = (ref: string, v: string) => `<c r="${ref}"><v>${v}</v></c>`

function workbook(rowsXml: string[], sharedStrings?: string): Buffer {
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="达人" sheetId="1" r:id="rId7"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/data.xml"/></Relationships>',
    'xl/worksheets/data.xml': `<worksheet><sheetData>${rowsXml.join('')}</sheetData></worksheet>`,
  }
  if (sharedStrings) files['xl/sharedStrings.xml'] = sharedStrings
  return zipStreamed(files)
}

const HEADER = `<row r="1">${inline('A1', '昵称')}${inline('B1', '小红书号')}${inline('C1', '粉丝数')}${inline('D1', '报价')}</row>`

describe('parseXlsx', () => {
  it('a styled empty cell (<c .../>) does not shift the columns after it', () => {
    const rows = parseXlsx(workbook([
      HEADER,
      `<row r="2">${inline('A2', '空单元格')}<c r="B2" s="1"/>${num('C2', '777')}${num('D2', '999')}</row>`,
    ]))
    expect(rows).toEqual([{ displayName: '空单元格', followers: '777', price: '999', __line: '2' }])
  })

  it('cells without r attributes are placed in order; shared strings skip phonetic runs; entities decode once', () => {
    const sst = '<sst><si><t>名A</t></si><si><r><t>富</t></r><r><t>文本</t></r><rPh><t>ふ</t></rPh></si><si><t>&amp;lt;tag&amp;gt;</t></si></sst>'
    const rows = parseXlsx(workbook([
      HEADER,
      '<row><c t="s"><v>1</v></c><c t="s"><v>2</v></c><c><v>1.2E+7</v></c></row>',
    ], sst))
    expect(rows).toEqual([{ displayName: '富文本', xhsId: '&lt;tag&gt;', followers: '1.2E+7', __line: '2' }])
  })
})

describe('readSheetRow', () => {
  it('a 0 quote is "not quoted", not a free creator', () => {
    const result = readSheetRow({ displayName: '零报价', followers: '8000', price: '0' }, new Date())
    expect(result.ok && result.incoming.metrics.priceImage).toBeNull()
    expect(result.ok && result.incoming.metrics.followers).toBe(8000)
  })

  it('a typed 小红书号 is folded like a vendor one, so it finds the same creator', () => {
    const result = readSheetRow({ displayName: '清潭', xhsId: ' Cheongdam_Skin ' }, new Date())
    expect(result.ok && result.incoming.xhsId).toBe('cheongdam_skin')
    expect(result.ok && result.incoming.creatorKey).toBe('xhs_cheongdam_skin')
  })
})

describe('workbook import', () => {
  let ctx: TestCtx
  const RUN = `wb${Date.now().toString(36)}`
  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(() => ctx.close())

  async function creatorByXhs(xhs: string) {
    return (await ctx.db.query('SELECT * FROM creators WHERE xhs_id = $1', [xhs])).rows[0]
  }

  it('reads every number the way vendors do; unreadable rows park with their cells', async () => {
    const x = (s: string) => `${RUN}_${s}`
    const job = await runWorkbookIngest(ctx.env, 'user_ops_lead', {
      fileName: 'probe.xlsx',
      batchName: 'probe',
      buf: workbook([
        HEADER,
        `<row r="2">${inline('A2', '万写法')}${inline('B2', x('wan'))}${inline('C2', '1.2万')}${inline('D2', '8000')}</row>`,
        `<row r="3">${inline('A3', '暂无粉丝')}${inline('B3', x('zanwu'))}${inline('C3', '暂无')}${inline('D3', '-')}</row>`,
        `<row r="4">${inline('A4', '区间报价')}${inline('B4', x('range'))}${inline('C4', '56000')}${inline('D4', '5000-8000')}</row>`,
        `<row r="5">${inline('A5', '科学计数')}${inline('B5', x('sci'))}${num('C5', '1.2E+7')}${num('D5', '3000')}</row>`,
        `<row r="6">${inline('A6', '浮点单元格')}${inline('B6', x('float'))}${num('C6', '12000.000000000002')}${num('D6', '1500')}</row>`,
        `<row r="7">${inline('A7', '负号')}${inline('B7', x('neg'))}${inline('C7', '-300')}${num('D7', '0')}</row>`,
        `<row r="8">${inline('A8', '空单元格')}<c r="B8" s="1"/>${num('C8', '777')}${num('D8', '999')}</row>`,
        // Prices are stored in minor units (fen), so a decimal quote is kept exactly.
        `<row r="9">${inline('A9', '小数报价')}${inline('B9', x('decimal'))}${num('C9', '5000')}${num('D9', '1500.5')}</row>`,
      ]),
    })

    expect(job).toMatchObject({ writtenCount: 6, failedCount: 2 })
    expect(await creatorByXhs(x('wan'))).toMatchObject({ followers: 12_000 })
    const unknown = await creatorByXhs(x('zanwu'))
    expect(unknown).toMatchObject({ followers: null, followers_unknown: true })
    expect(await creatorByXhs(x('sci'))).toMatchObject({ followers: 12_000_000 })
    expect(await creatorByXhs(x('float'))).toMatchObject({ followers: 12_000 })
    expect(await creatorByXhs(x('range'))).toBeUndefined()
    expect(await creatorByXhs(x('neg'))).toBeUndefined()
    const noXhs = (await ctx.db.query("SELECT * FROM creators WHERE last_ingest_job_id = $1 AND display_name = '空单元格'", [job.id])).rows[0]
    expect(noXhs).toMatchObject({ followers: 777, xhs_id: null })

    const parked = (await ctx.db.query(
      "SELECT * FROM ingest_dead_letters WHERE source = 'file-drop' AND job_id = $1 ORDER BY external_id",
      [job.id],
    )).rows
    expect(parked.map((row) => [row.code, row.message, row.payload.displayName])).toEqual([
      ['RECORD_INVALID', 'price.range', '区间报价'],
      ['RECORD_INVALID', 'followers.outOfRange', '负号'],
    ])
    const decimal = await creatorByXhs(x('decimal'))
    const quote = await ctx.db.query('SELECT amount_min_minor, currency FROM prices WHERE creator_id = $1', [decimal.id])
    expect(quote.rows).toEqual([{ amount_min_minor: '150050', currency: 'CNY' }])
    expect(parked[0].external_id).toBe(`${job.id}#4`)
    expect(parked[0].payload.__file).toBe('probe.xlsx')

    // A parked row replays from its cells, no file needed.
    const fixed = { ...parked[0].payload, price: '5000' }
    const counts = await replayRecord(ctx.env, { source: 'file-drop', jobId: job.id, externalId: parked[0].external_id, payload: fixed })
    expect(counts).toEqual({ written: 1, skipped: 0, failed: 0 })
    expect(await creatorByXhs(x('range'))).toMatchObject({ followers: 56_000 })
  })

  it('two rows with the same nickname and no ids are two creators', async () => {
    const name = `${RUN}同名`
    const job = await runWorkbookIngest(ctx.env, 'user_ops_lead', {
      fileName: 'same-name.xlsx',
      batchName: 'same-name',
      buf: workbook([
        HEADER,
        `<row r="2">${inline('A2', name)}<c r="B2"/>${num('C2', '1000')}</row>`,
        `<row r="3">${inline('A3', name)}<c r="B3"/>${num('C3', '90000')}</row>`,
      ]),
    })
    expect(job).toMatchObject({ writtenCount: 2, skippedDupes: 0, failedCount: 0 })
    const rows = (await ctx.db.query('SELECT followers FROM creators WHERE display_name = $1 ORDER BY followers', [name])).rows
    expect(rows.map((row) => row.followers)).toEqual([1000, 90000])
  })
})
