import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdirSync } from 'node:fs';

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
    cacheDir: 'node_modules/.vite-quick-invoice-behavior',
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
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
  it('retries the same create key when the first invoice response is lost', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Custom tea', quantity: 5, unit: 'g', price: 2 }] } });
    await page.evaluate(() => (window as any).quickInvoiceTest.loseInvoiceResponse());
    await saveDraft().click();
    await page.getByRole('button', { name: 'Retry save' }).waitFor();
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(1);
    await page.getByPlaceholder('Name or search existing customer…').fill('Edited after timeout');
    await page.evaluate(() => (window as any).quickInvoiceTest.restoreInvoiceResponse());
    await page.getByRole('button', { name: 'Retry save' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(2);
    const calls = await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls());
    expect(calls[0].key).toBe(calls[1].key);
    expect(calls[0].invoice).toEqual(calls[1].invoice);
    expect(calls[0].items).toEqual(calls[1].items);
    expect(await page.evaluate(() => localStorage.getItem('teajia:pending-invoice-create:account-a'))).toBeNull();
  }, 15_000);

  it('recovers the committed invoice after the modal remounts without storing customer details', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Custom tea', quantity: 5, unit: 'g', price: 2 }] } });
    await page.evaluate(() => (window as any).quickInvoiceTest.loseInvoiceResponse());
    await saveDraft().click();
    await page.getByRole('button', { name: 'Retry save' }).waitFor();
    const stored = await page.evaluate(() => localStorage.getItem('teajia:pending-invoice-create:account-a'));
    expect(stored).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(stored).not.toContain('Buyer');
    await page.evaluate(() => (window as any).quickInvoiceTest.mount());
    await page.getByRole('dialog', { name: 'Invoice saved' }).waitFor();
    expect(await page.getByText('Invoice INV-1 was saved').count()).toBe(1);
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(0);
  }, 15_000);

  it('fetches on open and renders only verified active tea suggestions with truthful Teaware copy', async () => {
    await open();
    await expect.poll(() => textOf(page.getByRole('status'))).toContain('Checking eligible sales inventory');
    await page.evaluate(rows => (window as any).quickInvoiceTest.resolveRequest(0, rows), [
      eligible('tea-a'), eligible('tray'), eligible('misc'), eligible('missing'), eligible('draft'), eligible('archived'),
    ]);
    await itemName().focus();
    await expect.poll(() => page.getByText('Account A Tea', { exact: true }).count()).toBe(1);
    expect(await page.getByText('Tea Tray', { exact: true }).count()).toBe(0);
    expect(await page.getByText('Misc Item', { exact: true }).count()).toBe(0);
    expect(await page.getByText('Missing Type', { exact: true }).count()).toBe(0);
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

  it('does not let a malformed eligible row validate a non-tea linked prefill', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Misc Item', productId: 'misc', quantity: 1, price: 2 }] } });
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(0, [row]), eligible('misc'));
    await expect.poll(() => page.getByText(/Unavailable for linked stock/).count()).toBeGreaterThan(0);
    await saveDraft().click();
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('no longer eligible');
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(0);
  });

  it('blocks below-floor linked invoices', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Account A Tea', productId: 'tea-a', quantity: 5, price: 0.2 }] } });
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(0, [row]), eligible('tea-a', { price_floor: 0.3 }));
    await saveDraft().click();
    await expect.poll(() => textOf(page.getByRole('alert'))).toContain('$0.30/g or above');
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(0);

  });

  it('blocks aggregate over-available linked invoices', async () => {
    await open({ prefill: { customerName: 'Buyer', items: [
      { name: 'Account A Tea', productId: 'tea-a', quantity: 7, price: 0.4 },
      { name: 'Account A Tea', productId: 'tea-a', quantity: 6, price: 0.4 },
    ] } });
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

  it('waits for the switched account token and ignores the late old-account response', async () => {
    await open({ accountId: 'account-a' });
    await page.evaluate(() => (window as any).quickInvoiceTest.setAccount('account-b'));
    await expect.poll(() => textOf(page.getByRole('status'))).toContain('Waiting for account authorization');
    expect(await page.evaluate(() => (window as any).quickInvoiceTest.requestScopes())).toEqual([
      { activeAccountId: 'account-a', headerAccountId: 'account-a' },
    ]);
    await page.evaluate(() => (window as any).quickInvoiceTest.setTokenAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).quickInvoiceTest.requestScopes())).toEqual([
      { activeAccountId: 'account-a', headerAccountId: 'account-a' },
      { activeAccountId: 'account-b', headerAccountId: 'account-b' },
    ]);
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(1, [row]), eligible('tea-b'));
    await page.evaluate(row => (window as any).quickInvoiceTest.resolveRequest(0, [row]), eligible('tea-a'));
    await itemName().focus();
    await expect.poll(() => page.getByText('Account B Tea', { exact: true }).count()).toBe(1);
    expect(await page.getByText('Account A Tea', { exact: true }).count()).toBe(0);
  });

  for (const [size, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    it(`keeps the committed invoice when native sharing fails and retries only sharing on ${size}`, async () => {
      await open({ prefill: { customerName: 'Buyer', items: [{ name: 'Custom tea', quantity: 5, unit: 'g', price: 2 }] } });
      await page.setViewportSize(viewport);
      await page.evaluate(() => (window as any).quickInvoiceTest.resolveRequest(0, []));
      await page.evaluate(() => {
        (window as any).shareCalls = 0;
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
          (window as any).shareCalls++;
          if ((window as any).shareCalls === 1) throw new Error('Share unavailable');
        } });
      });
      await page.getByRole('button', { name: 'Save + Share' }).click();
      await page.getByRole('dialog', { name: 'Invoice saved' }).waitFor({ timeout: 20_000 });
      await page.getByRole('alert').waitFor({ timeout: 20_000 });
      const savedMessage = await page.getByRole('alert').innerText();
      expect(await page.evaluate(() => (window as any).shareCalls), savedMessage).toBe(1); // PDF generation reached native sharing.
      expect(savedMessage).toContain('Share unavailable');
      expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(1);
      expect(await page.evaluate(() => (window as any).quickInvoiceTest.toasts().some((toast: any) => toast.message.includes('Invoice creation failed')))).toBe(false);
      mkdirSync('test-results', { recursive: true });
      await page.screenshot({ path: `test-results/invoice-share-failed-${size}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: 'Retry sharing' }).click();
      await expect.poll(() => page.evaluate(() => (window as any).shareCalls)).toBe(2);
      expect(await page.evaluate(() => (window as any).quickInvoiceTest.invoiceCalls().length)).toBe(1);
    });
  }
});
