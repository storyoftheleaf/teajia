import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/**
 * Item 4: a cost refusal must reach the operator in plain words, and nothing
 * catches it if that call is quietly removed. `plainCostWords` itself is
 * unit-tested in `costRefusalWords.test.ts`; this drives the actual import
 * flow in a real browser (file upload, "Import Ready" click, the server's
 * skipped-row response) and asserts on what lands on screen, so deleting the
 * `plainCostWords(...)` call at this call site fails this test.
 */
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'csv-import-modal-test-page',
      configureServer(vite) {
        vite.middlewares.use('/__csv-import-modal-test', async (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(await vite.transformIndexHtml('/__csv-import-modal-test',
            '<div id="root"></div><script type="module" src="/src/admin/components/CsvImportModal.behavior.harness.tsx"></script>'));
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
  await page.goto(`${origin}/__csv-import-modal-test`);
  await page.waitForFunction(() => Boolean((window as any).csvImportModalTest));
  await page.evaluate(() => (window as any).csvImportModalTest.mount());
}

describe('CsvImportModal cost refusal in plain words', () => {
  it('shows the operator plain words, not the raw server marker, for a row the server skipped', async () => {
    await open();
    await page.evaluate(() => (window as any).csvImportModalTest.setBulkCreateResult({
      results: [{ client_row_id: 'row-0', status: 'skipped', reason: 'cost_amount (missing: amount)' }],
    }));

    const csv = 'Product Name,Type\nTest Tea,Oolong\n';
    await page.setInputFiles('input[type="file"]', {
      name: 'intake.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
    });
    await expect.poll(() => page.getByRole('button', { name: /Import Ready/ }).count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: /Import Ready/ }).click();

    // The desktop review table shows the reason as the issue icon's title
    // (row.errors.join(', ')), not as always-visible text, so read that
    // attribute rather than searching rendered text nodes for it.
    await expect.poll(() => page.locator('td div[title]').count(),
      { message: 'the skipped row never grew an issue marker' }).toBeGreaterThan(0);
    const reason = await page.locator('td div[title]').first().getAttribute('title');
    expect(reason, 'the operator-facing plain-words sentence never reached the row')
      .toContain('What did this cost? Enter the price, or 0 if it was a gift.');
    expect(reason, 'the raw server marker leaked onto the screen instead of the plain-words sentence')
      .not.toContain('(missing: amount)');
  });
});
