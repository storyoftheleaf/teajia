import { expect, test } from './fixtures';

function token() {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
}

test('inventory purpose labels fit at phone, tablet, and desktop widths', async ({ page }, testInfo) => {
  const jwt = token();
  await page.addInitScript(value => {
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'acct', activeUserId: 'admin', memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }],
    } }));
  }, jwt);
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'admin', email: 'admin@test', role: 'owner' } }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { token: jwt } }));
  await page.route('**/api/products', route => route.fulfill({ json: [] }));
  await page.route('**/api/rates', route => route.fulfill({ json: [] }));
  await page.route('**/api/accounts/acct', route => route.fulfill({ json: { id: 'acct', name: 'Test', slug: 'test' } }));
  await page.route('**/api/inventory/receipts**', route => route.fulfill({ json: [] }));
  await page.route('**/api/batches**', route => route.fulfill({ json: [] }));
  await page.goto('/admin/stock');

  const row = page.getByTestId('inventory-purpose-row');
  const personal = row.getByRole('button', { name: 'Personal', exact: true });
  await expect(personal).toBeVisible({ timeout: 15_000 });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expect(personal).toBeVisible();
    const geometry = await personal.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    await page.screenshot({ path: testInfo.outputPath(`inventory-purpose-${width}.png`), fullPage: false });
  }
});
