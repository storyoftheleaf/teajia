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
  let received = 20; let currentOnHand = 55; let cancelled = 0; let listCalls = 0; let failReceive = true;
  const receipt = () => [{ id: 'r1', state: received || cancelled ? 'partially_received' : 'in_transit', vendor_name: 'Lin', source_kind: 'invoice', source_ref: 'INV-4', lines: [{ id: 'l1', product_name: 'Spring Oolong', expected_quantity: 100, received_quantity: received, cancelled_quantity: cancelled, current_on_hand: currentOnHand, unit: 'g', intended_purpose: 'working', source_ref: 'INV-4' }] }];
  await page.route('**/api/inventory/receipts**', async route => { listCalls++; await route.fulfill({ json: receipt() }); });
  await page.route('**/api/inventory/receipt-lines/l1/receive', async route => { if (failReceive) { failReceive = false; await route.fulfill({ status: 409, json: { error: 'This holding is sample; receiving it as working requires a separate holding or deliberate purpose conversion.', code: 'purpose_conflict' } }); return; } const body = route.request().postDataJSON(); received += body.quantity; currentOnHand += body.quantity; await route.fulfill({ json: { received_quantity: received, remaining_quantity: 100-received-cancelled, state: 'partially_received' } }); });
  await page.route('**/api/inventory/receipt-lines/l1/cancel-remaining', async route => { cancelled = 100-received; await route.fulfill({ json: { cancelled_quantity: cancelled, state: 'received' } }); });
  await page.goto('/admin/stock?incoming=1');
  await expect(page.getByRole('heading', { name: 'Incoming stock' })).toBeVisible();
  await expect(page.getByText('Expected: 100 g · Current on hand: 55 g · Received here: 20 g · Remaining: 80 g')).toBeVisible();
  await expect(page.getByText('invoice · INV-4')).toBeVisible();
  await page.getByLabel('Quantity received for Spring Oolong').fill('30');
  await page.getByRole('button', { name: 'Receive', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('requires a separate holding or deliberate purpose conversion');
  await expect(page.getByLabel('Quantity received for Spring Oolong')).toHaveValue('30');
  await page.getByRole('button', { name: 'Receive', exact: true }).click();
  await expect(page.getByText('Expected: 100 g · Current on hand: 85 g · Received here: 50 g · Remaining: 50 g')).toBeVisible();
  expect(listCalls).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Cancel remaining' }).click();
  await expect(page.getByText('Expected: 100 g · Current on hand: 85 g · Received here: 50 g · Remaining: 0 g')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Expected: 100 g · Current on hand: 85 g · Received here: 50 g · Remaining: 0 g')).toBeVisible();
});
