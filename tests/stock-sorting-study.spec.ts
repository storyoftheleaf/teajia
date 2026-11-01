import { expect, test } from './fixtures';
import { injectAuth, mockInventoryApi } from './helpers/inventoryMocks';

test('five heading studies preserve the actual Stock records and work at phone and desktop widths', async ({ page }) => {
  test.setTimeout(60000);
  // Signed in with the shared Stock shelf, as the card and polish studies are;
  // without it /admin/stock is the sign-in page and there is no study to see.
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  let original = '';
  for (const example of [1, 2, 3, 4, 5]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/stock?headingStudy=${example}`);
    await expect(page.getByTestId('stock-heading-study')).toBeVisible();
    const card = page.locator('.stock-record').first();
    await expect(card).toBeVisible();
    const content = await card.innerHTML();
    if (example === 1) original = content;
    else expect(content).toBe(original);
    for (const width of [320, 390, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (width !== 320) await page.screenshot({ path: test.info().outputPath(`heading-${example}-${width}.png`) });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Stock', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stock ↑', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/admin/stock?headingStudy=4');
  // Study 4's contained button names the current grouping and order, 'Group · Order ↑'.
  await page.getByTestId('stock-heading-study').getByRole('button', { name: / · .+[↑↓]$/ }).click();
  await expect(page.getByRole('dialog', { name: 'View options', exact: true })).toBeVisible();
});
