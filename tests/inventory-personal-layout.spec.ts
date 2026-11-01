import { expect, test } from './fixtures';

function token() {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
}

// Below 768px the phone shows Stock cards instead (stock-reference.spec.ts),
// so the labels are measured where they are a row.
test('inventory purpose labels fit at tablet and desktop widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'Mobile Chrome', 'The phone shows these in a menu, not a row');
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

  // The purposes are choices in the Show teas select since the 2026-10-27
  // header, one of four labelled choices in this row; each must fit its box.
  const row = page.getByTestId('inventory-purpose-row');
  const personal = row.getByRole('combobox', { name: 'Show teas' });
  await expect(personal.locator('option', { hasText: /^Personal$/ })).toHaveCount(1, { timeout: 15_000 });
  await personal.selectOption({ label: 'Personal' });
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expect(personal).toBeVisible();
    await expect.poll(() => row.evaluate(element => element.scrollWidth - element.clientWidth), { message: `the browsing row fits at ${width}px` }).toBeLessThanOrEqual(0);
    // Measure in the page's own typeface. Before Cormorant arrives the button is
    // sized for the fallback face and, for one frame after the swap, the text is
    // wider than its box; that was measured as a clipped label about one run in
    // three (2026-09-29) and never lasted past the swap. A label that truly does
    // not fit still fails: the poll gives up after five seconds.
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(
      () => personal.evaluate(element => element.scrollWidth - element.clientWidth),
      { message: `Personal fits its box at ${width}px`, timeout: 5_000 },
    ).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`inventory-purpose-${width}.png`), fullPage: false });
  }
});
