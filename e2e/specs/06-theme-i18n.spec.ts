import { expect, test } from '@playwright/test';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { tid } from '../helpers/tid';

/**
 * Break this catches: chrome cannot switch light/dark or zh-CN/en/ko
 * on Chromium (URL + html lang / dark class).
 */
test.describe('Light/dark and locale chrome', () => {
  test('home chrome switches theme and zh-CN / en / ko', async ({ page }) => {
    await page.goto(PAGES.home, { timeout: TIMEOUTS.navigation });

    const theme = page.getByTestId(tid.themeToggle);
    await expect(theme).toBeVisible();
    await theme.getByRole('button', { name: '深色' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await theme.getByRole('button', { name: '浅色' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    const locales = page.getByTestId(tid.localeSwitch);
    await locales.getByRole('button', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByTestId(tid.localeSwitch).getByRole('button', { name: '한국어' }).click();
    await expect(page).toHaveURL(/\/ko(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');

    await page.getByTestId(tid.localeSwitch).getByRole('button', { name: '中文' }).click();
    await expect(page).toHaveURL(/\/zh-CN(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  });
});
