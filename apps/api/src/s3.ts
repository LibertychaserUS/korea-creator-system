import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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
  })
  const publicBase = `${env.endpoint.replace(/\/$/, '')}/${env.bucket}`
  return {
    durable: true,
    async presign(key, contentType) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: env.bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: 900 },
      )
      return { url, key }
    },
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      )
      return { url: `${publicBase}/${key}`, key }
    },
  }
}
