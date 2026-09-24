/**
 * OSS side of the backups (S3-compatible API):
 *   upload <runDir> <stamp>   put every file of a run under BACKUP_S3_PREFIX<stamp>/
 *   prune <days>              delete runs whose stamp is older than <days>
 *   list                      print the stamps present remotely, newest first
 *   download <stamp> <dir>    fetch one run (restore drill on a fresh host)
 */
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const env = (name: string) => process.env[name]?.trim() || ''
const bucket = env('BACKUP_S3_BUCKET')
const prefix = (env('BACKUP_S3_PREFIX') || 'backups/').replace(/\/?$/, '/')
if (!bucket) {
  console.error('BACKUP_S3_BUCKET is required')
  process.exit(1)
}

const client = new S3Client({
  endpoint: env('BACKUP_S3_ENDPOINT') || undefined,
  region: env('BACKUP_S3_REGION') || 'us-east-1',
  forcePathStyle: env('BACKUP_S3_FORCE_PATH_STYLE') === 'true',
  credentials: { accessKeyId: env('BACKUP_S3_ACCESS_KEY'), secretAccessKey: env('BACKUP_S3_SECRET_KEY') },
  // Aliyun OSS rejects the SDK's default CRC32 trailer.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), job: 'backup-s3', msg, ...extra }))

const STAMP = /^\d{8}T\d{6}Z$/

async function remoteStamps(): Promise<Map<string, string[]>> {
  const runs = new Map<string, string[]>()
  let token: string | undefined
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }))
    for (const item of page.Contents ?? []) {
      const stamp = item.Key?.slice(prefix.length).split('/')[0]
      if (item.Key && stamp && STAMP.test(stamp)) runs.set(stamp, [...(runs.get(stamp) ?? []), item.Key])
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return runs
}

function stampOf(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

async function upload(runDir: string, stamp: string) {
  for (const name of (await readdir(runDir)).sort()) {
    const path = join(runDir, name)
    const { size } = await stat(path)
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}${stamp}/${name}`,
      Body: createReadStream(path),
      ContentLength: size,
      ContentType: 'application/octet-stream',
    }))
    log('uploaded', { key: `${prefix}${stamp}/${name}`, bytes: size })
  }
}

async function prune(days: number) {
  if (!(days > 0)) throw new Error('prune needs a positive number of days')
  const cutoff = stampOf(new Date(Date.now() - days * 86_400_000))
  const runs = await remoteStamps()
  const newest = [...runs.keys()].sort().at(-1)
  for (const [stamp, keys] of runs) {
    // Never delete the newest run, even if the clock or the schedule went wrong.
    if (stamp >= cutoff || stamp === newest) continue
    for (let i = 0; i < keys.length; i += 1000) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      }))
    }
    log('pruned remote run', { stamp, objects: keys.length })
  }
}

async function download(stamp: string, dir: string) {
  const runs = await remoteStamps()
  const keys = runs.get(stamp)
  if (!keys?.length) throw new Error(`no remote run ${stamp}`)
  await mkdir(dir, { recursive: true })
  for (const key of keys) {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    await pipeline(res.Body as Readable, createWriteStream(join(dir, key.split('/').at(-1)!)))
    log('downloaded', { key })
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'upload') await upload(args[0], args[1])
  else if (command === 'prune') await prune(Number(args[0]))
  else if (command === 'list') console.log([...(await remoteStamps()).keys()].sort().reverse().join('\n'))
  else if (command === 'download') await download(args[0], args[1])
  else throw new Error('usage: backup-s3.ts upload <dir> <stamp> | prune <days> | list | download <stamp> <dir>')
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ts: new Date().toISOString(), job: 'backup-s3', level: 'error', msg: String(error) }))
    process.exitCode = 1
  })
  .finally(() => client.destroy())
