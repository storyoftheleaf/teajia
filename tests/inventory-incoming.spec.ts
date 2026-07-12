import { test, expect } from '@playwright/test';

test('Incoming shows expected separately and supports partial receiving', async ({ page }) => {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now()/1000)+86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'admin', email: 'admin@test', role: 'owner' } }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { token } }));
  await page.route('**/api/products', route => route.fulfill({ json: [] }));
  await page.route('**/api/rates', route => route.fulfill({ json: [] }));
  await page.route('**/api/admin/events', route => route.fulfill({ json: [] }));
  await page.route('**/api/compass/incoming', route => route.fulfill({ json: [] }));
  await page.route('**/api/accounts/acct', route => route.fulfill({ json: { id: 'acct', name: 'Test tea house', slug: 'test' } }));
  await page.route('**/api/batches**', route => route.fulfill({ json: [] }));
  for (const endpoint of ['user/favorites', 'tea-discovery', 'compass/entries', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, route => route.fulfill({ json: [] }));
  }
  await page.route('**/api/inventory/receipts**', async route => route.fulfill({ json: [{ id: 'r1', state: 'in_transit', vendor_name: 'Lin', lines: [{ id: 'l1', product_name: 'Spring Oolong', expected_quantity: 100, received_quantity: 20, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] }] }));
  await page.goto('/admin/stock?incoming=1');
  await expect(page.getByRole('heading', { name: 'Incoming stock' })).toBeVisible();
  await expect(page.getByText('80 g expected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive remaining' })).toBeVisible();
});
