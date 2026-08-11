import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;

const eligible = (productId: string, overrides: Record<string, unknown> = {}) => ({
  product_id: productId, product_name: productId, owner_id: null, owner_name: null,
  physical_quantity: 50, held_quantity: 0, available_quantity: 50, price_floor: null,
  grant_id: null, permission_reason: 'account_owner', ...overrides,
});

beforeAll(async () => {
  server = await createServer({
    root: process.cwd(),
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'quick-invoice-behavior-page',
      configureServer(vite) {
        vite.middlewares.use('/__quick-invoice-test', async (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end(await vite.transformIndexHtml('/__quick-invoice-test', '<div id="root"></div><script type="module" src="/src/admin/components/QuickInvoiceModal.behavior.harness.tsx"></script>'));
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

async function open(options: Record<string, unknown> = {}) {
  page = await browser.newPage();
  await page.goto(`${origin}/__quick-invoice-test`);
  await page.waitForFunction(() => Boolean((window as any).quickInvoiceTest));
  await page.evaluate(value => (window as any).quickInvoiceTest.mount(value), options);
  await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.requestAccounts())).toEqual([options.accountId || 'account-a']);
}

const itemName = () => page.locator('input[placeholder="Name this item…"]').first();
const saveDraft = () => page.getByRole('button', { name: 'Save draft' });
const textOf = async (locator: ReturnType<Page['locator']>) => (await locator.allTextContents()).join(' ');

describe('QuickInvoiceModal linked sales behavior', () => {
  it('fetches on open and renders only verified active tea suggestions with truthful Teaware copy', async () => {
    await open();
    await expect.poll(() => textOf(page.getByRole('status'))).toContain('Checking eligible sales inventory');
    await page.evaluate(rows => (window as any).quickInvoiceTest.resolveRequest(0, rows), [eligible('tea-a'), eligible('tray'), eligible('draft'), eligible('archived')]);
    await itemName().focus();
    await expect.poll(() => page.getByText('Account A Tea', { exact: true }).count()).toBe(1);
    expect(await page.getByText('Tea Tray', { exact: true }).count()).toBe(0);
    expect(await page.getByText('Draft Tea', { exact: true }).count()).toBe(0);
    expect(await page.getByText('Archived Tea', { exact: true }).count()).toBe(0);
    await expect.poll(() => page.getByText(/Teaware.*custom/i).count()).toBeGreaterThan(0);
  });

  it('shows an alert and retries after an eligibility error', async () => {
    await open();
    await page.evaluate(() => (window as any).quickInvoiceTest.rejectRequest(0));
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('Sales inventory unavailable');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.requestAccounts())).toEqual(['account-a', 'account-a']);
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(1, [row]), eligible('tea-a'));
    await itemName().focus();
    await expect.poll(() => page.getByText('Account A Tea', { exact: true }).count()).toBe(1);
  });

  it('keeps stale linked prefill unavailable and blocks invoice creation', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Old Tea', productId: 'old-tea', quantity: 5, price: 0.4 }] } });
    await page.evaluate(() => (window as any).quickInvoiceTest.resolveRequest(0, []));
    await expect.poll(() => textOf(page.getByRole('status'))).toContain('No eligible linked tea inventory');
    await expect.poll(() => page.getByText(/Unavailable for linked stock/).count()).toBeGreaterThan(0);
    await saveDraft().click();
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('no longer eligible');
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(0);
  });

  it('blocks below-floor and aggregate over-available linked invoices', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Account A Tea', productId: 'tea-a', quantity: 5, price: 0.2 }] } });
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(0, [row]), eligible('tea-a', { price_floor: 0.3 }));
    await saveDraft().click();
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('$0.30/g or above');
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(0);

    await page.evaluate(() => (window as any).quickInvoiceTest.mount({ accountId: 'account-a', prefill: { customerName: 'Buyer', items: [
      { name: 'Account A Tea', productId: 'tea-a', quantity: 7, price: 0.4 },
      { name: 'Account A Tea', productId: 'tea-a', quantity: 6, price: 0.4 },
    ] } }));
    await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.requestAccounts())).toEqual(['account-a']);
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(0, [row]), eligible('tea-a', { available_quantity: 12 }));
    await saveDraft().click();
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('links 13g');
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(0);
  });

  it('allows custom free-text creation during eligibility failure without a product link', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Tea Tray (custom)', quantity: 1, unit: 'pcs', price: 20 }] } });
    await page.evaluate(() => (window as any).quickInvoiceTest.rejectRequest(0));
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('Sales inventory unavailable');
    await saveDraft().click();
    await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(1);
    const items = await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls()[0].items);
    expect(items).toEqual([expect.objectContaining({ product_id: null, custom_name: 'Tea Tray (custom)' })]);
  });

  it('clears eligibility on account switch and ignores the late old-account response', async () => {
    await open({ accountId: 'account-a' });
    await page.evaluate(() => (window as any).quickInvoiceTest.setAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.requestAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(1, [row]), eligible('tea-b'));
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(0, [row]), eligible('tea-a'));
    await itemName().focus();
    await expect.poll(() => page.getByText('Account B Tea', { exact: true }).count()).toBe(1);
    expect(await page.getByText('Account A Tea', { exact: true }).count()).toBe(0);
  });
});
