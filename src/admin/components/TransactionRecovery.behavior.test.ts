import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdirSync } from 'node:fs';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'silent', cacheDir: 'node_modules/.vite-transaction-recovery', server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    plugins: [{ name: 'transaction-recovery-page', configureServer(vite) {
      vite.middlewares.use('/__transaction-recovery-test', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__transaction-recovery-test', '<div id="root"></div><script type="module" src="/src/admin/components/TransactionRecovery.behavior.harness.tsx"></script>'));
      });
    } }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Vite test server did not expose a port');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  mkdirSync('test-results', { recursive: true });
}, 30_000);
afterAll(async () => { await browser?.close(); await server?.close(); });
afterEach(async () => { await page?.close(); });

const call = (method: string, ...args: unknown[]) => page.evaluate(([name, values]) => (window as any).recoveryTest[name](...values), [method, args] as const);
const rows = (name: string) => [{ id: `${name}-line`, product_id: `${name}-tea`, product_name: `${name} Tea`, given_name: `${name} Tea`, quantity: 5, price_at_sale: 2 }];

for (const [size, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
  describe(`transaction recovery on ${size}`, () => {
    const open = async () => {
      page = await browser.newPage({ viewport });
      await page.goto(`${origin}/__transaction-recovery-test`);
      await page.waitForFunction(() => Boolean((window as any).recoveryTest));
    };

    it('never sends A lines when B fails or when A responds after B', async () => {
      await open();
      await expect.poll(() => call('requests')).toEqual(['A']);
      await call('resolveOrder', 0, rows('A'));
      await page.getByText('A Tea').waitFor();
      await call('setInvoiceId', 'B');
      await expect.poll(() => call('requests')).toEqual(['A', 'B']);
      await call('rejectOrder', 1);
      await page.getByRole('button', { name: 'Retry loading items' }).waitFor();
      expect(await page.getByRole('button', { name: 'Save Changes' }).isDisabled()).toBe(true);
      await page.screenshot({ path: `test-results/order-load-failed-${size}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: 'Retry loading items' }).click();
      await expect.poll(() => call('requests')).toEqual(['A', 'B', 'B']);
      await call('resolveOrder', 2, rows('B'));
      await page.getByText('B Tea').waitFor();
      await call('setInvoiceId', 'A');
      await expect.poll(() => call('requests')).toEqual(['A', 'B', 'B', 'A']);
      await call('setInvoiceId', 'B');
      await expect.poll(() => call('requests')).toEqual(['A', 'B', 'B', 'A', 'B']);
      await call('resolveOrder', 4, rows('B'));
      await call('resolveOrder', 3, rows('A'));
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect.poll(() => call('orderWrites')).toHaveLength(1);
      expect(await call('orderWrites')).toEqual([{ id: 'B', body: expect.objectContaining({ lineItems: [expect.objectContaining({ product_id: 'B-tea' })] }) }]);
    });

    it('blocks a second receive after commit until a failed refresh recovers', async () => {
      await open();
      await call('setMode', 'receipt');
      await page.getByText(/Remaining: 20 g/).waitFor();
      await page.getByLabel('Quantity received for Fixture tea').fill('5');
      await call('setListFailure', true);
      await page.getByRole('button', { name: 'Receive' }).click();
      await page.getByRole('alert').getByText(/Stock was received/).waitFor();
      expect(await page.getByRole('button', { name: 'Receive' }).isDisabled()).toBe(true);
      expect(await call('receiveCalls')).toHaveLength(1);
      await page.screenshot({ path: `test-results/receipt-refresh-failed-${size}.png`, animations: 'disabled' });
      await call('setListFailure', false);
      await page.getByRole('button', { name: 'Try again' }).click();
      await page.getByText(/Received here: 5 g · Remaining: 15 g/).waitFor();
      expect(await call('receiveCalls')).toHaveLength(1);
    });

    it('retries an uncertain receive with the original key and quantity', async () => {
      await open();
      await call('setMode', 'receipt');
      await page.getByText(/Remaining: 20 g/).waitFor();
      await page.getByLabel('Quantity received for Fixture tea').fill('5');
      await call('failNextReceiveResponse');
      await page.getByRole('button', { name: 'Receive' }).click();
      await page.getByRole('alert').getByText(/Could not confirm whether stock was received/).waitFor();
      expect(await page.getByLabel('Quantity received for Fixture tea').isDisabled()).toBe(true);
      await call('setMode', 'order');
      await call('setMode', 'receipt');
      await page.getByRole('alert').getByText(/not been confirmed/).waitFor();
      await page.getByRole('button', { name: 'Retry Receive' }).click();
      await page.getByText(/Received here: 5 g · Remaining: 15 g/).waitFor();
      const calls = await call('receiveCalls') as Array<{ key: string; quantity: number }>;
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual(calls[0]);
      expect(await call('received')).toBe(5);
    });

    it('can reconcile a lost response after receiving the entire line', async () => {
      await open();
      await call('setMode', 'receipt');
      await page.getByText(/Remaining: 20 g/).waitFor();
      await call('failNextReceiveResponse');
      await page.getByRole('button', { name: 'Receive' }).click();
      await page.getByRole('alert').getByText(/Could not confirm whether stock was received/).waitFor();
      await page.getByRole('button', { name: 'Retry Receive' }).click();
      await page.getByText(/Received here: 20 g · Remaining: 0 g/).waitFor();
      const calls = await call('receiveCalls') as Array<{ key: string; quantity: number }>;
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual(calls[0]);
      expect(await call('received')).toBe(20);
    });

    it('retries an unchanged partner listing value after a failed save', async () => {
      await open();
      await call('setMode', 'listing');
      await call('failListing');
      const stock = page.getByRole('spinbutton', { name: /Stock/ });
      await stock.fill('25');
      await stock.blur();
      await page.getByRole('button', { name: 'Retry save' }).waitFor();
      await page.screenshot({ path: `test-results/listing-save-failed-${size}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: 'Retry save' }).click();
      await expect.poll(() => call('listingCalls')).toHaveLength(2);
      expect(await call('listingCalls')).toEqual([{ stock_grams: 25 }, { stock_grams: 25 }]);
      await page.getByRole('status').getByText(/Saved/).waitFor();
    });
  });
}
