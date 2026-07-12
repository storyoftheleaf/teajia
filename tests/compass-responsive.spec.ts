import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate responsive preservation', () => {
  test.beforeEach(async ({ page }) => { await installCompassHarness(page); });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('capture document never overflows horizontally', async ({ page }) => {
    await openCompass(page);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `Curate document overflows viewport by ${dimensions.scrollWidth - dimensions.width}px`).toBeLessThanOrEqual(dimensions.width);
  });

  test('uses Tea, Teaware, and Import as capture methods with persistent sample access', async ({ page }) => {
    await openCompass(page);
    const methods = page.getByRole('tablist', { name: 'Capture method' }).first();
    await expect(methods.getByRole('tab', { name: 'Tea', exact: true })).toBeVisible();
    await expect(methods.getByRole('tab', { name: 'Teaware', exact: true })).toBeVisible();
    await expect(methods.getByRole('tab', { name: 'Import', exact: true })).toBeVisible();
    await expect(methods.getByRole('tab', { name: 'Samples', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sample order (0)' }).first()).toBeVisible();
  });

  test('capture content clears the mobile bottom navigation', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'Bottom navigation clearance is a mobile contract');
    await openCompass(page);
    const done = page.getByRole('button', { name: /Done/ }).first();
    await done.scrollIntoViewIfNeeded();
    const nav = page.getByTestId('bottom-tab-bar');
    await expect(nav).toBeVisible();
    const [doneBox, navBox] = await Promise.all([done.boundingBox(), nav.boundingBox()]);
    expect(doneBox, 'Done button must have a layout box').not.toBeNull();
    expect(navBox, 'Bottom navigation must have a layout box').not.toBeNull();
    expect(doneBox!.y + doneBox!.height, 'Done button is obscured by mobile bottom navigation').toBeLessThanOrEqual(navBox!.y);
  });
});

test.describe('Curate legacy data resilience', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens Source when a hydrated encounter has no name', async ({ page }) => {
    test.setTimeout(60_000);
    await installCompassHarness(page, {
      compassEntries: [{
        id: 'nameless-import',
        name: null,
        category: 'tea',
        notes: '',
        photos: '[]',
        audio_clips: '[]',
        status: 'noted',
        created_at: '2026-07-12T00:00:00.000Z',
        updated_at: '2026-07-12T00:00:00.000Z',
      }],
    });

    await page.goto('/admin/compass?entry=nameless-import', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await expect(page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true })).toHaveValue('', { timeout: 30_000 });
  });
});
