import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`a recap reveal does not replay when recording another family (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 390, height: 844 });
    await installCompassHarness(page);
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Wheel continuity');
    await page.getByRole('button', { name: /tasting profile/i }).click();
    const nav = page.getByRole('navigation', { name: 'Tasting sections' });
    await nav.getByRole('button', { name: 'Taste', exact: true }).click();
    const activate = async (name: string) => {
      await page.getByRole('button', { name, exact: true }).focus();
      await page.keyboard.press('Enter');
    };
    await activate('Explore Floral');
    await activate('Rose · Taste');
    await page.getByRole('button', { name: 'Open your impression', exact: true }).click();
    await page.getByRole('region', { name: 'Your tasting selections', exact: true })
      .getByRole('button', { name: 'Edit Rose', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Rose · Taste', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await activate('Explore Fresh fruit');
    await activate('Peach · Taste');
    // Changing the tasting value must preserve the family the user opened.
    const peach = page.getByRole('button', { name: 'Peach · Taste', exact: true });
    await expect(peach).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Explore Fresh fruit/ })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('button', { name: 'Rose · Taste', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
