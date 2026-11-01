import { test, expect } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';

for (const width of [320, 390, 1280]) {
  test(`the five tastes are independent wheel choices and preserve saved Umami at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installCompassHarness(page);
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Five tastes');
    await page.evaluate(async () => {
      // @ts-expect-error Vite fixture module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId, { tasting: { basicTastes: ['Umami'], flavor: ['honey'], aroma: ['honey'] } });
    });
    await page.getByRole('button', { name: /tasting profile/i }).click();
    await page.getByRole('button', { name: 'Taste', exact: true }).filter({ visible: true }).click();
    const family = page.getByRole('button', { name: /^Explore The five tastes/ });
    await expect(family).toHaveCount(1);
    await page.screenshot({ path: `test-results/five-tastes-overview-${width}.png`, fullPage: true });
    await family.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Record The five tastes', exact: true })).toHaveCount(0);
    await expect(page.locator('.approved-taste-wheel .sense-hit:visible')).toHaveCount(0);
    const choices = ['Sweet', 'Bitter', 'Sour / tart', 'Savory (umami)', 'Salty'];
    for (const name of choices) {
      const choice = page.getByRole('button', { name, exact: true });
      await expect(choice).toHaveAttribute('aria-pressed', name === 'Savory (umami)' ? 'true' : 'false');
      if (name !== 'Savory (umami)') {
        await choice.focus();
        await page.keyboard.press('Enter');
        await expect(choice).toHaveAttribute('aria-pressed', 'true');
      }
    }
    await page.screenshot({ path: `test-results/five-tastes-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Exercise a pointer on the actual clipped Sweet wedge, not its full-size bounding box.
    const sweet = page.getByRole('button', { name: 'Sweet', exact: true });
    await sweet.scrollIntoViewIfNeeded();
    const point = await sweet.evaluate(element => {
      const box = element.getBoundingClientRect();
      const points = [...getComputedStyle(element).clipPath.matchAll(/([\d.]+)% ([\d.]+)%/g)].map(m => [Number(m[1]), Number(m[2])]);
      return { x: box.x + points.reduce((n, p) => n + p[0], 0) / points.length * box.width / 100, y: box.y + points.reduce((n, p) => n + p[1], 0) / points.length * box.height / 100 };
    });
    await page.mouse.click(point.x, point.y);
    await expect(sweet).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Save and close', exact: true }).click();
    await page.getByRole('button', { name: /tasting profile/i }).click();
    await page.getByRole('button', { name: 'Open your impression', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Savory (umami)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Savory (umami)', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const data = await page.evaluate(async () => {
      // @ts-expect-error Vite fixture module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return state.getEntry(state.activeEntryId)?.tasting;
    });
    expect(data).toMatchObject({ basicTastes: ['Umami', 'Bitter', 'Sour / tart', 'Salty'], flavor: ['honey'], aroma: ['honey'] });
    expect(data?.flavorFamilies ?? []).toEqual([]);
    await expectNoUnhandledCompassApi(page);
  });
}
