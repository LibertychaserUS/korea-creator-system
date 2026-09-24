import { expect, test } from '@playwright/test';
import { loginViaUi } from '../helpers/auth';
import { API_URL, APP_URLS, LOCALE, PAGES, TIMEOUTS } from '../helpers/constants';
import { closePool, sql } from '../helpers/postgres';

/**
 * 运营端分类与平台字典 → 抓取表单下拉；选人端候选名单移出；运维端存储卡手动采集。
 * 每一步都落到 Postgres（分类行、字典行、操作记录、候选名单、容量日表）。
 *
 * Break: 新建分类不进表或不写操作记录；字典替换后抓取表单仍是手填框；
 * 移出候选名单后行还在；手动采集后存储卡仍是空状态。
 */
test.describe('Catalog, shortlist and capacity', () => {
  test.afterAll(async () => {
    await closePool();
  });

  test('ops creates a category and replaces a source dictionary that the fetch form then offers', async ({ page }) => {
    const stamp = Date.now().toString(36);
    const slug = `e2e_${stamp}`;
    const values = [`甲E2E${stamp}`, `乙E2E${stamp}`];

    await loginViaUi(page, 'ops');
    await page.goto(`${APP_URLS.ops}/${LOCALE}/categories`, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    await expect(page.getByTestId('screen-a-categories')).toBeVisible();

    await page.getByTestId('btn-category-new').click();
    await page.getByTestId('category-slug').fill(slug);
    await page.getByTestId('category-name-zh-CN').fill('端到端分类');
    await page.getByTestId('category-name-en').fill('E2E category');
    await page.getByTestId('category-name-ko').fill('E2E 분류');
    await page.getByTestId('btn-category-create').click();
    await expect(page.locator(`[data-testid="row-category"][data-category="${slug}"]`)).toBeVisible({ timeout: TIMEOUTS.action });
    await expect
      .poll(async () => (await sql('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['category.create', slug])).rowCount, { timeout: TIMEOUTS.sql })
      .toBe(1);

    const editor = page.getByTestId('dictionary-editor');
    await editor.getByTestId('dictionary-source').selectOption('qiangua');
    await editor.getByTestId('dictionary-kind-region').click();
    await editor.getByTestId('dictionary-paste').fill(values.map((v) => `华东 > ${v}`).join('\n'));
    await editor.getByTestId('btn-dictionary-save').click();
    await expect(editor.getByTestId('dictionary-platform-count')).toHaveText('2', { timeout: TIMEOUTS.action });
    const { rows } = await sql<{ value: string; grp: string | null }>(
      "SELECT value, grp FROM source_dictionaries WHERE source_id = 'qiangua' AND kind = 'region' ORDER BY position",
    );
    expect(rows).toEqual(values.map((value) => ({ value, grp: '华东' })));

    await page.goto(`${APP_URLS.ops}/${LOCALE}/sources`, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    await page.getByTestId('adapter-qiangua').click();
    const region = page.getByTestId('fetch-region');
    await expect(region.locator(`option[value="${values[0]}"]`)).toHaveCount(1, { timeout: TIMEOUTS.action });
    await expect(region.locator(`optgroup[label="华东"] option`)).toHaveCount(2);
  });

  test('selector removes a creator from the shortlist', async ({ page }) => {
    const {
      rows: [creator],
    } = await sql<{ id: string }>("SELECT id FROM creators WHERE status = 'released' ORDER BY id LIMIT 1");
    expect(creator, 'demo data has a released creator').toBeTruthy();

    await loginViaUi(page, 'selector');
    const added = await page.request.post(new URL('/api/select/shortlist', API_URL).toString(), {
      data: { creatorId: creator.id },
      timeout: TIMEOUTS.action,
    });
    expect(added.status()).toBe(200);

    await page.goto(`${APP_URLS.select}/${LOCALE}/shortlist`, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    const row = page.locator(`[data-testid="row-shortlist"][data-creator-id="${creator.id}"]`);
    await expect(row).toBeVisible({ timeout: TIMEOUTS.action });
    await row.getByTestId('btn-shortlist-remove').click();
    await expect(row).toHaveCount(0, { timeout: TIMEOUTS.action });
    await expect
      .poll(async () => (await sql('SELECT 1 FROM shortlist_items WHERE creator_id = $1', [creator.id])).rowCount, { timeout: TIMEOUTS.sql })
      .toBe(0);
    expect((await sql('SELECT 1 FROM audit_logs WHERE action = $1 AND entity_id = $2', ['shortlist.remove', creator.id])).rowCount ?? 0).toBeGreaterThan(0);
  });

  test('devops takes a storage reading from the home card', async ({ page }) => {
    await loginViaUi(page, 'devops');
    await page.goto(PAGES.dev, { timeout: TIMEOUTS.navigation, waitUntil: 'networkidle' });
    const card = page.getByTestId('card-capacity');
    await expect(card).toBeVisible({ timeout: TIMEOUTS.action });
    await card.getByTestId('btn-capacity-snapshot').click();
    await expect(card.getByTestId('capacity-headline')).toBeVisible({ timeout: TIMEOUTS.action });
    await expect(card).toHaveAttribute('data-level', /^(ok|notice|warning|critical)$/);
    const { rowCount } = await sql(
      "SELECT 1 FROM ops_capacity_daily WHERE scope = 'database' AND day = (now() AT TIME ZONE 'Asia/Shanghai')::date",
    );
    expect(rowCount).toBe(1);
  });
});
