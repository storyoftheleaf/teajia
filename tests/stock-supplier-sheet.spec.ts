/**
 * Stock opens the supplier sheet from the supplier's name: the Source cell on
 * the laptop table, the supplier line and the tea card on the phone. A rename
 * there shows in the list at once, without a reload. Every API call is
 * answered here; nothing reaches the live shop.
 *
 * Adrian, 2026-10-11: "I see someone called Master Bo. If that's not his name,
 * there needs to be a button that I can click and change the name."
 */

import { test, expect, type Page } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/stock-supplier-sheet');

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

const PREVIEW = {
  vendor_id: 'bo', old_name: 'Master Bo', total: 6,
  counts: [
    { table: 'customers', label: 'the supplier card', by_id: 1, by_name: 0 },
    { table: 'products', label: 'teas on the shelf', by_id: 3, by_name: 0 },
    { table: 'purchase_orders', label: 'orders', by_id: 2, by_name: 0 },
  ],
};

interface Seen { renames: Array<Record<string, unknown>>; productReads: number; contacts: Array<Record<string, unknown>> }

async function prepare(page: Page): Promise<Seen> {
  // Keep new optional admin reads inside this mocked shelf, never the local API.
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  let chineseName = '';
  let supplierName = 'Master Bo'; // the "database": a rename changes what the next read says
  const seen: Seen = { renames: [], productReads: 0, contacts: [] };
  const products = () => MOCK_PRODUCTS.slice(0, 6).map((p, i) => (
    i < 3 ? { ...p, vendor: supplierName, vendor_id: 'bo' } : { ...p, vendor: 'Chen Family', vendor_id: 'chen' }
  ));

  await injectAuth(page);
  await page.addInitScript(() => {
    try { localStorage.removeItem('teajia.stockPhone.groupBy'); sessionStorage.clear(); } catch { /* ignore */ }
  });
  await mockInventoryApi(page);
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/products', route => { seen.productReads += 1; return route.fulfill(json(products())); });
  await page.route('**/api/customers/bo', route => {
    if (route.request().method() === 'PUT') { const body = route.request().postDataJSON(); seen.contacts.push(body); if (body.chinese_name !== undefined) chineseName = body.chinese_name; return route.fulfill(json({ success: true })); }
    return route.fulfill(json({ id: 'bo', name: supplierName, chinese_name: chineseName, whatsapp: '+86 138 0000 1111', wechat: 'masterbo88', company: 'Bo Tea House', city: 'Menghai', country: 'China', email: null, phone: null, address: null }));
  });
  await page.route('**/api/suppliers/bo/rename-preview**', route => {
    const name = new URL(route.request().url()).searchParams.get('name');
    if (/\p{Script=Han}/u.test(name || '')) return route.fulfill(json({ error: 'Use an English name; keep Chinese in Chinese name.', code: 'english_name_required' }, 400));
    return route.fulfill(json({ ...PREVIEW, new_name: name }));
  });
  await page.route('**/api/suppliers/bo/rename', route => {
    const body = route.request().postDataJSON();
    seen.renames.push(body);
    supplierName = body.name;
    return route.fulfill(json({ ...PREVIEW, old_name: 'Master Bo', new_name: supplierName }));
  });
  await page.route('**/api/suppliers/bo/freight', route => route.fulfill(json([
    { id: 'f1', leg: 'Guangzhou to Bali', mode: 'air', total_amount: 850, currency: 'Yuan', weight_kg: 10, per_kg: 85, per_kg_usd: 11.97, transit_days: 6, observed_on: '2026-10-01', current: true },
  ])));
  await page.route('**/api/shipping-routes**', route => route.fulfill(json([
    { id: 'r-air', mode: 'air', carrier: 'DHL', destination: 'Bali', rate_per_kg: 85, rate_currency: 'Yuan', packing_percent: null, billing_step_kg: null, minimum_kg: null },
  ])));
  return seen;
}

async function renameToBoLin(page: Page, seen: Seen, shotName: string, alreadyEditing = false) {
  const sheet = page.getByTestId('supplier-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('region', { name: 'Shipping' })).toContainText('Guangzhou to Bali');
  if (!alreadyEditing) await sheet.getByRole('button', { name: 'Rename', exact: true }).click();
  await sheet.getByLabel('New name').fill('Bo Lin');
  await sheet.getByLabel('New name').press('Enter');
  await expect(sheet.getByRole('button', { name: 'Rename everywhere' })).toBeVisible();
  await shot(page, shotName);
  await sheet.getByRole('button', { name: 'Rename everywhere' }).click();
  await expect.poll(() => seen.renames.length).toBe(1);
  expect(seen.renames[0]).toMatchObject({ name: 'Bo Lin' });
  // The sheet's own title follows the new name once the rename has landed.
  await expect(sheet.getByRole('button', { name: 'Rename', exact: true })).toBeVisible();
}

test.describe('Stock opens the supplier sheet from the supplier name', () => {
  test('laptop: the Source cell opens the sheet, and a rename shows in the table without a reload', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The laptop table renders at 768px and up');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const seen = await prepare(page);
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });

    const row = page.locator('tr[data-product-id="test-product-1"]');
    await row.getByRole('button', { name: 'Open supplier Master Bo' }).click();
    await shot(page, 'laptop-sheet');
    const readsBefore = seen.productReads;
    await renameToBoLin(page, seen, 'laptop-preview');
    // The sheet is modal, so the table is read once it closes.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('supplier-sheet')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Open supplier Bo Lin' })).toBeVisible();
    await expect(page.locator('tr[data-product-id="test-product-4"]')).toContainText('Chen Family');
    await expect.poll(() => seen.productReads).toBeGreaterThan(readsBefore);
    await shot(page, 'laptop-renamed');

    // The supplier page (sums, teas, select all) is one step on from the sheet.
    await row.getByRole('button', { name: 'Open supplier Bo Lin' }).click();
    await page.getByTestId('supplier-sheet').getByRole('button', { name: 'Stock from Bo Lin' }).click();
    await expect(page.getByRole('dialog', { name: 'Source: Bo Lin' })).toBeVisible();

    // Edit supplier on that page opens the same card in place, not the People page.
    await page.getByRole('button', { name: 'Edit supplier' }).click();
    await expect(page.getByTestId('supplier-sheet')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Source: Bo Lin' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/stock(?:\?|$)/);
    await page.waitForTimeout(500); // let the panel finish sliding out, for the picture only
    await shot(page, 'laptop-edit-supplier');
    expect(errors).toEqual([]);
  });

  test('phone: the supplier menu opens editing, and a rename regroups the list', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The phone list renders below 768px only');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const seen = await prepare(page);
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });

    await page.evaluate(async () => {
      const { useAppStore } = await import('/src/lib/store.ts');
      useAppStore.getState().setInventoryGroupBy('vendor');
    });
    await page.getByRole('button', { name: 'Supplier actions for Master Bo', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit supplier name', exact: true }).click();
    await shot(page, 'phone-sheet');
    await renameToBoLin(page, seen, 'phone-preview', true);
    await page.keyboard.press('Escape');

    await expect(page.getByRole('button', { name: 'Supplier actions for Bo Lin', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier actions for Master Bo', exact: true })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
    await shot(page, 'phone-renamed');
    expect(errors).toEqual([]);
  });
});

test('supplier arrow offers Edit while closed headings retain tea counts and grams', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  const seen = await prepare(page);
  await page.goto('/admin/stock');
  await page.locator('tr[data-product-id]').first().waitFor();
  await page.evaluate(async () => {
    const { useAppStore } = await import('/src/lib/store.ts');
    useAppStore.getState().setInventoryGroupBy('vendor');
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const heading = page.locator('[data-stock-group="Master Bo"]');
    await expect(heading.getByRole('button', { name: 'Supplier actions for Master Bo', exact: true })).toBeVisible();
    await expect(heading.locator('.stock-group-edit')).toHaveCount(0);
    await expect(heading.getByRole('button', { name: 'Collapse Master Bo', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Collapse Master Bo', exact: true }).click();
  const collapsed = page.locator('[data-stock-group="Master Bo"]');
  await expect(collapsed.locator('.stock-group-summary')).toContainText('3 teas');
  await expect(collapsed.locator('.stock-group-summary')).toContainText('87g');
  await expect(collapsed.locator('.stock-group-summary')).toContainText('$');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const name = await collapsed.locator('.stock-group-name').boundingBox();
    const summary = await collapsed.locator('.stock-group-summary').boundingBox();
    expect(summary!.y).toBeGreaterThanOrEqual(name!.y + name!.height);
    const values = await collapsed.locator('.stock-group-summary > span').all();
    const boxes = await Promise.all(values.map(value => value.boundingBox()));
    expect(Math.max(...boxes.map(box => box!.y)) - Math.min(...boxes.map(box => box!.y))).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(collapsed.locator('tr[data-product-id]')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('supplier-collapsed-heading.png') });
  await collapsed.getByRole('button', { name: 'Supplier actions for Master Bo', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit supplier name', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('supplier-edit-menu.png') });
  await page.getByRole('menuitem', { name: 'Edit supplier name', exact: true }).click();
  const sheet = page.getByTestId('supplier-sheet');
  await expect(sheet.getByLabel('New name')).toHaveValue('Master Bo');
  await sheet.getByLabel('New name').fill('博林 Bo Lin');
  await sheet.getByRole('button', { name: 'See what changes', exact: true }).click();
  await expect(sheet.getByRole('alert')).toContainText('English name');
  expect(seen.renames).toHaveLength(0);
  await sheet.getByLabel('New name').fill('Bo Lin');
  await sheet.getByRole('button', { name: 'See what changes', exact: true }).click();
  await sheet.getByRole('button', { name: 'Rename everywhere', exact: true }).click();
  await expect.poll(() => seen.renames.length).toBe(1);
  await expect(sheet.getByRole('button', { name: 'Rename', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Chinese name', exact: true }).click();
  await sheet.getByRole('textbox', { name: 'Chinese name', exact: true }).fill('静趣礼承');
  await sheet.getByRole('textbox', { name: 'Chinese name', exact: true }).press('Tab');
  await expect.poll(() => seen.contacts.length).toBe(1);
  expect(seen.contacts[0]).toEqual({ chinese_name: '静趣礼承' });
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  const renamed = page.locator('[data-stock-group="Bo Lin"]');
  await expect(renamed).toBeVisible();
  await renamed.getByRole('button', { name: 'Expand Bo Lin', exact: true }).click();
  await expect(renamed.locator('tr[data-product-id]')).toHaveCount(3);
  await expect(page.locator('[data-stock-group="Master Bo"]')).toHaveCount(0);
  await expect(page.locator('[data-stock-group="Chen Family"] tr[data-product-id]')).toHaveCount(3);
  await page.screenshot({ path: test.info().outputPath('supplier-group-corrected.png') });
  await page.reload();
  await expect(page.locator('[data-stock-group="Bo Lin"] tr[data-product-id]')).toHaveCount(3);
});

test('typing a supplier spelling in one tea does not silently create or assign another supplier', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await prepare(page);
  let assignments = 0;
  let creations = 0;
  await page.route('**/api/products/*/commercial', route => { assignments += 1; return route.fulfill({ json: { success: true } }); });
  await page.route('**/api/customers', route => { if (route.request().method() === 'POST') { creations += 1; return route.fulfill({ json: { id: 'unwanted' } }); } return route.fallback(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/stock');
  const row = page.locator('tr[data-product-id="test-product-1"]');
  await row.getByRole('button', { name: 'Open Green Test Tea 01 editor', exact: true }).click();
  const picker = page.getByRole('textbox', { name: 'Supplier for this tea', exact: true });
  await expect(picker).toHaveValue('Master Bo');
  await picker.fill('Mastre Bo');
  await picker.press('Tab');
  await expect(picker).toHaveValue('Master Bo');
  expect(assignments).toBe(0);
  expect(creations).toBe(0);
  await page.getByRole('button', { name: 'Correct name everywhere', exact: true }).click();
  await expect(page.getByTestId('supplier-sheet').getByLabel('New name')).toHaveValue('Master Bo');
});

test('Stock shortcuts, smaller view menu and missing suppliers remain connected', async ({ page }) => {
  await prepare(page);
  const shelf = MOCK_PRODUCTS.slice(0, 3).map((product, index) => ({ ...product, vendor: index < 2 ? (index ? '  ' : '') : 'Master Bo', vendor_id: index < 2 ? null : 'bo' }));
  const writes: Array<{ id: string; vendor: string }> = [];
  await page.route('**/api/products', route => route.fulfill({ json: shelf }));
  await page.route('**/api/customers', route => route.fulfill({ json: [{ id: 'bo', name: 'Master Bo', tags: ['vendor'] }] }));
  await page.route('**/api/products/*/commercial', route => {
    const id = new URL(route.request().url()).pathname.split('/')[3];
    const body = route.request().postDataJSON();
    writes.push({ id, vendor: body.vendor });
    Object.assign(shelf.find(product => product.id === id)!, body);
    return route.fulfill({ json: { success: true } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/stock');
  await page.locator('tr[data-product-id]').first().waitFor();
  await page.evaluate(async () => {
    const { useAppStore } = await import('/src/lib/store.ts');
    useAppStore.getState().setInventoryGroupBy('vendor');
  });
  await expect(page.locator('[data-stock-group="Unknown"]')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Show teas', exact: true }).locator('option')).toHaveCount(5);
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await expect(page.locator('tr[data-product-id]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-stock-group="Unknown"][data-collapsed="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await expect(page.locator('tr[data-product-id]')).toHaveCount(3);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.getByRole('button', { name: 'Tasting library', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'View options', exact: true }).click();
  await page.getByText('More filters', { exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'More Stock filters' }).locator('option')).toHaveCount(18);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Supplier actions for Unknown', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Assign suppliers', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Unknown supplier', exact: true });
  const picker = sheet.getByRole('textbox', { name: 'Supplier for this tea' }).first();
  await picker.fill('Master');
  await sheet.getByRole('button', { name: 'Master Bo', exact: true }).click();
  await sheet.getByRole('button', { name: `Save supplier for ${shelf[0].product_name}`, exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ id: shelf[0].id, vendor: 'Master Bo' });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-stock-group="Unknown"] tr[data-product-id]')).toHaveCount(1);
  await expect(page.locator('[data-stock-group="Master Bo"] tr[data-product-id]')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('stock-simplified-and-unknown.png') });
  await page.getByRole('button', { name: 'Tasting library', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/journal$/);
});
