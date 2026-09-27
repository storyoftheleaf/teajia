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

    it('rejects invalid amounts before writing an intent, then allows correction after definitive server rejection', async () => {
      await open();
      await call('setReceiptUnit', 'unit');
      await call('setMode', 'receipt');
      await page.getByText(/Remaining: 20 unit/).waitFor();
      const quantity = page.getByLabel('Quantity received for Fixture tea');
      const receive = page.getByRole('button', { name: 'Receive', exact: true });
      await quantity.fill('-1');
      expect(await receive.isDisabled()).toBe(true);
      await quantity.fill('1.5');
      expect(await receive.isDisabled()).toBe(true);
      expect(await call('receiveCalls')).toHaveLength(0);
      expect(await call('pendingFor', null)).toBeNull();

      for (const [status, attempted, corrected] of [[400, '5', '4'], [409, '3', '2']] as const) {
        await quantity.fill(attempted);
        await call('rejectNextReceive', status);
        await receive.click();
        await page.getByRole('alert').getByText(`Receive rejected (${status})`).waitFor();
        expect(await call('pendingFor', null)).toBeNull();
        expect(await quantity.isEnabled()).toBe(true);
        await quantity.fill(corrected);
        await receive.click();
        await page.getByText(new RegExp(`Received here: ${status === 400 ? 4 : 6} unit`)).waitFor();
      }
      const calls = await call('receiveCalls') as Array<{ quantity: number; key: string }>;
      expect(calls.map(item => item.quantity)).toEqual([5, 4, 3, 2]);
      expect(new Set(calls.map(item => item.key)).size).toBe(4);
      expect(await call('received')).toBe(6);
    });

    it('ignores a previous account list response after the account changes', async () => {
      await open();
      await call('setAccount', 'account-a');
      await call('deferNextList');
      await call('setMode', 'receipt');
      await expect.poll(() => call('heldLists')).toEqual(['account-a']);
      await call('setAccount', 'account-b');
      await page.getByText('account-b tea').waitFor();
      await call('resolveList', 0);
      await page.getByText('account-b tea').waitFor();
      expect(await page.getByText('account-a tea').count()).toBe(0);
      expect(await page.getByLabel('Quantity received for account-b tea').isEnabled()).toBe(true);
    });

    it('ignores a list response from an earlier visit to the same account', async () => {
      await open();
      await call('setAccount', 'account-a');
      await call('deferNextList');
      await call('setMode', 'receipt');
      await expect.poll(() => call('heldLists')).toEqual(['account-a']);
      await call('setAccount', 'account-b');
      await page.getByText('account-b tea').waitFor();
      await call('setAccount', 'account-a');
      await page.getByText('account-a tea').waitFor();
      await call('resolveList', 0, 'stale account-a tea');
      await page.getByText('account-a tea').waitFor();
      expect(await page.getByText('stale account-a tea').count()).toBe(0);
    });

    it('keeps an in-flight receive scoped to its original account', async () => {
      await open();
      await call('setAccount', 'account-a');
      await call('setMode', 'receipt');
      await page.getByText('account-a tea').waitFor();
      await page.getByLabel('Quantity received for account-a tea').fill('5');
      await call('deferNextReceive');
      await page.getByRole('button', { name: 'Receive', exact: true }).click();
      await expect.poll(() => call('heldReceives')).toBe(1);
      expect(await call('pendingFor', 'account-a')).not.toBeNull();
      await call('setAccount', 'account-b');
      await page.getByText('account-b tea').waitFor();
      await call('resolveReceive', 0);
      await expect.poll(() => call('receivedFor', 'account-a')).toBe(5);
      expect(await page.getByText('account-a tea').count()).toBe(0);
      expect(await page.getByText(/Received here: 0 g · Remaining: 20 g/).count()).toBe(1);
      expect(await call('pendingFor', 'account-a')).not.toBeNull();
      expect(await call('pendingFor', 'account-b')).toBeNull();
      expect(await page.getByRole('button', { name: 'Receive', exact: true }).isEnabled()).toBe(true);
    });

    it('does not let an earlier visit confirm a pending receive after switching away and back', async () => {
      await open();
      await call('setAccount', 'account-a');
      await call('setMode', 'receipt');
      await page.getByText('account-a tea').waitFor();
      await call('deferNextReceive');
      await page.getByRole('button', { name: 'Receive', exact: true }).click();
      await expect.poll(() => call('heldReceives')).toBe(1);
      await call('setAccount', 'account-b');
      await page.getByText('account-b tea').waitFor();
      await call('setAccount', 'account-a');
      await page.getByRole('button', { name: 'Retry Receive' }).waitFor();
      await call('resolveReceive', 0);
      await expect.poll(() => call('receivedFor', 'account-a')).toBe(20);
      const pending = JSON.parse(await call('pendingFor', 'account-a') as string);
      expect(pending.confirmed).toBe(false);
      expect(await page.getByRole('button', { name: 'Retry Receive' }).isEnabled()).toBe(true);
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
