import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const CART_ITEM = {
  id: 'compass-tea-1', name: '1998 Dong Ding', type: 'Oolong', grams: 10,
  compassEntryId: 'compass-tea-1', productId: 'product-42', teaKey: 'oolong:1998-dong-ding',
};

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

  test('persists history, identity, tastings, labels, and both source destinations across reopen', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM], preserveSamplesOnNavigation: true });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    const identity = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('teajia-samples') || '{}').state;
      return { setId: state.sampleSets[0].id, sample: state.samples[0] };
    });
    expect(identity.sample).toMatchObject({
      compassEntryId: 'compass-tea-1', productId: 'product-42', teaKey: 'oolong:1998-dong-ding',
    });
    await page.getByRole('button', { name: 'Manage sample sets' }).click();
    await page.getByText(/Sample Cart/).first().click();
    await page.getByRole('button', { name: 'Batch details' }).click();
    for (const purpose of ['Sourcing', 'Gifted', 'Event', 'Panel']) await expect(page.getByRole('button', { name: purpose, exact: true })).toBeVisible();
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      const sample = useSampleStore.getState().samples[0];
      useSampleStore.getState().addTasting(sample.id, {
        id: 'tasting-1', tasterId: 'admin', tasting: { aroma: ['orchid'] },
        verdict: 'love', wouldBuy: true, createdAt: '2026-07-12T00:00:00.000Z',
      });
    });
    await expect(page.getByText('1 tasting')).toBeVisible();

    await page.getByRole('button', { name: 'Print labels' }).click();
    await expect(page.getByText('Print Labels', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open in Curate to taste' }).click();
    await expect(page).toHaveURL(/\/admin\/compass\?entry=compass-tea-1/);

    await page.goto(`/admin/samples?set=${encodeURIComponent(identity.setId)}`);
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    await page.getByRole('button', { name: 'Open inventory product' }).click();
    await expect(page).toHaveURL(/\/admin\/stock\?panel=product-42/);

    await page.goto(`/admin/samples?set=${encodeURIComponent(identity.setId)}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample sets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    const persisted = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      return {
        disk: JSON.parse(localStorage.getItem('teajia-samples') || '{}').state,
        hydrated: useSampleStore.getState().samples[0],
      };
    });
    expect(persisted.disk.sampleSets.some((set: { id: string }) => set.id === identity.setId)).toBe(true);
    expect(persisted.disk.samples[0].tastings).toHaveLength(1);
    expect(persisted.hydrated).toMatchObject({ teaKey: 'oolong:1998-dong-ding', productId: 'product-42' });
    expect(persisted.hydrated.tastings).toHaveLength(1);
  });
});
