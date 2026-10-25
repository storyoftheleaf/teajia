import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

test('mobile tasting capsule keeps all sections reachable and preserves storage when leaving', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await installCompassHarness(page);
  await openCompass(page);
  await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Capsule tasting');
  await page.getByRole('button', { name: /tasting profile/i }).click();
  const nav = page.getByRole('navigation', { name: 'Tasting sections' });
  await expect(nav).toBeVisible();
  for (const label of ['Texture', 'Effect', 'Taste', 'Storage']) {
    const button = nav.getByRole('button', { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(43.9);
    expect(box!.height).toBeGreaterThanOrEqual(43.9);
  }
  const slider = page.getByRole('slider', { name: /Storage character/ });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Parched');
  await page.getByRole('button', { name: 'Musty', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Texture', exact: true }).click();
  await nav.getByRole('button', { name: 'Storage', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuetext', 'Parched');
  await expect(page.getByRole('button', { name: 'Musty', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await nav.getByRole('button', { name: 'Leave tasting' }).click();
  await expect(page.getByRole('button', { name: 'Save and close', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save and close', exact: true }).click();
  await expect(nav).toBeHidden();
  await expect.poll(() => page.evaluate(async () => {
    // @ts-expect-error Vite exposes source modules in the local browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const state = useTeaCompassStore.getState();
    const tasting = state.getEntry(state.activeEntryId)?.tasting;
    return { character: tasting?.storageCharacter, notes: tasting?.storageNotes };
  })).toEqual({ character: 0, notes: ['Musty'] });
  await expectNoUnhandledCompassApi(page);
});
