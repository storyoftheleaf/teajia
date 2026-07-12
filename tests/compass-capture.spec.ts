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

  test('creates exactly one blank shell on signed-in mount and an empty account switch', async ({ page }) => {
    await openCompass(page);
    const draftState = () => page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return {
        scope: state.draftAccountScopeId,
        pendingIds: state.pendingEntries.map((entry) => entry.id),
        sessionIds: state.sessionEntryIds,
        activeEntryId: state.activeEntryId,
      };
    });

    await expect.poll(draftState).toMatchObject({
      scope: 'acct-bali',
      pendingIds: [expect.any(String)],
      sessionIds: [expect.any(String)],
      activeEntryId: expect.any(String),
    });

    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useAppStore } = await import('/src/lib/store.ts');
      useAppStore.getState().setActiveAccountId('acct-empty');
    });
    await expect.poll(draftState).toMatchObject({
      scope: 'acct-empty',
      pendingIds: [expect.any(String)],
      sessionIds: [expect.any(String)],
      activeEntryId: expect.any(String),
    });
  });

  for (const destination of [
    { query: 'library', tab: 'Library' },
    { query: 'buying', tab: 'Ledger' },
  ]) {
    test(`opens ${destination.tab} without creating a capture shell`, async ({ page }) => {
      await page.goto(`/admin/compass?tab=${destination.query}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('tab', { name: destination.tab, exact: true }))
        .toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
      await expect.poll(() => page.evaluate(async () => {
        // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
        const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
        return useTeaCompassStore.getState().pendingEntries.length;
      })).toBe(0);
    });
  }

  test('switches to Teaware in one action', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Teaware', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Teaware name (e.g., Shipiao, Bing Lang…)').filter({ visible: true })).toBeVisible();
  });

  test('switches between named entries in the current session', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true });
    await name.fill('First field tea');
    await page.getByRole('button', { name: /^(New Entry|Start a new entry)$/ }).filter({ visible: true }).click();
    await name.fill('Second field tea');
    await expect(name).toHaveValue('Second field tea');
    await page.getByRole('button', { name: /First field tea/ }).filter({ visible: true }).click();
    await expect(name).toHaveValue('First field tea');
  });

  test('preserves a partial tea entry when switching capture type', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true });
    await name.fill('Field fragment tea');
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await page.getByRole('tab', { name: 'Tea', exact: true }).click();
    await expect(name).toHaveValue('Field fragment tea');
  });

  test('restores a price-only pending fragment after refresh without accumulating blank shells', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Price').filter({ visible: true }).fill('480');
    const originalId = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().activeEntryId;
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('Price').filter({ visible: true })).toHaveValue('480');
    const restored = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return { activeEntryId: state.activeEntryId, pendingIds: state.pendingEntries.map((entry) => entry.id) };
    });
    expect(restored).toEqual({ activeEntryId: originalId, pendingIds: [originalId] });
  });

  test('keeps the single Done commit affordance', async ({ page }) => {
    await openCompass(page);
    await expect(page.getByRole('button', { name: /Done/ }).first()).toBeVisible();
    await expect(page.locator('[data-testid="save-mode-personal"], [data-testid="save-mode-inventory"]')).toHaveCount(0);
  });
});
