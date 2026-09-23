import { expect, test } from '@playwright/test';
import { expectDenied, loginViaUi } from '../helpers/auth';
import { APP_URLS, LOCALE, PAGES, TIMEOUTS } from '../helpers/constants';
import { tid } from '../helpers/tid';

/**
 * 账号：平台管理员在运维端开账号 → 新同事用初始密码登录，按角色落到自己的工作台；
 * 运维（非管理员）看不到「账号」，直接打开也被拦下。
 *
 * Break: 开出来的账号登不上 / 落错端；非管理员能进账号页。
 */
test.describe('Accounts', () => {
  test('admin opens an ops account; the new teammate signs in and lands on the ops desk', async ({ browser }) => {
    const email = `e2e-${Date.now()}@kcs.local`;
    const password = `Kcs!e2e${Date.now()}`;

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await loginViaUi(admin, 'platform_admin');
    await admin.goto(`${APP_URLS.dev}/${LOCALE}/accounts`, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    await expect(admin.getByTestId(tid.screenAccounts)).toBeVisible();
    await admin.getByTestId(tid.btnCreateAccount).click();
    const form = admin.getByTestId(tid.formCreateAccount);
    await form.locator('#acc-email').fill(email);
    await form.locator('#acc-name').fill('E2E 新同事');
    await form.locator('#acc-password').fill(password);
    await form.locator('#acc-role').selectOption('ops');
    await admin.getByTestId(tid.btnCreateAccountSubmit).click();
    const row = admin.locator(`[data-testid="${tid.rowAccount}"][data-account-email="${email}"]`);
    await expect(row).toBeVisible({ timeout: TIMEOUTS.action });
    await expect(row.getByTestId(tid.accountRole)).toHaveValue('ops');
    await expect(row.getByTestId(tid.accountStatus)).toHaveAttribute('data-status', 'active');
    await adminContext.close();

    const newcomerContext = await browser.newContext();
    const newcomer = await newcomerContext.newPage();
    await newcomer.goto(PAGES.login, { timeout: TIMEOUTS.navigation });
    await newcomer.getByTestId(tid.loginEmail).fill(email);
    await newcomer.getByTestId(tid.loginPassword).fill(password);
    await newcomer.getByTestId(tid.loginSubmit).click();
    await expect(newcomer.getByTestId(tid.session)).toHaveAttribute('data-role', 'ops', { timeout: TIMEOUTS.action });
    expect(newcomer.url().startsWith(APP_URLS.ops)).toBe(true);
    await newcomerContext.close();
  });

  test('devops has no accounts entry and is turned away from the page', async ({ page }) => {
    await loginViaUi(page, 'devops');
    await page.goto(PAGES.dev, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    await expect(page.getByTestId(tid.screen['B-health'])).toBeVisible();
    await expect(page.getByTestId(tid.navAccounts)).toHaveCount(0);
    await page.goto(`${APP_URLS.dev}/${LOCALE}/accounts`, { timeout: TIMEOUTS.navigation });
    await expectDenied(page);
    await expect(page.getByTestId(tid.screenAccounts)).toHaveCount(0);
  });
});
