import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ObjectStore } from './store'

export function createS3Store(env: {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  forcePathStyle?: boolean
}): ObjectStore {
  const client = new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    forcePathStyle: env.forcePathStyle ?? true,
    credentials: { accessKeyId: env.accessKey, secretAccessKey: env.secretKey },
    // SDK ≥ 3.729 adds CRC32 checksums to every request by default; Aliyun OSS's
    // S3 endpoint rejects the trailer, so only send them where S3 demands one.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return {
    durable: true,
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      )
    },
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: env.bucket, Key: key }))
        const bytes = await res.Body?.transformToByteArray()
        return bytes ? Buffer.from(bytes) : null
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        if (error instanceof NoSuchKey || status === 404) return null
        throw error
      }
    },
    async signedGetUrl(key, expiresInSeconds) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: env.bucket,
          Key: key,
          ResponseContentDisposition: 'inline',
        }),
        { expiresIn: expiresInSeconds },
      )
    },
  }
}
