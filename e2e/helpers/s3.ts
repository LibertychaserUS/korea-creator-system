import {
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

export function s3Config() {
  return {
    endpoint: process.env.E2E_S3_ENDPOINT || 'http://127.0.0.1:9000',
    bucket: process.env.E2E_S3_BUCKET || 'kcs-assets',
    accessKeyId: process.env.E2E_S3_ACCESS_KEY || 'kcsminio',
    secretAccessKey: process.env.E2E_S3_SECRET_KEY || 'kcsminio123',
    region: process.env.E2E_S3_REGION || 'us-east-1',
  };
}

export function createS3Client() {
  const cfg = s3Config();
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

export async function objectExists(key: string): Promise<boolean> {
  const cfg = s3Config();
  const client = createS3Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return true;
  } catch {
    return false;
  } finally {
    client.destroy();
  }
}

export async function listObjectKeys(prefix = ''): Promise<string[]> {
  const cfg = s3Config();
  const client = createS3Client();
  try {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        MaxKeys: 200,
      }),
    );
    return (res.Contents ?? []).map((item) => item.Key).filter((key): key is string => Boolean(key));
  } finally {
    client.destroy();
  }
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const cfg = s3Config();
  const client = createS3Client();
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
    const body = await res.Body?.transformToByteArray();
    if (!body) throw new Error(`empty S3 body for ${key}`);
    return body;
  } finally {
    client.destroy();
  }
}

/** Creates the bucket if needed and keeps it private, as in production (no anonymous read). */
export async function ensureBucket(): Promise<void> {
  const cfg = s3Config();
  const client = createS3Client();
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: cfg.bucket }));
    }
    // An older run may have left a public-read policy behind.
    await client.send(new DeleteBucketPolicyCommand({ Bucket: cfg.bucket })).catch(() => {});
  } finally {
    client.destroy();
  }
}

/** The object's direct bucket URL — must NOT be readable anonymously. */
export function bucketObjectUrl(key: string): string {
  const cfg = s3Config();
  return `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key.replace(/^\//, '')}`;
}
