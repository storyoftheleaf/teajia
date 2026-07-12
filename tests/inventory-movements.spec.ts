import { expect, test, type Page } from '@playwright/test';

function token() {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'operator@test', role: 'owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
}

const product = {
  id: 'tea-1', type: 'Oolong', form: 'Loose', given_name: 'Cloud', product_name: 'Cloud Oolong',
  origin_country: 'Taiwan', origin_region: 'Alishan', retail_price_per_gram_usd: .4,
  cost_per_gram_usd: .1, cost_amount: 20, stock_grams: 100, low_stock_threshold: 20,
  stock_known_at: '2026-07-12', description: 'Floral tea', tasting_notes: [], image_url: '', status: 'Active',
  cost_currency: 'USD', quantity_purchased: 100, is_public: 0, shown_in_shop: 0, can_reorder: 0,
  is_sample: 0, is_personal: 0, inventory_purpose: 'working', tasting_source: 'common',
  source_compass_entry_id: 'compass-cloud',
};
const destinationProduct = { ...product, id: 'tea-2', given_name: 'Reserve', product_name: 'Reserve Oolong', stock_grams: 25 };
const unrelatedProduct = { ...product, id: 'tea-3', given_name: 'Other lot', product_name: 'Other lot', source_compass_entry_id: 'compass-other', stock_grams: 8 };
const teawareProduct = { ...product, id: 'ware-1', type: 'Teaware', given_name: 'Field Gaiwan', product_name: 'Field Gaiwan', stock_grams: 0, quantity_units: 3, teaware_category: 'pot', material: 'Porcelain' };

let balance = 100;
let failNext = false;
let teawareBalance = 3;
let destinationBalance = 25;
const movements: any[] = [];
const movementBodies: any[] = [];
const absoluteStockWrites: any[] = [];
const invoiceBodies: any[] = [];

async function install(page: Page) {
  const jwt = token();
  balance = 100;
  movements.length = 0;
  movementBodies.length = 0;
  absoluteStockWrites.length = 0;
  invoiceBodies.length = 0;
  failNext = false;
  teawareBalance = 3;
  destinationBalance = 25;
  await page.route('**/api/**', route => route.fulfill({ status: 501, json: { error: `Unhandled ${route.request().method()} ${new URL(route.request().url()).pathname}` } }));
  await page.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct', activeUserId: 'admin', memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }] } }));
  }, jwt);
  await page.route('**/api/auth/me', r => r.fulfill({ json: { id: 'admin', email: 'operator@test', role: 'owner' } }));
  await page.route('**/api/auth/refresh', r => r.fulfill({ json: { token: jwt } }));
  await page.route('**/api/products', r => r.fulfill({ json: [{ ...product, stock_grams: balance }, { ...destinationProduct, stock_grams: destinationBalance }, unrelatedProduct, { ...teawareProduct, quantity_units: teawareBalance }] }));
  await page.route('**/api/products/*/events', r => r.fulfill({ json: [] }));
  await page.route('**/api/products/tea-1/movements', async r => {
    const body = r.request().postDataJSON();
    movementBodies.push(body);
    if (failNext) {
      failNext = false;
      balance = 95;
      await r.fulfill({ status: 409, json: { error: 'Stock balance changed', current_balance: 95 } });
      return;
    }
    const before = balance;
    const outward = ['sample_use', 'gift', 'waste', 'sale', 'transfer'].includes(body.movement_type);
    const next = body.movement_type === 'recount' ? Number(body.balance) : before + (outward ? -Number(body.quantity) : Number(body.quantity));
    if (next < 0) {
      await r.fulfill({ status: 409, json: { error: 'Insufficient stock' } });
      return;
    }
    balance = next;
    if (body.movement_type === 'transfer') destinationBalance += Number(body.quantity);
    movements.unshift({ id: `movement-${movements.length + 1}`, movement_type: body.movement_type, reason: body.movement_type.toUpperCase(), delta: next - before, balance_before: before, balance_after: next, user_email: 'operator@test', note: body.note, source_invoice_number: body.source_invoice_number, created_at: new Date().toISOString() });
    await r.fulfill({ status: 201, json: { id: movements[0].id, before_balance: before, after_balance: next, ...(body.movement_type === 'transfer' ? { destination_product_id: body.destination_product_id, destination_after_balance: destinationBalance } : {}) } });
  });
  await page.route('**/api/products/ware-1/movements', async r => {
    const body = r.request().postDataJSON();
    movementBodies.push(body);
    const before = teawareBalance;
    const outward = ['sample_use', 'gift', 'waste'].includes(body.movement_type);
    teawareBalance = body.movement_type === 'recount' ? Number(body.balance) : before + (outward ? -Number(body.quantity) : Number(body.quantity));
    movements.unshift({ id: `ware-${movements.length}`, movement_type: body.movement_type, reason: body.movement_type.toUpperCase(), delta: teawareBalance - before, balance_after: teawareBalance, movement_unit: 'unit', created_at: new Date().toISOString() });
    await r.fulfill({ status: 201, json: { before_balance: before, after_balance: teawareBalance, unit: 'unit' } });
  });
  await page.route('**/api/products/*/stock', async r => { absoluteStockWrites.push(r.request().postDataJSON()); await r.fulfill({ json: { success: true } }); });
  await page.route('**/api/invoices', async r => {
    if (r.request().method() === 'POST') {
      invoiceBodies.push(r.request().postDataJSON());
      await r.fulfill({ status: 201, json: { id: 'invoice-1', invoice_number: 'INV-1' } });
    } else {
      await r.fulfill({ json: [] });
    }
  });
  await page.route('**/api/stock-ledger**', r => {
    const url = new URL(r.request().url());
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 20);
    return r.fulfill({ json: { entries: movements.slice(offset, offset + limit), total: movements.length } });
  });
  await page.route('**/api/rates', r => r.fulfill({ json: [] }));
  await page.route('**/api/accounts/acct', r => r.fulfill({ json: { id: 'acct', name: 'Test' } }));
  await page.route('**/api/batches**', r => r.fulfill({ json: [] }));
  await page.route('**/api/inventory/receipts**', r => r.fulfill({ json: [] }));
  for (const endpoint of ['admin/events', 'compass/incoming', 'user/favorites', 'tea-discovery', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, r => r.fulfill({ json: [] }));
  }
  await page.route('**/api/compass/entries**', r => r.fulfill({ json: { entries: [] } }));
}

test.beforeEach(async ({ page }) => {
  await install(page);
  await page.goto('/admin/stock');
  await expect(page.getByText('Cloud Oolong')).toBeVisible({ timeout: 15_000 });
});

test('normal stock interaction opens explicit movement actions and previews before/after', async ({ page }) => {
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await expect(page.getByRole('dialog', { name: 'Change stock — Cloud Oolong' })).toBeVisible();
  for (const label of ['Receive', 'Sample use', 'Gift', 'Waste', 'Return', 'Recount', 'Transfer']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Waste', exact: true }).click();
  await page.getByLabel('Quantity').fill('15');
  await expect(page.getByText('100g → 85g')).toBeVisible();
  await page.getByLabel('Movement note').fill('Broken storage bag');
  await page.getByLabel('Movement reference').fill('INV-204');
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.getByText('Cloud · 85g')).toBeVisible();
  await expect(page.getByText('Broken storage bag')).toBeVisible();
  await expect(page.getByText('operator@test')).toBeVisible();
  await expect(page.getByRole('button', { name: 'INV-204' })).toBeVisible();
});

test('stock ledger pagination controls have accessible names', async ({ page }) => {
  for (let index = 0; index < 21; index += 1) {
    movements.push({ id: `history-${index}`, movement_type: 'receipt', reason: 'RECEIPT', delta: 1, balance_after: index + 1, user_email: 'operator@test', created_at: new Date().toISOString() });
  }
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await expect(page.getByRole('button', { name: 'Previous stock history page' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next stock history page' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next stock history page' }).click();
  await expect(page.getByText('21–21 of 21')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous stock history page' })).toBeEnabled();
  await page.getByRole('button', { name: 'Previous stock history page' }).click();
  await expect(page.getByText('1–20 of 21')).toBeVisible();
});

test('receive, sample use, and return record the correct movement direction', async ({ page }) => {
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  for (const [label, type, quantity, expected] of [
    ['Receive', 'receipt', '5', '105'],
    ['Sample use', 'sample_use', '2', '103'],
    ['Return', 'return', '4', '107'],
  ] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByLabel('Quantity').fill(quantity);
    await page.getByRole('button', { name: 'Record movement' }).click();
    await expect(page.getByText(`Cloud · ${expected}g`)).toBeVisible();
    expect(movementBodies.at(-1)).toMatchObject({ movement_type: type, quantity: Number(quantity) });
  }
});

test('gift and waste submit exact outward movements and refresh their ledger balances', async ({ page }) => {
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  for (const [label, type, quantity, expected] of [
    ['Gift', 'gift', '6', '94'],
    ['Waste', 'waste', '4', '90'],
  ] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByLabel('Quantity').fill(quantity);
    await page.getByLabel('Movement note').fill(`${label} detail`);
    await page.getByRole('button', { name: 'Record movement' }).click();
    expect(movementBodies.at(-1)).toMatchObject({ movement_type: type, quantity: Number(quantity), expected_balance: Number(expected) + Number(quantity) });
    await expect(page.getByText(`Cloud · ${expected}g`)).toBeVisible();
    await expect(page.getByText(`${label} detail`)).toBeVisible();
    await expect(page.getByText(`${Number(expected) + Number(quantity)}g → ${expected}g`)).toBeVisible();
  }
});

test('prevents insufficient stock inline and preserves form after an API error', async ({ page }) => {
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await page.getByRole('button', { name: 'Gift', exact: true }).click();
  await page.getByLabel('Quantity').fill('101');
  await expect(page.getByText('Only 100g available')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record movement' })).toBeDisabled();
  await page.getByLabel('Quantity').fill('10');
  await page.getByLabel('Movement note').fill('Vendor gift');
  failNext = true;
  await page.getByRole('button', { name: 'Record movement' }).click();
  const firstKey = movementBodies.at(-1).idempotency_key;
  await expect(page.getByText('Stock changed to 95g. Review and retry.')).toBeVisible();
  await expect(page.getByLabel('Quantity')).toHaveValue('10');
  await expect(page.getByLabel('Movement note')).toHaveValue('Vendor gift');
  await expect(page.getByText('95g → 85g')).toBeVisible();
  await page.getByRole('button', { name: 'Record movement' }).click();
  expect(movementBodies.at(-1)).toMatchObject({ expected_balance: 95, quantity: 10, note: 'Vendor gift' });
  expect(movementBodies.at(-1).idempotency_key).not.toBe(firstKey);
  await expect(page.getByText('Cloud · 85g')).toBeVisible();
});

test('transfer selects a related holding, sends its identity, and refreshes both balances', async ({ page }) => {
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByLabel('Quantity').fill('5');
  await expect(page.getByLabel('Transfer destination')).toHaveValue('tea-2');
  await expect(page.getByRole('option', { name: /Other lot/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record movement' }).click();
  expect(movementBodies.at(-1)).toMatchObject({ movement_type: 'transfer', destination_product_id: 'tea-2', quantity: 5 });
  await expect(page.getByText('Cloud · 95g')).toBeVisible();
  await page.getByRole('button', { name: 'Close stock movement' }).click();
  await expect(page.getByText('Reserve Oolong').first()).toBeVisible();
  await expect(page.getByText('30').first()).toBeVisible();
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await page.getByRole('button', { name: 'Recount', exact: true }).click();
  await page.getByLabel('New balance').fill('72');
  await expect(page.getByText('95g → 72g')).toBeVisible();
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.getByText('Cloud · 72g')).toBeVisible();
});

test('teaware movements use units, update quantityUnits, and render a unit-aware ledger', async ({ page }) => {
  await page.getByRole('button', { name: 'Wares', exact: true }).click();
  await expect(page.getByText('Field Gaiwan').first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Change stock for Field Gaiwan' }).click();
  await expect(page.getByText('Field Gaiwan · 3 units')).toBeVisible();
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Record movement' }).click();
  expect(movementBodies.at(-1)).toMatchObject({ movement_type: 'receipt', unit: 'unit', expected_balance: 3, quantity: 2 });
  await expect(page.getByText('Field Gaiwan · 5 units')).toBeVisible();
  await expect(page.getByText('3 units → 5 units')).toBeVisible();
  await page.getByRole('button', { name: 'Recount', exact: true }).click();
  await page.getByLabel('New balance').fill('4');
  await page.getByRole('button', { name: 'Record movement' }).click();
  expect(movementBodies.at(-1)).toMatchObject({ movement_type: 'recount', unit: 'unit', expected_balance: 5, balance: 4 });
  await expect(page.getByText('Field Gaiwan · 4 units')).toBeVisible();
});

test('quick edit opens Recount and full product edit opens movements without absolute stock writes', async ({ page }) => {
  const row = page.locator('tr[data-product-id="tea-1"]');
  await row.dispatchEvent('pointerdown');
  await page.waitForTimeout(600);
  await row.dispatchEvent('pointerup');
  await page.getByRole('button', { name: 'Recount stock for Cloud Oolong' }).click();
  await expect(page.getByRole('button', { name: 'Recount', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('New balance').fill('88');
  await page.getByRole('button', { name: 'Record movement' }).click();
  expect(movementBodies.at(-1)).toMatchObject({ movement_type: 'recount', balance: 88, expected_balance: 100 });
  await expect(page.getByText('Cloud · 88g')).toBeVisible();
  await expect(page.getByText('100g → 88g')).toBeVisible();
  expect(absoluteStockWrites).toHaveLength(0);
  await page.getByRole('button', { name: 'Close stock movement' }).click();

  await page.getByText('Cloud Oolong').click();
  await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('[role="dialog"][aria-hidden="false"]').getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await expect(page.getByRole('dialog', { name: 'Change stock — Cloud Oolong' })).toBeVisible();
  expect(absoluteStockWrites).toHaveLength(0);
});

test('invoice-driven sale remains available and Sale is not an ad-hoc movement action', async ({ page }) => {
  await page.getByText('Cloud Oolong').click();
  await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Invoice' }).click();
  await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible();
  await expect(page.locator('input[value="Cloud"]')).toBeVisible();
  await page.getByPlaceholder('Name or search existing customer…').fill('Field Buyer');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'New Invoice' })).toHaveCount(0);
  expect(invoiceBodies).toHaveLength(1);
  expect(invoiceBodies[0]).toMatchObject({
    invoice: { customer_name: 'Field Buyer', status: 'Draft' },
    lineItems: [{ product_id: 'tea-1', quantity: 10 }],
  });
  expect(movementBodies.filter(body => body.movement_type === 'sale')).toHaveLength(0);
});

test('mobile panel is full width, closes without breaking scroll, and returns focus', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Change stock for Cloud Oolong' });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Change stock — Cloud Oolong' });
  const box = await dialog.boundingBox();
  if ((page.viewportSize()?.width || 0) < 768) {
    expect(box?.width).toBeGreaterThan((page.viewportSize()?.width || 390) - 4);
  } else {
    expect(box?.width).toBeLessThanOrEqual(522);
  }
  await page.getByRole('button', { name: 'Close stock movement' }).click();
  await expect(trigger).toBeFocused();
  const scroll = page.getByTestId('inventory-scroll');
  await expect.poll(() => scroll.evaluate(el => getComputedStyle(el).overflowY)).toMatch(/auto|scroll/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('stock movement dialog traps keyboard focus and Escape restores its trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Change stock for Cloud Oolong' });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Change stock — Cloud Oolong' });
  const close = page.getByRole('button', { name: 'Close stock movement' });
  await expect(close).toBeFocused();
  await close.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
