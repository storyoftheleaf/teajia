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
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await page.getByRole('button', { name: /Sample list —/ }).click();
    await page.getByRole('button', { name: 'Edit 1998 Dong Ding' }).click();

    await page.getByLabel('Inventory holding').selectOption('holding-1');
    await page.getByRole('button', { name: 'Save holding link' }).click();
    expect(movements).toHaveLength(0);
    await expect(page.getByText('Linked without changing stock')).toBeVisible();

    await page.getByRole('button', { name: 'Use 10g from holding' }).click();
    const confirmation = page.getByRole('dialog', { name: 'Confirm sample use' });
    await expect(confirmation).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByRole('button', { name: 'Cancel sample use' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Confirm 10g sample use' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel sample use' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmation).toBeHidden();
    await expect(page.getByText('Edit Sample')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use 10g from holding' })).toBeFocused();

    await page.getByRole('button', { name: 'Use 10g from holding' }).click();
    await page.evaluate(() => {
      const confirm = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Confirm 10g sample use'));
      confirm?.click();
      confirm?.click();
    });
    await expect.poll(() => movements.length).toBe(1);
    expect(movements[0]).toMatchObject({ movement_type: 'sample_use', quantity: 10, unit: 'g', expected_balance: 42 });
    await expect(page.getByRole('button', { name: 'Use 10g from holding' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Record another sample use' })).toBeVisible();
  });

  test('reuses a persisted movement key after a lost response and records one completed use', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    const appliedKeys = new Set<string>();
    await installCompassHarness(page, { sampleCart: [CART_ITEM], preserveSamplesOnNavigation: true, products: [{
      id: 'holding-1', type: 'Oolong', given_name: 'Dong Ding holding', product_name: 'Dong Ding',
      stock_grams: 42, status: 'Active', inventory_purpose: 'sample', origin_country: '', origin_region: '',
    }] });
    await page.route('**/api/products/holding-1/movements', async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push(body);
      const key = String(body.idempotency_key);
      const alreadyApplied = appliedKeys.has(key);
      appliedKeys.add(key);
      if (!alreadyApplied) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Response lost after commit' }) });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'movement-1', after_balance: 32, already_applied: true }) });
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await page.getByRole('button', { name: /Sample list —/ }).click();
    await page.getByRole('button', { name: 'Edit 1998 Dong Ding' }).click();
    await page.getByLabel('Inventory holding').selectOption('holding-1');
    await page.getByRole('button', { name: 'Save holding link' }).click();
    await page.getByRole('button', { name: 'Use 10g from holding' }).click();
    await page.getByRole('button', { name: 'Confirm 10g sample use' }).click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.getByText('Response lost after commit', { exact: true })).toBeVisible();
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.samples[0]);
    expect(pending.holdingUsePendingIdempotencyKey).toBe(requests[0].idempotency_key);
    expect(pending.completedHoldingMovement).toBeUndefined();

    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Edit 1998 Dong Ding' }).click();
    await expect(page.getByRole('button', { name: 'Retry 10g sample use' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry 10g sample use' }).click();
    await page.getByRole('button', { name: 'Confirm 10g sample use' }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].idempotency_key).toBe(requests[0].idempotency_key);
    const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.samples[0]);
    expect(completed).toMatchObject({
      inventoryHoldingProductId: 'holding-1',
      completedHoldingMovement: { id: 'movement-1', idempotencyKey: requests[0].idempotency_key, quantity: 10, afterBalance: 32 },
    });
    expect(completed.holdingUsePendingIdempotencyKey).toBeUndefined();
    expect(appliedKeys.size).toBe(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      return useSampleStore.getState().samples.length;
    })).toBeGreaterThan(0);
    const hydrated = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      return useSampleStore.getState().samples[0];
    });
    expect(hydrated).toMatchObject({
      inventoryHoldingProductId: 'holding-1', lastHoldingUseAt: expect.any(String),
      completedHoldingMovement: { id: 'movement-1', idempotencyKey: requests[0].idempotency_key, quantity: 10, afterBalance: 32 },
    });
    expect(hydrated.holdingUsePendingIdempotencyKey).toBeUndefined();
  });

  test('persists history, identity, tastings, labels, and both source destinations across reopen', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM], preserveSamplesOnNavigation: true });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    const identity = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('teajia-samples') || '{}').state;
      return { setId: state.sampleSets[0].id, sample: state.samples[0] };
    });
    expect(identity.sample).toMatchObject({
      compassEntryId: 'compass-tea-1', productId: 'product-42', teaKey: 'oolong:1998-dong-ding',
    });
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await page.getByRole('button', { name: /Sample list —/ }).click();
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
    await expect(page.getByText('Print labels', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open in Curate to taste' }).click();
    await expect(page).toHaveURL(/\/admin\/compass\?entry=compass-tea-1/);

    await page.goto(`/admin/samples?set=${encodeURIComponent(identity.setId)}`);
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    await page.getByRole('button', { name: 'Open inventory product' }).click();
    await expect(page).toHaveURL(/\/admin\/stock\?panel=product-42/);

    await page.goto(`/admin/samples?set=${encodeURIComponent(identity.setId)}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample batches' })).toBeVisible();
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

test.describe('Sample list and Sample batches interface', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('does not create an untitled batch until a name is confirmed', async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (0)' }).first().click();
    await expect(page.getByRole('heading', { name: 'Sample list' })).toBeVisible();
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await expect(page.getByRole('heading', { name: 'Sample batches' })).toBeVisible();

    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      return useSampleStore.getState().sampleSets.length;
    })).toBe(0);

    await page.getByRole('button', { name: 'New batch' }).click();
    const name = page.getByLabel('Batch name');
    await expect(name).toBeVisible();
    await expect(name).toHaveCSS('font-size', '16px');
    await expect(page.getByRole('button', { name: 'Create batch' })).toBeDisabled();
    await name.fill('July Wuyi samples');
    await page.getByRole('button', { name: 'Create batch' }).click();

    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      return useSampleStore.getState().sampleSets.map((set: { name: string }) => set.name);
    })).toEqual(['July Wuyi samples']);

    await page.getByRole('button', { name: 'Back to batches' }).click();
    await page.getByRole('button', { name: /All/ }).click();
    const allSearch = page.getByLabel('Search all samples');
    await expect(allSearch).toHaveCSS('font-size', '16px');
    for (const control of await page.getByRole('button', { name: /^(All|Requested|Received|Untasted|Tasted|Favorite|To Order|Ordered|Passed)$/ }).all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('keeps sample-list operations reachable with mobile touch targets', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();

    for (const label of ['Save as sample batch', 'Print sample list', 'Share sample list on WhatsApp']) {
      const control = page.getByRole('button', { name: label });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText('1998 Dong Ding')).toHaveCSS('font-size', '16px');
  });
});
