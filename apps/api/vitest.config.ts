import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Vendor credentials from the shell must never reach a test: every vendor call here is a stub.
    env: { LOG_REQUESTS: '0', TIKHUB_API_KEY: '', PGY_ACCESS_TOKEN: '', QIANGUA_TOKEN: '', XINHONG_TOKEN: '' },
  },
})
