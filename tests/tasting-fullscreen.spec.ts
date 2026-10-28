import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 700 }, { width: 844, height: 390 }]) {
  test(`tasting fills the window and the wheel works at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installCompassHarness(page);
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Full screen tasting');
    await page.getByRole('button', { name: /tasting profile/i }).click();
    const surface = page.locator('.tasting-session-surface');
    await expect(surface).toBeVisible();
    const box = await surface.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    await page.getByRole('button', { name: 'Taste', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Explore The five tastes', exact: true }).focus();
    await page.keyboard.press('Enter');
    const savory = page.getByRole('button', { name: 'Savory (umami)', exact: true });
    await savory.focus();
    await page.keyboard.press('Enter');
    await expect(savory).toHaveAttribute('aria-pressed', 'true');
    if (viewport.width >= 1024) {
      const wheel = await page.locator('.radial-stage').boundingBox();
      const details = await page.locator('.tasting-wheel-details').boundingBox();
      expect(wheel!.width).toBeGreaterThan(440);
      expect(details!.x).toBeGreaterThanOrEqual(wheel!.x + wheel!.width);
      expect(wheel!.y + wheel!.height).toBeLessThan(viewport.height - 44);
    }
    if (viewport.width < 1024) {
      const wheel = await page.locator('.radial-stage').boundingBox();
      const nav = await page.getByRole('navigation', { name: 'Tasting sections' }).boundingBox();
      expect(wheel!.y + wheel!.height).toBeLessThanOrEqual(nav!.y);
    }
    await expect(page.getByRole('button', { name: 'Save tasting', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/tasting-fullscreen-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Save and close', exact: true }).click();
    await expect(surface).toHaveCount(0);
    await expectNoUnhandledCompassApi(page);
  });
}
