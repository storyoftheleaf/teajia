import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;
beforeAll(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 17809, strictPort: false }, plugins: [{
    name: 'product-demand-test', configureServer(vite) { vite.middlewares.use('/__product-demand-test', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml('/__product-demand-test', '<div id="root"></div><script type="module" src="/src/admin/hooks/useAdminData.behavior.harness.tsx"></script>'));
    }); },
  }] });
  await server.listen(); const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`; browser = await chromium.launch({ headless: true });
}, 30_000);
afterAll(async () => { await browser?.close(); await server?.close(); }, 30_000);
afterEach(async () => { await page?.close(); });
async function open() {
  page = await browser.newPage(); await page.goto(`${origin}/__product-demand-test`);
  await page.waitForFunction(() => Boolean((window as any).productDemandTest));
}
const calls = () => page.evaluate(() => (window as any).productDemandTest.calls());
describe('inventory demand and refresh behavior', () => {
  it('does not load settings; opens the command palette on demand and shares one list with Stock and Dashboard', async () => {
    await open(); expect((await calls()).lists).toBe(0);
    await page.evaluate(() => (window as any).productDemandTest.overlay(true));
    await expect.poll(() => page.getByTestId('rows').textContent()).toBe('a:10,b:10');
    await page.getByPlaceholder('Search products, customers, events...').fill('a');
    await expect.poll(() => page.locator('[cmdk-item]').filter({ has: page.getByText('a', { exact: true }) }).count()).toBe(1);
    await page.evaluate(() => { (window as any).productDemandTest.overlay(false); (window as any).productDemandTest.navigate('/admin/stock'); });
    await page.evaluate(() => (window as any).productDemandTest.ensure());
    await page.evaluate(() => (window as any).productDemandTest.navigate('/admin/dashboard'));
    expect((await calls()).lists).toBe(1);
  });
  it('keeps independently mounted consumers working when the shell does not need products', async () => {
    await open(); await page.evaluate(() => (window as any).productDemandTest.navigate('/admin/people'));
    await expect.poll(() => page.getByTestId('child').textContent()).toBe('a,b');
    expect((await calls()).lists).toBe(1);
  });
  it('reconciles a movement and deletion without list reloads, and preserves intentional manual refresh', async () => {
    await open(); await page.evaluate(() => (window as any).productDemandTest.navigate('/admin/stock'));
    await expect.poll(() => page.getByTestId('rows').textContent()).toBe('a:10,b:10');
    await page.evaluate(() => (window as any).productDemandTest.refresh(['a', 'a']));
    await expect.poll(() => page.getByTestId('rows').textContent()).toBe('a:50,b:10');
    expect(await calls()).toEqual({ lists: 1, rows: ['a'] });
    await page.evaluate(() => (window as any).productDemandTest.remove('a'));
    await expect.poll(() => page.getByTestId('rows').textContent()).toBe('b:10');
    expect((await calls()).lists).toBe(1);
    await page.evaluate(() => (window as any).productDemandTest.fullRefresh());
    await expect.poll(() => page.getByTestId('rows').textContent()).toBe('a:10,b:10');
    expect((await calls()).lists).toBe(2);
  });
});
