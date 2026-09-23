import { expect, test } from '@playwright/test';
import { loginViaUi } from '../helpers/auth';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { findCreatorByDisplayName } from '../helpers/postgres';
import { tid } from '../helpers/tid';

/**
 * Break this catches: ops cannot create a person, stamp coop_history, and
 * publish a released row that PostgreSQL stores.
 */
test.describe('Ops publish journey', () => {
  test('ops logs in, creates a creator, categorizes 合作过/没合作过, publishes', async ({
    page,
  }) => {
    const displayName = `E2E 运营达人 ${Date.now()}`;

    await loginViaUi(page, 'ops');
    // Wait for hydration: a click before it does a full load, and the next page's hydration wipes what was typed.
    await page.goto(PAGES.ops, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    await expect(page.getByTestId(tid.screen['A-home'])).toBeVisible();

    await page.getByTestId(tid.btnCreateCreator).click();
    await expect(page.getByTestId(tid.displayName)).toBeVisible();
    await page.getByTestId(tid.displayName).fill(displayName);
    await page.getByTestId(tid.followers).fill('128000');
    await page.getByTestId(tid.priceMin).fill('8000');

    await page.getByTestId(tid.categoryCollaborated).click();
    await expect(page.getByTestId(tid.categoryCollaborated)).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId(tid.categoryNever).click();
    await expect(page.getByTestId(tid.categoryNever)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(tid.categoryCollaborated)).toHaveAttribute('aria-pressed', 'false');

    await page.getByTestId(tid.save).click();
    await expect(page.getByTestId(tid.creatorKey)).toBeVisible();
    const creatorKey = await page.getByTestId(tid.creatorKey).getAttribute('data-creator-key');
    expect(creatorKey, 'ops must persist a creator_key').toBeTruthy();

    await page.getByTestId(tid.btnPublish).click();
    await page.getByTestId(tid.publishConfirm).click();
    await expect(page.getByTestId(tid.creatorStatus)).toHaveAttribute('data-status', 'released');

    const row = await findCreatorByDisplayName(displayName);
    expect(row, 'published creator must exist in PostgreSQL').toBeTruthy();
    expect(row?.status).toBe('released');
  });
});
