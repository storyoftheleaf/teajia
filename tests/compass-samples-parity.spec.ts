import { test, expect } from '@playwright/test';
import { compassRequestCount, expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const CART_ITEM = { id: 'compass-tea-1', name: '1998 Dong Ding', chineseName: '凍頂', type: 'Oolong', vendorName: 'Chen Family', grams: 10, compassEntryId: 'compass-tea-1' };

test.describe('Sample workflows remain reachable outside the capture method row', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));
  test('opens the contextual empty Sample list from Source and restores focus', async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    const trigger = page.getByRole('button', { name: 'Sample list (0)' }).first();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample list', exact: true })).toBeVisible();
    await expect(page.getByText('Your Sample list is empty', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Capture tea' }).click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeHidden();
    await expect(page.getByPlaceholder('Tea name').filter({ visible: true })).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Browse Library' }).click();
    await expect(page.getByRole('tab', { name: 'Library', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Source', exact: true }).click();
    await trigger.click();
    await page.getByRole('button', { name: 'Close Samples workspace' }).click();
    await expect(trigger).toBeFocused();
  });

  test('/admin/samples and linked set query open visible sample management UI', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    const setId = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.sampleSets[0].id);
    await page.goto(`/admin/samples?set=${encodeURIComponent(setId)}`);
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample batches' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Samples workspace' }).click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeHidden();
    await expect(page).not.toHaveURL(/sampleOrder|set=/);
  });

  test('nested label and edit overlays own Escape before the Sample list', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await page.getByRole('dialog', { name: 'Samples workspace' }).getByRole('button', { name: /Sample list —/ }).click();
    const labels = page.getByRole('button', { name: 'Print labels' });
    await labels.click();
    await expect(page.getByText('Print labels', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Print labels', { exact: true }).filter({ visible: true })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(labels).toBeFocused();
    const edit = page.getByRole('button', { name: 'Edit 1998 Dong Ding' });
    await edit.click();
    await expect(page.getByText('Edit sample', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Edit sample', { exact: true })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(edit).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeHidden();
  });

  test('opens the exact sample set from a Library batch link without remounting Compass', async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      // @ts-expect-error Vite source modules are available in Playwright.
      const { createEmptySampleSet } = await import('/src/samples/types.ts');
      // @ts-expect-error Vite source modules are available in Playwright.
      const { createEmptyEntry } = await import('/src/components/TeaCompass/types.ts');
      // Both stores persist independently. Rehydrate them before injecting the
      // runtime-only fixture so a late hydration cannot replace it after the
      // Library tab renders (most visible on slower mobile runs).
      await Promise.all([
        useSampleStore.persist.rehydrate(),
        useTeaCompassStore.persist.rehydrate(),
      ]);
      const set = createEmptySampleSet({ purpose: 'sourcing' });
      set.id = 'set-library-click';
      set.name = 'Library Click Batch';
      useSampleStore.getState().addSampleSet(set);
      const entry = createEmptyEntry('tea');
      entry.id = 'library-sample-entry';
      entry.name = 'Library Sample Tea';
      entry.isSample = true;
      entry.sampleSetId = set.id;
      entry.status = 'noted';
      useTeaCompassStore.getState().addEntry(entry);
    });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: /To taste/ }).click();
    await page.getByRole('button', { name: 'Library Click Batch' }).click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample batches' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Samples workspace' }).click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeHidden();
    await expect(page).not.toHaveURL(/sampleOrder|set=/);
    await page.getByRole('button', { name: /To taste/ }).click();
    await page.getByRole('button', { name: 'Library Click Batch' }).click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeHidden();
    await page.goForward();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
  });

  test('shows count and saves a nonempty cart as a historical set', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await expect(page.getByRole('button', { name: 'Sample list (1)' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await expect(page.getByText('1 tea · 10g').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('teajia-samples') || '{}');
      return saved.state?.sampleSets?.length ?? 0;
    }), { message: 'Save as sample batch must persist a historical set' }).toBe(1);

    await page.goto('/admin/samples', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample batches' })).toBeVisible();
  });

  test('saving a sample list links the same requested batch into the Library tasting queue', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM], preserveSamplesOnNavigation: true, compassEntries: [{
      id: 'compass-tea-1', name: '1998 Dong Ding', category: 'tea', status: 'noted', decision: 'selected', verdict: 'love',
      notes: '', photos: '[]', audio_clips: '[]', created_at: '2026-07-13T00:00:00.000Z', updated_at: '2026-07-13T00:00:00.000Z',
    }] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect(page.getByText('Saved as sample batch — list cleared')).toBeVisible();
    await page.getByRole('button', { name: 'Close Samples workspace' }).click();
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: /To taste/ }).click();
    await expect(page.getByText('Requested', { exact: true }).first()).toBeVisible();
    const setName = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const linked = useTeaCompassStore.getState().entries.find((entry: { id: string }) => entry.id === 'compass-tea-1');
      return { setId: linked.sampleSetId, decision: linked.decision, verdict: linked.verdict, status: linked.status };
    });
    expect(setName).toMatchObject({ decision: 'selected', verdict: 'love', status: 'noted' });
    await page.getByRole('button', { name: /Sample list —/ }).click();
    await expect(page.getByRole('dialog', { name: 'Samples workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    const status = page.locator('button[title="Click to change status"]').filter({ visible: true });
    await expect(status).toHaveText('Requested');
    await status.click();
    await expect(status).toHaveText('Received');
    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries.find((candidate: { id: string }) => candidate.id === 'compass-tea-1');
      return { sampleState: entry.sampleState, decision: entry.decision, verdict: entry.verdict, status: entry.status };
    })).toEqual({ sampleState: 'received', decision: 'selected', verdict: 'love', status: 'noted' });
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      const sample = useSampleStore.getState().samples[0];
      useSampleStore.getState().addTasting(sample.id, {
        id: 'actual-tasting', tasterId: 'admin', tasting: { aroma: ['orchid'] }, verdict: 'pass', wouldBuy: false,
        createdAt: '2026-07-13T01:00:00.000Z',
      });
    });
    await expect.poll(() => page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().entries.find((candidate: { id: string }) => candidate.id === 'compass-tea-1');
      return { sampleState: entry.sampleState, decision: entry.decision, verdict: entry.verdict, status: entry.status };
    })).toEqual({ sampleState: 'tasted', decision: 'selected', verdict: 'love', status: 'noted' });
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { syncCompassEntries } = await import('/src/lib/teaCompassSync.ts');
      await syncCompassEntries('acct-bali');
    });
    await page.getByRole('button', { name: 'Close Samples workspace' }).click();
    await page.evaluate(() => localStorage.removeItem('teajia-compass'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: /To taste/ }).click();
    await expect(page.getByRole('button', { name: /Sample list —/ })).toBeVisible();
    await expect(page.getByText('Tasted', { exact: true }).first()).toBeVisible();
  });

  test('a failed portion write keeps the list and retries the same batch', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    let failed = false;
    await page.route('**/api/admin/samples', async route => {
      if (route.request().method() === 'POST' && !failed) {
        failed = true;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary sample write failure' }) });
      }
      return route.fallback();
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect(page.getByRole('alert')).toContainText('Temporary sample write failure');
    await expect(page.getByText('1 tea · 10g').filter({ visible: true })).toBeVisible();
    const firstSetId = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.sampleSets[0].id);
    await page.getByRole('button', { name: 'Retry saving sample batch' }).click();
    await expect(page.getByText('Saved as sample batch — list cleared')).toBeVisible();
    const savedSetIds = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.sampleSets.map((set: { id: string }) => set.id));
    expect(savedSetIds).toEqual([firstSetId]);
  });

  test('reopens a failed Compass linkage retry with the same persisted batch ids', async ({ page }) => {
    await installCompassHarness(page, {
      sampleCart: [CART_ITEM], preserveSamplesOnNavigation: true, preserveSampleCartOnNavigation: true,
    });
    let failed = false;
    await page.route('**/api/compass/sync', async route => {
      if (!failed) {
        failed = true;
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Compass linkage rejected once' }) });
      }
      return route.fallback();
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect(page.getByRole('alert')).toContainText('Library linkage is still pending');
    await expect(page.getByText(/saved batch is locked until Library linkage finishes/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '15g' })).toBeDisabled();
    const beforeReload = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state;
      return {
        setId: state.pendingOperation.sampleSet.id,
        sampleIds: state.pendingOperation.samples.map((sample: { id: string }) => sample.id),
      };
    });
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleCartStore } = await import('/src/samples/sampleCartStore.ts');
      const store = useSampleCartStore.getState();
      store.updateGrams('compass-tea-1', 50);
      store.removeItem('compass-tea-1');
      store.addItem({ id: 'duplicate-risk', name: 'Duplicate risk', grams: 5 });
      store.clear();
    });
    await expect(page.getByText('1 tea · 10g').filter({ visible: true })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Retry saved batch' }).click();
    await expect(page.getByText('Saved as sample batch — list cleared')).toBeVisible();
    expect(compassRequestCount(page, 'POST /api/admin/sample-sets')).toBe(1);
    expect(compassRequestCount(page, 'POST /api/admin/samples')).toBe(1);
    const afterRetry = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state);
    expect(afterRetry.pendingOperation).toBeNull();
    expect(afterRetry.items).toEqual([]);
    const sampleState = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state);
    expect(sampleState.sampleSets.filter((set: { id: string }) => set.id === beforeReload.setId)).toHaveLength(1);
    expect(sampleState.samples.map((sample: { id: string }) => sample.id)).toEqual(expect.arrayContaining(beforeReload.sampleIds));
  });

  test('discards a blocked saved draft once, unlocks its original list, and saves the corrected list', async ({ page }) => {
    const missingItem = {
      id: 'missing-cart-item', name: 'Missing Library Tea', type: 'Green', vendorName: 'Absent Vendor',
      grams: 5, compassEntryId: 'missing-library-entry',
    };
    const goodItem = {
      id: 'good-cart-item', name: 'Available Library Tea', type: 'Oolong', vendorName: 'Present Vendor',
      grams: 10, compassEntryId: 'good-library-entry',
    };
    await installCompassHarness(page, {
      sampleCart: [missingItem, goodItem],
      preserveSamplesOnNavigation: true,
      preserveSampleCartOnNavigation: true,
      compassEntries: [{
        id: 'good-library-entry', name: goodItem.name, category: 'tea', status: 'noted',
        decision: null, verdict: null, sample_state: null, sample_set_id: null,
        notes: '', photos: '[]', audio_clips: '[]', created_at: '2026-07-13T00:00:00.000Z', updated_at: '2026-07-13T00:00:00.000Z',
      }],
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (2)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect(page.getByRole('alert')).toContainText('discard the saved draft to unlock and edit this list');

    const blocked = await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state;
      const samples = JSON.parse(localStorage.getItem('teajia-samples') || '{}').state;
      return {
        setId: cart.pendingOperation.sampleSet.id,
        portionIds: cart.pendingOperation.samples.map((sample: { id: string }) => sample.id),
        persistedSetIds: samples.sampleSets.map((set: { id: string }) => set.id),
        persistedPortionIds: samples.samples.map((sample: { id: string }) => sample.id),
      };
    });
    expect(blocked.persistedSetIds).toEqual([blocked.setId]);
    expect(blocked.persistedPortionIds).toEqual(expect.arrayContaining(blocked.portionIds));

    await page.getByRole('button', { name: 'Discard saved draft' }).click();
    await expect(page.getByRole('button', { name: 'Save as sample batch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeEnabled();
    expect(compassRequestCount(page, `DELETE /api/admin/sample-sets/${blocked.setId}`)).toBe(1);
    expect(compassRequestCount(page, 'POST /api/admin/sample-sets')).toBe(1);
    expect(compassRequestCount(page, 'POST /api/admin/samples')).toBe(2);

    const afterDiscard = await page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state,
      samples: JSON.parse(localStorage.getItem('teajia-samples') || '{}').state,
    }));
    expect(afterDiscard.cart.pendingOperation).toBeNull();
    expect(afterDiscard.cart.items.map((item: { id: string }) => item.id)).toEqual(['missing-cart-item', 'good-cart-item']);
    expect(afterDiscard.samples.sampleSets).toEqual([]);
    expect(afterDiscard.samples.samples).toEqual([]);

    const missingRow = page.getByText('Missing Library Tea', { exact: true }).locator('..').locator('..');
    await missingRow.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('1 tea · 10g').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect(page.getByText('Saved as sample batch — list cleared')).toBeVisible();
    expect(compassRequestCount(page, `DELETE /api/admin/sample-sets/${blocked.setId}`)).toBe(1);
    expect(compassRequestCount(page, 'POST /api/admin/sample-sets')).toBe(2);
    expect(compassRequestCount(page, 'POST /api/admin/samples')).toBe(3);

    const corrected = await page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state,
      samples: JSON.parse(localStorage.getItem('teajia-samples') || '{}').state,
    }));
    expect(corrected.cart.pendingOperation).toBeNull();
    expect(corrected.cart.items).toEqual([]);
    expect(corrected.samples.sampleSets).toHaveLength(1);
    expect(corrected.samples.sampleSets[0].id).not.toBe(blocked.setId);
    expect(corrected.samples.samples).toHaveLength(1);
    expect(corrected.samples.samples[0]).toMatchObject({ compassEntryId: 'good-library-entry' });
    expect(blocked.portionIds).not.toContain(corrected.samples.samples[0].id);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state,
      samples: JSON.parse(localStorage.getItem('teajia-samples') || '{}').state,
    })), { message: 'The corrected batch should rehydrate without restoring the discarded draft' }).toMatchObject({
      cart: { pendingOperation: null, items: [] },
      samples: { sampleSets: [{ id: corrected.samples.sampleSets[0].id }] },
    });
    const reloaded = await page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state,
      samples: JSON.parse(localStorage.getItem('teajia-samples') || '{}').state,
    }));
    expect(reloaded.cart.pendingOperation).toBeNull();
    expect(reloaded.cart.items).toEqual([]);
    expect(reloaded.samples.sampleSets.map((set: { id: string }) => set.id)).toEqual([corrected.samples.sampleSets[0].id]);
  });

  test('keeps a blocked list locked when saved draft cleanup fails', async ({ page }) => {
    await installCompassHarness(page, {
      sampleCart: [{ ...CART_ITEM, compassEntryId: 'missing-library-entry' }],
      preserveSamplesOnNavigation: true,
      preserveSampleCartOnNavigation: true,
      compassEntries: [],
    });
    let failCleanup = true;
    await page.route('**/api/admin/sample-sets/*', async route => {
      if (route.request().method() === 'DELETE' && failCleanup) {
        failCleanup = false;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Draft cleanup is temporarily unavailable' }) });
      }
      return route.fallback();
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await page.getByRole('button', { name: 'Discard saved draft' }).click();
    await expect(page.getByText('Draft cleanup is temporarily unavailable', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard saved draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    const stillLocked = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state);
    expect(stillLocked.pendingOperation).not.toBeNull();
    expect(stillLocked.items).toHaveLength(1);

    await page.getByRole('button', { name: 'Discard saved draft' }).click();
    await expect(page.getByRole('button', { name: 'Save as sample batch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeEnabled();
  });

  test('retries a lost Library unlink before deleting its remotely linked sample draft', async ({ page }) => {
    await installCompassHarness(page, {
      sampleCart: [CART_ITEM],
      preserveSamplesOnNavigation: true,
      preserveSampleCartOnNavigation: true,
      compassSyncLoseResponses: 2,
      compassEntries: [{
        id: 'compass-tea-1', name: CART_ITEM.name, category: 'tea', status: 'noted', decision: 'selected', verdict: 'love',
        sample_state: null, sample_set_id: null, notes: '', photos: '[]', audio_clips: '[]',
        created_at: '2026-07-13T00:00:00.000Z', updated_at: '2026-07-13T00:00:00.000Z',
      }],
    });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await expect(page.getByRole('alert')).toContainText('Library linkage is still pending');
    const setId = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-sample-cart') || '{}').state.pendingOperation.sampleSet.id);
    const remotelyLinked = await page.evaluate(async () => {
      const response = await fetch('/api/compass/entries');
      return (await response.json()).entries.find((entry: { id: string }) => entry.id === 'compass-tea-1');
    });
    expect(remotelyLinked).toMatchObject({
      sample_set_id: setId, sample_state: 'requested', decision: 'selected', verdict: 'love', status: 'noted',
    });

    await page.getByRole('button', { name: 'Discard saved draft' }).click();
    await expect(page.getByText(/still linked in Library/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    expect(compassRequestCount(page, `DELETE /api/admin/sample-sets/${setId}`)).toBe(0);
    const remotelyUnlinkedAfterLostResponse = await page.evaluate(async () => {
      const response = await fetch('/api/compass/entries');
      return (await response.json()).entries.find((entry: { id: string }) => entry.id === 'compass-tea-1');
    });
    expect(remotelyUnlinkedAfterLostResponse).toMatchObject({
      sample_set_id: null, sample_state: null, decision: 'selected', verdict: 'love', status: 'noted',
    });

    await page.getByRole('button', { name: 'Discard saved draft' }).click();
    await expect(page.getByRole('button', { name: 'Save as sample batch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeEnabled();
    expect(compassRequestCount(page, 'POST /api/compass/sync')).toBe(3);
    expect(compassRequestCount(page, `DELETE /api/admin/sample-sets/${setId}`)).toBe(1);
    expect(compassRequestCount(page, 'POST /api/admin/sample-sets')).toBe(1);
    expect(compassRequestCount(page, 'POST /api/admin/samples')).toBe(1);
    const finalState = await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return {
        entry: useTeaCompassStore.getState().entries.find((candidate: { id: string }) => candidate.id === 'compass-tea-1'),
        samples: JSON.parse(localStorage.getItem('teajia-samples') || '{}').state,
      };
    });
    expect(finalState.entry).toMatchObject({
      sampleSetId: undefined, sampleState: null, isSample: false, synced: true,
      decision: 'selected', verdict: 'love', status: 'noted',
    });
    expect(finalState.samples.sampleSets).toEqual([]);
    expect(finalState.samples.samples).toEqual([]);
  });

  test('historical sample preserves label identity and tasting linkage', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    const historical = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('teajia-samples') || '{}');
      return saved.state?.samples?.[0];
    });
    expect(historical, 'Saved sample must remain available to the historical sample tools').toMatchObject({
      name: '1998 Dong Ding', chineseName: '凍頂', type: 'Oolong', compassEntryId: 'compass-tea-1', tastings: [],
    });
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await page.getByRole('dialog', { name: 'Samples workspace' }).getByRole('button', { name: /Sample list —/ }).click();
    await page.getByRole('button', { name: 'Open in Curate to taste' }).click();
    await expect(page).toHaveURL(/\/admin\/compass\?entry=compass-tea-1/);
  });

  test('makes historical sets, labels, tasting management, and purpose semantics reachable', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample list (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as sample batch' }).click();
    await page.getByRole('button', { name: 'View Sample batches' }).click();
    await expect(page.getByRole('heading', { name: 'Sample batches', exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: 'Samples workspace' }).getByRole('button', { name: /Sample list —/ }).click();
    await page.getByRole('button', { name: 'Batch details' }).click();
    await expect(page.getByRole('button', { name: 'Sourcing', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gifted', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Event', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Panel', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Gifted', exact: true }).click();
    await page.getByPlaceholder('Select customer...').fill('Mina Chen');
    await page.getByPlaceholder('Select customer...').blur();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.sampleSets[0].customerName)).toBe('Mina Chen');
    await expect(page.getByRole('button', { name: /Print labels/i })).toBeVisible();
    await expect(page.getByText(/Untasted|Tasted/).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open in Curate to taste' })).toBeVisible();
    const visibleStatusControl = page.locator('button[title="Click to change status"]').filter({ visible: true });
    await expect(visibleStatusControl).toHaveCount(1);
    for (let step = 0; step < 4; step += 1) await visibleStatusControl.click();
    await expect(page.getByRole('button', { name: 'Graduate to inventory' })).toBeVisible();
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useSampleStore } = await import('/src/samples/sampleStore.ts');
      const sample = useSampleStore.getState().samples[0];
      useSampleStore.getState().updateSample(sample.id, { productId: 'product-42' });
    });
    await page.getByRole('button', { name: 'Open inventory product' }).click();
    await expect(page).toHaveURL(/\/admin\/stock\?panel=product-42/);
  });
});
