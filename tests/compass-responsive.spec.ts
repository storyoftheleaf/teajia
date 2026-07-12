import { test, expect } from '@playwright/test';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate responsive preservation', () => {
  test.beforeEach(async ({ page }) => { await installCompassHarness(page); });

  test('capture document never overflows horizontally', async ({ page }) => {
    await openCompass(page);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `Curate document overflows viewport by ${dimensions.scrollWidth - dimensions.width}px`).toBeLessThanOrEqual(dimensions.width);
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
