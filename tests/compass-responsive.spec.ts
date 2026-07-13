import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate responsive preservation', () => {
  test.beforeEach(async ({ page }) => { await installCompassHarness(page); });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('capture document never overflows horizontally', async ({ page }) => {
    await openCompass(page);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `Curate document overflows viewport by ${dimensions.scrollWidth - dimensions.width}px`).toBeLessThanOrEqual(dimensions.width);
  });

  test('keeps the mobile Library header actions visible without crowding the screen tabs', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'Mobile header composition contract');
    await openCompass(page);
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    const screenTabs = page.getByRole('tablist', { name: 'Screen' });
    const newEntry = page.getByRole('button', { name: 'New entry', exact: true }).filter({ visible: true }).first();
    await expect(newEntry).toBeVisible();
    const viewportWidth = page.viewportSize()!.width;
    const actions = [
      screenTabs.getByRole('button', { name: 'Back', exact: true }),
      screenTabs.getByRole('tab', { name: 'Source', exact: true }),
      screenTabs.getByRole('tab', { name: 'Library', exact: true }),
      screenTabs.getByRole('tab', { name: 'Ledger', exact: true }),
      screenTabs.getByRole('button', { name: 'Sample list (0)' }),
      newEntry,
    ];
    for (const action of actions) {
      const box = await action.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
    }
    const [tabsBox, newBox] = await Promise.all([
      screenTabs.getByRole('tab', { name: 'Library', exact: true }).boundingBox(),
      newEntry.boundingBox(),
    ]);
    expect(newBox!.y).toBeGreaterThan(tabsBox!.y + tabsBox!.height - 1);
  });

  test('uses Tea, Teaware, and Import as capture methods with persistent sample access', async ({ page }) => {
    await openCompass(page);
    const captureMethodControls = page.getByRole('tablist', { name: 'Capture method' });
    await expect(captureMethodControls).toHaveCount(1);
    const methods = captureMethodControls.first();
    await expect(methods.getByRole('tab', { name: 'Tea', exact: true })).toBeVisible();
    await expect(methods.getByRole('tab', { name: 'Teaware', exact: true })).toBeVisible();
    await expect(methods.getByRole('tab', { name: 'Import', exact: true })).toBeVisible();
    await expect(methods.getByRole('tab', { name: 'Samples', exact: true })).toHaveCount(0);
    const sampleList = page.getByRole('button', { name: 'Sample list (0)' }).first();
    await expect(sampleList).toBeVisible();
    expect(await sampleList.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap');

    const headerActions = [
      page.getByRole('button', { name: 'Back', exact: true }),
      page.getByRole('tablist', { name: 'Screen' }).getByRole('tab', { name: 'Source', exact: true }),
      page.getByRole('tablist', { name: 'Screen' }).getByRole('tab', { name: 'Library', exact: true }),
      page.getByRole('tablist', { name: 'Screen' }).getByRole('tab', { name: 'Ledger', exact: true }),
      methods.getByRole('tab', { name: 'Tea', exact: true }),
      methods.getByRole('tab', { name: 'Teaware', exact: true }),
      methods.getByRole('tab', { name: 'Import', exact: true }),
      sampleList,
      page.getByRole('button', { name: 'Record voice note', exact: true }),
    ];
    const viewportWidth = page.viewportSize()!.width;
    for (const action of headerActions) {
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
    }
  });

  test('applies the Source input and touch contracts to Teaware', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    const source = page.locator('[data-curate-source]').filter({ visible: true });
    await expect(source).toHaveCount(1);
    for (const input of await source.locator('input:not([type="file"]), select, textarea').filter({ visible: true }).all()) {
      expect(parseFloat(await input.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
    for (const action of [
      source.getByRole('button', { name: 'Category', exact: true }),
      source.getByRole('button', { name: 'Decrease quantity', exact: true }),
      source.getByRole('button', { name: 'Increase quantity', exact: true }),
      source.getByRole('button', { name: /Done, commit this entry/ }),
    ]) {
      const box = await action.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('keeps a populated clay subtype valid, readable, and independently clearable', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, { material: 'Yixing', clayType: 'Zhuni' });
    });

    const change = page.getByRole('button', { name: 'Clay subtype: Zhuni — tap to change' }).filter({ visible: true }).first();
    const clear = page.getByRole('button', { name: 'Clear clay subtype' }).filter({ visible: true }).first();
    for (const control of [change, clear]) {
      await expect.poll(async () => (await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(parseFloat(await change.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);
    await expect(page.locator('[data-curate-source] button button')).toHaveCount(0);
    await clear.click();
    await expect(clear).toBeHidden();

    await page.getByRole('button', { name: 'Era', exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: 'Add new era', exact: true }).click();
    const customEra = page.getByPlaceholder('e.g. Song Dynasty');
    await expect.poll(async () => (await customEra.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(parseFloat(await customEra.evaluate((element) => getComputedStyle(element).fontSize))).toBe(16);
  });

  test('capture content clears the mobile bottom navigation', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('Mobile'), 'Bottom navigation clearance is a mobile contract');
    await openCompass(page);
    const done = page.getByRole('button', { name: /Done/ }).first();
    await done.scrollIntoViewIfNeeded();
    const nav = page.getByTestId('bottom-tab-bar');
    await expect(nav).toBeVisible();
    const [doneBox, navBox] = await Promise.all([done.boundingBox(), nav.boundingBox()]);
    expect(doneBox, 'Done button must have a layout box').not.toBeNull();
    expect(navBox, 'Bottom navigation must have a layout box').not.toBeNull();
    expect(doneBox!.y + doneBox!.height, 'Done button is obscured by mobile bottom navigation').toBeLessThanOrEqual(navBox!.y);
  });

  test('Library search resists mobile zoom and visible row actions keep 44px hit areas', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    const search = page.getByPlaceholder('Search Library').filter({ visible: true });
    expect(parseFloat(await search.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    const firstRow = page.locator('[data-testid^="library-entry-"]').first();
    for (const action of await firstRow.locator('[data-library-action]').all()) {
      const box = await action.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  });
});

test.describe('Curate legacy data resilience', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens Source when a hydrated encounter has no name', async ({ page }) => {
    test.setTimeout(60_000);
    await installCompassHarness(page, {
      compassEntries: [{
        id: 'nameless-import',
        name: null,
        category: 'tea',
        notes: '',
        photos: '[]',
        audio_clips: '[]',
        status: 'noted',
        created_at: '2026-07-12T00:00:00.000Z',
        updated_at: '2026-07-12T00:00:00.000Z',
      }],
    });

    await page.goto('/admin/compass?entry=nameless-import', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await expect(page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true })).toHaveValue('', { timeout: 30_000 });
  });
});
