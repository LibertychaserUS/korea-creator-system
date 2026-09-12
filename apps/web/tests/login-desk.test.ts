import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const login = readFileSync(resolve(__dirname, '../pages/login.vue'), 'utf8')

/**
 * Break: /login is one generic card for both desks.
 */
describe('distinct A vs C login', () => {
  it('renders an ops split-rail desk and a selector card desk', () => {
    expect(login).toContain('data-testid="screen-a-login"')
    expect(login).toContain('data-testid="screen-c-login"')
    expect(login).toContain('login-a')
    expect(login).toContain('login-c')
    expect(login).toMatch(/loginDesk\.opsTitle|运营登录/)
    expect(login).toMatch(/loginDesk\.selectTitle|选人公司登录/)
    expect(login).not.toMatch(/运营录入 \/ 选人公司/)
  })
})
