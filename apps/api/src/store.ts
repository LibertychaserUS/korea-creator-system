export type ObjectStore = {
  /**
   * True when the store keeps the bytes itself (S3 / MinIO) and serves them from
   * its own URL; false means Postgres must hold the only copy for
   * `/api/assets/raw/*` to read back.
   */
  durable: boolean
  presign: (key: string, contentType: string) => Promise<{ url: string; key: string }>
  put: (key: string, body: Buffer, contentType: string) => Promise<{ url: string; key: string }>
}

/** Process-local stand-in; returns no URL so callers fall back to `/api/assets/raw/*`. */
export class MemoryObjectStore implements ObjectStore {
  readonly durable = false
  objects = new Map<string, { contentType: string; body?: Buffer }>()

  async presign(key: string, contentType: string) {
    this.objects.set(key, { contentType })
    return { url: '', key }
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { contentType, body })
    return { url: '', key }
  }
}
