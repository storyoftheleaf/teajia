import { test, expect } from './fixtures';

test('Incoming shows expected separately and supports partial receiving', async ({ page }) => {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now()/1000)+86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
  // Nothing may escape to the real API: an unmocked call used to leave the
  // shell waiting on the network, and a session that never settles renders as
  // a signed-out one.
  await page.route('**/api/**', route => route.fulfill({ status: 501, json: { error: `Unhandled ${route.request().method()} ${new URL(route.request().url()).pathname}` } }));
  // A token alone no longer opens an admin route: the shell also needs the
  // account it is acting for. Without it the app decides there is no session
  // and redirects to sign-in, so both tests here were asserting against the
  // sign-in page rather than against the receipts panel.
  await page.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'acct', activeUserId: 'admin',
      memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }],
    } }));
  }, token);
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
  let received = 20; let currentOnHand = 55; let cancelled = 0; let listCalls = 0; let purposeResolved = false;
  const receiveKeys: string[] = [];
  const receipt = () => [{ id: 'r1', state: received || cancelled ? 'partially_received' : 'in_transit', vendor_name: 'Lin', source_kind: 'invoice', source_ref: 'INV-4', lines: [{ id: 'l1', product_name: 'Spring Oolong', expected_quantity: 100, received_quantity: received, cancelled_quantity: cancelled, current_on_hand: currentOnHand, unit: 'g', intended_purpose: 'working', source_ref: 'INV-4' }] }];
  await page.route('**/api/inventory/receipts**', async route => { listCalls++; await route.fulfill({ json: receipt() }); });
  await page.route('**/api/inventory/receipt-lines/l1/receive', async route => {
    const body = route.request().postDataJSON() as { quantity: number; idempotency_key: string };
    receiveKeys.push(body.idempotency_key);
    if (!purposeResolved) {
      await route.fulfill({ status: 409, json: { error: 'This holding is sample; receiving it as working requires a separate holding or deliberate purpose conversion.', code: 'purpose_conflict' } });
      return;
    }
    received += body.quantity; currentOnHand += body.quantity;
    await route.fulfill({ json: { received_quantity: received, remaining_quantity: 100-received-cancelled, state: 'partially_received' } });
  });
  await page.route('**/api/inventory/receipt-lines/l1/cancel-remaining', async route => { cancelled = 100-received; await route.fulfill({ json: { cancelled_quantity: cancelled, state: 'received' } }); });
  // The receiving panel: Ordered, Arrived and Coming per line, with the shelf's
  // own count under Stock and corrections.
  const item = page.locator('.purchase-tracking-item').filter({ hasText: 'Spring Oolong' });
  const expectLine = async ({ ordered, arrived, coming, shelf }: { ordered: number; arrived: number; coming: number; shelf: number }) => {
    const quantities = item.locator('.purchase-tracking-quantities');
    await expect(quantities).toContainText(`Ordered ${ordered} g`);
    await expect(quantities).toContainText(`Arrived ${arrived} g`);
    await expect(quantities).toContainText(`Coming ${coming} g`);
    await expect(item).toContainText(`Shelf stock: ${shelf} g`);
  };
  // Bare ?incoming=1 now opens Purchases; a specific delivery opens the receiving panel.
  await page.goto('/admin/stock?incoming=1&receipt=r1');
  await expect(page.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  await expectLine({ ordered: 100, arrived: 20, coming: 80, shelf: 55 });
  await expect(page.locator('article').filter({ hasText: 'Spring Oolong' })).toContainText('invoice · INV-4');
  await page.getByLabel('Quantity received for Spring Oolong').fill('30');
  await page.getByRole('button', { name: 'Receive', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('requires a separate holding or deliberate purpose conversion');
  await expect(page.getByLabel('Quantity received for Spring Oolong')).toHaveValue('30');
  await expect(page.getByLabel('Quantity received for Spring Oolong')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry Receive', exact: true })).toHaveCount(0);
  expect(received).toBe(20);
  // The conflict rejected the attempt before any stock movement. Once the
  // holding purpose is corrected elsewhere, Receive starts a fresh request.
  purposeResolved = true;
  await page.getByRole('button', { name: 'Receive', exact: true }).click();
  await expect.poll(() => receiveKeys).toHaveLength(2);
  expect(receiveKeys[1]).not.toBe(receiveKeys[0]);
  await expectLine({ ordered: 100, arrived: 50, coming: 50, shelf: 85 });
  expect(listCalls).toBeGreaterThan(1);
  // Cancelling what is still owed is a correction, folded under the line.
  await item.getByText('Stock and corrections').click();
  await page.getByRole('button', { name: 'Cancel remaining' }).click();
  await expectLine({ ordered: 100, arrived: 50, coming: 0, shelf: 85 });
  await page.reload();
  await expectLine({ ordered: 100, arrived: 50, coming: 0, shelf: 85 });
});

test('receipt deep link loads closed receipts and shows the exact finalized receipt', async ({ page }) => {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now()/1000)+86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
  // Nothing may escape to the real API: an unmocked call used to leave the
  // shell waiting on the network, and a session that never settles renders as
  // a signed-out one.
  await page.route('**/api/**', route => route.fulfill({ status: 501, json: { error: `Unhandled ${route.request().method()} ${new URL(route.request().url()).pathname}` } }));
  // A token alone no longer opens an admin route: the shell also needs the
  // account it is acting for. Without it the app decides there is no session
  // and redirects to sign-in, so both tests here were asserting against the
  // sign-in page rather than against the receipts panel.
  await page.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'acct', activeUserId: 'admin',
      memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }],
    } }));
  }, token);
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
  let requestedUrl = '';
  await page.route('**/api/inventory/receipts**', route => {
    requestedUrl = route.request().url();
    return route.fulfill({ json: [
      { id: 'receipt-finalized', state: 'received', vendor_name: 'Chen Family', source_kind: 'curate_import', source_ref: 'Taiwan Spring', lines: [{ id: 'line-finalized', product_name: 'Spring Oolong', expected_quantity: 500, received_quantity: 500, cancelled_quantity: 0, current_on_hand: 500, unit: 'g', intended_purpose: 'working' }] },
      { id: 'receipt-other', state: 'in_transit', vendor_name: 'Other vendor', source_kind: 'invoice', source_ref: 'INV-2', lines: [] },
    ] });
  });

  await page.goto('/admin/stock?receipt=receipt-finalized');

  await expect(page.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  await expect(page.getByText('Chen Family')).toBeVisible();
  await expect(page.getByText('received', { exact: true })).toBeVisible();
  await expect(page.getByText('Spring Oolong')).toBeVisible();
  await expect(page.getByText('Other vendor')).toHaveCount(0);
  expect(new URL(requestedUrl).searchParams.get('include_closed')).toBe('1');
});
