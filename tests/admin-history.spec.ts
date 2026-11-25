/**
 * Back and forward in the admin (Adrian, 2026-11-25: "my web browser is not
 * recorded backs and forwards ... once I click on here, I get stuck").
 *
 * Tabs and the Stock record panel are history entries now, so the browser's
 * back and forward step through them, and section pages carry a Back row of
 * their own once there is somewhere in the site to go back to.
 */
import { test, expect } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

test.beforeEach(async ({ page }) => {
  await injectAuth(page);
  await mockInventoryApi(page);
});

test('People tabs step back and forward with the browser and the Back row', async ({ page }) => {
  await page.goto('/admin/people?tab=customers');
  const tabs = page.locator('nav').filter({ hasText: /Suppliers/i }).last();
  // First page of the visit: nothing to go back to, so no Back row.
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);

  await tabs.getByRole('button', { name: /Suppliers/i }).click();
  await expect(page).toHaveURL(/tab=sources/);
  await tabs.getByRole('button', { name: /Tags/i }).click();
  await expect(page).toHaveURL(/tab=tags/);

  await page.goBack();
  await expect(page).toHaveURL(/tab=sources/);

  // The in-page row does the same, and offers Forward after a Back.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/tab=customers/);
  await page.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(page).toHaveURL(/tab=sources/);
  await page.goForward();
  await expect(page).toHaveURL(/tab=tags/);
});

test('a Stock record opened from the list closes with browser back and reopens with forward', async ({ page, isMobile }) => {
  // On the phone a tap on the name edits it in place rather than opening the record.
  test.skip(isMobile, 'desktop list opens the record from the name');
  await page.goto('/admin/stock');
  await page.getByText(/Test Tea 01/).first().click();
  await expect(page).toHaveURL(/panel=test-product-1/);

  await page.goBack();
  await expect(page).not.toHaveURL(/panel=/);
  await page.goForward();
  await expect(page).toHaveURL(/panel=test-product-1/);
});
