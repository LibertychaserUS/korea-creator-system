import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [resolve(__dirname, 'suites/**/*.test.ts')],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: resolve(__dirname, 'global-setup.ts'),
  },
})
