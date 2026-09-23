import { readFileSync } from 'fs';
import { expect, test } from '@playwright/test';
import { loginViaUi } from '../helpers/auth';
import { APP_URLS, LOCALE, PAGES, TIMEOUTS } from '../helpers/constants';
import { findAssignment, sql } from '../helpers/postgres';
import { tid } from '../helpers/tid';

/**
 * 一条完整链：运营抓演示数据 → 列表「待审核」→ 详情里看发布时 / 最新对照后通过并发布 →
 * 选人在博主池里看到 → 分到项目 → 导出表格。
 *
 * Break: 抓到的博主不进待审核；发布后选人池看不到；导出的表格打开乱码、表头是字段名，
 * 或者没有这位博主。
 *
 * 演示数据是固定的几位博主（每个来源几位），API 每次启动会把它们恢复成待审核；
 * 同一个库上连跑多次会把某个来源的待审核用完，重启 API 或换新库即可。
 */
const SOURCE = process.env.E2E_REVIEW_SOURCE || 'xinhong';

test.describe('Ops review chain', () => {
  test('fetch demo → review list → approve & publish → pool → project → export', async ({ browser }) => {
    test.setTimeout(180_000);

    // 运营：抓一批演示数据
    const opsContext = await browser.newContext();
    const ops = await opsContext.newPage();
    await loginViaUi(ops, 'ops');
    await ops.goto(`${APP_URLS.ops}/${LOCALE}/sources`, { timeout: TIMEOUTS.navigation });
    await ops.getByTestId('fetch-source').selectOption(SOURCE);
    await ops.getByTestId('fetch-run').click();
    const result = ops.getByTestId('fetch-result');
    await expect(result).toBeVisible({ timeout: TIMEOUTS.action });
    const jobId = await result.getAttribute('data-job-id');
    expect(jobId, 'fetch must open a job').toBeTruthy();
    const jobRow = ops.locator(`[data-testid="row-fetch-job"][data-job-id="${jobId}"]`);
    await expect(jobRow).toHaveAttribute('data-status', /^(ok|done|succeeded)$/, { timeout: 60_000 });

    // 列表：待审核、按来源筛
    await ops.goto(`${APP_URLS.ops}/${LOCALE}/creators?tab=review&source=${SOURCE}`, { timeout: TIMEOUTS.navigation });
    await expect(ops.getByTestId(tid.screenOpsCreators)).toBeVisible();
    await expect(ops.getByTestId(tid.opsCreatorTabReview)).toHaveAttribute('aria-selected', 'true');
    const rows = ops.getByTestId(tid.rowOpsCreator);
    await expect(rows.first(), `no ${SOURCE} creator waiting for review — restart the API to restore demo data`).toBeVisible({
      timeout: TIMEOUTS.action,
    });
    const onScreen = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-creator-id')));
    // Blacklisted creators never reach the pool, so the chain follows one that can.
    const fetched = await sql<{ id: string; display_name: string }>(
      `SELECT c.id, c.display_name FROM creators c
       WHERE c.id = ANY($1) AND c.last_ingest_job_id = $2
         AND NOT EXISTS (SELECT 1 FROM creator_categories cc WHERE cc.creator_id = c.id AND cc.category_slug = 'blacklist')
       ORDER BY c.id LIMIT 1`,
      [onScreen, jobId],
    );
    expect(fetched.rows[0], 'a creator this fetch wrote is waiting for review').toBeTruthy();
    const { id: creatorId, display_name: displayName } = fetched.rows[0]!;
    await ops.locator(`[data-testid="${tid.rowOpsCreator}"][data-creator-id="${creatorId}"]`).click();

    // 详情：对照、平台原始信息、通过并发布
    await expect(ops.getByTestId(tid.screenOpsCreator)).toBeVisible({ timeout: TIMEOUTS.navigation });
    await expect(ops.getByTestId(tid.creatorStatus)).toHaveAttribute('data-stage', 'review');
    await expect(ops.getByTestId(tid.metricCompare)).toBeVisible();
    await ops.getByTestId(tid.btnRaw).click();
    await expect(ops.getByTestId(tid.sheetRaw)).toBeVisible();
    await expect(ops.getByTestId(tid.rawRecord).first()).toBeVisible();
    await ops.keyboard.press('Escape');
    const creatorKey = await ops.getByTestId(tid.creatorKey).getAttribute('data-creator-key');
    expect(creatorKey).toBeTruthy();
    await ops.getByTestId(tid.btnPublish).click();
    await ops.getByTestId(tid.btnPublishConfirm).click();
    await expect(ops.getByTestId(tid.creatorStatus)).toHaveAttribute('data-stage', 'released', { timeout: TIMEOUTS.action });
    await expect(ops.getByTestId(tid.btnUnpublish)).toBeVisible();
    await opsContext.close();

    // 选人：新项目 → 博主池里找到刚发布的人 → 分到项目
    const selectContext = await browser.newContext({ acceptDownloads: true });
    const sel = await selectContext.newPage();
    await loginViaUi(sel, 'selector');
    const projectName = `E2E 审核链 ${Date.now()}`;
    await sel.goto(PAGES.select, { timeout: TIMEOUTS.navigation });
    await sel.getByTestId(tid.btnCreateProject).click();
    // Typing before hydration is lost; retry until the form has taken the name.
    await expect(async () => {
      await sel.getByTestId(tid.projectName).fill(projectName);
      await expect(sel.getByTestId(tid.btnCreateProject)).toBeEnabled({ timeout: 1_000 });
    }).toPass({ timeout: TIMEOUTS.action });
    await sel.getByTestId(tid.btnCreateProject).click();
    const board = sel.getByTestId(tid.screen['C-project-board']);
    await expect(board).toBeVisible({ timeout: TIMEOUTS.navigation });
    const projectId = await board.getAttribute('data-project-id');

    await sel.getByTestId(tid.libraryOpen).click();
    await expect(sel.getByTestId(tid.tablePool)).toBeVisible({ timeout: TIMEOUTS.navigation });
    const poolRow = sel.locator(`[data-testid="${tid.libraryRow}"][data-creator-key="${creatorKey}"]`);
    // The first saved plan filters the pool; a blank plan shows everyone published.
    await sel.getByTestId('query-new').click();
    await expect(async () => {
      await sel.getByTestId(tid.poolSearch).fill(displayName);
      await expect(poolRow, 'published creator must be in the pool').toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: TIMEOUTS.action });
    await poolRow.getByTestId(tid.libraryCheckbox).check();
    await sel.getByTestId(tid.btnAssign).click();
    await sel.getByTestId(tid.assignConfirm).click();
    await expect(board).toBeVisible({ timeout: TIMEOUTS.navigation });
    await expect(sel.locator(`[data-testid="${tid.projectRow}"][data-creator-key="${creatorKey}"]`)).toBeVisible();
    const assignment = await findAssignment({ creatorKey: creatorKey! });
    expect(String(assignment?.project_id)).toBe(String(projectId));

    // 导出：带 BOM 的表格，中文表头，里面有这位博主
    const [download] = await Promise.all([sel.waitForEvent('download'), sel.getByTestId(tid.btnExportProject).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    const [header, ...lines] = text.trim().split('\r\n');
    expect(header).toContain('博主');
    expect(header).not.toMatch(/displayName|followers/);
    expect(lines.some((line) => line.includes(displayName))).toBe(true);
    await selectContext.close();
  });
});
