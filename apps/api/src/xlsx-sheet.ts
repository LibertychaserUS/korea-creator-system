import { inflateRawSync } from 'node:zlib'

export type SheetRow = Record<string, string>

function unzip(buf: Buffer): Record<string, Buffer> {
  const files: Record<string, Buffer> = {}
  let offset = 0
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset)
    if (sig !== 0x04034b50) break
    const method = buf.readUInt16LE(offset + 8)
    const flags = buf.readUInt16LE(offset + 6)
    let compSize = buf.readUInt32LE(offset + 18)
    const nameLen = buf.readUInt16LE(offset + 26)
    const extraLen = buf.readUInt16LE(offset + 28)
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8')
    let start = offset + 30 + nameLen + extraLen
    if (flags & 0x8) {
      /* data descriptor: sizes were 0; scan later — skip unsupported */
    }
    const data = buf.subarray(start, start + compSize)
    if (method === 0) files[name] = Buffer.from(data)
    else if (method === 8) files[name] = inflateRawSync(data)
    offset = start + compSize
  }
  return files
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function rowIndex(ref: string): number {
  return Number(ref.replace(/\D/g, '')) - 1
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function sharedStrings(xml: string): string[] {
  const out: string[] = []
  const blocks = xml.split(/<si[\s>]/).slice(1)
  for (const block of blocks) {
    const texts = [...block.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => decodeXml(m[1]))
    out.push(texts.join(''))
  }
  return out
}

function sheetValues(xml: string, sst: string[]): string[][] {
  const grid: string[][] = []
  const cells = xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)
  for (const match of cells) {
    const attrs = match[1]
    const inner = match[2]
    const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]
    if (!ref) continue
    const type = attrs.match(/\bt="([^"]+)"/)?.[1]
    let value = ''
    if (type === 'inlineStr') {
      value = decodeXml(inner.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] || '')
    } else if (type === 's') {
      const idx = Number(inner.match(/<v[^>]*>([^<]*)<\/v>/)?.[1] || '0')
      value = sst[idx] || ''
    } else {
      value = decodeXml(inner.match(/<v[^>]*>([^<]*)<\/v>/)?.[1] || '')
    }
    const r = rowIndex(ref)
    const c = colIndex(ref)
    if (!grid[r]) grid[r] = []
    grid[r][c] = value
  }
  return grid
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

export function parseXlsx(buf: Buffer): SheetRow[] {
  const files = unzip(buf)
  const sheetKey = Object.keys(files).find((k) => /worksheets\/sheet1\.xml$/i.test(k))
  if (!sheetKey) return []
  const sstKey = Object.keys(files).find((k) => /sharedStrings\.xml$/i.test(k))
  const sst = sstKey ? sharedStrings(files[sstKey].toString('utf8')) : []
  const grid = sheetValues(files[sheetKey].toString('utf8'), sst)
  if (!grid.length) return []
  const headers = (grid[0] || []).map((h) => HEADER_ALIASES[normHeader(h || '')] || HEADER_ALIASES[h || ''] || h)
  const rows: SheetRow[] = []
  for (const line of grid.slice(1)) {
    if (!line || line.every((cell) => !cell)) continue
    const row: SheetRow = {}
    headers.forEach((key, i) => {
      if (key && line[i]) row[key] = String(line[i]).trim()
    })
    if (Object.keys(row).length) rows.push(row)
  }
  return rows
}

export function creatorKeyFromRow(row: SheetRow): string {
  if (row.userId) return `uid_${row.userId}`
  if (row.xhsId) return `xhs_${row.xhsId}`
  if (row.displayName) return `name_${row.displayName.replace(/\s+/g, '_')}`
  return ''
}
