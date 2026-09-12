import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * libs/panel 是被四个端 extends 的共享层。层内文件里的 `@/…` 别名指向
 * 的是「当前 app」的 srcDir，而不是层自己 —— 只有各 app 里的显式 shim
 * （如 apps/ops/lib/utils.ts）才能接住。层内跨文件引用必须走相对路径，
 * 否则 dev 能跑、build 的 vue-tsc 直接报 TS2307（2026-09 真实踩过）。
 *
 * 例外：`@/lib/utils` 由每个 app 的 lib/utils.ts shim 统一 re-export，
 * 属于 shadcn 惯例，允许保留。
 */

const panelDir = resolve(__dirname, '../../libs/panel')

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.nuxt' || entry === '.output') continue
      yield* walk(full)
    } else if (/\.(vue|ts)$/.test(entry)) {
      yield full
    }
  }
}

describe('panel 层内部引用', () => {
  it('层内文件不使用指向 app srcDir 的 @/ 别名（@/lib/utils 除外）', () => {
    const offenders: string[] = []
    for (const file of walk(panelDir)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/from\s+'@\/([^']+)'/g)) {
        if (match[1] === 'lib/utils') continue
        offenders.push(`${file.replace(`${panelDir}/`, '')} → @/${match[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('每个 app 都有 lib/utils.ts shim 接住 @/lib/utils', () => {
    for (const app of ['marketing', 'select', 'ops', 'dev']) {
      const shim = resolve(__dirname, `../../apps/${app}/lib/utils.ts`)
      const source = readFileSync(shim, 'utf8')
      expect(source).toContain('libs/panel/lib/utils')
    }
  })
})
