/** Curate preservation contract: field capture stays one tap away and non-linear. */
import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate field capture preservation', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens directly to Source and Tea with price visible', async ({ page }) => {
    await openCompass(page);
    await expect(page.getByRole('tab', { name: 'Tea', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Tea name…').filter({ visible: true })).toBeVisible();
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

  test('teaware capture has no legacy Want control', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Want', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Wanted', exact: true })).toHaveCount(0);
  });

  test('keeps Teaware selected when a teaware draft is restored after refresh', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await page.getByPlaceholder('Teaware name (e.g., Shipiao, Bing Lang…)').filter({ visible: true }).fill('Field gaiwan');

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: 'Teaware', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Teaware name (e.g., Shipiao, Bing Lang…)').filter({ visible: true })).toHaveValue('Field gaiwan');
  });

  test('keeps Teaware selected when returning to an account with a teaware draft', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await page.getByPlaceholder('Teaware name (e.g., Shipiao, Bing Lang…)').filter({ visible: true }).fill('Account gaiwan');
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useAppStore } = await import('/src/lib/store.ts');
      useAppStore.getState().setActiveAccountId('acct-empty');
    });
    await expect(page.getByRole('tab', { name: 'Tea', exact: true })).toHaveAttribute('aria-selected', 'true');

    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useAppStore } = await import('/src/lib/store.ts');
      useAppStore.getState().setActiveAccountId('acct-bali');
    });
    await expect(page.getByRole('tab', { name: 'Teaware', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Teaware name (e.g., Shipiao, Bing Lang…)').filter({ visible: true })).toHaveValue('Account gaiwan');
  });

  test('switches between named entries in the current session', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name…').filter({ visible: true });
    await name.fill('First field tea');
    const directNewEntry = page.getByRole('button', { name: /^(New Entry|Start a new entry)$/ }).filter({ visible: true });
    await expect(directNewEntry).toHaveCount(1);
    await directNewEntry.click();
    await name.fill('Second field tea');
    await expect(name).toHaveValue('Second field tea');
    const firstEntry = page.getByRole('button', { name: 'First field tea', exact: true }).filter({ visible: true });
    if (!(await firstEntry.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /^Run(?: · \d+)?$/ }).filter({ visible: true }).click();
    }
    await firstEntry.click();
    await expect(name).toHaveValue('First field tea');
  });

  test('preserves a partial tea entry when switching capture type', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name…').filter({ visible: true });
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
    let promotions = 0;
    await page.route('**/api/compass/entries/*/promote', route => {
      promotions += 1;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'unexpected-product' }) });
    });
    await openCompass(page);
    await page.getByPlaceholder('Tea name…').filter({ visible: true }).fill('Encounter only');
    await expect(page.getByRole('button', { name: /Done/ }).first()).toBeVisible();
    await expect(page.locator('[data-testid="save-mode-personal"], [data-testid="save-mode-inventory"]')).toHaveCount(0);
    await page.getByRole('button', { name: /Done/ }).first().click();
    await expect.poll(() => promotions).toBe(0);
    await expect.poll(async () => page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return {
        activeEntryId: state.activeEntryId,
        pendingIds: state.pendingEntries.map((entry) => entry.id),
        committedNames: state.entries.map((entry) => entry.name),
      };
    })).toMatchObject({ pendingIds: [expect.any(String)], committedNames: ['Encounter only'] });
    const replacement = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return { activeEntryId: state.activeEntryId, pendingId: state.pendingEntries[0]?.id };
    });
    expect(replacement.activeEntryId).toBe(replacement.pendingId);
  });

  test('capture action footer has three equal actions in Buy Done Sample order', async ({ page }) => {
    await openCompass(page);
    const footer = page.getByTestId('capture-action-footer').filter({ visible: true });
    const buttons = footer.getByRole('button');

    await expect(buttons).toHaveCount(3);
    await expect(buttons).toHaveText(['Buy', 'Done', 'Sample']);
    await expect(page.getByRole('button', { name: 'Tasted', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Want', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pass', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bag it', exact: true })).toHaveCount(0);

    const widths = await buttons.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().width),
    );
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });

  test('Sample opens the current tea tasting without changing sourcing or possession', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name…').filter({ visible: true }).fill('Decision-safe sample');
    await page.getByRole('radio', { name: 'Considering' }).click();
    await page.getByTestId('capture-action-footer').filter({ visible: true })
      .getByRole('button', { name: 'Sample', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      const entry = state.getEntry(state.activeEntryId!);
      return { decision: entry?.decision, sampleState: entry?.sampleState ?? null };
    })).toEqual({ decision: 'considering', sampleState: null });
  });

  test('authenticated capture keeps Share reachable outside the action footer', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name…').filter({ visible: true }).fill('Shareable tea');
    const share = page.getByRole('button', { name: 'Share', exact: true }).filter({ visible: true });

    await expect(share).toHaveCount(1);
    await share.click();
    await expect(page.getByRole('heading', { name: 'Shareable tea', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Link', exact: true })).toBeVisible();
  });

  test('Buy reports and controls its purchase picker disclosure state', async ({ page }) => {
    await openCompass(page);
    const buy = page.getByTestId('capture-action-footer').filter({ visible: true })
      .getByRole('button', { name: 'Buy', exact: true });

    await expect(buy).toHaveAttribute('aria-expanded', 'false');
    const pickerId = await buy.getAttribute('aria-controls');
    expect(pickerId).toBeTruthy();
    await expect(page.locator(`#${pickerId}`)).toHaveCount(1);
    await buy.click();
    await expect(buy).toHaveAttribute('aria-expanded', 'true');
  });

  test('desktop Done also creates exactly one active replacement draft', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'desktop action bar only');
    await openCompass(page);
    await page.getByPlaceholder('Tea name…').filter({ visible: true }).fill('Desktop encounter');
    await page.getByTestId('compass-done-desktop').click();
    await expect.poll(async () => page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return {
        active: state.activeEntryId,
        pending: state.pendingEntries.map((entry) => entry.id),
        committed: state.entries.map((entry) => entry.name),
      };
    })).toMatchObject({ pending: [expect.any(String)], committed: ['Desktop encounter'] });
    const ids = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return [state.activeEntryId, state.pendingEntries[0]?.id];
    });
    expect(ids[0]).toBe(ids[1]);
  });

  test('Done resumes an existing partial entry instead of creating a blank replacement', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder('Tea name…').filter({ visible: true });
    await name.fill('Earlier fragment');
    const earlierId = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().activeEntryId;
    });
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.getState().startNewCapture('tea');
    });
    await name.fill('Current fragment');
    await page.getByRole('button', { name: /Done/ }).filter({ visible: true }).first().click();
    await expect(name).toHaveValue('Earlier fragment');
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return { active: state.activeEntryId, pending: state.pendingEntries.map((entry) => entry.id), committed: state.entries.map((entry) => entry.name) };
    })).toEqual({ active: earlierId, pending: [earlierId], committed: ['Current fragment'] });
  });

  test('begins immediately with no Journey or Visit setup gate', async ({ page }) => {
    await openCompass(page);
    await expect(page.getByPlaceholder('Tea name…').filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add journey or visit context' })).toBeVisible();
  });

  test('inherits recent context, can clear it, and leaves the six-hour session unchanged', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await page.getByRole('button', { name: /Taiwan, Spring 2026/ }).click();
    await page.getByRole('button', { name: 'Chen Family Taipei' }).click();
    await page.getByRole('button', { name: 'Apply context' }).click();
    await expect(page.getByRole('button', { name: /Edit context: Taiwan, Spring 2026 · Chen Family/ })).toBeVisible();

    const first = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      const entry = state.getEntry(state.activeEntryId!);
      return { journeyId: entry?.journeyId, visitId: entry?.visitId, sessionId: entry?.sessionId };
    });
    await page.getByRole('button', { name: /^(New Entry|Start a new entry)$/ }).filter({ visible: true }).click();
    const second = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      const entry = state.getEntry(state.activeEntryId!);
      return { journeyId: entry?.journeyId, visitId: entry?.visitId, sessionId: entry?.sessionId };
    });
    expect(second).toMatchObject({ journeyId: 'journey-taiwan', visitId: 'visit-chen', sessionId: first.sessionId });
    await expect(page.getByRole('button', { name: /Edit context: Taiwan, Spring 2026 · Chen Family/ })).toBeVisible();

    await page.getByRole('button', { name: /Edit context:/ }).click();
    await page.getByRole('button', { name: 'Clear context' }).click();
    await expect(page.getByRole('button', { name: 'Add journey or visit context' })).toBeVisible();
  });
});
