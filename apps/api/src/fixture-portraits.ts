import { deflateSync } from 'zlib'

type TalentLook = {
  id: string
  name: string
  verticals: string[]
}

type Rgb = [number, number, number]

const SKINS: Rgb[] = [
  [244, 218, 198],
  [236, 196, 168],
  [214, 168, 128],
  [186, 132, 96],
  [148, 98, 74],
  [250, 228, 208],
]

const HAIRS: Rgb[] = [
  [32, 24, 22],
  [64, 42, 28],
  [120, 72, 40],
  [28, 28, 36],
  [196, 148, 88],
  [88, 44, 36],
]

const CLOTHES: Rgb[] = [
  [36, 64, 88],
  [148, 52, 64],
  [48, 92, 78],
  [212, 196, 176],
  [72, 56, 96],
  [28, 28, 32],
]

export function renderPortraitPng(talent: TalentLook): Buffer {
  const w = 256
  const h = 256
  const rng = mulberry(hash32(`${talent.id}:portrait`))
  const pixels = new Uint8Array(w * h * 3)
  const bg = mix(pick(CLOTHES, rng), [236, 228, 216], 0.55)
  const skin = pick(SKINS, rng)
  const hair = pick(HAIRS, rng)
  const cloth = pick(CLOTHES, rng)
  const accent = verticalAccent(talent.verticals)

  fill(pixels, w, h, bg)
  disc(pixels, w, h, 196, 40, 90, mix(accent, bg, 0.35))
  disc(pixels, w, h, 48, 220, 110, mix(accent, bg, 0.5))
  rect(pixels, w, h, 0, 188, w, 68, cloth)
  ellipse(pixels, w, h, 128, 214, 78, 36, mix(cloth, [20, 20, 24], 0.2))
  ellipse(pixels, w, h, 128, 168, 28, 22, mix(skin, [80, 50, 40], 0.12))
  ellipse(pixels, w, h, 128, 122, 58, 70, skin)
  const hairStyle = rng() % 3
  if (hairStyle === 0) {
    ellipse(pixels, w, h, 128, 78, 64, 36, hair)
    ellipse(pixels, w, h, 72, 118, 18, 42, hair)
    ellipse(pixels, w, h, 184, 118, 18, 42, hair)
  } else if (hairStyle === 1) {
    ellipse(pixels, w, h, 128, 86, 70, 48, hair)
  } else {
    ellipse(pixels, w, h, 128, 74, 60, 28, hair)
    ellipse(pixels, w, h, 128, 58, 36, 16, hair)
  }
  const eye = mix(hair, [24, 24, 28], 0.4)
  disc(pixels, w, h, 108, 118, 7, [250, 248, 244])
  disc(pixels, w, h, 148, 118, 7, [250, 248, 244])
  disc(pixels, w, h, 108, 118, 4, eye)
  disc(pixels, w, h, 148, 118, 4, eye)
  disc(pixels, w, h, 110, 117, 1, [255, 255, 255])
  disc(pixels, w, h, 150, 117, 1, [255, 255, 255])
  ellipse(pixels, w, h, 128, 138, 6, 8, mix(skin, [90, 50, 40], 0.25))
  ellipse(pixels, w, h, 128, 156, 14, 5, mix(skin, [160, 70, 80], 0.35))
  speckle(pixels, w, h, rng, 900, 10)
  return encodePng(w, h, pixels)
}

export function renderCoverPng(talent: TalentLook): Buffer {
  const w = 480
  const h = 300
  const rng = mulberry(hash32(`${talent.id}:cover`))
  const pixels = new Uint8Array(w * h * 3)
  const accent = verticalAccent(talent.verticals)
  const ground = mix(accent, [40, 44, 52], 0.35)
  const sky = mix(accent, [236, 230, 220], 0.55)
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1)
    const row = mix(sky, ground, t * t)
    for (let x = 0; x < w; x++) set(pixels, w, x, y, row)
  }
  rect(pixels, w, h, 0, 168, w, 132, mix(ground, [24, 28, 32], 0.2))
  disc(pixels, w, h, 86 + (rng() % 40), 92, 48, mix(accent, [255, 240, 220], 0.25))
  disc(pixels, w, h, 340 + (rng() % 50), 70, 64, mix(accent, sky, 0.2))
  rect(pixels, w, h, 40, 188, 120, 72, mix(accent, [30, 30, 36], 0.45))
  rect(pixels, w, h, 190, 176, 90, 84, mix(CLOTHES[rng() % CLOTHES.length], ground, 0.3))
  rect(pixels, w, h, 320, 198, 130, 62, mix(accent, [250, 246, 238], 0.4))
  speckle(pixels, w, h, rng, 2200, 12)
  return encodePng(w, h, pixels)
}

function verticalAccent(verticals: string[]): Rgb {
  const blob = verticals.join(' ').toLowerCase()
  if (/beauty|美妆|护肤|skin/.test(blob)) return [212, 132, 148]
  if (/food|探店|韩食|cafe/.test(blob)) return [212, 140, 72]
  if (/travel|旅行|jeju|济州/.test(blob)) return [72, 140, 168]
  if (/home|家居|lifestyle/.test(blob)) return [168, 140, 104]
  if (/fit|健身|滑雪|ski/.test(blob)) return [64, 128, 112]
  return [96, 108, 148]
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const dest = y * (width * 3 + 1)
    raw[dest] = 0
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), dest + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]
  chunks.push(chunk('IHDR', ihdr))
  chunks.push(chunk('IDAT', deflateSync(raw, { level: 9 })))
  chunks.push(chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(chunks)
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const body = Buffer.concat([typeBuf, data])
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function hash32(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry(seed: number) {
  let a = seed || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }
}

function pick<T>(items: T[], rng: () => number): T {
  return items[rng() % items.length]
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function set(pixels: Uint8Array, w: number, x: number, y: number, rgb: Rgb) {
  if (x < 0 || y < 0 || x >= w || y >= pixels.length / (w * 3)) return
  const i = (y * w + x) * 3
  pixels[i] = rgb[0]
  pixels[i + 1] = rgb[1]
  pixels[i + 2] = rgb[2]
}

function fill(pixels: Uint8Array, w: number, h: number, rgb: Rgb) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(pixels, w, x, y, rgb)
}

function rect(pixels: Uint8Array, w: number, h: number, x0: number, y0: number, rw: number, rh: number, rgb: Rgb) {
  const x1 = Math.min(w, x0 + rw)
  const y1 = Math.min(h, y0 + rh)
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) set(pixels, w, x, y, rgb)
  }
}

function disc(pixels: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, rgb: Rgb) {
  ellipse(pixels, w, h, cx, cy, r, r, rgb)
}

function ellipse(
  pixels: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rgb: Rgb,
) {
  const x0 = Math.max(0, Math.floor(cx - rx))
  const x1 = Math.min(w - 1, Math.ceil(cx + rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const y1 = Math.min(h - 1, Math.ceil(cy + ry))
  const rx2 = rx * rx || 1
  const ry2 = ry * ry || 1
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1) set(pixels, w, x, y, rgb)
    }
  }
}

function speckle(pixels: Uint8Array, w: number, h: number, rng: () => number, count: number, amp: number) {
  for (let i = 0; i < count; i++) {
    const x = rng() % w
    const y = rng() % h
    const i3 = (y * w + x) * 3
    const d = (rng() % (amp * 2 + 1)) - amp
    pixels[i3] = clamp(pixels[i3] + d)
    pixels[i3 + 1] = clamp(pixels[i3 + 1] + d)
    pixels[i3 + 2] = clamp(pixels[i3 + 2] + d)
  }
}

function clamp(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}
