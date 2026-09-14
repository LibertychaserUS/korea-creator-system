import type { Role } from './rbac'

export const SEED_PASSWORD = 'Kcs!demo2026'

export const SEED_USERS: ReadonlyArray<{
  email: string
  role: Role
  displayName: string
}> = [
  { email: 'admin@kcs.local', role: 'platform_admin', displayName: '平台管理员' },
  { email: 'ops@kcs.local', role: 'ops', displayName: '运营录入' },
  { email: 'devops@kcs.local', role: 'devops', displayName: '运维监测' },
  { email: 'selector@kcs.local', role: 'selector', displayName: '选人公司' },
  { email: 'viewer@kcs.local', role: 'selector_viewer', displayName: '选人只读' },
]
