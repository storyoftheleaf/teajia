import { test, expect, tapFloor } from './fixtures';
import { injectAuth, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

for (const width of [375, 390, 1280]) {
  test(`stock and source controls remain usable without overflow at ${width}px`, async ({ page }, testInfo) => {
    await injectAuth(page);
    await mockInventoryApi(page);
    // Keep the low, empty, and healthy-stock cases on the actual screen.
    await page.route('**/api/products', route => route.fulfill({ json: [MOCK_PRODUCTS[1], MOCK_PRODUCTS[2], MOCK_PRODUCTS[6], { ...MOCK_PRODUCTS[4], stock_grams: null }] }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/stock');
    if (width < 768) {
      // The phone is the 8 October list (2026-11-25): one tap row per tea, its
      // stock changed in the panel that opens, not in buttons on the row.
      const list = page.getByTestId('stock-phone');
      const teaRow = list.getByRole('button', { name: /Oolong Test Tea 02/ });
      await expect(teaRow).toBeVisible();
      expect((await teaRow.boundingBox())!.height).toBeGreaterThanOrEqual(tapFloor());
      // A low tea's count is red; a healthy one is not.
      await expect(teaRow.locator('.text-tea-error')).toHaveCount(1);
      await expect(list.getByRole('button', { name: /Oolong Test Tea 03/ }).locator('.text-tea-error')).toHaveCount(0);
      await teaRow.click();
      const panel = page.getByRole('region', { name: 'Oolong Test Tea 02, at a glance' });
      await expect(panel).toBeVisible();
      // The panel's minus, count and plus are drawn 32px across, under the 44px
      // finger floor (open with Adrian, 2026-11-26), so this guards that each is
      // on screen and nothing covers it, not its size.
      const controls = [
        panel.getByRole('button', { name: 'Take some Oolong Test Tea 02 out', exact: true }),
        panel.getByRole('button', { name: 'Type a new count for Oolong Test Tea 02', exact: true }),
        panel.getByRole('button', { name: 'Add some Oolong Test Tea 02', exact: true }),
      ];
      await expect(controls[1]).toHaveClass(/text-tea-error/);
      for (const control of controls) {
        await expect(control).toBeVisible();
        expect(await control.evaluate(el => {
          const box = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        })).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`stock-row-${width}.png`) });
      return;
    }
    const row = page.locator('tr[data-product-id="test-product-2"]');
    await expect(row).toBeVisible();
    const stock = row.getByRole('button', { name: /^Change stock for Oolong Test Tea 02/ });
    const source = row.getByRole('button', { name: 'Open supplier Mountain Source', exact: true });
    for (const control of [stock, source]) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(tapFloor());
      expect(box.height).toBeGreaterThanOrEqual(tapFloor());
      // No invisible hit overlay intercepts the actual button centre.
      expect(await control.evaluate(el => {
        const box = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(46);
    await expect(stock).toContainText('47');
    await expect(stock).toContainText('Low');
    await expect(stock).toHaveAccessibleName('Change stock for Oolong Test Tea 02, low stock');
    await expect(page.locator('tr[data-product-id="test-product-3"] [data-stock-column="stockGrams"]')).not.toContainText('Low');
    await expect(page.locator('tr[data-product-id="test-product-7"] [data-stock-column="stockGrams"]')).not.toContainText('Low');
    await page.screenshot({ path: testInfo.outputPath(`stock-row-${width}.png`) });
    await stock.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Change stock: Oolong Test Tea 02', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close stock movement', exact: true }).click();
    await expect(stock).toBeFocused();
  });
}
