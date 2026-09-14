import { randomUUID } from 'node:crypto'
import type { Db } from '../db'

export async function audit(
  db: Db,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
) {
  await db.query(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, summary)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), actorId, action, entityType, entityId, summary],
  )
}
