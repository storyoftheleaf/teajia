import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

test('Stock cards use two columns only when two readable cards fit, then become a spreadsheet', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/products', route => route.fulfill({ json: MOCK_PRODUCTS.slice(0, 3).map(product => ({ ...product, vendor: 'Master Bo' })) }));
  await page.addInitScript(() => {
    for (const key of ['stock-preview-auth', 'stock-preview-columns-v1', 'stock-preview-source-group-v3']) sessionStorage.setItem(key, '1');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/stock');
  await page.locator('tr[data-product-id]').first().waitFor();
  await page.evaluate(async () => {
    const { useAppStore } = await import('/src/lib/store.ts');
    useAppStore.getState().setInventoryGroupBy('vendor');
  });
  const rows = page.locator('[data-stock-group="Master Bo"] tr[data-product-id]');
  for (const width of [390, 679, 680, 740, 767]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(rows).toHaveCount(3);
    const first = await rows.nth(0).boundingBox();
    const second = await rows.nth(1).boundingBox();
    const third = await rows.nth(2).boundingBox();
    if (width < 680) expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    else {
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
      expect(second!.x).toBeGreaterThan(first!.x + first!.width);
      expect(third!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
      expect(first!.width).toBeGreaterThanOrEqual(320);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width === 740) {
      await page.screenshot({ path: test.info().outputPath('stock-two-column-cards.png') });
      await rows.first().getByRole('button', { name: /Edit given name/ }).click();
      await expect(page.getByRole('dialog', { name: 'Given name', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    }
  }
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(page.locator('.stock-record')).toHaveCount(0);
  await expect(page.getByTestId('inventory-column-row')).toBeVisible();
});
