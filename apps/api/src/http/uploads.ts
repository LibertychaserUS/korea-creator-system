import { bodyLimit } from 'hono/body-limit'
import { jsonError } from './responses'

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const WORKBOOK_MAX_BYTES = 20 * 1024 * 1024
/** Room for multipart boundaries and the other form fields around the file. */
const MULTIPART_OVERHEAD = 64 * 1024

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type ImageType = (typeof IMAGE_TYPES)[number]

const EXTENSIONS: Record<ImageType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function isImageType(value: unknown): value is ImageType {
  return typeof value === 'string' && (IMAGE_TYPES as readonly string[]).includes(value)
}

export function imageExtension(type: ImageType): string {
  return EXTENSIONS[type]
}

/**
 * The type is decided by the bytes, never by what the client declared: an
 * HTML page labelled `image/png` is not an image.
 */
export function sniffImage(buf: Uint8Array): ImageType | null {
  const at = (offset: number, bytes: number[]) =>
    buf.length >= offset + bytes.length && bytes.every((byte, i) => buf[offset + i] === byte)
  const ascii = (offset: number, text: string) => at(offset, [...text].map((c) => c.charCodeAt(0)))
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif'
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  return null
}

/** Rejects an oversized body with 413 before it is buffered. */
export function uploadLimit(maxFileBytes: number) {
  return bodyLimit({
    maxSize: maxFileBytes + MULTIPART_OVERHEAD,
    onError: (context) => jsonError(context, 413, 'UPLOAD-TOO-LARGE', 'file_too_large'),
  })
}

/**
 * Headers for serving a stored upload back: the sniffed image type only, no
 * sniffing by the browser, never rendered as a document, no active content.
 */
export function safeImageHeaders(type: ImageType, size: number): Record<string, string> {
  return {
    'content-type': type,
    'content-length': String(size),
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
    'content-security-policy': "default-src 'none'",
    'cache-control': 'public, max-age=86400',
  }
}
