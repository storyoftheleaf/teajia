import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', cacheDir: '/tmp/teajia-partner-listing-vite-cache',
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    plugins: [{ name: 'partner-listing-delay-page', configureServer(vite) {
      vite.middlewares.use('/__partner-listing-delay-test', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__partner-listing-delay-test', '<div id="root"></div><script type="module" src="/src/admin/views/PartnerListingEdit.delayed.harness.tsx"></script>'));
      });
    } }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No Vite test port');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30_000);
afterAll(async () => { await browser?.close(); await server?.close(); });
afterEach(async () => { await page?.close(); });

const patches = () => page.evaluate(() => window.partnerListingTest.patches());
const settle = (method: 'resolve' | 'reject', index: number) => page.evaluate(([name, i]) => window.partnerListingTest[name](i), [method, index] as const);

describe('partner listing saves with delayed responses', () => {
  const open = async () => {
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${origin}/__partner-listing-delay-test`);
    await page.waitForFunction(() => Boolean(window.partnerListingTest));
  };

  it('holds a field during its first save, then accepts and persists a second edit', async () => {
    await open();
    const stock = page.getByLabel('Stock');
    await stock.fill('11');
    await stock.blur();
    await expect.poll(patches).toEqual([{ stock_grams: 11 }]);
    expect(await stock.isDisabled()).toBe(true);
    await settle('resolve', 0);
    await expect.poll(() => stock.isEnabled()).toBe(true);

    await stock.fill('12');
    await stock.blur();
    await expect.poll(patches).toEqual([{ stock_grams: 11 }, { stock_grams: 12 }]);
    expect(await stock.isDisabled()).toBe(true);
    await settle('resolve', 1);
    await expect.poll(() => stock.isEnabled()).toBe(true);
  });

  it('retries the latest note after a failed save, not the value held by the failed request', async () => {
    await open();
    const note = page.getByPlaceholder('Your voice on this tea. Shown above the curator\'s description on your storefront.');
    await note.fill('First note');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect.poll(patches).toEqual([{ store_note: 'First note' }]);
    expect(await note.isDisabled()).toBe(true);
    await settle('reject', 0);
    await page.getByRole('button', { name: 'Retry save' }).waitFor();
    await expect.poll(() => note.isEnabled()).toBe(true);

    await note.fill('Latest note');
    await page.getByRole('button', { name: 'Retry save' }).click();
    await expect.poll(patches).toEqual([{ store_note: 'First note' }, { store_note: 'Latest note' }]);
    await settle('resolve', 1);
    await expect.poll(() => note.isEnabled()).toBe(true);
  });
});
