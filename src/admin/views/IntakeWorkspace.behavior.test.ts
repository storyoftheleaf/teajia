import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/**
 * Item 4: a cost refusal must reach the operator in plain words, and nothing
 * catches it if that call is quietly removed. This drives the actual bulk
 * intake flow in a real browser (file upload, "Add to inventory" click, the
 * server's skipped-row response) and asserts on the toast that lands, so
 * deleting the `plainCostWords(...)` call at this call site fails this test.
 */
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false },
    plugins: [{
      name: 'intake-workspace-test-page',
      configureServer(vite) {
        vite.middlewares.use('/__intake-workspace-test', async (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/__intake-workspace-test',
            '<div id="root"></div><script type="module" src="/src/admin/views/IntakeWorkspace.behavior.harness.tsx"></script>'));
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => { await browser?.close(); await server?.close(); }, 30_000);
afterEach(async () => { await page?.close(); });

async function open() {
  page = await browser.newPage();
  await page.goto(`${origin}/__intake-workspace-test`);
  await page.waitForFunction(() => Boolean((window as any).intakeWorkspaceTest));
  await page.evaluate(() => (window as any).intakeWorkspaceTest.mount());
}

describe('IntakeWorkspace cost refusal in plain words', () => {
  it('shows the operator plain words, not the raw server marker, when a line is skipped for its cost', async () => {
    await open();
    await page.evaluate(() => (window as any).intakeWorkspaceTest.setBulkCreateResult({
      inserted: 0, skipped: 1,
      results: [{ status: 'skipped', reason: 'cost_amount (missing: amount)' }],
    }));

    const csv = 'Product Name,Type\nTest Tea,Oolong\n';
    await page.setInputFiles('input[type="file"]', {
      name: 'intake.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
    });
    await expect.poll(() => page.getByRole('button', { name: /to inventory/ }).count(),
      { message: 'the row never staged, so the commit button never appeared' }).toBeGreaterThan(0);
    await page.getByRole('button', { name: /to inventory/ }).click();

    await expect.poll(() => page.getByText(
      'What did this cost? Enter the price, or 0 if it was a gift.', { exact: false },
    ).count(), { message: 'the operator-facing plain-words sentence never reached the toast' }).toBeGreaterThan(0);
    expect(await page.getByText('(missing: amount)').count(),
      'the raw server marker leaked onto the screen instead of the plain-words sentence').toBe(0);
  });

  it('retries a failed purchase record without creating inventory products again or closing the draft early', async () => {
    await open();
    await page.evaluate(() => {
      (window as any).intakeWorkspaceTest.setBulkCreateResult({ inserted: 1, skipped: 0, results: [] });
      (window as any).intakeWorkspaceTest.failPurchase();
    });
    const csv = 'Product Name,Type,Cost Amount,Cost Currency,Vendor,Quantity Purchased\nTest Tea,Oolong,5,USD,Lin,10\n';
    await page.setInputFiles('input[type="file"]', { name: 'intake.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: /Add 1 to inventory/ }).click();
    await page.getByRole('button', { name: /Retry 1 purchase record/ }).waitFor();
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.bulkCalls())).toBe(1);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.purchaseCalls().length)).toBe(1);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(0);
    await page.getByRole('button', { name: 'Clear all' }).click();
    expect(await page.getByRole('button', { name: /Retry 1 purchase record/ }).isDisabled()).toBe(true);
    await page.getByLabel('I checked Purchase Orders for these vendors and found no matching record.').check();
    await expect.poll(() => page.getByRole('button', { name: /Retry 1 purchase record/ }).isEnabled()).toBe(true);
    await page.getByRole('button', { name: /Retry 1 purchase record/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).intakeWorkspaceTest.purchaseCalls().length)).toBe(2);
    expect(await page.evaluate(() => (window as any).intakeWorkspaceTest.bulkCalls())).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as any).intakeWorkspaceTest.abandonCalls())).toBe(1);
  });
});
