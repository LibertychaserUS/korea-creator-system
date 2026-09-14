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

    // 方案栏：量级 / 健康等级快捷过滤 + 指标排序，都是同一份 SavedQuery
    await expect(page.getByTestId(tid.queryBar)).toBeVisible();
    await page.getByTestId(tid.filterHealthExcellent).click();
    await page.getByTestId(tid.filterHealthExcellent).click();
    await page.getByTestId(tid.sortKey).selectOption('followers');
    await page.getByTestId(tid.sortDir).click();
    await page.getByTestId(tid.sortKey).selectOption('cpe');
    await page.getByTestId(tid.queryEditorToggle).click();
    await expect(page.getByTestId(tid.queryEditor)).toBeVisible();
    await page.getByTestId(tid.queryEditorToggle).click();

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
