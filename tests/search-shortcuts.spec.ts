import { expect, test } from './fixtures';

test('public Ctrl+K opens Global Search and Escape closes it', async ({ page }, testInfo) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: '139 teas. One curator.' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('public-search.png'), animations: 'disabled' });
  await expect(page.getByRole('dialog', { name: 'Command palette', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search', exact: true })).toHaveCount(0);
});
