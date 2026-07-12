import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const CART_ITEM = { id: 'compass-tea-1', name: '1998 Dong Ding', type: 'Oolong', grams: 10, compassEntryId: 'compass-tea-1' };

test.describe('sample portions and physical holdings stay distinct', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('links a portion to Inventory without silently consuming its holding', async ({ page }) => {
    const movements: unknown[] = [];
    await installCompassHarness(page, { sampleCart: [CART_ITEM], products: [{
      id: 'holding-1', type: 'Oolong', given_name: 'Dong Ding holding', product_name: 'Dong Ding',
      stock_grams: 42, status: 'Active', inventory_purpose: 'sample', origin_country: '', origin_region: '',
    }] });
    await page.route('**/api/products/holding-1/movements', async route => {
      movements.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ after_balance: 32 }) });
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    await page.getByRole('button', { name: 'Manage sample sets' }).click();
    await page.getByText(/Sample Cart/).first().click();
    await page.getByRole('button', { name: 'Edit 1998 Dong Ding' }).click();

    await page.getByLabel('Inventory holding').selectOption('holding-1');
    await page.getByRole('button', { name: 'Save holding link' }).click();
    expect(movements).toHaveLength(0);
    await expect(page.getByText('Linked without changing stock')).toBeVisible();

    await page.getByRole('button', { name: 'Use 10g from holding' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirm sample use' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm 10g sample use' }).click();
    await expect.poll(() => movements.length).toBe(1);
    expect(movements[0]).toMatchObject({ movement_type: 'sample_use', quantity: 10, unit: 'g', expected_balance: 42 });
  });

  test('preserves set purposes, history, labels, tastings, and Curate links', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    await page.getByRole('button', { name: 'Manage sample sets' }).click();
    await page.getByText(/Sample Cart/).first().click();
    await page.getByRole('button', { name: 'Batch details' }).click();
    for (const purpose of ['Sourcing', 'Gifted', 'Event', 'Panel']) await expect(page.getByRole('button', { name: purpose, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print labels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open in Curate to taste' })).toBeVisible();
  });
});
