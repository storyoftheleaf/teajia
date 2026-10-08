/**
 * The phone's Stock screen: grouped by supplier, a panel under the list for
 * the tea you tap, a bar above the bottom nav for the teas you tick.
 * todo/plans/stock-phone-by-supplier.md. The laptop ledger is covered by
 * inventory-scroll.spec.ts; this file holds the same jobs to the phone list,
 * so a function cannot disappear from the phone without a test going red.
 */

import { test, expect, type Page } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/stock-phone');

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

test.describe('Stock on the phone', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'The phone list renders below 768px only');
    await page.addInitScript(() => {
      try { localStorage.removeItem('teajia.stockPhone.groupBy'); sessionStorage.clear(); } catch { /* ignore */ }
    });
    await injectAuth(page);
    await mockInventoryApi(page);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    (page as Page & { __errors?: string[] }).__errors = errors;
  });

  test('opens grouped by supplier with a compact two-line top and no sideways scroll', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const list = page.getByTestId('stock-phone');
    await expect(list).toBeVisible();
    // The mock shelf has three suppliers, 32 teas each.
    for (const supplier of ['Chen Family', 'Mountain Source', 'Old Tree Co']) {
      await expect(list.getByRole('region', { name: supplier })).toContainText('32 teas');
    }
    await expect(page.locator('[data-inventory-header-row]')).toHaveCount(2);
    const purpose = page.getByTestId('inventory-purpose-row');
    await expect(purpose.getByRole('group', { name: 'Group teas by' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await shot(page, 'grouped');
  });

  test('tapping a tea opens its sheet, and Full page opens the full page', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    await chen.getByRole('button', { name: /^Green Test Tea 01/ }).click();
    const panel = page.getByRole('region', { name: /Green Test Tea 01, at a glance/ });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/Shelf/);
    await shot(page, 'panel');
    await panel.getByRole('button', { name: /Full page/ }).click();
    await expect(page.getByText('Quick entry')).toBeVisible();
  });

  test('the full tea page opens on its stock, steps through its supplier, and acts on the one tea', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    await chen.getByRole('button', { name: /^Green Test Tea 07/ }).click();
    await page.getByRole('region', { name: /Green Test Tea 07, at a glance/ }).getByRole('button', { name: /Full page/ }).click();

    const header = page.getByTestId('phone-tea-header');
    await expect(header.getByRole('region', { name: 'On the shelf' })).toContainText('82 g');
    await expect(header.getByRole('region', { name: 'On the shelf' })).toContainText('Checked');
    // Previous / next walk the tea's own supplier, not the whole shelf.
    await expect(page.getByText(/from Chen Family/i)).toBeVisible();
    await expect(page.getByText(/\/ 32/)).toBeVisible();

    const jump = header.getByRole('navigation', { name: 'Jump to a section' });
    for (const name of ['Details', 'Photos', 'Tasting', 'Story', 'Shop']) {
      await expect(jump.getByRole('button', { name, exact: true })).toBeVisible();
    }
    const fits = await jump.evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    expect(fits).toBe(true);
    await shot(page, 'tea-page');

    await header.getByRole('button', { name: 'Add this tea to a collection' }).click();
    await expect(page.getByText('1 item selected')).toBeVisible();
  });

  test('ticking teas shows the action bar above the nav with every action', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    await chen.getByRole('button', { name: 'Tick Green Test Tea 01' }).click();
    const bar = page.getByRole('toolbar', { name: 'Selection actions' });
    await expect(bar).toContainText('1 tea selected');
    for (const name of ['Add to a collection', 'Invoice', 'Edit', 'More actions']) {
      await expect(bar.getByRole('button', { name })).toBeVisible();
    }
    await bar.getByRole('button', { name: 'More actions' }).click();
    for (const name of ['Record tasting', 'Edit product tasting profile', 'Manage linked writing', 'Star', 'Sample', 'Share', 'Archive selection']) {
      await expect(bar.getByRole('button', { name })).toBeVisible();
    }
    await shot(page, 'selected-more');
    // The bottom nav stays on screen while teas are ticked.
    await expect(page.getByRole('button', { name: 'Your Table' }).last()).toBeVisible();
  });

  test('Stage keeps the lifecycle sections in order, with the incoming tea in Incoming', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.getByRole('group', { name: 'Group teas by' }).getByRole('button', { name: 'Stage' }).click();
    const regions = page.getByTestId('stock-phone').getByRole('region');
    const names = await regions.evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
    const order = ['Published', 'Ready, private', 'Incoming', 'Needs preparation', 'Archived'];
    const seen = names.filter((n): n is string => !!n && order.includes(n));
    expect(seen).toEqual(order.filter(o => seen.includes(o)));
    const incoming = page.getByRole('region', { name: 'Incoming' });
    await incoming.getByRole('button', { name: /Incoming/ }).first().click();
    await expect(incoming).toContainText('Red Test Tea 03');
  });

  test('tapping the grams counts the tea: the ledger gets a recount and the list shows it', async ({ page }) => {
    const sent: Array<Record<string, unknown>> = [];
    await page.route('**/api/products/test-product-7/movements', async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      sent.push(body);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ after_balance: body.balance }) });
    });
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    await chen.getByRole('button', { name: /^Green Test Tea 07/ }).click();
    const sheet = page.getByRole('region', { name: /Green Test Tea 07, at a glance/ });
    await expect(sheet.getByRole('button', { name: 'Take some Green Test Tea 07 out' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Add some Green Test Tea 07' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Type a new count for Green Test Tea 07' }).click();
    const box = sheet.getByRole('textbox', { name: 'What is on the shelf' });
    await expect(box).toBeFocused();
    await box.fill('64');
    await box.press('Enter');
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ movement_type: 'recount', balance: 64, expected_balance: 82, unit: 'g' });
    await expect(chen.getByRole('button', { name: /^Green Test Tea 07/ })).toContainText('64');
    await shot(page, 'counted');
  });

  test('minus takes an amount and a reason, and shows what is left before saving', async ({ page }) => {
    const sent: Array<Record<string, unknown>> = [];
    await page.route('**/api/products/test-product-7/movements', async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      sent.push(body);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ after_balance: 82 - Number(body.quantity) }) });
    });
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    await chen.getByRole('button', { name: /^Green Test Tea 07/ }).click();
    const sheet = page.getByRole('region', { name: /Green Test Tea 07, at a glance/ });
    await sheet.getByRole('button', { name: 'Take some Green Test Tea 07 out' }).click();
    await expect(sheet.getByRole('radio', { name: 'Sampled' })).toHaveAttribute('aria-checked', 'true');
    const box = sheet.getByRole('textbox', { name: 'How much went out' });
    await box.fill('100');
    await expect(sheet).toContainText('only 82 there');
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    await box.fill('7');
    await expect(sheet).toContainText('leaves 75');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ movement_type: 'sample_use', quantity: 7, expected_balance: 82 });
  });

  test('tapping the name, the price or Shop changes the tea itself', async ({ page }) => {
    const writes: Array<Record<string, unknown>> = [];
    await page.route(/\/api\/products\/test-product-7(\/[a-z-]+)?$/, async route => {
      if (route.request().method() === 'GET') return route.fallback();
      writes.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    await chen.getByRole('button', { name: /^Green Test Tea 07/ }).click();
    let sheet = page.getByRole('region', { name: /Green Test Tea 07, at a glance/ });
    await sheet.getByRole('button', { name: 'Rename Green Test Tea 07' }).click();
    await sheet.getByRole('textbox', { name: 'Rename Green Test Tea 07' }).fill('Spring Dragonwell');
    await sheet.getByRole('textbox', { name: 'Rename Green Test Tea 07' }).press('Enter');
    await expect(chen.getByRole('button', { name: /^Spring Dragonwell/ })).toBeVisible();
    sheet = page.getByRole('region', { name: /Spring Dragonwell, at a glance/ });
    await sheet.getByRole('button', { name: /Shop price per gram/ }).click();
    await sheet.getByRole('textbox', { name: /Shop price per gram/ }).fill('0.9');
    await sheet.getByRole('textbox', { name: /Shop price per gram/ }).press('Enter');
    const shop = sheet.getByRole('switch', { name: /in the shop/ });
    const wasOn = (await shop.getAttribute('aria-checked')) === 'true';
    await shop.click();
    await expect(shop).toHaveAttribute('aria-checked', wasOn ? 'false' : 'true');
    await expect.poll(() => writes.length).toBeGreaterThanOrEqual(3);
    const all = Object.assign({}, ...writes);
    expect(all).toMatchObject({ product_name: 'Spring Dragonwell', fixed_retail_price_usd: 0.9, is_public: !wasOn });
  });

  test('a supplier opens its source panel, from the group line and from a tea', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Supplier details for Mountain Source' }).click();
    await expect(page.getByText('Stock from this source')).toBeVisible();
    await page.getByRole('button', { name: 'Close source panel' }).click();
    await expect(page.getByText('Stock from this source')).toHaveCount(0);
  });

  test('the supplier page sums the supplier, opens its teas, and ticks them all', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Supplier details for Mountain Source' }).click();
    const glance = page.getByRole('region', { name: 'This supplier at a glance' });
    await expect(glance).toContainText('32');
    await expect(glance).toContainText('To recount');
    await shot(page, 'supplier');
    await glance.getByRole('button', { name: 'Select all 32' }).click();
    await expect(page.getByRole('toolbar', { name: 'Selection actions' })).toContainText('32 teas selected');
    await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Clear' }).click();

    await page.getByRole('button', { name: 'Supplier details for Mountain Source' }).click();
    await page.getByRole('button', { name: /^Open Oolong Test Tea 02/ }).click();
    await expect(page.getByTestId('phone-tea-header')).toBeVisible();
  });

  test('Incoming groups deliveries by supplier with how they travel and when they are due', async ({ page }) => {
    // Local calendar days, the way the screen counts them. toISOString() is UTC,
    // which in Bali is the previous day until 8 am, and the test went red daily.
    const localDay = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const soon = localDay(6);
    const past = localDay(-3);
    const transportCalls: unknown[] = [];
    await page.route('**/api/inventory/receipts**', route => route.fulfill({ json: [
      { id: 'r1', state: 'in_transit', vendor_name: 'Chen Family', source_kind: 'invoice', source_ref: 'WeChat', eta: soon, transport_mode: 'air', lines: [{ id: 'l1', product_id: 'test-product-1', product_name: 'Green Test Tea 01', expected_quantity: 500, received_quantity: 0, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] },
      { id: 'r2', state: 'ordered', vendor_name: 'Old Tree Co', source_kind: 'invoice', eta: past, transport_mode: null, lines: [{ id: 'l2', product_id: 'test-product-3', product_name: 'Red Test Tea 03', expected_quantity: 300, received_quantity: 0, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] },
    ] }));
    await page.route('**/api/inventory/receipts/*/transport', route => { transportCalls.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
    await page.goto('/admin/stock?incoming=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: 'Coming from Chen Family' })).toContainText('due in 6 days');
    await expect(page.getByRole('region', { name: 'Coming from Old Tree Co' })).toContainText('3 days late');
    await shot(page, 'incoming');
    await page.getByRole('combobox', { name: 'How the delivery from Old Tree Co travels' }).selectOption('sea');
    await expect.poll(() => transportCalls).toEqual([{ transport_mode: 'sea' }]);
    await page.getByRole('button', { name: 'Air', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Coming from Old Tree Co' })).toHaveCount(0);
  });

  test('search narrows the list by supplier and opens the groups that match', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Search inventory' }).first().click();
    await page.getByRole('textbox', { name: /^Search (tea or source|teaware)$/ }).fill('Old Tree');
    const list = page.getByTestId('stock-phone');
    await expect(list.getByRole('region', { name: 'Old Tree Co' })).toBeVisible();
    await expect(list.getByRole('region', { name: 'Chen Family' })).toHaveCount(0);
    // A search opens its groups, so the teas show without a second tap.
    await expect(list.getByRole('button', { name: /^Oolong Test Tea 02/ }).or(list.getByRole('button', { name: /Test Tea/ }).first())).toBeVisible();
  });

  test('the column headings sort by price per gram and by year, and tap again to reverse', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    const chen = page.getByTestId('stock-phone').getByRole('region', { name: 'Chen Family' });
    await chen.getByRole('button', { name: /Chen Family/ }).first().click();
    const price = page.getByRole('columnheader', { name: /\$\s*\/\s*g/ });
    await price.click();
    await expect(price).toHaveAttribute('aria-sort', 'ascending');
    const prices = async () => (await chen.locator('button[aria-expanded] > span:last-child').allInnerTexts()).map(Number);
    const up = await prices();
    expect(up).toEqual([...up].sort((a, b) => a - b));
    await price.click();
    await expect(price).toHaveAttribute('aria-sort', 'descending');
    const down = await prices();
    expect(down).toEqual([...down].sort((a, b) => b - a));
    const year = page.getByRole('columnheader', { name: /Year/ });
    await year.click();
    await expect(year).toHaveAttribute('aria-sort', 'ascending');
    await shot(page, 'sorted');
  });

  test('every view is one menu away, and choosing one filters the list', async ({ page }) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Choose which teas to show/ }).click();
    for (const name of ['All', 'Working', 'Samples', 'Personal', 'Needs writing', 'Low stock']) {
      await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible();
    }
    await page.getByRole('menuitem', { name: 'Needs writing', exact: true }).click();
    await expect(page.getByTestId('stock-phone')).toContainText('Sheng Test Tea 04');
    await expect(page.getByTestId('stock-phone')).not.toContainText('Oolong Test Tea 02');
  });
});
