export type ObjectStore = {
  presign: (key: string, contentType: string) => Promise<{ url: string; key: string }>
  put: (key: string, body: Buffer, contentType: string) => Promise<{ url: string; key: string }>
}

export class MemoryObjectStore implements ObjectStore {
  objects = new Map<string, { contentType: string; body?: Buffer }>()

  async presign(key: string, contentType: string) {
    this.objects.set(key, { contentType })
    return { url: `http://localhost:7100/api/assets/raw/${key}`, key }
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { contentType, body })
    return { url: `http://localhost:7100/api/assets/raw/${key}`, key }
  }
}
