import type { Hono } from 'hono'
import type { Permission, Role, SourceAdapter } from '@kcs/contract'
import type { Db } from '../db'
import type { ObjectStore } from '../store'

export type SessionUser = {
  id: string
  orgId: string
  email: string
  role: Role
  displayName: string
}

/**
 * What the session verifier hands back: a KCS user, an identity TinyShip
 * recognises but that has not been given a KCS role yet (`role: null`, →
 * 403 on every route), or nothing (`null`, → 401).
 */
export type VerifiedIdentity = (Omit<SessionUser, 'role'> & { role: Role | null }) | null

export type AppEnv = {
  db: Db
  store: ObjectStore
  now: () => Date
  verifySession?: (token: string) => Promise<VerifiedIdentity>
  getAdapter?: (source: string) => SourceAdapter | undefined
  /** Flipped by the shutdown handler: new requests get 503 and readiness fails. */
  lifecycle?: { draining: boolean }
}

export type KcsApp = Hono

export type RouteContext = Parameters<Parameters<Hono['use']>[1]>[0]

export type AuthResult = {
  user: SessionUser | null
  denied: Response | null
}

export type RouteHelpers = {
  requireAuth: (c: RouteContext, permission?: Permission) => Promise<AuthResult>
}
