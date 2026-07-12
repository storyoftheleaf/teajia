import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const CART_ITEM = { id: 'compass-tea-1', name: '1998 Dong Ding', chineseName: '凍頂', type: 'Oolong', vendorName: 'Chen Family', grams: 10, compassEntryId: 'compass-tea-1' };

test.describe('Sample workflows remain reachable outside the capture method row', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));
  test('opens the contextual empty Sample order from Source and restores focus', async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
    const trigger = page.getByRole('button', { name: 'Sample order (0)' }).first();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(page.getByText('Sample List', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Your sample list is empty', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Capture tea' }).click();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeHidden();
    await expect(page.getByPlaceholder(/Tea name \(e\.g\., Tieguanyin/).filter({ visible: true })).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Browse Library' }).click();
    await expect(page.getByRole('tab', { name: 'Library', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Source', exact: true }).click();
    await trigger.click();
    await page.getByRole('button', { name: 'Close Sample order' }).click();
    await expect(trigger).toBeFocused();
  });

  test('/admin/samples and linked set query open visible sample management UI', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    const setId = await page.evaluate(() => JSON.parse(localStorage.getItem('teajia-samples') || '{}').state.sampleSets[0].id);
    await page.goto(`/admin/samples?set=${encodeURIComponent(setId)}`);
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample sets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Sample order' }).click();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeHidden();
    await expect(page).not.toHaveURL(/sampleOrder|set=/);
  });

  test('nested label and edit overlays own Escape before the Sample order', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    await page.getByRole('button', { name: 'Manage sample sets' }).click();
    await page.getByText(/Sample Cart/).first().click();
    const labels = page.getByRole('button', { name: 'Print labels' });
    await labels.click();
    await expect(page.getByText('Print Labels', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Print Labels', { exact: true })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(labels).toBeFocused();
    const edit = page.getByRole('button', { name: 'Edit 1998 Dong Ding' });
    await edit.click();
    await expect(page.getByText('Edit Sample', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Edit Sample', { exact: true })).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(edit).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeHidden();
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
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample sets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch details' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Sample order' }).click();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeHidden();
    await expect(page).not.toHaveURL(/sampleOrder|set=/);
    await page.getByRole('button', { name: /To taste/ }).click();
    await page.getByRole('button', { name: 'Library Click Batch' }).click();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeHidden();
    await page.goForward();
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
  });

  test('shows count and saves a nonempty cart as a historical set', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await expect(page.getByRole('button', { name: 'Sample order (1)' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await expect(page.getByText('1 tea · 10g').filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('teajia-samples') || '{}');
      return saved.state?.sampleSets?.length ?? 0;
    }), { message: 'Save as Sample Set must persist a historical set' }).toBe(1);

    await page.goto('/admin/samples', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('dialog', { name: 'Sample order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample sets' })).toBeVisible();
  });

  test('historical sample preserves label identity and tasting linkage', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    const historical = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('teajia-samples') || '{}');
      return saved.state?.samples?.[0];
    });
    expect(historical, 'Saved sample must remain available to the historical sample tools').toMatchObject({
      name: '1998 Dong Ding', chineseName: '凍頂', type: 'Oolong', compassEntryId: 'compass-tea-1', tastings: [],
    });
    await page.getByRole('button', { name: 'Manage sample sets' }).click();
    await page.getByText(/Sample Cart/).first().click();
    await page.getByRole('button', { name: 'Open in Curate to taste' }).click();
    await expect(page).toHaveURL(/\/admin\/compass\?entry=compass-tea-1/);
  });

  test('makes historical sets, labels, tasting management, and purpose semantics reachable', async ({ page }) => {
    await installCompassHarness(page, { sampleCart: [CART_ITEM] });
    await openCompass(page);
    await page.getByRole('button', { name: 'Sample order (1)' }).first().click();
    await page.getByRole('button', { name: 'Save as Sample Set' }).click();
    await page.getByRole('button', { name: 'Manage sample sets' }).click();
    await expect(page.getByRole('heading', { name: /Sample Sets|Samples/ }).first()).toBeVisible();
    await page.getByText(/Sample Cart/).first().click();
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
    await expect(page.getByText(/Untasted|Tasted/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open in Curate to taste' })).toBeVisible();
    await page.locator('button[title="Click to change status"]').last().click();
    await page.locator('button[title="Click to change status"]').last().click();
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
