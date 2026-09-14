import { expect, test, type Page } from '@playwright/test';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { tid } from '../helpers/tid';

/**
 * Break this catches: chrome cannot switch light/dark or zh-CN/en/ko
 * on Chromium (URL + html lang / dark class).
 *
 * Chrome shape (libs/panel): `theme-toggle` is a single icon button whose
 * accessible name is the theme it switches TO; `locale-switch` wraps a
 * dropdown trigger (`locale-switch-trigger`) with `locale-option-<code>` items.
 */
async function switchLocale(page: Page, code: 'en' | 'ko' | 'zh-CN') {
  await page.getByTestId(tid.localeSwitch).getByTestId('locale-switch-trigger').click();
  await page.getByTestId(`locale-option-${code}`).click();
}

test.describe('Light/dark and locale chrome', () => {
  test('home chrome switches theme and zh-CN / en / ko', async ({ page }) => {
    await page.goto(PAGES.home, { timeout: TIMEOUTS.navigation });

    const theme = page.getByTestId(tid.themeToggle);
    await expect(theme).toBeVisible();
    await expect(theme).toHaveAccessibleName(/深色/);
    await theme.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await expect(theme).toHaveAccessibleName(/浅色/);
    await theme.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await switchLocale(page, 'en');
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await switchLocale(page, 'ko');
    await expect(page).toHaveURL(/\/ko(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');

    await switchLocale(page, 'zh-CN');
    await expect(page).toHaveURL(/\/zh-CN(\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  });
});
