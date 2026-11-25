import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

// The 8 October phone list is back; the one-tap tools of the 26 October cards
// now live in the tea panel. Each must open what the card opened.
test('phone tea panel keeps Photo, Taste, Form and More', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  const shelf = MOCK_PRODUCTS.slice(0, 3).map(product => ({ ...product, vendor: 'Master Bo' }));
  await page.route('**/api/products', route => route.fulfill({ json: shelf }));
  await page.addInitScript(() => localStorage.setItem('teajia-stock-layout', 'table'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/stock');
  const supplier = page.getByRole('region', { name: 'Master Bo', exact: true });
  await expect(supplier).toBeVisible();
  await expect(page.locator('.stock-record')).toHaveCount(0);
  await supplier.getByRole('button', { name: /^Master Bo/ }).click();
  await page.getByText(shelf[0].product_name, { exact: true }).first().click();
  const tools = page.getByRole('group', { name: `Tools for ${shelf[0].product_name}` });
  await expect(tools).toBeVisible();
  for (const [label, dialog] of [['Photos for', /photo/i], ['Edit form and pricing for', /form|pric/i], ['More for', /tea details/i]] as const) {
    await tools.getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: dialog })).toHaveCount(0);
  }
  await expect(tools.getByRole('button', { name: /tasting for/ })).toBeVisible();
  // Supplier menu on the phone line: details, and rename.
  await page.getByRole('button', { name: 'Supplier actions for Master Bo', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit supplier name', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Supplier details', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
