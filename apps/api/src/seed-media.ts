import type { Db } from './db'
import { renderCoverPng, renderPortraitPng } from './fixture-portraits'
import type { ObjectStore } from './store'

export function assetPublicUrl(key: string) {
  const base = (process.env.API_PUBLIC_URL || 'http://localhost:7100').replace(/\/$/, '')
  return `${base}/api/assets/raw/${key}`
}

export async function attachTalentMedia(
  db: Db,
  talent: { id: string; name: string; verticals: string[] },
  store?: ObjectStore,
) {
  const avatarKey = `fixtures/talents/${talent.id}/avatar.png`
  const coverKey = `fixtures/talents/${talent.id}/cover.png`
  const avatar = renderPortraitPng(talent)
  const cover = renderCoverPng(talent)
  const avatarUrl = assetPublicUrl(avatarKey)
  const coverUrl = assetPublicUrl(coverKey)
  await upsertAsset(db, avatarKey, avatarUrl, avatar)
  await upsertAsset(db, coverKey, coverUrl, cover)
  if (store) {
    await store.put(avatarKey, avatar, 'image/png')
    await store.put(coverKey, cover, 'image/png')
  }
  await db.query(
    `UPDATE creators
        SET avatar_url = $2,
            photo_urls = $3,
            avatar_key = $4,
            updated_at = now()
      WHERE id = $1`,
    [talent.id, avatarUrl, [coverUrl], avatarKey],
  )
}

async function upsertAsset(db: Db, key: string, url: string, bytes: Buffer) {
  await db.query(
    `INSERT INTO assets (key, url, content_type, size, bytes, uploaded_by)
     VALUES ($1,$2,'image/png',$3,$4,'seed')
     ON CONFLICT (key) DO UPDATE SET
       url = EXCLUDED.url,
       content_type = EXCLUDED.content_type,
       size = EXCLUDED.size,
       bytes = EXCLUDED.bytes,
       uploaded_by = EXCLUDED.uploaded_by`,
    [key, url, bytes.length, bytes],
  )
}
