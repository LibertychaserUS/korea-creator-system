import { expect, test } from '@playwright/test';
import { loginViaUi, postAssignment } from '../helpers/auth';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { tid } from '../helpers/tid';

/**
 * Break this catches: viewer loses the published pool, or can assign
 * through UI or API.
 */
test.describe('Viewer pool journey', () => {
  test('viewer can see the pool and cannot assign', async ({ page }) => {
    await loginViaUi(page, 'selector_viewer');
    await page.goto(PAGES.selectPool, { timeout: TIMEOUTS.navigation });
    await expect(page.getByTestId(tid.tablePool)).toBeVisible();
    await expect(page.getByTestId(tid.libraryRow).first()).toBeVisible();

    await expect(page.getByTestId(tid.btnAssign)).toHaveCount(0);
    await expect(page.getByTestId(tid.assignConfirm)).toHaveCount(0);

    const api = await postAssignment(page.request, {
      projectId: 'e2e-forbidden-project',
      creatorKey: 'e2e-forbidden-creator',
    });
    expect(api.status(), 'viewer POST assignments must be 403').toBe(403);
  });
});
