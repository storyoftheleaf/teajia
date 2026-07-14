/** Curate preservation contract: field capture stays one tap away and non-linear. */
import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate field capture preservation', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens directly to Source and Tea with price visible', async ({ page }) => {
    await openCompass(page);
    await expect(page.getByRole('tab', { name: 'Tea', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toBeVisible();
    await expect(page.getByPlaceholder('Price').filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Teaware', exact: true })).toBeVisible();
  });

  test('keeps the complete sourcing spine visible with labelled evidence actions', async ({ page }) => {
    await openCompass(page);

    for (const section of ['Tea', 'Buy', 'Taste']) {
      await expect(page.getByRole('heading', { name: section, exact: true }).filter({ visible: true })).toHaveCount(1);
    }
    await expect(page.getByTestId('curate-notes-band').filter({ visible: true })).toContainText('Notes');
    await expect(page.getByText('Intent · None detected', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Yiwu').filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Storage', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tea type', exact: true }).click();
    await page.getByRole('button', { name: 'Sheng', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Storage', exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Scan label', exact: true }).filter({ visible: true })).toContainText('Scan');
    await expect(page.getByRole('button', { name: 'Add photo', exact: true }).filter({ visible: true })).toContainText('Photo');
  });

  test('uses one compact readable type scale and full touch targets in Source', async ({ page }) => {
    await openCompass(page);

    const workingInputs = page.locator('[data-curate-source] input:not([type="file"]), [data-curate-source] select, [data-curate-source] textarea').filter({ visible: true });
    for (const input of await workingInputs.all()) {
      expect(parseFloat(await input.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }

    for (const action of await page.locator('[data-curate-source] [data-curate-action]').filter({ visible: true }).all()) {
      const box = await action.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const visibleTextStyles = await page.locator('[data-curate-source]').evaluateAll((sources) => {
      const styles = new Map<string, { text: string; size: number; className: string }>();
      for (const source of sources) {
        if (source.getClientRects().length === 0) continue;
        const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          if (node.textContent?.trim()) {
            const element = node.parentElement;
            if (element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden') {
              const size = parseFloat(getComputedStyle(element).fontSize);
              const text = node.textContent.trim();
              styles.set(`${size}:${text}:${element.className}`, { text, size, className: String(element.className) });
            }
          }
          node = walker.nextNode();
        }
      }
      return [...styles.values()];
    });
    expect([...new Set(visibleTextStyles.map(({ size }) => size))].sort((a, b) => a - b), JSON.stringify(visibleTextStyles.filter(({ size }) => size !== 12 && size !== 16), null, 2)).toEqual([12, 16]);

    for (const control of await page.locator('[data-curate-source] button, [data-curate-source] input:not([type="file"]):not([type="range"]), [data-curate-source] select, [data-curate-source] textarea').filter({ visible: true }).all()) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('keeps conditional vendor contact actions on the same type and touch scale', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Vendor', exact: true }).click();
    const vendorPicker = page.getByPlaceholder('Select vendor...');
    await vendorPicker.click();
    await expect.poll(async () => (await vendorPicker.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(parseFloat(await vendorPicker.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);
    for (const option of [
      page.getByRole('button', { name: 'New vendor…' }),
      page.getByRole('button', { name: /Chen Family/ }),
    ]) {
      await expect.poll(async () => (await option.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(parseFloat(await option.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    }
    await page.keyboard.press('Escape');

    const contactOptions = page.getByRole('button', { name: 'Vendor contact options' });
    const addContactLink = page.getByRole('button', { name: 'Add contact link' });
    await contactOptions.click();

    for (const control of [
      contactOptions,
      page.getByRole('button', { name: 'Storefront photo' }),
      page.getByRole('button', { name: 'Drop pin' }),
      addContactLink,
    ]) {
      await expect.poll(async () => (await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(parseFloat(await control.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    }

    await addContactLink.click();
    for (const placeholder of ["Paste map link or 'lat, lng'", 'Phone', 'WhatsApp', 'WeChat', 'LINE']) {
      const field = page.getByPlaceholder(placeholder);
      await expect.poll(async () => (await field.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(parseFloat(await field.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);
    }
    const location = page.getByPlaceholder("Paste map link or 'lat, lng'");
    await location.fill('not coordinates');
    await location.blur();
    const locationError = page.getByText(/Couldn't read coordinates/);
    await expect(locationError).toBeVisible();
    expect(parseFloat(await locationError.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
  });

  test('keeps detected Intent actions readable, reachable, and named', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, { notes: 'Price NT 500 for 100g from 2019' });
    });
    const detected = page.getByText('Detected:', { exact: true }).filter({ visible: true }).first();
    await expect(detected).toBeVisible();
    expect(parseFloat(await detected.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);

    for (const label of ['NT500', '100g', '2019']) {
      for (const control of [
        page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first(),
        page.getByRole('button', { name: `Dismiss detected ${label}`, exact: true }).filter({ visible: true }).first(),
      ]) {
        await expect.poll(async () => (await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(parseFloat(await control.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
      }
    }
  });

  test('keeps a populated tasting profile on the support and touch scale', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, {
        tasting: { quality: 8, flavor: ['floral'], body: ['thick'], finish: ['long'] },
      });
    });

    for (const legend of ['BODY', 'FINISH', 'FLAVOR']) {
      const label = page.getByText(legend, { exact: true }).filter({ visible: true }).first();
      await expect(label).toBeVisible();
      expect(parseFloat(await label.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    }
    for (const term of ['Thick', 'Long', 'Floral']) {
      const chip = page.getByRole('button', { name: `Remove ${term}` }).filter({ visible: true }).first();
      await expect.poll(async () => (await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(parseFloat(await chip.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    }
  });

  test('keeps Retail shipping and Buy quantity controls on the working scale', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, { priceAmount: 500, pricePerUnitGrams: 100 });
    });

    const shipping = page.getByRole('button', { name: 'add ship cost', exact: true }).filter({ visible: true }).first();
    await expect.poll(async () => (await shipping.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(parseFloat(await shipping.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    await shipping.click();
    const shippingInput = page.getByRole('spinbutton', { name: 'Shipping cost per kilogram' }).filter({ visible: true }).first();
    await expect.poll(async () => (await shippingInput.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(parseFloat(await shippingInput.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);

    await page.getByTestId('capture-action-footer').filter({ visible: true }).getByRole('button', { name: 'Buy', exact: true }).click();
    const quantity = page.getByRole('spinbutton', { name: 'Purchase quantity' }).filter({ visible: true }).first();
    await expect.poll(async () => (await quantity.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(parseFloat(await quantity.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);
  });

  test('keeps the duplicate warning readable and fully actionable', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      const activeId = useTeaCompassStore.getState().activeEntryId!;
      const existing = { ...createEmptyEntry('tea'), id: 'duplicate-existing', name: 'Duplicate Dong Ding', synced: true };
      const unrelated = { ...createEmptyEntry('tea'), id: 'duplicate-unrelated', name: 'Unrelated Tea', synced: true };
      useTeaCompassStore.setState((state) => ({ entries: [...state.entries, existing, unrelated] }));
      useTeaCompassStore.getState().updateEntry(activeId, { name: 'Duplicate Dong Ding' });
    });

    for (const name of ['Same', 'Different', 'Dismiss duplicate warning']) {
      const control = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
      await expect(control).toBeVisible({ timeout: 5_000 });
      await expect.poll(async () => (await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(parseFloat(await control.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    }
  });

  test('keeps the label scanner readable, closable, and touch-safe', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: () => new Promise(() => undefined) },
      });
    });
    await page.getByRole('button', { name: 'Scan label', exact: true }).filter({ visible: true }).first().click();
    const closeScanner = page.getByRole('button', { name: 'Close label scanner' });
    await expect.poll(async () => (await closeScanner.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const instruction = page.getByText('Align the tea label within the frame');
    await expect(instruction).toBeVisible();
    expect(parseFloat(await instruction.evaluate((element) => getComputedStyle(element).fontSize))).toBe(12);
    await closeScanner.click();

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new Error('denied')) },
      });
    });
    await page.getByRole('button', { name: 'Scan label', exact: true }).filter({ visible: true }).first().click();
    const denied = page.getByText('Camera access denied', { exact: true });
    await expect(denied).toBeVisible();
    expect(parseFloat(await denied.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);
    const deniedClose = page.getByRole('button', { name: 'Close', exact: true });
    await expect.poll(async () => (await deniedClose.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('keeps existing-photo lightbox navigation named and touch-safe', async ({ page }) => {
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, {
        photos: [
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23866"/%3E%3C/svg%3E',
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23686"/%3E%3C/svg%3E',
        ],
      });
    });

    const photoTrigger = page.getByRole('button', { name: 'Photo actions' }).filter({ visible: true }).first();
    await photoTrigger.click();
    await page.getByRole('button', { name: 'View full size', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
    await expect(viewer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close photo viewer' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await viewer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    for (const name of ['Close photo viewer', 'Next photo', 'View photo 1', 'View photo 2']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect.poll(async () => (await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Next photo' }).click();
    const previous = page.getByRole('button', { name: 'Previous photo' });
    await expect.poll(async () => (await previous.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(photoTrigger).toBeFocused();
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
    const name = page.getByPlaceholder('Tea name').filter({ visible: true });
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
    const name = page.getByPlaceholder('Tea name').filter({ visible: true });
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
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Encounter only');
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
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Decision-safe sample');
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
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Shareable tea');
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
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Desktop encounter');
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
    const name = page.getByPlaceholder('Tea name').filter({ visible: true });
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
    await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toBeVisible();
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
