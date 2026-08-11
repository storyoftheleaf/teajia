import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer; let browser: Browser; let page: Page; let origin: string;
const row = (overrides = {}) => ({
  id: 'settlement-1', account_id: 'account-a', invoice_id: 'invoice-1', invoice_number: 'INV-1042', line_item_id: 'line-1',
  product_id: 'tea-1', product_name: 'Spring Alishan', stock_owner_user_id: 'stock-owner', stock_owner_name: 'Barry',
  seller_user_id: 'seller', seller_name: 'Rayi', grant_id: 'grant-1', gross_amount: 42.5, owner_amount: 34,
  seller_amount: 8.5, status: 'owed', reversed_at: null, created_at: '2026-08-10T09:30:00Z', updated_at: '2026-08-10T09:30:00Z', ...overrides,
});

beforeAll(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'silent', server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'settlement-ledger-test-page', configureServer(vite) { vite.middlewares.use('/__settlement-ledger-test', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml('/__settlement-ledger-test', '<div id="root"></div><script type="module" src="/src/admin/components/SettlementLedger.behavior.harness.tsx"></script>'));
    }); },
  }] });
  await server.listen();
  const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  origin = `http://127.0.0.1:${address.port}`; browser = await chromium.launch({ headless: true });
}, 30_000);
afterAll(async () => { await browser?.close(); await server?.close(); }, 30_000);
afterEach(async () => { await page?.close(); });
async function open(role: 'owner' | 'staff' = 'owner') {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } }); await page.goto(`${origin}/__settlement-ledger-test`);
  await page.waitForFunction(() => Boolean((window as any).settlementLedgerTest));
  await page.evaluate(value => (window as any).settlementLedgerTest.mount(value), role);
}

describe('SettlementLedger behavior', () => {
  it('renders loading, data and confirmation before an owner marks an owed row paid', async () => {
    await open();
    await expect.poll(() => page.getByRole('status').textContent()).toContain('Loading settlements');
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).settlementLedgerTest.resolveList(0, [value]), row());
    await expect.poll(() => page.getByText('INV-1042', { exact: true }).count()).toBe(1);
    await expect.poll(() => page.getByText('Spring Alishan', { exact: true }).count()).toBe(1);
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await expect.poll(() => page.getByRole('dialog').textContent()).toContain('Confirm settlement payment');
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Cancel');
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Confirm paid');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Cancel');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.getByRole('dialog').count()).toBe(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Mark paid');
    await page.getByRole('button', { name: 'Mark paid' }).click();
    expect(await page.evaluate(() => (window as any).settlementLedgerTest.paidIds())).toEqual([]);
    await page.getByRole('button', { name: 'Confirm paid' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.paidIds())).toEqual(['settlement-1']);
    await expect.poll(() => page.getByRole('button', { name: 'Marking paid' }).isDisabled()).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.getByRole('dialog').count()).toBe(1);
    await page.evaluate(() => (window as any).settlementLedgerTest.resolvePaid(0));
    await expect.poll(() => page.getByText('Settlement marked paid.', { exact: true }).count()).toBe(1);
  });

  it('shows retry and verified empty states, and never offers staff the paid action', async () => {
    await open('staff');
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a']);
    await page.evaluate(() => (window as any).settlementLedgerTest.rejectList(0));
    await expect.poll(() => page.getByRole('alert').textContent()).toContain('could not be loaded');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a', 'account-a']);
    await page.evaluate(() => (window as any).settlementLedgerTest.resolveList(1, []));
    await expect.poll(() => page.getByText('No settlements yet.', { exact: true }).count()).toBe(1);
    await page.evaluate(() => (window as any).settlementLedgerTest.setAccount('account-b', 'staff'));
    await page.evaluate(() => (window as any).settlementLedgerTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toContain('account-b');
    const index = await page.evaluate(() => (window as any).settlementLedgerTest.listAccounts().length - 1);
    await page.evaluate(({ index, value }) => (window as any).settlementLedgerTest.resolveList(index, [value]), { index, value: row({ id: 'settlement-b', account_id: 'account-b' }) });
    expect(await page.getByRole('button', { name: 'Mark paid' }).count()).toBe(0);
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true);
  });

  it('rejects stale list data until the JWT catches up with the active account', async () => {
    await open();
    await page.evaluate(() => (window as any).settlementLedgerTest.setAccount('account-b'));
    await page.evaluate(value => (window as any).settlementLedgerTest.resolveList(0, [value]), row({ product_name: 'Stale tea' }));
    expect(await page.getByText('Stale tea', { exact: true }).count()).toBe(0);
    expect(await page.getByRole('status').textContent()).toContain('Loading settlements');
    await page.evaluate(() => (window as any).settlementLedgerTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a', 'account-b']);
  });

  it('keeps an owed row available after a failed paid mutation', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).settlementLedgerTest.resolveList(0, [value]), row());
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await page.getByRole('button', { name: 'Confirm paid' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.paidIds())).toEqual(['settlement-1']);
    await page.evaluate(() => (window as any).settlementLedgerTest.rejectPaid(0));
    await expect.poll(() => page.getByRole('alert').textContent()).toContain('could not be marked paid');
    expect(await page.getByRole('button', { name: 'Mark paid' }).count()).toBe(1);
  });

  it('does not leak a late paid mutation error into a ready newly active account', async () => {
    await open();
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a']);
    await page.evaluate(value => (window as any).settlementLedgerTest.resolveList(0, [value]), row());
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await page.getByRole('button', { name: 'Confirm paid' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.paidIds())).toEqual(['settlement-1']);
    await page.evaluate(() => (window as any).settlementLedgerTest.setAccount('account-b'));
    await page.evaluate(() => (window as any).settlementLedgerTest.confirmAccount('account-b'));
    await expect.poll(() => page.evaluate(() => (window as any).settlementLedgerTest.listAccounts())).toEqual(['account-a', 'account-b']);
    await page.evaluate(value => (window as any).settlementLedgerTest.resolveList(1, [value]), row({ id: 'settlement-b', account_id: 'account-b', invoice_number: 'INV-B', product_name: 'Account B tea' }));
    await expect.poll(() => page.getByText('Account B tea', { exact: true }).count()).toBe(1);
    await page.evaluate(() => (window as any).settlementLedgerTest.rejectPaid(0));
    await page.waitForTimeout(150);
    expect(await page.getByText('Settlement marked paid.', { exact: true }).count()).toBe(0);
    expect(await page.getByText(/could not be marked paid/i).count()).toBe(0);
  });
});
