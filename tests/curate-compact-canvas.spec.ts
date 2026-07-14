import { test, expect } from '@playwright/test';
import {
  expectNoUnhandledCompassApi,
  installCompassHarness,
  openCompass,
} from './helpers/compassHarness';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Curate compact sourcing canvas', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
  });

  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('keeps the order-independent work clusters compact and spatially stable', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const identity = canvas.getByTestId('curate-cluster-identity');
    const buying = canvas.getByTestId('curate-cluster-buying');
    const tasting = canvas.getByTestId('curate-cluster-tasting');

    await expect(identity).toBeVisible();
    await expect(buying).toBeVisible();
    await expect(tasting).toBeVisible();

    const identityBox = await identity.boundingBox();
    const buyingBox = await buying.boundingBox();
    const tastingBox = await tasting.boundingBox();
    expect(identityBox).not.toBeNull();
    expect(buyingBox).not.toBeNull();
    expect(tastingBox).not.toBeNull();
    expect(identityBox!.y).toBeLessThan(buyingBox!.y);
    expect(buyingBox!.y).toBeLessThan(tastingBox!.y);
    expect(tastingBox!.y).toBeLessThan(844);

    await expect(canvas.getByTestId('curate-chinese-type-row')).toBeVisible();
    await expect(canvas.getByTestId('curate-chinese-suggest')).toBeVisible();
    await expect(canvas.getByRole('slider', { name: 'Grams' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('uses compact painted controls without shrinking touch targets', async ({ page }) => {
    const paintedControls = page.locator('[data-curate-compact-chrome]:visible');
    expect(await paintedControls.count()).toBeGreaterThan(5);
    const heights = await paintedControls.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(Math.max(...heights)).toBeLessThanOrEqual(36);

    const touchTargets = page.locator('[data-curate-compact-target]:visible');
    expect(await touchTargets.count()).toBeGreaterThan(5);
    const targetHeights = await touchTargets.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(Math.min(...targetHeights)).toBeGreaterThanOrEqual(44);
  });
});
