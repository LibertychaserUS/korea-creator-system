/**
 * 听潮四端拆分 —— 结构性回归测试。
 *
 * 四个独立 app（marketing/select/ops/dev）各自独立部署、独立端口，
 * 共享 libs/panel 层。单宿主时代留下的 `/ops`、`/select`、`/dev`
 * 路径前缀在分端后会 404：本文件锁住「按端寻址」的约定。
 *
 * Break: 从旧单宿主 apps/web 拷页面时不改链接前缀。
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

describe('marketing app (public site)', () => {
  it('has a landing page', () => {
    expect(existsSync(resolve(ROOT, 'apps/marketing/pages/index.vue'))).toBe(true)
  })

  const page = () => read('apps/marketing/pages/index.vue')

  it('landing is public chrome, not the workspace sidebar', () => {
    const src = page()
    expect(src).not.toContain('AppSidebar')
    expect(src).toMatch(/layout:\s*(false|'marketing')/)
  })

  it('carries the 听潮 brand and the warm tide motif', () => {
    const src = page()
    expect(src).toContain('AppLogo')
    expect(src).toContain('TideCanvas')
    expect(src).toContain('kcs.brand.tagline')
  })

  it('exposes language dropdown and theme toggle', () => {
    const src = page()
    expect(src).toContain('LocaleSelect')
    expect(src).toContain('ThemeToggle')
  })

  it('links into login and the three workspace apps by configured origin', () => {
    const src = page()
    expect(src).toContain('data-testid="marketing-hero"')
    expect(src).toContain('data-testid="cta-enter"')
    // Cross-app links must use configured absolute URLs, never path prefixes.
    expect(src).toMatch(/selectUrl|select_url|public\.select/)
    expect(src).toMatch(/opsUrl|ops_url|public\.ops/)
    expect(src).toMatch(/devUrl|dev_url|public\.dev/)
  })
})

describe('per-app routing (no single-host prefixes left)', () => {
  it('select app links stay inside the select origin', () => {
    for (const f of ['apps/select/pages/index.vue', 'apps/select/pages/projects/index.vue', 'apps/select/pages/projects/new.vue', 'apps/select/pages/projects/[id].vue']) {
      const src = read(f)
      expect(src, `${f} still uses the retired /select prefix`).not.toMatch(/localePath\([`'"]\/select\//)
    }
  })

  it('ops app links stay inside the ops origin', () => {
    const src = read('apps/ops/pages/index.vue')
    expect(src).not.toMatch(/localePath\([`'"]\/ops\//)
  })

  it('app pages import shared utils via @libs, never the app-local @/', () => {
    // `@/` resolves to the app dir, which has no utils/ — the panel layer
    // owns shared helpers. Break: ops creator form 302s home on a bad import.
    for (const f of [
      'apps/ops/pages/creators/new.vue',
      'apps/ops/pages/index.vue',
      'apps/select/pages/index.vue',
      'apps/select/pages/projects/index.vue',
      'apps/select/pages/projects/new.vue',
      'apps/select/pages/projects/[id].vue',
      'apps/dev/pages/index.vue',
      'apps/marketing/pages/index.vue',
    ]) {
      const src = read(f)
      expect(src, `${f} imports app-local @/utils or @/lib`).not.toMatch(/from\s+['"]@\/(utils|lib|composables)\//)
    }
  })
})

describe('shared panel layer serves per-app config', () => {
  it('sidebar renders the current app nav from appConfig.kcs', () => {
    const src = read('libs/panel/components/AppSidebar.vue')
    expect(src).toMatch(/useAppConfig\(\)/)
    expect(src).toMatch(/kcs/)
  })

  it('workspace switcher crosses app origins, not paths', () => {
    const src = read('libs/panel/components/WorkspaceSwitch.vue')
    expect(src).toMatch(/selectUrl|opsUrl|devUrl/)
  })

  it('route middleware enforces the app-level perm from appConfig.kcs', () => {
    const src = read('libs/panel/middleware/kcs-rbac.global.ts')
    expect(src).toMatch(/useAppConfig\(\)/)
  })

  it('login redirect lands on the current app home', () => {
    const src = read('libs/panel/server/routes/__login.post.ts')
    // Workspace apps: home is `/` on the same origin; marketing hands off
    // to the role workspace origin. The retired `/${ws}` path redirect 404s.
    expect(src).toContain('appKey')
    expect(src).not.toContain('`/${allowed[0]}`')
  })
})
