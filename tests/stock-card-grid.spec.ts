import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

test('Stock opens in Table and remembers a deliberately selected layout', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/products', route => route.fulfill({ json: MOCK_PRODUCTS.slice(0, 8) }));
  await page.goto('/admin/stock');

  const tableButton = page.getByRole('button', { name: 'Table', exact: true });
  const cardsButton = page.getByRole('button', { name: 'Cards', exact: true });
  const desktop = page.viewportSize()!.width >= 768;
  // On a phone, Table is the 8 October list and the Cards / Table choice lives in View options.
  const table = desktop ? page.getByTestId('inventory-column-row') : page.getByTestId('stock-phone');
  const options = page.getByRole('button', { name: 'View options', exact: true });
  const cards = page.getByTestId('stock-card-sections');
  await expect(table).toBeVisible();
  if (!desktop) await options.click();
  await expect(tableButton).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(0);

  await cardsButton.click();
  await expect(cards).toBeVisible();
  await page.reload();
  await expect(cards).toBeVisible();
  await expect(cards.locator('[data-testid^="stock-card-"]')).toHaveCount(8);
  await expect(table).toHaveCount(0);
  await expect(cardsButton).toHaveAttribute('aria-pressed', 'true');

  const first = page.getByTestId('stock-card-test-product-2');
  await expect(first).toContainText('Buyer');
  await first.getByRole('button', { name: 'Review listing', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review listing' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Review listing' }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Close product panel' }).click();
  await page.getByTestId('stock-card-test-product-4').getByRole('button', { name: 'Develop tea' }).click();
  await expect(page).toHaveURL(/\/admin\/compass\?/);
  await page.goto('/admin/stock');
  await tableButton.click();
  await expect(table).toBeVisible();
  await page.reload();
  await expect(table).toBeVisible();
  if (!desktop) await options.click();
  await expect(tableButton).toHaveAttribute('aria-pressed', 'true');
});

test('Stock below 768px is the 8 October supplier list, then becomes a spreadsheet', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/products', route => route.fulfill({ json: MOCK_PRODUCTS.slice(0, 3).map(product => ({ ...product, vendor: 'Master Bo' })) }));
  await page.addInitScript(() => {
    for (const key of ['stock-preview-auth', 'stock-preview-columns-v1', 'stock-preview-source-group-v3']) sessionStorage.setItem(key, '1');
    localStorage.setItem('teajia-stock-layout', 'table');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/stock');
  const supplier = page.getByRole('region', { name: 'Master Bo', exact: true });
  await expect(supplier).toBeVisible();
  await expect(supplier).toContainText('3 teas');
  for (const width of [320, 390, 600, 767]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(supplier).toBeVisible();
    await expect(page.locator('.stock-record')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.screenshot({ path: test.info().outputPath('stock-phone-list.png') });
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(page.locator('.stock-record')).toHaveCount(0);
  await expect(page.getByTestId('inventory-column-row')).toBeVisible();
});
