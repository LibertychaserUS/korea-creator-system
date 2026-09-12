import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API, API_URL, PAGES, TIMEOUTS, USERS, type SeedRole } from './constants';
import { tid } from './tid';

export async function loginViaUi(page: Page, role: SeedRole) {
  const user = USERS[role];
  await page.goto(PAGES.login, { timeout: TIMEOUTS.navigation });
  await expect(page.getByTestId(tid.loginEmail)).toBeVisible({ timeout: TIMEOUTS.action });
  await page.getByTestId(tid.loginEmail).fill(user.email);
  await page.getByTestId(tid.loginPassword).fill(user.password);
  await page.getByTestId(tid.loginSubmit).click();

  const session = page.getByTestId(tid.session);
  await expect(session).toBeVisible({ timeout: TIMEOUTS.action });
  await expect(session).toHaveAttribute('data-role', role);
}

export async function postAssignment(
  request: APIRequestContext,
  body: { projectId: string; creatorId?: string; creatorKey?: string },
) {
  const payload = body.creatorId
    ? { creatorIds: [body.creatorId] }
    : { creatorKey: body.creatorKey, creatorIds: body.creatorKey ? [body.creatorKey] : [] };
  return request.post(new URL(API.assignments(body.projectId), API_URL).toString(), {
    data: payload,
    timeout: TIMEOUTS.action,
  });
}

export async function expectDenied(page: Page) {
  await expect(page.getByTestId(tid.denied)).toBeVisible({ timeout: TIMEOUTS.action });
  await expect(page.getByTestId(tid.screen['A-home'])).toHaveCount(0);
  await expect(page.getByTestId(tid.tablePool)).toHaveCount(0);
  await expect(page.getByTestId(tid.tableJobs)).toHaveCount(0);
}
