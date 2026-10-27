import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;
beforeAll(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
    name: 'product-story-behavior', configureServer(vite) { vite.middlewares.use('/__product-story-test', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml('/__product-story-test', '<div id="root"></div><script type="module" src="/src/admin/views/ProductStoryView.behavior.harness.tsx"></script>'));
    }); },
  }] });
  await server.listen(); const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`; browser = await chromium.launch({ headless: true });
}, 30_000);
afterAll(async () => { await browser?.close(); await server?.close(); }, 30_000);
afterEach(async () => { await page?.close(); });
async function open() {
  page = await browser.newPage(); await page.goto(`${origin}/__product-story-test`);
  await page.waitForFunction(() => Boolean((window as any).productStoryTest));
  await expect.poll(async () => (await requests()).filter((r: any) => r.kind === 'detail').length).toBe(1);
}
const requests = () => page.evaluate(() => (window as any).productStoryTest.requests());
const resolve = (index: number, overrides = {}) => page.evaluate(([i, values]) => (window as any).productStoryTest.resolve(i, values), [index, overrides]);
const heading = (name: string) => page.getByText(name, { exact: true });

describe('single-product story data behavior', () => {
  it('loads one product and preserves its mapped price, stock, origin, ledger, events and tasting relationships', async () => {
    await open(); expect(await page.getByText('Loading tea', { exact: true }).count()).toBe(1);
    expect(await requests()).toEqual([{ kind: 'detail', id: 'tea-shared', account: 'account-a', user: 'operator' }]);
    await resolve(0);
    await expect.poll(() => heading('account-a-operator-Tea').count()).toBe(1);
    await expect.poll(() => page.getByText('account-a delivery', { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText('account-a supplier', { exact: true }).count()).toBe(1);
    await expect.poll(() => heading('account-a gathering').count()).toBe(1);
    await expect.poll(() => page.getByText('"account-a floral peaches"', { exact: true }).count()).toBe(1);
    expect(await page.getByText('$0.250', { exact: true }).count()).toBe(1);
    expect(await page.getByText('120g', { exact: true }).count()).toBe(1);
    expect((await requests()).filter((r: any) => r.kind === 'list')).toEqual([]);
    const size = await page.evaluate(() => (window as any).productStoryTest.measurement());
    expect(size.before.items).toBe(96); expect(size.after.items).toBe(1);
    expect(size.after.bytes).toBeLessThan(size.before.bytes / 90);
    console.log('Product story fixture response payload (not billed database rows):', JSON.stringify(size));
  });

  it('does not show late old-account details or reuse another account/user story cache', async () => {
    await open();
    await page.evaluate(() => (window as any).productStoryTest.switchAccount('account-b'));
    await resolve(0);
    expect(await heading('account-a-operator-Tea').count()).toBe(0);
    expect((await requests()).filter((r: any) => r.kind === 'detail')).toHaveLength(1);
    await page.evaluate(() => (window as any).productStoryTest.confirm('account-b'));
    await expect.poll(async () => (await requests()).filter((r: any) => r.kind === 'detail').length).toBe(2);
    await resolve(1);
    await expect.poll(() => heading('account-b-operator-Tea').count()).toBe(1);
    expect(await page.getByText('account-a delivery', { exact: true }).count()).toBe(0);
    await page.evaluate(() => (window as any).productStoryTest.confirm('account-b', 'second-reader'));
    await expect.poll(async () => (await requests()).filter((r: any) => r.kind === 'detail').length).toBe(3);
    expect(await heading('account-b-operator-Tea').count()).toBe(0);
    await resolve(2);
    await expect.poll(() => heading('account-b-second-reader-Tea').count()).toBe(1);
    expect((await requests()).filter((r: any) => r.kind === 'list')).toHaveLength(0);
  });

  it('shows missing products, recovers a failed request and refreshes/navigates without requesting the full inventory', async () => {
    await open(); await page.evaluate(() => (window as any).productStoryTest.reject(0, 503));
    await expect.poll(() => page.getByText('Could not load tea', { exact: true }).count()).toBe(1);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(async () => (await requests()).filter((r: any) => r.kind === 'detail').length).toBe(2);
    await resolve(1);
    await expect.poll(() => heading('account-a-operator-Tea').count()).toBe(1);
    await page.evaluate(() => (window as any).productStoryTest.patchCachedName());
    await expect.poll(() => heading('Updated tea').count()).toBe(1);
    await page.evaluate(() => { void (window as any).productStoryTest.refresh(); });
    await expect.poll(async () => (await requests()).filter((r: any) => r.kind === 'detail').length).toBe(3);
    await resolve(2, { stock_grams: 77 });
    await expect.poll(() => page.getByText('77g', { exact: true }).count()).toBe(1);
    await page.evaluate(() => (window as any).productStoryTest.navigate('/admin/products/missing/story'));
    await expect.poll(async () => (await requests()).filter((r: any) => r.kind === 'detail').length).toBe(4);
    await page.evaluate(() => (window as any).productStoryTest.reject(3, 404));
    await expect.poll(() => page.getByText('Tea not found', { exact: true }).count()).toBe(1);
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect.poll(() => heading('account-a-operator-Tea').count()).toBe(1);
    expect((await requests()).filter((r: any) => r.kind === 'list')).toHaveLength(0);
  });
});
