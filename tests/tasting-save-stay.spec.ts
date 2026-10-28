import { test, expect } from './fixtures';
import { installCompassHarness } from './helpers/compassHarness';

test('Save keeps tasting open even after the tea leaves To taste', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installCompassHarness(page, { compassEntries: [{
    id: 'save-stay', category: 'tea', name: 'Save in place tea', type: 'Dark',
    vendor_name: 'Huang Wei', status: 'incoming', created_at: new Date().toISOString(),
  }] });
  await page.goto('/admin/compass?tab=library');
  await page.getByRole('button', { name: /^To taste/ }).click();
  await page.getByRole('button', { name: 'Taste Save in place tea', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  await nav.getByRole('button', { name: 'Effect', exact: true }).click();
  await page.getByRole('button', { name: 'Calm', exact: true }).click();
  await page.getByRole('button', { name: 'Save tasting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tasting saved', exact: true })).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  await expect(page.getByTestId('library-entry-save-stay')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/tasting-saved-in-place.png' });
  await page.getByRole('button', { name: 'Calm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save tasting', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Calm', exact: true }).click();
  await page.getByRole('button', { name: 'Save tasting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tasting saved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/compass\?tab=library/);
});
