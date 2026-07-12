/** Curate preservation contract: field capture stays one tap away and non-linear. */
import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate field capture preservation', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens directly to Source and Tea with price visible', async ({ page }) => {
    await openCompass(page);
    await expect(page.getByRole('tab', { name: 'Tea', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true })).toBeVisible();
    await expect(page.getByPlaceholder('Price').filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Teaware', exact: true })).toBeVisible();
  });

  test('switches to Teaware in one action', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Teaware', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Teaware name (e.g., Shipiao, Bing Lang…)').filter({ visible: true })).toBeVisible();
  });

  test('switches between named entries in the current session', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const first = useTeaCompassStore.getState().activeEntryId;
      useTeaCompassStore.getState().updateEntry(first, { name: 'First field tea' });
      const second = useTeaCompassStore.getState().startNewCapture('tea');
      useTeaCompassStore.getState().updateEntry(second, { name: 'Second field tea' });
    });
    const name = page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true });
    await expect(name).toHaveValue('Second field tea');
    await page.getByRole('button', { name: /First field tea/ }).filter({ visible: true }).click();
    await expect(name).toHaveValue('First field tea');
  });

  test('currently replaces a partial tea entry when switching capture type', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true });
    await name.fill('Field fragment tea');
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await page.getByRole('tab', { name: 'Tea', exact: true }).click();
    await expect(name).toHaveValue('');
  });

  test('keeps the single Done commit affordance', async ({ page }) => {
    await openCompass(page);
    await expect(page.getByRole('button', { name: /Done/ }).first()).toBeVisible();
    await expect(page.locator('[data-testid="save-mode-personal"], [data-testid="save-mode-inventory"]')).toHaveCount(0);
  });
});
