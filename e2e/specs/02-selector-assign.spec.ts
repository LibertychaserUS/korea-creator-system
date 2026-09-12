import { expect, test } from '@playwright/test';
import { expectDenied, loginViaUi } from '../helpers/auth';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { findAssignment } from '../helpers/postgres';
import { tid } from '../helpers/tid';

/**
 * Break this catches: selector 3-step path (project → filter/sort → assign)
 * does not write an assignment row, or selector can open /ops.
 */
test.describe('Selector assign journey', () => {
  test('selector cannot open /ops', async ({ page }) => {
    await loginViaUi(page, 'selector');
    await page.goto(PAGES.ops, { timeout: TIMEOUTS.navigation });
    await expectDenied(page);
  });

  test('selector opens a project, filters/sorts the pool, assigns, row lands in Postgres', async ({
    page,
  }) => {
    const projectName = `E2E 选人项目 ${Date.now()}`;

    await loginViaUi(page, 'selector');
    await page.goto(PAGES.select, { timeout: TIMEOUTS.navigation });
    await expect(page.getByTestId(tid.tableProjects)).toBeVisible();

    await page.getByTestId(tid.btnCreateProject).click();
    await page.getByTestId(tid.projectName).fill(projectName);
    await page.getByTestId(tid.btnCreateProject).click();
    await expect(page.getByTestId(tid.screen['C-project-board'])).toBeVisible();
    const projectId = await page
      .getByTestId(tid.screen['C-project-board'])
      .getAttribute('data-project-id');
    expect(projectId).toBeTruthy();

    await page.getByTestId(tid.libraryOpen).click();
    await expect(page.getByTestId(tid.tablePool)).toBeVisible();

    await page.getByTestId(tid.filterFollowersMin).fill('10000');
    await page.getByTestId(tid.filterFollowersMax).fill('900000');
    await page.getByTestId(tid.filterPriceMin).fill('1000');
    await page.getByTestId(tid.filterPriceMax).fill('50000');
    await page.getByTestId(tid.filterCollab).selectOption('any');

    await page.getByTestId(tid.sortFollowers).click();
    await page.getByTestId(tid.sortPrice).click();
    await page.getByTestId(tid.sortCollab).click();

    const row = page.getByTestId(tid.libraryRow).first();
    await expect(row).toBeVisible();
    const creatorKey = await row.getAttribute('data-creator-key');
    expect(creatorKey).toBeTruthy();
    await row.getByTestId(tid.libraryCheckbox).check();
    await page.getByTestId(tid.btnAssign).click();
    await page.getByTestId(tid.assignConfirm).click();

    await expect(page.getByTestId(tid.screen['C-project-board'])).toBeVisible();
    await expect(
      page.locator(`[data-testid="${tid.projectRow}"][data-creator-key="${creatorKey}"]`),
    ).toBeVisible();

    const assignment = await findAssignment({ creatorKey: creatorKey! });
    expect(assignment, 'assignment must exist in PostgreSQL').toBeTruthy();
    expect(assignment?.status).toBe('assigned');
    expect(String(assignment?.project_id)).toBe(String(projectId));
  });
});
