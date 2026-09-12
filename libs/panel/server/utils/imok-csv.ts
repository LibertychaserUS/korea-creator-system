import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * IMOK sample CSV fixtures (display-only, dev convenience).
 * Defaults to the in-repo fixture directory. Override with KCS_IMOK_FIXTURE_DIR.
 */
const here = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR =
  process.env.KCS_IMOK_FIXTURE_DIR ||
  resolve(here, '../../../../apps/api/fixtures/imok-pink')

export function readImokCsv(fileName: string): Record<string, string>[] {
  const path = resolve(FIXTURE_DIR, fileName)
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '')
  return parseCsv(text)
}

/** RFC4180-ish CSV: quoted fields, escaped quotes, commas, CRLF. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows
  if (!header) return []
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}
