import { describe, expect, it } from 'vitest'
import { createS3Store } from '../src/s3'

const base = {
  endpoint: 'https://oss-cn-hongkong-internal.aliyuncs.com',
  region: 'oss-cn-hongkong',
  bucket: 'kcs-assets',
  accessKey: 'AKID',
  secretKey: 'secret',
  forcePathStyle: false,
}

describe('S3 store signed reads', () => {
  it('signs against the public endpoint when the API talks to an internal one', async () => {
    const store = createS3Store({ ...base, publicEndpoint: 'https://oss-cn-hongkong.aliyuncs.com' })
    const url = new URL(await store.signedGetUrl!('avatars/a.png', 300))
    expect(url.origin).toBe('https://kcs-assets.oss-cn-hongkong.aliyuncs.com')
    expect(url.pathname).toBe('/avatars/a.png')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
    expect(url.searchParams.get('response-content-disposition')).toBe('inline')
  })

  it('falls back to the API endpoint', async () => {
    const url = new URL(await createS3Store(base).signedGetUrl!('k', 60))
    expect(url.origin).toBe('https://kcs-assets.oss-cn-hongkong-internal.aliyuncs.com')
  })
})
