import { test, expect } from '@playwright/test';
import { compassRequestCount, expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate context retrieval', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('keeps context editable after the capture has other information', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true }).fill('Context tea');
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await page.getByRole('button', { name: /Taiwan, Spring 2026/ }).click();
    await page.getByRole('button', { name: 'Chen Family Taipei' }).click();
    await page.getByRole('button', { name: 'Apply context' }).click();
    await page.getByRole('button', { name: /Edit context:/ }).click();
    await expect(page.getByRole('button', { name: 'Clear context' })).toBeVisible();
  });

  test('reopens a committed Library entry and persists a later context edit', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name (e.g., Tieguanyin, Bingdao…)').filter({ visible: true }).fill('Committed context tea');
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await page.getByRole('button', { name: /Taiwan, Spring 2026/ }).click();
    await page.getByRole('button', { name: 'Chen Family Taipei' }).click();
    await page.getByRole('button', { name: 'Apply context' }).click();
    const entryId = await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const id = useTeaCompassStore.getState().activeEntryId!;
      useTeaCompassStore.getState().commitEntry(id);
      return id;
    });

    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: /Committed context tea/ }).click();
    await page.getByTitle('Edit in Capture').filter({ visible: true }).click();
    await page.getByRole('button', { name: /Edit context: Taiwan, Spring 2026 · Chen Family/ }).click();
    await page.getByRole('button', { name: 'Clear context' }).click();

    const persisted = await page.evaluate(async id => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries.find((item: any) => item.id === id);
      return { journeyId: entry?.journeyId, visitId: entry?.visitId, synced: entry?.synced };
    }, entryId);
    expect(persisted).toEqual({ journeyId: null, visitId: null, synced: false });
  });
});

test.describe('Curate context recovery', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page, { contextEmpty: true, contextFailOnce: true }));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('preserves a failed form for retry and prevents duplicate submissions', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await page.getByRole('button', { name: 'New journey' }).click();
    await page.getByLabel('Journey name').fill('Yunnan');
    await page.getByRole('button', { name: 'Save journey' }).dblclick();
    await expect(page.getByRole('alert')).toContainText('Could not save the journey');
    await expect(page.getByLabel('Journey name')).toHaveValue('Yunnan');
    expect(compassRequestCount(page, 'POST /api/curate/journeys')).toBe(1);
    await page.getByRole('button', { name: 'Save journey' }).click();
    await expect(page.getByRole('button', { name: 'Edit journey Yunnan' })).toBeVisible();
    expect(compassRequestCount(page, 'POST /api/curate/journeys')).toBe(2);
  });
});

test.describe('Curate context management', () => {
  test.beforeEach(async ({ page }) => installCompassHarness(page, { contextEmpty: true }));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('creates, edits, and deletes Journeys and Visits from a useful empty state', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Add journey or visit context' }).click();
    await expect(page.getByText('No journeys yet')).toBeVisible();
    await expect(page.getByText('Visits can stand alone or belong to a journey.')).toBeVisible();
    await page.getByRole('button', { name: 'New journey' }).click();
    await page.getByLabel('Journey name').fill('Yunnan');
    await page.getByLabel('Journey season').fill('Autumn');
    await page.getByLabel('Journey year').fill('2026');
    await page.getByRole('button', { name: 'Save journey' }).click();
    await page.getByRole('button', { name: 'Edit journey Yunnan' }).click();
    await page.getByLabel('Journey name').fill('Yunnan edited');
    await page.getByRole('button', { name: 'Save journey' }).click();
    await page.getByRole('button', { name: 'New visit' }).click();
    await page.getByLabel('Visit vendor').selectOption('vendor-chen');
    await page.getByLabel('Visit place').fill('Kunming');
    await page.getByRole('button', { name: 'Save visit' }).click();
    await page.getByRole('button', { name: 'Edit visit Chen Family' }).click();
    await page.getByLabel('Visit place').fill('Dali');
    await page.getByRole('button', { name: 'Save visit' }).click();
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source import.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      const state = useTeaCompassStore.getState();
      const pending = createEmptyEntry('tea');
      pending.name = 'Pending reference'; pending.journeyId = 'journey-created'; pending.visitId = 'visit-created'; pending.synced = true;
      const committed = createEmptyEntry('tea');
      committed.name = 'Other reference'; committed.journeyId = 'journey-created'; committed.visitId = 'visit-created'; committed.synced = true;
      state.addEntry(committed);
      useTeaCompassStore.setState(current => ({ pendingEntries: [...current.pendingEntries, pending] }));
    });
    await page.getByRole('button', { name: 'Delete visit Chen Family' }).click();
    await page.getByRole('button', { name: 'Delete journey Yunnan edited' }).click();
    await expect(page.getByText('No journeys yet')).toBeVisible();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return [...state.entries, ...state.pendingEntries].filter((entry: any) => entry.journeyId || entry.visitId).length;
    })).toBe(0);
  });
});

test.describe('Curate Library decisions and retrieval', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source import.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      const fixtures = [
        { id: 'unresolved', name: 'Cloud Peak', vendorName: 'Chen Family', originRegion: 'Yunnan', type: 'Sheng', notes: 'Taiwan Spring journey Taipei', status: 'incoming', verdict: 'love', decision: null, isSample: true },
        { id: 'selected', name: 'River Stone', vendorName: 'Lin Tea', originRegion: 'Alishan', type: 'Oolong', notes: 'mountain floral', status: 'noted', verdict: 'pass', decision: 'selected' },
        { id: 'passed', name: 'Old Kiln Cup', vendorName: 'Wang Studio', originRegion: 'Jingdezhen', category: 'teaware', notes: 'invoice ceramic', status: 'in_stock', decision: 'passed_on' },
      ];
      const entries = fixtures.map((fixture, index) => ({
        ...createEmptyEntry(fixture.category === 'teaware' ? 'teaware' : 'tea'),
        ...fixture,
        createdAt: new Date(Date.UTC(2026, 5, 12 - index)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 5, 12 - index)).toISOString(),
        synced: true,
      }));
      useTeaCompassStore.setState({ entries, pendingEntries: [], activeEntryId: null });
    });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('uses independent four-state sourcing decisions without changing verdict or stock status', async ({ page }) => {
    await page.getByRole('button', { name: /Cloud Peak/ }).click();
    await page.getByRole('radio', { name: 'Considering' }).click();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries.find((item: any) => item.id === 'unresolved');
      return { decision: entry.decision, verdict: entry.verdict, status: entry.status };
    })).toEqual({ decision: 'considering', verdict: 'love', status: 'incoming' });
    await page.getByRole('radio', { name: 'Considering' }).click();
    await expect(page.getByRole('radio', { name: 'Considering' })).toHaveAttribute('aria-checked', 'false');
  });

  test('shows only All, To taste, and Selected as primary Library views', async ({ page }) => {
    const controls = page.getByTestId('library-controls').filter({ visible: true });
    for (const label of ['All', 'To taste', 'Selected']) await expect(controls.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
    for (const legacy of ['Mine', 'Queue', 'Loved', 'Want', 'Pass']) await expect(controls.getByRole('button', { name: new RegExp(`^${legacy}`) })).toHaveCount(0);
    await controls.getByRole('button', { name: /^Selected/ }).click();
    await expect(page.getByText('River Stone', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toHaveCount(0);
  });

  test('keeps dimensional filters, sorting, and List/Photos as separate controls', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();
    for (const label of ['Decision', 'Verdict', 'Possession', 'Journey', 'Vendor', 'Place', 'Date', 'Category', 'Type', 'Origin', 'Year', 'Price', 'Sample state', 'Photos', 'Missing information']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await page.getByLabel('Decision').selectOption('passed_on');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('Old Kiln Cup', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /1 filter/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Most recent' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Photos' })).toBeVisible();
  });

  test('searches broadly across vendor, origin, notes, and journey/place fragments', async ({ page }) => {
    const search = page.getByPlaceholder('Search Library').filter({ visible: true });
    for (const query of ['Chen', 'Yunnan', 'Taiwan', 'Taipei', 'Sheng']) {
      await search.fill(query);
      await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toBeVisible();
    }
  });

  test('migrates legacy persisted filters and keeps every Library control at least 44px', async ({ page }) => {
    const migrated = await page.evaluate(async () => {
      localStorage.setItem('teajia-compass', JSON.stringify({ state: { browseFilter: 'loved' }, version: 3 }));
      // @ts-expect-error Vite source import.
      const { migrateCompassPersistedState } = await import('/src/lib/teaCompassStore.ts');
      return migrateCompassPersistedState({ browseFilter: 'loved' }, 3);
    });
    expect(migrated).toMatchObject({ browseFilter: 'all', libraryFilters: {} });
    for (const button of await page.locator('[data-testid="library-controls"] button').all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
