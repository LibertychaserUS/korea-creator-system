import { inflateRawSync } from 'node:zlib'

export type SheetRow = Record<string, string>

/** Reads entries through the central directory, so streamed zips (sizes in a data descriptor) work too. */
function unzip(buf: Buffer): Record<string, Buffer> {
  const files: Record<string, Buffer> = {}
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return files
  const entries = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < entries && offset + 46 <= buf.length; n += 1) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break
    const method = buf.readUInt16LE(offset + 10)
    const compSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const local = buf.readUInt32LE(offset + 42)
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')
    offset += 46 + nameLen + extraLen + commentLen
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) continue
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + compSize)
    if (method === 0) files[name] = Buffer.from(data)
    else if (method === 8) files[name] = inflateRawSync(data)
  }
  return files
}

function colIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase()
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function rowIndex(ref: string): number {
  return Number(ref.replace(/\D/g, '')) - 1
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** One pass, so `&amp;lt;` stays the text `&lt;`. */
function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[name.toLowerCase()] ?? whole
  })
}

function attributes(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of text.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]!] = decodeXml(m[2] ?? m[3] ?? '')
  return out
}

/** Visible text of a rich-text run list; phonetic guides (`<rPh>`) are not part of the value. */
function runText(xml: string): string {
  const visible = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  return [...visible.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)].map((m) => decodeXml(m[1] ?? '')).join('')
}

function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) => runText(m[1] ?? ''))
}

const CELL = /<c\b((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\/>|>([\s\S]*?)<\/c>)/g
const ROW = /<row\b((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\/>|>([\s\S]*?)<\/row>)/g

function sheetValues(xml: string, sst: string[]): string[][] {
  const grid: string[][] = []
  let nextRow = 0
  for (const rowMatch of xml.matchAll(ROW)) {
    const rowAttrs = attributes(rowMatch[1] ?? '')
    const r = rowAttrs.r ? Number(rowAttrs.r) - 1 : nextRow
    nextRow = r + 1
    let nextCol = 0
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(CELL)) {
      const attrs = attributes(cellMatch[1] ?? '')
      const inner = cellMatch[2] ?? ''
      const c = attrs.r ? colIndex(attrs.r) : nextCol
      const cellRow = attrs.r && /\d/.test(attrs.r) ? rowIndex(attrs.r) : r
      nextCol = c + 1
      const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]
      let value = ''
      if (attrs.t === 'inlineStr') value = runText(inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? '')
      else if (attrs.t === 's') value = v == null ? '' : sst[Number(v)] ?? ''
      else if (attrs.t === 'e') value = ''
      else value = v == null ? '' : decodeXml(v)
      if (!grid[cellRow]) grid[cellRow] = []
      grid[cellRow]![c] = value
    }
  }
  return grid
}

/** The first sheet in workbook order, not whichever file happens to be called sheet1. */
function firstSheetPath(files: Record<string, Buffer>): string | undefined {
  const workbook = files['xl/workbook.xml']?.toString('utf8')
  const rels = files['xl/_rels/workbook.xml.rels']?.toString('utf8')
  const sheet = workbook?.match(/<sheet\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/)
  const relId = sheet ? attributes(sheet[1] ?? '')['r:id'] : undefined
  if (relId && rels) {
    for (const m of rels.matchAll(/<Relationship\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g)) {
      const attrs = attributes(m[1] ?? '')
      if (attrs.Id !== relId || !attrs.Target) continue
      const target = attrs.Target.startsWith('/') ? attrs.Target.slice(1) : `xl/${attrs.Target.replace(/^\.\//, '')}`
      if (files[target]) return target
    }
  }
  return Object.keys(files).find((k) => /worksheets\/sheet1\.xml$/i.test(k))
    ?? Object.keys(files).filter((k) => /worksheets\/[^/]+\.xml$/i.test(k)).sort()[0]
}

const HEADER_ALIASES: Record<string, string> = {
  昵称: 'displayName',
  达人名称: 'displayName',
  达人: 'displayName',
  nickname: 'displayName',
  displayname: 'displayName',
  小红书号: 'xhsId',
  小红书: 'xhsId',
  xhsid: 'xhsId',
  xhs: 'xhsId',
  userid: 'userId',
  用户id: 'userId',
  粉丝数: 'followers',
  粉丝: 'followers',
  followers: 'followers',
  报价: 'price',
  price: 'price',
  抓取关键词: 'keywords',
  关键词: 'keywords',
  keywords: 'keywords',
  地域: 'region',
  region: 'region',
  身份人设: 'persona',
  人设: 'persona',
  内容类目: 'vertical',
  内容标签: 'vertical',
}

function normHeader(value: string): string {
  return value.replace(/[\s_|·]/g, '').toLowerCase()
}

/** Rows keep their 1-based sheet line in `__line` so a failed row can be pointed at. */
export function parseXlsx(buf: Buffer): SheetRow[] {
  const files = unzip(buf)
  const sheetKey = firstSheetPath(files)
  if (!sheetKey) return []
  const sstKey = Object.keys(files).find((k) => /sharedStrings\.xml$/i.test(k))
  const sst = sstKey ? sharedStrings(files[sstKey]!.toString('utf8')) : []
  const grid = sheetValues(files[sheetKey]!.toString('utf8'), sst)
  const headerLine = grid.findIndex((line) => line?.some((cell) => cell))
  if (headerLine < 0) return []
  const headers = Array.from(grid[headerLine]!, (h) => HEADER_ALIASES[normHeader(h || '')] || HEADER_ALIASES[h || ''] || h)
  const rows: SheetRow[] = []
  for (let index = headerLine + 1; index < grid.length; index += 1) {
    const line = grid[index]
    if (!line || !line.some((cell) => cell && cell.trim())) continue
    const row: SheetRow = {}
    headers.forEach((key, i) => {
      const cell = line[i]
      if (key && cell != null && cell.trim()) row[key] = String(cell).trim()
    })
    if (Object.keys(row).length) rows.push({ ...row, __line: String(index + 1) })
  }
  return rows
}

/**
 * Only real identifiers make a key. A nickname is not one: two different
 * people share names, so a row with neither id gets a fresh key.
 */
export function creatorKeyFromRow(row: SheetRow): string {
  if (row.userId) return `uid_${row.userId}`
  if (row.xhsId) return `xhs_${row.xhsId}`
  return ''
}
