import { test, expect } from './fixtures';
import { installCompassHarness, openCompass } from './helpers/compassHarness';

test('Source has one context door and preserves capture and sourcing associations', async ({ page }, info) => {
  await installCompassHarness(page);
  const widths = info.project.name === 'Mobile Chrome' ? [320, 390] : [1280];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name').filter({ visible: true });
    await name.fill('Source context tea');
    const header = page.getByTestId('curate-supplier-header').filter({ visible: true });
    await expect(header.getByRole('button', { name: 'Source context', exact: true })).toHaveCount(1);
    await expect(header.getByRole('button', { name: /^(Run|Visit|Journey)$/ })).toHaveCount(0);
    await header.getByRole('button', { name: 'Source context', exact: true }).click();
    const context = page.getByRole('dialog', { name: 'Source context', exact: true });
    await expect(context).toBeVisible();
    await expect(context.getByRole('heading', { name: 'Captures from this sitting', exact: true })).toBeVisible();
    await expect(context.getByRole('heading', { name: 'Sourcing context', exact: true })).toBeVisible();
    await context.getByRole('button', { name: 'Taiwan, Spring 2026', exact: true }).click();
    await context.getByRole('button', { name: 'Chen Family · Taipei', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`context-${width}.png`), animations: 'disabled', fullPage: true });
    await context.getByRole('button', { name: 'Apply context', exact: true }).click();
    await expect(context).toHaveCount(0);
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite module imported only in the local browser harness.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const store = useTeaCompassStore.getState();
      const entry = [...store.pendingEntries, ...store.entries].find(item => item.id === store.activeEntryId);
      return { journey: entry?.journeyId, visit: entry?.visitId };
    })).toEqual({ journey: 'journey-taiwan', visit: 'visit-chen' });
    await header.getByRole('button', { name: 'Source context', exact: true }).click();
    await expect(context.getByRole('button', { name: 'Taiwan, Spring 2026', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(context.getByRole('button', { name: 'Chen Family · Taipei', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await context.getByRole('button', { name: 'New entry', exact: true }).click();
    await expect(name).toHaveValue('');
    await header.getByRole('button', { name: 'Source context', exact: true }).click();
    await expect(context.getByRole('button', { name: 'Source context tea', exact: true })).toBeVisible();
    await context.getByRole('button', { name: 'New session', exact: true }).click();
    await expect(context).toHaveCount(0);
    await expect(name).toHaveValue('');
    await page.screenshot({ path: info.outputPath(`header-${width}.png`), animations: 'disabled', fullPage: true });
  }
});
