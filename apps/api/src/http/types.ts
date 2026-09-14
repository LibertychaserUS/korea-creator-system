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

export type AppEnv = {
  db: Db
  store: ObjectStore
  now: () => Date
  verifySession?: (token: string) => Promise<SessionUser | null>
  getAdapter?: (source: string) => SourceAdapter | undefined
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
