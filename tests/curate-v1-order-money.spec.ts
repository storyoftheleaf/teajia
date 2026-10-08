/**
 * Curate v1 (/admin/compass): what a purchase order SENDS. The same money rules
 * Curate v2 is held to in curate-v2-requests.spec.ts: total_usd is dollars or
 * absent, never the order's own money; one order is one money; "Mark as Sent"
 * names the order the shop recorded.
 */
import { test, expect, type Page } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

type Sent = { method: string; path: string; body: any };
function record(page: Page): Sent[] {
  const sent: Sent[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET') return;
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/purchase-orders')) return;
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    sent.push({ method: req.method(), path: url.pathname, body });
  });
  return sent;
}
const posted = (sent: Sent[]) => sent.filter((s) => s.method === 'POST').map((s) => s.body);

const RATES = [
  { currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() },
  { currency: 'Yuan', rate_to_usd: 7.1, last_updated: new Date().toISOString() },
  { currency: 'NT', rate_to_usd: 32, last_updated: new Date().toISOString() },
];

/**
 * Add each tea to the Ledger through its own Buy panel, one fresh page per tea
 * (the card keeps its "Added to Ledger" note when it switches tea). The ledger
 * is kept in localStorage, so the drafts carry across the reloads.
 */
async function buyThroughCaptureCard(page: Page, teas: Array<Record<string, unknown>>) {
  for (const [index, tea] of teas.entries()) {
    if (index > 0) await openCompass(page);
    await page.evaluate(async ({ list, id }) => {
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      const entries = list.map((t) => ({ ...createEmptyEntry('tea'), status: 'noted', vendorName: 'Wang Laoshi', vendorId: 'vendor-wang', form: 'Cake', ...t }));
      useTeaCompassStore.setState({ entries, pendingEntries: [], activeEntryId: id });
    }, { list: teas, id: tea.id as string });
    await page.getByRole('button', { name: /Buy/ }).last().click();
    await page.getByRole('spinbutton').last().fill('2');
    await page.getByRole('button', { name: 'Add to Ledger' }).click();
    await expect(page.getByText('Inventory changes only after you accept this receipt.')).toBeVisible();
  }
}

async function openLedger(page: Page) {
  await page.goto('/admin/compass?tab=buying', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tablist', { name: 'Screen' }).getByRole('tab', { name: 'Ledger', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}

test.describe('Curate v1 purchase orders: the money they send', () => {
  test.beforeEach(async ({}, testInfo) => { test.skip(testInfo.project.name !== 'Mobile Chrome', 'phone only'); });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('a vendor sold in two moneys gets one order in each, recorded in dollars, and Mark as Sent names the shop\'s order', async ({ page }) => {
    await installCompassHarness(page, { rates: RATES, customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] }] });
    const sent = record(page);
    await openCompass(page);
    await buyThroughCaptureCard(page, [
      { id: 'v1-yuan', name: 'Mengku Laobanzhang', priceAmount: 450, priceCurrency: 'Yuan' },
      { id: 'v1-nt', name: 'Alishan Oolong', priceAmount: 1800, priceCurrency: 'NT' },
    ]);

    // Two drafts, not one ¥2,250 order.
    const drafts = await page.evaluate(async () => {
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      return useLedgerStore.getState().transactions.map((tx) => ({ currency: tx.currency, lines: tx.items.map((i) => i.currency) }));
    });
    expect(drafts).toHaveLength(2);
    for (const d of drafts) expect(d.lines.every((c) => c === d.currency)).toBe(true);

    await openLedger(page);
    const confirmButtons = page.getByRole('button', { name: 'Purchase', exact: true });
    await expect(confirmButtons).toHaveCount(2);
    await confirmButtons.first().click();
    await expect.poll(() => posted(sent).length).toBe(1);
    await page.getByRole('button', { name: 'Purchase', exact: true }).first().click();
    await expect.poll(() => posted(sent).length).toBe(2);

    const orders = posted(sent);
    const yuanPo = orders.find((o) => o.display_currency === 'Yuan')!;
    const ntPo = orders.find((o) => o.display_currency === 'NT')!;
    // ¥450 × 2 is $126.76, not $900; NT$1,800 × 2 is $112.50, not $3,600.
    expect(yuanPo.total_usd).toBeCloseTo(900 / 7.1, 2);
    expect(ntPo.total_usd).toBeCloseTo(3600 / 32, 2);
    for (const po of orders) {
      expect(po.vendor_id).toBe('vendor-wang');
      for (const item of JSON.parse(po.items_json)) expect(item.currency).toBe(po.display_currency);
    }

    // Mark as Sent names the order by the id the shop gave it, not a slice of the local id.
    await page.getByRole('button', { name: 'Mark as Sent' }).first().click();
    await expect(page.getByRole('button', { name: 'Sent' }).first()).toBeVisible();
    const put = sent.find((s) => s.method === 'PUT')!;
    expect(put.path).toBe('/api/purchase-orders/po-created');
    expect(put.body).toEqual({ status: 'sent' });
  });

  test('a tea with no price yet is sent as a blank and the order\'s dollar total is left out, not understated', async ({ page }) => {
    await installCompassHarness(page, { rates: RATES, customers: [{ id: 'vendor-wang', name: 'Wang Laoshi', tags: ['vendor'] }] });
    const sent = record(page);
    await openCompass(page);
    await buyThroughCaptureCard(page, [
      { id: 'p-priced', name: 'Mengku Laobanzhang', priceAmount: 450, priceCurrency: 'Yuan' },
      { id: 'p-blank', name: 'Priceless Cake', priceAmount: undefined, priceCurrency: 'Yuan' },
    ]);
    await openLedger(page);
    await page.getByRole('button', { name: 'Purchase', exact: true }).click();
    await expect.poll(() => posted(sent).length).toBe(1);
    const po = posted(sent)[0];
    expect(po.total_usd).toBeUndefined();
    const items = JSON.parse(po.items_json);
    expect(items.find((i: any) => i.name === 'Priceless Cake').pricePerUnit).toBeNull();
    expect(items.find((i: any) => i.name === 'Mengku Laobanzhang').pricePerUnit).toBe(450);
  });

  test('a currency the shop has no rate for leaves total_usd out instead of reading it at 1', async ({ page }) => {
    await installCompassHarness(page, { rates: RATES.filter((r) => r.currency !== 'Yuan') });
    const sent = record(page);
    await openCompass(page);
    await buyThroughCaptureCard(page, [{ id: 'r-1', name: 'Mengku Laobanzhang', priceAmount: 450, priceCurrency: 'Yuan' }]);
    await openLedger(page);
    await page.getByRole('button', { name: 'Purchase', exact: true }).click();
    await expect.poll(() => posted(sent).length).toBe(1);
    expect(posted(sent)[0].total_usd).toBeUndefined();
  });

  test('an older draft holding two moneys shows each on its own, never ¥ and NT$ summed under one symbol', async ({ page }) => {
    await installCompassHarness(page, { rates: RATES });
    await openCompass(page);
    await page.evaluate(async () => {
      const { useLedgerStore } = await import('/src/lib/ledgerStore.ts');
      const now = new Date().toISOString();
      const line = (id: string, name: string, pricePerUnit: number, currency: string) => ({ id, addedAt: now, name, quantityUnits: 1, pricePerUnit, priceIsPerGram: false, currency });
      useLedgerStore.setState({
        transactions: [{
          id: 'legacy-mixed', direction: 'purchase', counterpartyName: 'Wang Laoshi', status: 'draft', currency: 'Yuan',
          createdAt: now, updatedAt: now, photos: [],
          items: [line('a', 'Mengku Laobanzhang', 450, 'Yuan'), line('b', 'Alishan Oolong', 1800, 'NT')],
        }] as never,
        activeTransactionId: null,
      });
    });
    await openLedger(page);
    const total = page.getByRole('tabpanel').getByLabel('Grand total');
    await expect(total).toContainText('CN¥450.00 + NT$1,800');
    await expect(page.getByText('CN¥2,250.00')).toHaveCount(0);
  });
});
