/**
 * Samples on the phone look and work like Stock: grouped by supplier, one slim
 * row per tea, a sheet on tap. − logs a tasting (5 g already typed), tapping the
 * grams weighs the portion, and Save sends the change and confirms it.
 */

import { test, expect, type Page } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/samples-phone');

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

async function openSamples(page: Page) {
  // Samples is a view of the one Stock list, picked from the same menu as Working or Personal.
  await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Choose which teas to show/ }).click();
  await page.getByRole('menuitem', { name: 'Samples', exact: true }).click();
}

const HOLDINGS = [
  {
    entry: { id: 'tea-a', name: '1958 Aged Raw', type: 'Sheng Puer', year: 1958, vendor_name: 'Boyuan Tea Shop', vendor_id: 'v1', price_amount: 900, price_currency: 'Yuan', price_per_unit_grams: 357, origin_region: 'Yunnan', form: 'Cake' },
    stock_grams: 0, sample_grams: 25,
    samples: [{ id: 'portion-a', name: '', grams: 25, status: 'received', compass_entry_id: 'tea-a' }],
  },
  {
    entry: { id: 'tea-b', name: 'Wild Moonlight', type: 'White', year: 2019, vendor_name: 'Boyuan Tea Shop', vendor_id: 'v1', price_amount: null, price_currency: null },
    stock_grams: 0, sample_grams: null,
    samples: [{ id: 'portion-b', name: '', grams: null, status: 'received', compass_entry_id: 'tea-b' }],
  },
];

test.describe('Samples on the phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout only');

  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockInventoryApi(page);
    await page.route('**/api/curate/holdings**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HOLDINGS) }));
  });

  test('looks like Stock: grouped by supplier, each sample shows its quote', async ({ page }) => {
    await openSamples(page);
    const list = page.getByTestId('samples-phone');
    await expect(list.getByRole('region', { name: 'Boyuan Tea Shop' })).toContainText('2 samples');
    await expect(list.getByTestId('sample-decide-row').filter({ hasText: '1958 Aged Raw' })).toContainText('900');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
    await shot(page, 'list');
  });

  test('Samples is a view of the Stock list: no separate bar, same headings, Kind regroups', async ({ page }) => {
    await openSamples(page);
    await expect(page.getByRole('button', { name: 'Samples only' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: /Stock/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Showing Samples/ })).toContainText('2');
    await expect(page.getByRole('button', { name: 'Kind', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier', exact: true })).toBeVisible();
    const list = page.getByTestId('samples-phone');
    await expect(list.getByRole('region', { name: 'Boyuan Tea Shop' })).toBeVisible();
    await page.getByRole('button', { name: 'Kind', exact: true }).click();
    await expect(list.getByRole('region', { name: 'Sheng Puer' })).toBeVisible();
    await expect(list.getByRole('region', { name: 'White' })).toBeVisible();
    await page.getByRole('button', { name: 'Supplier', exact: true }).click();
    await shot(page, 'same-page');
  });

  test('minus logs a tasting with 5 g ready, and Save confirms it', async ({ page }) => {
    const calls: Array<{ command: Record<string, unknown>; confirm?: string }> = [];
    await page.route('**/api/curate/correct', async route => {
      const body = route.request().postDataJSON() as { command: Record<string, unknown>; confirm?: string };
      calls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirm ? { ok: true } : { confirmation_token: 'tok-1', preview: {} }) });
    });
    await openSamples(page);
    await page.getByTestId('samples-phone').getByRole('button', { name: /^1958 Aged Raw/ }).click();
    const sheet = page.getByRole('region', { name: /1958 Aged Raw, at a glance/ });
    await sheet.getByRole('button', { name: /Log a tasting/ }).click();
    const box = sheet.getByRole('textbox', { name: 'Grams tasted' });
    await expect(box).toHaveValue('5');
    await expect(sheet).toContainText('leaves 20');
    await shot(page, 'tasting');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0].command).toMatchObject({ action: 'taste_sample', id: 'portion-a', consumed_grams: 5 });
    expect(calls[1]).toMatchObject({ confirm: 'tok-1' });
  });

  test('a tasting carries its notes and score, and the name renames the tea', async ({ page }) => {
    const calls: Array<{ command: Record<string, any>; confirm?: string }> = [];
    await page.route('**/api/curate/correct', async route => {
      const body = route.request().postDataJSON() as { command: Record<string, any>; confirm?: string };
      calls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirm ? { ok: true } : { confirmation_token: 'tok', preview: {} }) });
    });
    await openSamples(page);
    await page.getByTestId('samples-phone').getByRole('button', { name: /^1958 Aged Raw/ }).click();
    const sheet = page.getByRole('region', { name: /1958 Aged Raw, at a glance/ });
    await sheet.getByRole('button', { name: /Log a tasting/ }).click();
    const picker = sheet.getByRole('combobox', { name: 'Add a tasting note' });
    const first = await picker.locator('option').nth(1).getAttribute('value');
    await picker.selectOption(first!);
    await sheet.getByRole('textbox', { name: 'Score out of 10' }).fill('8');
    await shot(page, 'notes');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => calls.length).toBe(2);
    const sent = calls[0].command;
    expect(sent).toMatchObject({ action: 'taste_sample', consumed_grams: 5, score: 8 });
    expect(Object.values(sent.tasting as Record<string, string[]>).flat()).toContain(first);

    await sheet.getByRole('button', { name: /^Rename 1958 Aged Raw/ }).click();
    await sheet.getByRole('textbox', { name: /^Rename 1958 Aged Raw/ }).fill('1958 Aged Raw, Hong Kong stored');
    await sheet.getByRole('textbox', { name: /^Rename 1958 Aged Raw/ }).press('Enter');
    await expect.poll(() => calls.length).toBe(4);
    expect(calls[2].command).toMatchObject({ action: 'edit', entity: 'tea', id: 'tea-a', fields: { name: '1958 Aged Raw, Hong Kong stored' } });
    expect(calls[3]).toMatchObject({ confirm: 'tok' });
  });

  test('tapping the grams weighs a portion that was never weighed', async ({ page }) => {
    const calls: Array<{ command: Record<string, unknown>; confirm?: string }> = [];
    await page.route('**/api/curate/correct', async route => {
      const body = route.request().postDataJSON() as { command: Record<string, unknown>; confirm?: string };
      calls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirm ? { ok: true } : { confirmation_token: 'tok-2', preview: {} }) });
    });
    await openSamples(page);
    await page.getByTestId('samples-phone').getByRole('button', { name: /^Wild Moonlight/ }).click();
    const sheet = page.getByRole('region', { name: /Wild Moonlight, at a glance/ });
    await expect(sheet).toContainText('weigh it');
    await expect(sheet.getByRole('button', { name: /Log a tasting/ })).toBeDisabled();
    await sheet.getByRole('button', { name: /Weigh/ }).click();
    await sheet.getByRole('textbox', { name: 'Grams left in the sample' }).fill('30');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0].command).toMatchObject({ action: 'edit', entity: 'sample', id: 'portion-b', fields: { grams: 30 } });
  });
});

test.describe('Samples on the laptop', () => {
  test.skip(({ isMobile }) => !!isMobile, 'laptop layout only');

  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockInventoryApi(page);
    await page.route('**/api/rates', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }, { currency: 'Yuan', rate_to_usd: 7.2, last_updated: new Date().toISOString() }]) }));
    await page.route('**/api/curate/holdings**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HOLDINGS) }));
  });

  test('Samples is a view of the one table: Curate samples are rows with their grams, and open in Curate', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Samples only' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Samples', exact: true }).first().click();
    const rows = page.getByTestId('curate-sample-table-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: '1958 Aged Raw' })).toContainText('25');
    await expect(page.getByText('No products match the current filter.')).toHaveCount(0);
    const aged = rows.filter({ hasText: '1958 Aged Raw' });
    await expect(aged).toContainText('900');
    await expect(aged).toContainText('/357g');
    await expect(aged).toContainText('Yunnan');
    // 900 Yuan for 357 g at 7.2 Yuan a dollar is $0.35 a gram.
    await expect(aged).toContainText('0.35');
    await expect(page.getByText(/0 items/i)).toHaveCount(0);
    await shot(page, 'laptop');
    await page.getByRole('button', { name: 'Open 1958 Aged Raw in Curate' }).click();
    await expect(page).toHaveURL(/\/admin\/compass\?entry=tea-a/);
  });
});

// Build 1 of todo/plans/samples-to-orders.md: rate, reject, cost and want, all
// written through Curate's own store and synced like any Curate edit.
test.describe('Deciding on a sample, phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout only');

  const COMPASS = [
    { id: 'tea-a', name: '1958 Aged Raw', type: 'Sheng Puer', form: 'Cake', year: 1958, vendor_name: 'Boyuan Tea Shop', vendor_id: 'v1', price_amount: 900, price_currency: 'Yuan', price_per_unit_grams: 357, decision: null, tasting: null, status: 'considering', category: 'tea', updated_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
    { id: 'tea-b', name: 'Wild Moonlight', type: 'White', form: 'Loose', year: 2019, vendor_name: 'Boyuan Tea Shop', vendor_id: 'v1', price_amount: 320, price_currency: 'Yuan', price_per_unit_grams: 100, decision: null, tasting: null, status: 'considering', category: 'tea', updated_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
  ];

  async function setup(page: Page) {
    const synced: Array<Record<string, unknown>> = [];
    await injectAuth(page);
    await mockInventoryApi(page);
    await page.route('**/api/curate/holdings**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HOLDINGS) }));
    // A stand-in that remembers what was synced, as the real Curate store does.
    const rows = COMPASS.map(e => ({ ...e })) as Array<Record<string, unknown>>;
    await page.route('**/api/compass/entries**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: rows }) }));
    await page.route('**/api/compass/sync', async route => {
      const body = route.request().postDataJSON() as { entries?: Array<Record<string, unknown>> };
      synced.push(...(body.entries ?? []));
      for (const e of body.entries ?? []) { const i = rows.findIndex(r => r.id === e.id); if (i >= 0) rows[i] = { ...rows[i], ...e }; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ syncedIds: (body.entries ?? []).map(e => e.id) }) });
    });
    await page.route('**/api/rates', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }, { currency: 'Yuan', rate_to_usd: 7.2, last_updated: new Date().toISOString() }]) }));
    await openSamples(page);
    return synced;
  }
  const lastFor = (synced: Array<Record<string, unknown>>, id: string) => [...synced].reverse().find(e => e.id === id);
  const parseTasting = (t: unknown) => (typeof t === 'string' ? JSON.parse(t) : t) as { quality?: number } | null;

  test('a row reads name, then cost for grams and $/g, then rating and Taste · Reject · Want', async ({ page }) => {
    await setup(page);
    const row = page.getByTestId('sample-decide-row').filter({ hasText: '1958 Aged Raw' });
    await expect(row).toContainText('900');
    await expect(row).toContainText('357');
    await expect(row).toContainText('0.35');
    for (const name of ['Taste', 'Reject', 'Want']) await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
    await shot(page, 'decide-row');
  });

  test('four dots save a tasting score of 8 through Curate', async ({ page }) => {
    const synced = await setup(page);
    const row = page.getByTestId('sample-decide-row').filter({ hasText: '1958 Aged Raw' });
    await row.getByRole('radio', { name: '4 of 5' }).click();
    await expect(row.getByRole('radio', { name: '4 of 5' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => parseTasting(lastFor(synced, 'tea-a')?.tasting)?.quality, { timeout: 8000 }).toBe(8);
  });

  test('Reject hides the sample; the Rejected toggle shows it with Restore, which clears it', async ({ page }) => {
    const synced = await setup(page);
    const row = page.getByTestId('sample-decide-row').filter({ hasText: 'Wild Moonlight' });
    await row.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(page.getByTestId('sample-decide-row').filter({ hasText: 'Wild Moonlight' })).toHaveCount(0);
    await expect.poll(() => lastFor(synced, 'tea-b')?.decision, { timeout: 8000 }).toBe('passed_on');
    await page.getByRole('button', { name: /Rejected 1, show/ }).click();
    await page.getByTestId('sample-decide-row').filter({ hasText: 'Wild Moonlight' }).getByRole('button', { name: 'Restore' }).click();
    await expect.poll(() => lastFor(synced, 'tea-b')?.decision ?? null, { timeout: 8000 }).toBeNull();
  });

  test('the cost is tapped and typed, and an empty field stays unknown, never zero', async ({ page }) => {
    const synced = await setup(page);
    const row = page.getByTestId('sample-decide-row').filter({ hasText: '1958 Aged Raw' });
    await row.getByRole('button', { name: 'Cost of 1958 Aged Raw' }).click();
    await row.getByRole('textbox', { name: 'Cost of 1958 Aged Raw' }).fill('950');
    await row.getByRole('textbox', { name: 'Cost of 1958 Aged Raw' }).press('Enter');
    await expect.poll(() => lastFor(synced, 'tea-a')?.price_amount, { timeout: 8000 }).toBe(950);
    await row.getByRole('button', { name: 'Cost of 1958 Aged Raw' }).click();
    await row.getByRole('textbox', { name: 'Cost of 1958 Aged Raw' }).fill('');
    await row.getByRole('textbox', { name: 'Cost of 1958 Aged Raw' }).press('Enter');
    await expect(row.getByRole('button', { name: 'Cost of 1958 Aged Raw' })).toContainText('add');
    await expect.poll(() => { const e = lastFor(synced, 'tea-a'); return e && 'price_amount' in e ? e.price_amount : 'absent'; }, { timeout: 8000 }).not.toBe(0);
  });

  test('Want asks how many cakes before anything is added, then shows the amount', async ({ page }) => {
    await setup(page);
    const row = page.getByTestId('sample-decide-row').filter({ hasText: '1958 Aged Raw' });
    await row.getByRole('button', { name: 'Want', exact: true }).click();
    const box = row.getByRole('textbox', { name: 'How many pieces' });
    await box.fill('2');
    await expect(row).toContainText('¥1,800');
    await shot(page, 'decide-want');
    await row.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(row.getByRole('button', { name: '2 pc' })).toBeVisible();
  });

  test('the buying basket: Want, then sizes, Air or Boat, and Place order records it once', async ({ page }) => {
    await setup(page);
    const created: Array<Record<string, unknown>> = [];
    const receipts: string[] = [];
    await page.route('**/api/purchase-orders', async route => {
      if (route.request().method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      created.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'po-1' }) });
    });
    await page.route('**/api/compass/entries/*/receipt-proposals', async route => {
      receipts.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'r-1' }) });
    });
    // The routes from Settings: air billed by the kilo with packing; no boat route yet.
    await page.route('**/api/shipping-routes', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'r1', mode: 'air', carrier: 'Bali Air Cargo', destination: 'Teajia Bali', rate_per_kg: 85, rate_currency: 'Yuan', packing_percent: 35, billing_step_kg: 1, minimum_kg: null, learned: null }]) }));
    const row = page.getByTestId('sample-decide-row').filter({ hasText: '1958 Aged Raw' });
    await row.getByRole('button', { name: 'Want', exact: true }).click();
    await row.getByRole('textbox', { name: 'How many pieces' }).fill('2');
    await row.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('buying-entry').click();
    const line = page.getByTestId('buying-line').filter({ hasText: '1958 Aged Raw' });
    await expect(line).toBeVisible();
    await expect(line.getByRole('radio', { name: /2 cakes/ })).toHaveAttribute('aria-checked', 'true');
    await expect(line).toContainText('¥1,800');
    await line.getByRole('radio', { name: /7 cakes/ }).click();
    await expect(line).toContainText('¥6,300');
    await line.getByRole('radio', { name: 'Boat' }).click();
    await expect(line.getByRole('radio', { name: 'Boat' })).toHaveAttribute('aria-checked', 'true');
    // Boat with no route is not estimated, never guessed.
    await expect(page.getByText('freight not estimated')).toBeVisible();
    await expect(page.getByTestId('receiving-tile')).toContainText('add one in Settings');
    await shot(page, 'buying-basket-boat');
    await line.getByRole('radio', { name: 'Air' }).click();
    // 7 cakes, 2.5 kg, plus 35% packing, billed by the kilo: 4 kg at ¥85.
    await expect(page.getByText('freight ≈ ¥340, packing included')).toBeVisible();
    await expect(page.getByTestId('receiving-tile')).toContainText('Teajia Bali');
    await shot(page, 'buying-basket');
    await line.getByRole('radio', { name: 'Boat' }).click();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('status', { name: 'Orders placed' })).toContainText('Boyuan Tea Shop');
    expect(created).toHaveLength(1);
    const items = JSON.parse(String(created[0].items_json)) as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ name: '1958 Aged Raw', quantity: 7, shipBy: 'boat' });
    // One order per supplier per route: an all-boat basket is one boat order.
    expect(created[0].ship_mode).toBe('sea');
    expect(receipts).toHaveLength(1);
    await shot(page, 'buying-placed');
  });

  test('In process: message the supplier, mark it sent, paste tracking, receive into Stock', async ({ page }) => {
    await setup(page);
    const line = (n: string) => ({ name: n, quantity: 1, pricePerUnit: 900, priceIsPerGram: false, currency: 'Yuan', form: 'Cake', compass_entry_id: 'tea-a' });
    const orders: Array<Record<string, unknown>> = [
      { id: 'po-1', account_id: 'a', vendor_name: 'Boyuan Tea Shop', items_json: JSON.stringify([line('1958 Aged Raw')]), total_usd: 125, display_currency: 'Yuan', status: 'confirmed', ship_mode: 'air', tracking_number: null, created_at: '2026-10-10', updated_at: '2026-10-10' },
    ];
    const puts: Array<Record<string, unknown>> = [];
    const accepted: string[] = [];
    await page.route('**/api/purchase-orders**', async route => {
      const req = route.request();
      if (req.method() === 'PUT') {
        const id = new URL(req.url()).pathname.split('/').pop();
        const body = req.postDataJSON() as Record<string, unknown>;
        puts.push(body);
        const o = orders.find(x => x.id === id)!;
        Object.assign(o, body.tracking_number !== undefined ? { tracking_number: String(body.tracking_number).trim() || null } : {}, body.status ? { status: body.status } : {});
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orders) });
    });
    await page.route('**/api/curate/receipt-proposals', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pending: [{ id: 'rp-1', compass_entry_id: 'tea-a', product_id: null, product_name: '1958 Aged Raw', purpose: 'working', quantity: 357, unit: 'g', acquisition_kind: 'purchase', created_at: '', tea_name: '1958 Aged Raw', vendor_name: 'Boyuan Tea Shop' }] }) }));
    await page.route('**/api/curate/receipt-proposals/*/accept', async route => { accepted.push(route.request().url()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ proposal: { id: 'rp-1' }, product_id: 'p1', ledger_id: 'l1', alreadyAccepted: false }) }); });

    await page.reload();
    await openSamples(page);
    await page.getByTestId('in-process-entry').click();
    const row = page.getByTestId('in-process-order').filter({ hasText: 'Boyuan Tea Shop' });
    await expect(row).toContainText('air');
    await expect(row).toContainText('1958 Aged Raw · 1 cake');
    await expect(row.locator('[aria-current="step"]')).toHaveText('Placed');
    await shot(page, 'in-process');

    await row.getByRole('button', { name: 'Send message ›' }).click();
    await expect(page.getByText("I'd like to order", { exact: false })).toBeVisible();
    await page.keyboard.press('Escape');
    await row.getByRole('button', { name: 'Mark sent' }).click();
    await expect(row.locator('[aria-current="step"]')).toHaveText('Sent to supplier');

    await row.getByRole('button', { name: 'Paste a tracking number' }).click();
    await row.getByRole('textbox', { name: 'Tracking number for Boyuan Tea Shop' }).fill('SF 1234 5678 90');
    await row.getByRole('textbox', { name: 'Tracking number for Boyuan Tea Shop' }).press('Enter');
    await expect(row).toContainText('SF 1234 5678 90');
    await expect(row.locator('[aria-current="step"]')).toHaveText('Shipped');
    await shot(page, 'in-process-shipped');

    await row.getByRole('button', { name: 'Receive ›' }).click();
    await expect(page.getByText('Boyuan Tea Shop: one tea is in Stock with what it cost.')).toBeVisible();
    expect(accepted).toHaveLength(1);
    expect(puts.map(p => p.status ?? p.tracking_number)).toEqual(['sent', 'SF 1234 5678 90', 'shipped', 'received']);
  });
});
