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

  test('balances Type with Year and keeps actions inside their visual clusters', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const year = canvas.getByTestId('curate-year-control');
    const type = canvas.getByTestId('curate-type-control');
    const decision = canvas.getByTestId('curate-decision-control');
    const buying = canvas.getByTestId('curate-cluster-buying');

    const yearBox = await year.boundingBox();
    const typeBox = await type.boundingBox();
    expect(yearBox).not.toBeNull();
    expect(typeBox).not.toBeNull();
    expect(Math.round(typeBox!.width)).toBe(Math.round(yearBox!.width));
    expect(Math.round(typeBox!.height)).toBe(Math.round(yearBox!.height));
    expect(await year.evaluate((element) => getComputedStyle(element).borderRadius))
      .toBe(await type.evaluate((element) => getComputedStyle(element).borderRadius));

    await expect(decision).toHaveAttribute('data-visual-control', 'segmented');
    await expect(decision.locator('[aria-checked="false"]')).toHaveCount(3);
    await expect(buying.getByTestId('capture-action-footer')).toBeVisible();
    await expect(canvas.getByText('Intent · None detected', { exact: true })).toBeVisible();
  });

  test('reserves a stable photo position before and after capture', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const photoSlot = canvas.getByTestId('curate-photo-slot');
    const emptyBox = await photoSlot.boundingBox();
    expect(emptyBox).not.toBeNull();
    await expect(photoSlot.getByRole('button', { name: 'Add photo' })).toBeVisible();

    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, {
        photos: ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='],
      });
    });

    await expect(photoSlot.getByRole('button', { name: 'Photo actions' })).toBeVisible();
    await expect(photoSlot.getByRole('button', { name: 'Add another photo' })).toBeVisible();
    const filledBox = await photoSlot.boundingBox();
    expect(filledBox).not.toBeNull();
    expect(Math.round(filledBox!.width)).toBe(Math.round(emptyBox!.width));
    expect(Math.round(filledBox!.height)).toBe(Math.round(emptyBox!.height));
  });

  test('keeps the same visual system balanced on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const canvas = page.locator('[data-curate-source]:visible');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeLessThanOrEqual(768);
    await expect(canvas.getByTestId('curate-decision-control')).toBeVisible();
    await expect(canvas.getByTestId('curate-cluster-identity')).toBeVisible();
    await expect(canvas.getByTestId('curate-cluster-buying')).toBeVisible();
    await expect(canvas.getByTestId('curate-cluster-tasting')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  });

});
