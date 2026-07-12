import { test, expect, type Page } from '@playwright/test';

const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'u1', email: 'owner@test.dev', role: 'owner', platform_role: 'platform_owner', active_account_id: 'acct-bali', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }], exp: Math.floor(Date.now() / 1000) + 86400 })}.sig`;

async function setup(page: Page) {
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'u1', email: 'owner@test.dev', role: 'owner' } }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { token } }));
  await page.route('**/api/products', route => route.fulfill({ json: [] }));
  await page.route('**/api/rates', route => route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] }));
  await page.route('**/api/accounts/acct-bali', route => route.fulfill({ json: { id: 'acct-bali', name: 'Teajia Bali' } }));
  await page.route('**/api/batches**', route => route.fulfill({ json: [] }));
  for (const endpoint of ['admin/events', 'compass/incoming', 'user/favorites', 'tea-discovery', 'compass/entries', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, route => route.fulfill({ json: [] }));
  }
}

test.describe('structured stock import review', () => {
  test.beforeEach(async ({ page }) => setup(page));

  test('filters issues, edits required fields, applies purpose, and previews opening movements', async ({ page }) => {
    let submitted: Record<string, any> | null = null;
    await page.route('**/api/products/bulk', async route => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { inserted: 2, movements: 1, skipped: 0 } });
    });
    await page.goto('/admin/stock');
    await page.getByRole('button', { name: 'Open inventory actions' }).first().click();
    await page.getByRole('menuitem', { name: /Import CSV/i }).first().click({ force: true });
    await page.locator('input[type=file]').setInputFiles({
      name: 'stock.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Type,Product Name,Stock,Purpose\nOolong,Mountain Tea,25,sample\n,Unnamed Row,10,\nTeaware,Cup,,personal'),
    });

    await expect(page.getByText('3 Total')).toBeVisible();
    await expect(page.getByText('1 Issues')).toBeVisible();
    await expect(page.getByText('2 opening balances')).toBeVisible();
    await page.getByRole('button', { name: /1 Issues/ }).click();
    if ((page.viewportSize()?.width || 1000) < 768) await page.getByRole('button', { name: /Unnamed Row/ }).click();
    const type = page.locator('input[aria-label^="Type"]:visible').first();
    await type.fill('White');
    await expect(page.getByText('0 Issues')).toBeVisible();
    await page.getByRole('button', { name: /3 Total/ }).click();
    const typeInputs = page.locator('input[aria-label^="Type"]:visible');
    const whiteIndex = await typeInputs.evaluateAll(inputs => inputs.findIndex(input => (input as HTMLInputElement).value === 'White'));
    await typeInputs.nth(whiteIndex).fill('');
    await page.getByLabel('Purpose for all rows').selectOption('working');
    await page.getByLabel('Receipt / invoice label').fill('Invoice 88');
    await page.getByRole('button', { name: 'Import Ready (2)' }).click();
    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted?.receipt_label).toBe('Invoice 88');
    expect(submitted?.products).toHaveLength(2);
    expect(submitted?.products.every((row: any) => row.inventory_purpose === 'working')).toBe(true);
    await expect(page.getByText('1 Total')).toBeVisible();
    await expect(page.getByText('1 Issues')).toBeVisible();
  });
});
