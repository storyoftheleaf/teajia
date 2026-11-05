import { test, expect } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

for (const width of [375, 390, 1280]) {
  test(`stock and source controls remain usable without overflow at ${width}px`, async ({ page }, testInfo) => {
    await injectAuth(page);
    await mockInventoryApi(page);
    // Keep the low, empty, and healthy-stock cases on the actual screen.
    await page.route('**/api/products', route => route.fulfill({ json: [MOCK_PRODUCTS[1], MOCK_PRODUCTS[2], MOCK_PRODUCTS[6]] }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/stock');
    const row = page.locator('tr[data-product-id="test-product-2"]');
    await expect(row).toBeVisible();
    const stock = row.getByRole('button', { name: /^Change stock for Oolong Test Tea 02/ });
    const source = row.getByRole('button', { name: width < 768 ? 'Source for Oolong Test Tea 02: Mountain Source' : 'Open supplier Mountain Source', exact: true });
    for (const control of [stock, source]) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      // No invisible hit overlay intercepts the actual button centre.
      expect(await control.evaluate(el => {
        const box = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if (width >= 768) {
      expect((await row.boundingBox())!.height).toBeLessThanOrEqual(46);
      await expect(stock).toContainText('47');
      await expect(stock).toContainText('Low');
      await expect(stock).toHaveAccessibleName('Change stock for Oolong Test Tea 02, low stock');
      await expect(page.locator('tr[data-product-id="test-product-3"] [data-stock-column="stockGrams"]')).not.toContainText('Low');
      await expect(page.locator('tr[data-product-id="test-product-7"] [data-stock-column="stockGrams"]')).not.toContainText('Low');
    } else {
      await expect(row.getByRole('button', { name: 'Edit name for Oolong Test Tea 02', exact: true })).toHaveCSS('min-height', '44px');
    }
    await page.screenshot({ path: testInfo.outputPath(`stock-row-${width}.png`) });
    await stock.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Change stock: Oolong Test Tea 02', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close stock movement', exact: true }).click();
    await expect(stock).toBeFocused();
  });
}
