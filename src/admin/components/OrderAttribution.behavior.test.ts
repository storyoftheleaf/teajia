import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;

const detail = (seller: string) => ({
  invoice_id: 'invoice-1', seller_name: seller, payment_recipient_name: 'Teajia', fulfilled_by_name: null,
  payment_recipient_kind: 'account', fulfilled_at: null, settlement_visibility: 'full', items: [],
});

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'order-attribution-behavior-page',
      configureServer(vite) {
        vite.middlewares.use('/__order-attribution-test', async (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end(await vite.transformIndexHtml('/__order-attribution-test', '<div id="root"></div><script type="module" src="/src/admin/components/OrderAttribution.behavior.harness.tsx"></script>'));
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Vite test server did not expose a port');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => { await browser?.close(); await server?.close(); });
afterEach(async () => { await page?.close(); });

async function open() {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${origin}/__order-attribution-test`);
  await page.waitForFunction(() => Boolean((window as any).orderAttributionTest));
  await page.evaluate(() => (window as any).orderAttributionTest.mount());
}

describe('OrderAttribution request behavior', () => {
  it('shows an inline error and retries', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).orderAttributionTest.requestAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).orderAttributionTest.reject(0));
    await expect.poll(() => page.getByRole('alert').textContent()).toContain('Sales attribution could not be loaded');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).orderAttributionTest.requestAccounts())).toEqual(['account-a', 'account-a']);
  });

  it('ignores a late response after the active account changes', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).orderAttributionTest.requestAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).orderAttributionTest.setAccount('account-b'));
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => (window as any).orderAttributionTest.requestAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).orderAttributionTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).orderAttributionTest.requestAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(value => (window as any).orderAttributionTest.resolve(1, value), detail('Barry'));
    await expect.poll(() => page.getByText('Barry', { exact: true }).count()).toBe(1);
    await page.evaluate(value => (window as any).orderAttributionTest.resolve(0, value), detail('Rayi'));
    await expect.poll(() => page.getByText('Rayi', { exact: true }).count()).toBe(0);
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
