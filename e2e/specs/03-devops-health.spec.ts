import { expect, test } from '@playwright/test';
import { loginViaUi, postAssignment } from '../helpers/auth';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { countIngestJobs } from '../helpers/postgres';
import { tid } from '../helpers/tid';

/**
 * Break this catches: /dev health is a fake number (not SQL), or devops
 * can complete a selector assign.
 */
test.describe('Devops health journey', () => {
  test('devops sees job/health from SQL and cannot assign', async ({ page }) => {
    await loginViaUi(page, 'devops');
    await page.goto(PAGES.dev, { timeout: TIMEOUTS.navigation });
    await expect(page.getByTestId(tid.screen['B-health'])).toBeVisible();
    await expect(page.getByTestId(tid.sqlOk)).toBeVisible();

    const sqlCount = await countIngestJobs();
    const uiCount = Number(
      (await page.getByTestId(tid.jobCount).innerText()).replace(/[^\d-]/g, ''),
    );
    expect(uiCount, 'dev-job-count must equal COUNT(*) FROM ingest_job').toBe(sqlCount);

    await page.goto(PAGES.select, { timeout: TIMEOUTS.navigation });
    const assign = page.getByTestId(tid.btnAssign);
    if (await assign.count()) {
      await expect(assign).toBeDisabled();
    }

    const api = await postAssignment(page.request, {
      projectId: 'e2e-forbidden-project',
      creatorKey: 'e2e-forbidden-creator',
    });
    expect(api.status(), 'devops POST assignments must be 403').toBe(403);
  });
});
