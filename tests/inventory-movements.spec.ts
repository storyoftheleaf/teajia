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
};

let balance = 100;
let failNext = false;
const movements: any[] = [];

async function install(page: Page) {
  const jwt = token();
  balance = 100;
  movements.length = 0;
  failNext = false;
  await page.route('**/api/**', route => route.fulfill({ status: 501, json: { error: `Unhandled ${route.request().method()} ${new URL(route.request().url()).pathname}` } }));
  await page.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct', activeUserId: 'admin', memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }] } }));
  }, jwt);
  await page.route('**/api/auth/me', r => r.fulfill({ json: { id: 'admin', email: 'operator@test', role: 'owner' } }));
  await page.route('**/api/auth/refresh', r => r.fulfill({ json: { token: jwt } }));
  await page.route('**/api/products', r => r.fulfill({ json: [{ ...product, stock_grams: balance }] }));
  await page.route('**/api/products/*/events', r => r.fulfill({ json: [] }));
  await page.route('**/api/products/tea-1/movements', async r => {
    const body = r.request().postDataJSON();
    if (failNext) {
      failNext = false;
      await r.fulfill({ status: 409, json: { error: 'Stock changed elsewhere. Review the current balance and try again.' } });
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
    movements.unshift({ id: `movement-${movements.length + 1}`, movement_type: body.movement_type, reason: body.movement_type.toUpperCase(), delta: next - before, balance_before: before, balance_after: next, user_email: 'operator@test', note: body.note, source_invoice_number: body.source_invoice_number, created_at: new Date().toISOString() });
    await r.fulfill({ status: 201, json: { id: movements[0].id, before_balance: before, after_balance: next } });
  });
  await page.route('**/api/stock-ledger**', r => r.fulfill({ json: { entries: movements, total: movements.length } }));
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
  await expect(page.getByText('Stock changed elsewhere. Review the current balance and try again.')).toBeVisible();
  await expect(page.getByLabel('Quantity')).toHaveValue('10');
  await expect(page.getByLabel('Movement note')).toHaveValue('Vendor gift');
});

test('transfer requires a destination and recount records an absolute balance', async ({ page }) => {
  await page.getByRole('button', { name: 'Change stock for Cloud Oolong' }).click();
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByLabel('Quantity').fill('5');
  await expect(page.getByText('Choose a destination holding')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record movement' })).toBeDisabled();
  await page.getByRole('button', { name: 'Recount', exact: true }).click();
  await page.getByLabel('New balance').fill('72');
  await expect(page.getByText('100g → 72g')).toBeVisible();
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.getByText('Cloud · 72g')).toBeVisible();
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
