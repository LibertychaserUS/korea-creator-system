// Bundles the API into apps/api/dist so production runs plain `node`, not tsx.
//
// The source reads a few files next to itself through `new URL(..., import.meta.url)`:
// migrations and seed fixtures from `src/`, vendor fixtures from `src/adapters/`,
// and the version from `../../package.json`. Everything is bundled into
// `dist/src/*.mjs`, so those files are copied to where each lookup lands.
import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'src')
const out = resolve(root, 'dist/src')

await rm(resolve(root, 'dist'), { recursive: true, force: true })
await mkdir(out, { recursive: true })

await build({
  entryPoints: {
    index: resolve(src, 'index.ts'),
    'migrate-cli': resolve(src, 'migrate-cli.ts'),
  },
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  // pg only loads pg-native when asked for `pg.native`; it is not installed.
  external: ['pg-native'],
  // Bundled CommonJS dependencies still call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __kcsCreateRequire } from 'node:module'; const require = __kcsCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
})

await cp(resolve(src, 'migrations'), resolve(out, 'migrations'), { recursive: true })
await cp(resolve(src, 'adapters/fixtures'), resolve(out, 'adapters/fixtures'), { recursive: true })
await cp(resolve(src, 'adapters/fixtures'), resolve(out, 'fixtures'), { recursive: true })
