import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

for (const width of [320, 390, 1280]) {
  test(`broad family saves without a flower or channel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installCompassHarness(page);
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Broad family tasting');
    await page.getByRole('button', { name: /tasting profile/i }).click();
    const nav = page.getByRole('navigation', { name: 'Tasting sections' });
    await page.getByRole('button', { name: 'Taste', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Explore Floral', exact: true }).focus();
    await page.keyboard.press('Enter');
    const record = page.getByRole('button', { name: 'Record Floral', exact: true });
    await expect(record).toHaveAttribute('aria-pressed', 'false');
    await record.click();
    await expect(record).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Rose · Taste', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Rose · Aroma', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('slider', { name: 'Returning sweetness intensity', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Explore The five tastes', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Savory (umami)', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.screenshot({ path: `test-results/taste-family-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 1024) await nav.getByRole('button', { name: 'Leave tasting', exact: true }).click();
    else await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Save and close', exact: true }).click();
    await expect(nav).toBeHidden();
    const saved = await page.evaluate(async () => {
      // @ts-expect-error Vite fixture module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return state.getEntry(state.activeEntryId)?.tasting;
    });
    expect(saved).toMatchObject({ flavorFamilies: ['floral'], basicTastes: ['Umami'] });
    expect(saved?.flavor ?? []).toEqual([]);
    expect(saved?.aroma ?? []).toEqual([]);
    expect(saved?.huiGanIntensity).toBeUndefined();
    await page.getByRole('button', { name: /tasting profile/i }).click();
    await page.getByRole('button', { name: 'Open your impression', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Floral', exact: true }).click();
    await expect(record).toHaveAttribute('aria-pressed', 'true');
    await record.click();
    await expect(page.getByRole('region', { name: 'Recorded flavor families', exact: true })).toHaveCount(0);
    await expectNoUnhandledCompassApi(page);
  });
}

test('Incense is offered as a Storage concern rather than a new flavor note', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Legacy incense');
  await page.getByRole('button', { name: /tasting profile/i }).click();
  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  await nav.getByRole('button', { name: 'Taste', exact: true }).click();
  await page.getByRole('button', { name: /^Explore Wood & resin/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Incense · Taste', exact: true })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Storage', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Incense', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => {
    // @ts-expect-error Vite fixture module.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const state = useTeaCompassStore.getState();
    state.updateEntry(state.activeEntryId, { tasting: { flavor: ['incense'] } });
  });
  await page.getByRole('button', { name: /tasting profile/i }).click();
  await nav.getByRole('button', { name: 'Taste', exact: true }).click();
  await page.getByRole('button', { name: /^Explore Wood & resin/ }).focus();
  await page.keyboard.press('Enter');
  const legacy = page.getByRole('button', { name: 'Incense · Taste', exact: true });
  await expect(legacy).toHaveAttribute('aria-pressed', 'true');
  await legacy.focus();
  await page.keyboard.press('Enter');
  await expect(legacy).toHaveAttribute('aria-pressed', 'false');
});
