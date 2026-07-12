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

test.describe('Curate Library account-scoped context resilience', () => {
  test('clears old context immediately and ignores late responses after account switch', async ({ page }) => {
    await installCompassHarness(page, {
      contextByAccount: {
        'acct-bali': { journeys: [{ id: 'old-journey', name: 'Old Account Journey' }], visits: [] },
      },
      contextAfterInitial: { journeys: [{ id: 'new-journey', name: 'New Account Journey' }], visits: [] },
      contextDelayByAccount: { 'acct-bali': 400 },
    });
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite source imports.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source imports.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      // @ts-expect-error Vite source imports.
      const { useAppStore } = await import('/src/lib/store.ts');
      useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry('tea'), id: 'context-entry', name: 'Context entry', synced: true }] });
      useAppStore.getState().setActiveAccountId('acct-empty');
    });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByLabel('Journey')).not.toContainText('Old Account Journey');
    await expect(page.getByLabel('Journey')).toContainText('New Account Journey');
    await page.waitForTimeout(500);
    await expect(page.getByLabel('Journey')).not.toContainText('Old Account Journey');
  });

  test('retains partial context success and retries only after a visible error', async ({ page }) => {
    await installCompassHarness(page, { contextJourneyFailOnce: true });
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite source imports.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source imports.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry('tea'), id: 'partial-entry', name: 'Partial entry', synced: true }] });
    });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await expect(page.getByText('journeys unavailable', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByLabel('Place')).toContainText('Taipei');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('journeys unavailable', { exact: true }).filter({ visible: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByLabel('Journey')).toContainText('Taiwan');
  });
});

test.describe('Curate server-hydrated sample identity', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page, { compassEntries: [
      { id: 'server-received', name: 'Server Received', category: 'tea', status: 'in_stock', sample_state: 'received', created_at: '2026-07-01T00:00:00.000Z' },
      { id: 'server-requested', name: 'Server Requested', category: 'tea', status: 'noted', sample_state: 'requested', created_at: '2026-07-02T00:00:00.000Z' },
    ] });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('uses durable sample_state without a local isSample boolean', async ({ page }) => {
    await page.getByTestId('library-controls').filter({ visible: true }).getByRole('button', { name: /^To taste/ }).click();
    await expect(page.getByText('Server Requested', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Server Received', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByTestId('library-controls').filter({ visible: true }).getByRole('button', { name: 'Photos', exact: true }).click();
    await expect(page.getByText('Sample', { exact: true }).filter({ visible: true })).toHaveCount(2);
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
    await installCompassHarness(page, { products: [
      { id: 'product-cloud', is_public: 1, shown_in_shop: 0, status: 'Draft', given_name: 'Cloud Peak' },
      { id: 'product-held', source_compass_entry_id: 'held-sample', inventory_purpose: 'sample', stock_grams: 10, given_name: 'Held Sample' },
    ] });
    await openCompass(page);
    // Hydration is intentionally asynchronous. Seed fixtures only after its
    // first server merge so a late empty response cannot erase the test entry.
    await expect.poll(() => compassRequestCount(page, 'GET /api/compass/entries')).toBeGreaterThan(0);
    await page.waitForTimeout(200);
    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source import.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      const fixtures = [
        { id: 'unresolved', name: 'Cloud Peak', vendorName: 'Chen Family', originRegion: 'Yunnan', type: 'Sheng', notes: 'smoky apricot', status: 'incoming', verdict: 'love', decision: null, isSample: true, sampleState: 'requested', journeyId: 'journey-taiwan', visitId: 'visit-chen', priceAmount: 20, pricePerUnitGrams: 10, year: 2024, photos: ['cloud.jpg'], tasting: { quality: 9 }, createdAt: '2026-06-10T00:00:00.000Z' },
        { id: 'selected', name: 'River Stone', vendorName: 'Lin Tea', originRegion: 'Alishan', type: 'Oolong', notes: 'mountain floral', status: 'noted', verdict: 'pass', decision: 'selected', priceAmount: 5, pricePerUnitGrams: 10, tasting: { quality: 5 }, createdAt: '2026-06-12T00:00:00.000Z' },
        { id: 'passed', name: 'Old Kiln Cup', vendorName: 'Wang Studio', originRegion: 'Jingdezhen', category: 'teaware', notes: 'invoice ceramic', status: 'in_stock', decision: 'passed_on', createdAt: '2025-06-11T00:00:00.000Z' },
      ];
      const entries = fixtures.map((fixture, index) => ({
        ...createEmptyEntry(fixture.category === 'teaware' ? 'teaware' : 'tea'),
        ...fixture,
        createdAt: fixture.createdAt ?? new Date(Date.UTC(2026, 5, 11 - index)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 5, 12 - index)).toISOString(),
        synced: true,
      }));
      useTeaCompassStore.setState({ entries, pendingEntries: [], activeEntryId: null });
    });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('creates one Inventory record explicitly and replaces the action with its Inventory link', async ({ page }) => {
    let promotions = 0;
    await page.route('**/api/compass/entries/selected/promote', route => {
      promotions += 1;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'inventory-river', alreadyPromoted: false }) });
    });
    await page.getByRole('button', { name: /River Stone/ }).click();
    const createAction = page.getByRole('button', { name: 'Create Inventory record' });
    await expect(createAction).toHaveClass(/tap-target/);
    await createAction.click();
    await expect(page.getByRole('button', { name: /View in Inventory/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /View in Inventory/ })).toHaveClass(/tap-target/);
    expect(promotions).toBe(1);
    await page.getByRole('button', { name: /View in Inventory/ }).click();
    await expect(page).toHaveURL(/\/admin\/stock\?panel=inventory-river/);
  });

  test('persists a failed explicit Inventory request and resumes it through sync', async ({ page }) => {
    let fail = true;
    let promotions = 0;
    await page.route('**/api/compass/entries/selected/promote', route => {
      promotions += 1;
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Offline' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'inventory-river', alreadyPromoted: true }) });
    });
    await page.getByRole('button', { name: /River Stone/ }).click();
    await page.getByRole('button', { name: 'Create Inventory record' }).click();
    await expect(page.getByText('Queued until the connection returns', { exact: true })).toBeVisible();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().pendingPromotions;
    })).toContain('selected');
    fail = false;
    await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { syncCompassEntries } = await import('/src/lib/teaCompassSync.ts');
      await syncCompassEntries();
    });
    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      return { pending: state.pendingPromotions, productId: state.entries.find((entry: any) => entry.id === 'selected')?.draftProductId };
    })).toEqual({ pending: [], productId: 'inventory-river' });
    expect(promotions).toBe(2);
  });

  test('shows permanent promotion errors without adding a retry queue', async ({ page }) => {
    await page.route('**/api/compass/entries/selected/promote', route =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Compass entry not found' }) }),
    );
    await page.getByRole('button', { name: /River Stone/ }).click();
    await page.getByRole('button', { name: 'Create Inventory record' }).click();
    await expect(page.getByText('Could not create Inventory record: Compass entry not found', { exact: true })).toBeVisible();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().pendingPromotions;
    })).not.toContain('selected');
  });

  test('uses independent four-state sourcing decisions without changing verdict or stock status', async ({ page }) => {
    const publicationBefore = await page.evaluate(async () => {
      const response = await fetch('/api/products');
      const [product] = await response.json();
      return { is_public: product.is_public, shown_in_shop: product.shown_in_shop };
    });
    await page.getByRole('button', { name: /Cloud Peak/ }).click();
    await page.getByRole('radio', { name: 'Considering' }).click();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries.find((item: any) => item.id === 'unresolved');
      return { decision: entry.decision, verdict: entry.verdict, status: entry.status };
    })).toEqual({ decision: 'considering', verdict: 'love', status: 'incoming' });
    await page.getByRole('radio', { name: 'Selected' }).click();
    await expect(page.getByRole('radio', { name: 'Selected' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Passed on' }).click();
    await expect(page.getByRole('radio', { name: 'Passed on' })).toHaveAttribute('aria-checked', 'true');
    for (const control of await page.getByRole('radiogroup', { name: 'Sourcing decision' }).getByRole('radio').all()) {
      expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('radio', { name: 'Passed on' }).click();
    await expect(page.getByRole('radio', { name: 'Considering' })).toHaveAttribute('aria-checked', 'false');
    const publicationAfter = await page.evaluate(async () => {
      const response = await fetch('/api/products');
      const [product] = await response.json();
      return { is_public: product.is_public, shown_in_shop: product.shown_in_shop };
    });
    expect(publicationAfter).toEqual(publicationBefore);
  });

  test('applies every supported dimensional filter to the result set', async ({ page }) => {
    await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source import.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      const held = { ...createEmptyEntry('tea'), id: 'held-sample', name: 'Held Sample', isSample: true, sampleState: 'tasted', status: 'in_stock', tasting: { quality: 7 }, synced: true };
      useTeaCompassStore.setState((state: any) => ({ entries: [...state.entries, held] }));
    });
    const cases: Array<[Record<string, string>, string]> = [
      [{ decision: 'none' }, 'Cloud Peak'], [{ verdict: 'pass' }, 'River Stone'],
      [{ possession: 'none' }, 'Cloud Peak'], [{ possession: 'sample' }, 'Held Sample'], [{ journey: 'journey-taiwan' }, 'Cloud Peak'],
      [{ vendor: 'Lin Tea' }, 'River Stone'], [{ place: 'visit-chen' }, 'Cloud Peak'],
      [{ date: 'this_year' }, 'Cloud Peak'], [{ category: 'teaware' }, 'Old Kiln Cup'],
      [{ type: 'Sheng' }, 'Cloud Peak'], [{ origin: 'Alishan' }, 'River Stone'],
      [{ year: '2024' }, 'Cloud Peak'], [{ price: 'known' }, 'Cloud Peak'],
      [{ sampleState: 'requested' }, 'Cloud Peak'], [{ sampleState: 'tasted' }, 'Held Sample'], [{ photos: 'with' }, 'Cloud Peak'],
      [{ missing: 'price' }, 'Old Kiln Cup'],
    ];
    for (const [filters, expected] of cases) {
      await page.evaluate(async (next) => {
        // @ts-expect-error Vite source import.
        const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
        useTeaCompassStore.getState().setLibraryFilters(next);
      }, filters);
      await expect(page.getByText(expected, { exact: true }).filter({ visible: true })).toBeVisible();
      const excluded = expected === 'Old Kiln Cup' ? 'Cloud Peak' : 'Old Kiln Cup';
      await expect(page.getByText(excluded, { exact: true }).filter({ visible: true })).toHaveCount(0);
    }
  });

  test('never treats an incoming sample as possessed or received', async ({ page }) => {
    for (const filters of [{ possession: 'none' }, { sampleState: 'requested' }]) {
      await page.evaluate(async (next) => {
        // @ts-expect-error Vite source import.
        const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
        useTeaCompassStore.getState().setLibraryFilters(next);
      }, filters);
      await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toBeVisible();
    }
    for (const filters of [{ possession: 'sample' }, { possession: 'working' }, { sampleState: 'received' }, { sampleState: 'tasted' }]) {
      await page.evaluate(async (next) => {
        // @ts-expect-error Vite source import.
        const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
        useTeaCompassStore.getState().setLibraryFilters(next);
      }, filters);
      await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toHaveCount(0);
    }
  });

  test('orders by every sort option and switches between List and Photos', async ({ page }) => {
    const cases: Array<[string, string]> = [['Most recent', 'River Stone'], ['Highest score', 'Cloud Peak'], ['Price · low to high', 'River Stone'], ['Name · A–Z', 'Cloud Peak']];
    for (const [label, expectedFirst] of cases) {
      await page.getByTestId('library-controls').filter({ visible: true }).getByTitle('Sort').click();
      await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).last().click();
      const titles = page.locator('span.min-w-0.truncate.text-ui-16.font-serif').filter({ visible: true });
      await expect(titles.first()).toHaveText(expectedFirst);
    }
    const controls = page.getByTestId('library-controls').filter({ visible: true });
    const photos = controls.getByRole('button', { name: 'Photos', exact: true });
    await photos.click();
    await expect(controls.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await controls.getByRole('button', { name: 'List', exact: true }).click();
    await expect(controls.getByRole('button', { name: 'Photos', exact: true })).toHaveAttribute('aria-pressed', 'false');
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

  test('resolves Journey and Visit records for filters instead of matching opaque ids', async ({ page }) => {
    const search = page.getByPlaceholder('Search Library').filter({ visible: true });
    for (const query of ['Taiwan', 'Spring 2026', 'Taipei']) {
      await search.fill(query);
      await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toBeVisible();
    }
    await search.fill('');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Journey').selectOption('journey-taiwan');
    await page.getByLabel('Place').selectOption('visit-chen');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('Cloud Peak', { exact: true }).filter({ visible: true })).toBeVisible();
  });

  test('keeps verdict separate and requires an explicit sourcing decision in tasting review', async ({ page }) => {
    await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.setState((state: any) => ({ entries: state.entries.map((entry: any) => ({ ...entry, tasting: { quality: 8 }, verdict: undefined, decision: null, status: 'noted' })) }));
    });
    await page.getByRole('button', { name: /tasted teas.*Review/ }).click();
    await page.getByRole('button', { name: 'Love' }).first().click();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries[0];
      return { verdict: entry.verdict, decision: entry.decision, status: entry.status };
    })).toEqual({ verdict: 'love', decision: null, status: 'noted' });
    await page.getByRole('radio', { name: 'Selected' }).first().click();
    expect(await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().entries[0].decision;
    })).toBe('selected');
    await expect(page.getByText(/want list/i)).toHaveCount(0);
  });

  test('migrates legacy persisted filters and keeps every Library control at least 44px', async ({ page }) => {
    const migrated = await page.evaluate(async () => {
      localStorage.setItem('teajia-compass', JSON.stringify({ state: { browseFilter: 'loved' }, version: 3 }));
      // @ts-expect-error Vite source import.
      const { migrateCompassPersistedState } = await import('/src/lib/teaCompassStore.ts');
      return migrateCompassPersistedState({ browseFilter: 'loved' }, 3);
    });
    expect(migrated).toMatchObject({ browseFilter: 'all', libraryFilters: {} });
    const legacyWant = await page.evaluate(async () => {
      // @ts-expect-error Vite source import.
      const { migrateCompassPersistedState } = await import('/src/lib/teaCompassStore.ts');
      return migrateCompassPersistedState({ browseFilter: 'want', entries: [{ id: 'legacy-sample', isSample: true }] }, 3);
    });
    expect(legacyWant).toMatchObject({ browseFilter: 'all', entries: [{ sampleState: 'requested' }] });
    for (const button of await page.locator('[data-testid="library-controls"] button').all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
