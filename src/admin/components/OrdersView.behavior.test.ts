import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;
const order = (account: string, invoice: string, customer: string) => ({
  id: `${account}-invoice`, invoice_number: invoice, customer_name: customer, customer_id: null,
  status: 'Pending', payment_status: 'unpaid', payment_method: null, inventory_deducted: false,
  computed_total: 27.5, shipping_cost_usd: 0, display_currency: 'USD', created_at: '2026-08-10T08:00:00Z', notes: null,
});

beforeAll(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'orders-view-test-page', configureServer(vite) { vite.middlewares.use('/__orders-view-test', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml('/__orders-view-test', '<div id="root"></div><script type="module" src="/src/admin/components/OrdersView.behavior.harness.tsx"></script>'));
    }); },
  }] });
  await server.listen(); const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`; browser = await chromium.launch({ headless: true });
}, 30_000);
afterAll(async () => { await browser?.close(); await server?.close(); }, 30_000);
afterEach(async () => { await page?.close(); });
async function open() {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } }); await page.goto(`${origin}/__orders-view-test`);
  await page.waitForFunction(() => Boolean((window as any).ordersViewTest)); await page.evaluate(() => (window as any).ordersViewTest.mount());
}

describe('OrdersView account request behavior', () => {
  it('does not render old orders while the active account waits for its JWT', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.setAccount('account-b'));
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(0, [value]), order('account-a', 'INV-A', 'Account A buyer'));
    expect(await page.getByText('Account A buyer', { exact: true }).count()).toBe(0);
    expect(await page.getByText('Account B buyer', { exact: true }).count()).toBe(0);
    expect(await page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(1, [value]), order('account-b', 'INV-B', 'Account B buyer'));
    await expect.poll(() => page.getByText('Account B buyer', { exact: true }).count()).toBe(2);
    expect(await page.getByText('Account A buyer', { exact: true }).count()).toBe(0);
  });

  it('discards late detail items and timeline from the previous account', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(0, [value]), order('account-a', 'INV-A', 'Account A buyer'));
    await page.getByRole('button', { name: 'INV-A' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.itemAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.setAccount('account-b'));
    await page.evaluate(() => (window as any).ordersViewTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(() => (window as any).ordersViewTest.resolveItems(0, [{ id: 'line-a', custom_name: 'Account A tea', quantity: 1, price_at_sale: 20 }]));
    await page.waitForTimeout(100);
    expect(await page.getByText('Invoice Details', { exact: true }).count()).toBe(0);
    expect(await page.evaluate(() => (window as any).ordersViewTest.timelineAccounts())).toEqual([]);
  });

  it('does not show a late account A timeline while account B detail is loading', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(0, [value]), order('account-a', 'INV-A', 'Account A buyer'));
    await page.getByRole('button', { name: 'INV-A' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.itemAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.resolveItems(0, [{ id: 'line-a', custom_name: 'Account A tea', quantity: 1, price_at_sale: 20 }]));
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.timelineAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.setAccount('account-b'));
    await page.evaluate(() => (window as any).ordersViewTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(1, [value]), order('account-b', 'INV-B', 'Account B buyer'));
    await page.evaluate(() => (window as any).ordersViewTest.resolveTimeline(0, [{ id: 'log-a', action: 'A_ONLY_ACTION', details: 'Account A secret timeline', created_at: '2026-08-10T09:00:00Z' }]));
    await page.getByRole('button', { name: 'INV-B' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.itemAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(() => (window as any).ordersViewTest.resolveItems(1, [{ id: 'line-b', custom_name: 'Account B tea', quantity: 1, price_at_sale: 20 }]));
    await expect.poll(() => page.getByText('Invoice Details', { exact: true }).count()).toBe(1);
    expect(await page.getByText('Account A secret timeline', { exact: true }).count()).toBe(0);
  });
});

describe('accepting a draft that still has a line with no price', () => {
  const draft = () => ({
    id: 'account-a-invoice', invoice_number: 'INV-A', customer_name: 'Account A buyer', customer_id: null,
    status: 'Draft', payment_status: 'unpaid', payment_method: null, inventory_deducted: false,
    computed_total: 0, shipping_cost_usd: 0, display_currency: 'USD',
    created_at: '2026-08-10T08:00:00Z', notes: null,
  });

  async function openDraft() {
    await open();
    await page.evaluate(() => (window as any).ordersViewTest.refuseUnpricedOnce(['Retired Da Hong Pao']));
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(0, [value]), draft());
    await page.getByRole('button', { name: 'INV-A' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.itemAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.resolveItems(0, [
      { id: 'line-a', custom_name: 'Retired Da Hong Pao', quantity: 30, price_at_sale: 0 },
    ]));
    await page.getByRole('button', { name: /Accept & Make Order/i }).click();
  }

  it('asks about it by name instead of reporting a fault', async () => {
    await openDraft();

    // The refusal is a question the operator can answer, so it reaches them as
    // a confirm naming the line, not as a red error toast they cannot act on.
    await expect.poll(() => page.getByRole('button', { name: 'Send anyway' }).count()).toBe(1);
    const dialog = await page.locator('h3', { hasText: 'nothing charged' }).first().textContent();
    expect(dialog).toContain('INV-A');
    expect(await page.getByText('Retired Da Hong Pao').count()).toBeGreaterThan(0);
    expect(await page.getByText('No price set').count()).toBe(1);
  });

  it('sends it only after the operator says so, and says so explicitly', async () => {
    await openDraft();
    await page.getByRole('button', { name: 'Send anyway' }).click();

    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.acceptCalls().length)).toBe(2);
    const calls = await page.evaluate(() => (window as any).ordersViewTest.acceptCalls());
    // The first attempt carried no permission, which is what got it refused.
    expect(calls[0]).toEqual({ status: 'Pending' });
    // The second carries it, and only because a person clicked.
    expect(calls[1]).toEqual({ status: 'Pending', allow_unpriced_lines: true });

    // The dialog closes rather than sitting there mid-send.
    await expect.poll(() => page.getByText('Send INV-A with nothing charged?').count()).toBe(0);
  });

  it('leaves a priced draft alone', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.orderAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).ordersViewTest.resolveOrders(0, [value]), draft());
    await page.getByRole('button', { name: 'INV-A' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.itemAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).ordersViewTest.resolveItems(0, [
      { id: 'line-a', custom_name: 'Da Hong Pao', quantity: 30, price_at_sale: 1 },
    ]));
    await page.getByRole('button', { name: /Accept & Make Order/i }).click();

    await expect.poll(() => page.evaluate(() => (window as any).ordersViewTest.acceptCalls().length)).toBe(1);
    expect(await page.getByText('Send INV-A with nothing charged?').count()).toBe(0);
  });
});
