import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { loginViaUi } from '../helpers/auth';
import { PAGES, TIMEOUTS } from '../helpers/constants';
import { bucketObjectUrl, listObjectKeys, objectExists } from '../helpers/s3';
import { tid } from '../helpers/tid';

const AVATAR = resolve(__dirname, '../fixtures/talent-avatar.png');

/**
 * Break this catches: ops "upload" is a local blob only — no object in
 * MinIO/S3 and the avatar URL does not return an image; or the bucket is
 * readable anonymously (it must be private: images are read through the API).
 */
test.describe('Image upload journey', () => {
  test('uploaded avatar appears in S3/MinIO and the URL works', async ({ page }) => {
    const displayName = `E2E 头像达人 ${Date.now()}`;
    const keysBefore = new Set(await listObjectKeys());

    await loginViaUi(page, 'ops');
    await page.goto(PAGES.opsNew, { timeout: TIMEOUTS.navigation });
    await page.getByTestId(tid.displayName).fill(displayName);
    await page.getByTestId(tid.followers).fill('22000');
    await page.getByTestId(tid.categoryNever).click();
    await page.getByTestId(tid.avatar).setInputFiles(AVATAR);
    await page.getByTestId(tid.save).click();

    const avatar = page.getByTestId(tid.avatarUrl);
    await expect(avatar).toBeVisible();
    const objectKey = await avatar.getAttribute('data-object-key');
    expect(objectKey, 'creator-avatar-url must expose data-object-key').toBeTruthy();

    expect(await objectExists(objectKey!), `MinIO missing key ${objectKey}`).toBeTruthy();

    const href = (await avatar.getAttribute('href')) || (await avatar.getAttribute('src'));
    expect(href, 'creator-avatar-url must link the image').toBeTruthy();
    expect(href!, 'avatar must be served by the API, not straight from the bucket').toContain('/api/assets/raw/');
    const response = await page.request.get(href!);
    expect(response.ok(), `avatar URL ${href} → ${response.status()}`).toBeTruthy();
    const contentType = response.headers()['content-type'] || '';
    expect(contentType.startsWith('image/'), `expected image/*, got ${contentType}`).toBeTruthy();

    const direct = await page.request.get(bucketObjectUrl(objectKey!));
    expect(direct.status(), 'bucket must not allow anonymous reads').toBe(403);

    const keysAfter = await listObjectKeys();
    const added = keysAfter.filter((key) => !keysBefore.has(key));
    expect(added.length, 'upload must add at least one object to the bucket').toBeGreaterThan(0);
  });
});
