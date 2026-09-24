export type ObjectStore = {
  /**
   * True when the store keeps the bytes itself (S3 / MinIO / OSS); false means
   * Postgres must hold the only copy for `/api/assets/raw/*` to read back.
   * The bucket is private either way: browsers only ever see API URLs.
   */
  durable: boolean
  put: (key: string, body: Buffer, contentType: string) => Promise<void>
  get: (key: string) => Promise<Buffer | null>
  /** Short-lived signed GET, for S3_READ_MODE=redirect. */
  signedGetUrl?: (key: string, expiresInSeconds: number) => Promise<string>
}

/** Process-local stand-in: not durable, so uploads also keep their bytes in Postgres. */
export class MemoryObjectStore implements ObjectStore {
  readonly durable = false
  objects = new Map<string, { contentType: string; body: Buffer }>()

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { contentType, body })
  }

  async get(key: string) {
    return this.objects.get(key)?.body ?? null
  }
}
