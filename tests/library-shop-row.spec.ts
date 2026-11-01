import { test, expect, type Page } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';
import { openRecordSection } from './helpers/teaRecord';

const entryId = 'library-shop-row';
const photo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/%3E';

async function openLibrary(page: Page) {
  await installCompassHarness(page, { compassEntries: [{
    id: entryId, name: 'Cloud Peak', chinese_name: '云峰', category: 'tea',
    type: 'Sheng', year: 2024, origin_region: 'Yunnan', vendor_name: 'Chen Family',
    status: 'noted', notes: 'smoky apricot', photos: JSON.stringify([photo]),
    price_amount: 20, price_currency: 'USD', price_per_unit_grams: 10,
    created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
  }] });
  await page.route(`**/api/compass/entries/${entryId}`, route => route.request().method() === 'DELETE'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    : route.fallback());
  await openCompass(page);
  await expect.poll(() => page.evaluate(async () => {
    // @ts-expect-error Vite source module.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return useTeaCompassStore.getState().hydrationStatus;
  })).toBe('ready');
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await expect(page.getByTestId(`library-entry-${entryId}`).filter({ visible: true })).toBeVisible();
}


const perGram = (entry: ReturnType<Page['getByTestId']>) => entry.locator('span:text-is("Per gram") + strong');

test.describe('Library compact row and shared tea record', () => {
  test.beforeEach(async ({ page }) => openLibrary(page));
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('shows quote, Taste and More without Save or horizontal overflow', async ({ page }) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    await expect(entry).toContainText('Cloud Peak');
    // The card's three pricing fields: per gram and quote are bare numbers in the
    // display currency (libraryCardAmounts), with the quoted weight beside them.
    await expect(perGram(entry)).toHaveText('2');
    await expect(entry.getByRole('button', { name: /^Edit quote in / })).toHaveText('20.00');
    for (const name of ['Taste Cloud Peak', 'Edit details for Cloud Peak', 'Choose', 'Reject']) {
      await expect(entry.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(entry.getByRole('button', { name: /^(Save|Unsave|Want|Edit entry|Delete entry)/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await entry.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('More directly opens the editable record and saves description separately from notes', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit details for Cloud Peak', exact: true }).filter({ visible: true }).click();
    const record = page.getByTestId('library-entry-detail').filter({ visible: true });
    // The name is edited in place at the head of the record, above the tabs.
    await expect(page.getByTestId('library-entry-detail').filter({ visible: true }).getByRole('button', { name: 'Tea name', exact: true })).toHaveText('Cloud Peak');
    await openRecordSection(page, 'About this tea');
    await openRecordSection(page, 'Source material');
    await expect(record.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('smoky apricot');
    await openRecordSection(page, 'Story & description');
    await record.getByRole('textbox', { name: 'Description', exact: true }).fill('A clear working description');
    await record.getByRole('textbox', { name: 'Notes', exact: true }).click();
    await expect.poll(() => page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().getEntry(id);
      return { description: entry.description, notes: entry.notes };
    }, entryId)).toEqual({ description: 'A clear working description', notes: 'smoky apricot' });
    const saved = await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { syncCompassEntries } = await import('/src/lib/teaCompassSync.ts');
      await syncCompassEntries();
      const { entries } = await (await fetch('/api/compass/entries')).json();
      const entry = entries.find((row: any) => row.id === id);
      return { description: entry.description, notes: entry.notes };
    }, entryId);
    expect(saved).toEqual({ description: 'A clear working description', notes: 'smoky apricot' });
  });

  test('keeps Sample list action in the shared record', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit details for Cloud Peak', exact: true }).filter({ visible: true }).click();
    const record = page.getByTestId('library-entry-detail').filter({ visible: true });
    await openRecordSection(page, 'Files & history');
    await record.getByRole('button', { name: 'Add to Sample list', exact: true }).click();
    await expect(record.getByRole('button', { name: 'In Sample list', exact: true })).toBeVisible();
    expect(await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useSampleCartStore } = await import('/src/samples/sampleCartStore.ts');
      return useSampleCartStore.getState().items.some((item: any) => item.compassEntryId === id);
    }, entryId)).toBe(true);
    await record.getByRole('button', { name: 'In Sample list', exact: true }).click();
    await expect(record.getByRole('button', { name: 'Add to Sample list', exact: true })).toBeVisible();
  });

  test('opens the existing Taste flow and returns to the same record', async ({ page }) => {
    await page.getByRole('button', { name: 'Taste Cloud Peak' }).click();
    const close = page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true });
    await expect(close).toBeVisible();
    await close.click();
    await page.getByRole('button', { name: 'Edit details for Cloud Peak', exact: true }).filter({ visible: true }).click();
    // The name is edited in place at the head of the record, above the tabs.
    await expect(page.getByTestId('library-entry-detail').filter({ visible: true }).getByRole('button', { name: 'Tea name', exact: true })).toHaveText('Cloud Peak');
    await openRecordSection(page, 'About this tea');
  });

  test('handles long names, recorded zero and missing quotes without overflow', async ({ page }) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.getState().updateEntry(id, { name: 'A long tea name from a mountain garden that remains readable', priceAmount: 0 });
    }, entryId);
    // A recorded zero is a price of zero, not an unknown one.
    await expect(perGram(entry)).toHaveText('0');
    expect(await entry.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.evaluate(async id => {
      // @ts-expect-error Vite source module.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.getState().updateEntry(id, { priceAmount: undefined });
    }, entryId);
    await expect(perGram(entry)).toHaveText('—');
    await expect(entry.getByRole('button', { name: /^Edit quote in / })).toHaveText('—');
  });

  test('requires confirmation before deleting from the record', async ({ page }) => {
    const entry = page.getByTestId(`library-entry-${entryId}`).filter({ visible: true });
    await entry.getByRole('button', { name: 'Edit details for Cloud Peak', exact: true }).click();
    const record = page.getByTestId('library-entry-detail').filter({ visible: true });
    await openRecordSection(page, 'Files & history');
    await record.getByRole('button', { name: 'Delete entry', exact: true }).click();
    await expect(record).toBeVisible();
    await record.getByRole('button', { name: 'Confirm delete entry', exact: true }).click();
    await expect(entry).toHaveCount(0);
  });

  test('Add contains imports and has no secondary row action menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to Library', exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: /Import files/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /New tea Capture/ })).toBeVisible();
  });
});
