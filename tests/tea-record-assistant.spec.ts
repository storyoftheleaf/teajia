import { test, expect } from './fixtures';
import { compassRequestCount, expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const teaId = 'assistant-tea';
const parts = [
  { kind: 'tea', text: 'Spring 2019 tea from Yiwu', fields: { year: 2019, season: 'Spring', origin_region: 'Yiwu', type: 'Sheng' } },
  { kind: 'price', text: '120 yuan per cake', fields: { amount: 120, currency: 'CNY', per: 'cake' } },
  { kind: 'taste', text: 'Vendor says excellent', fields: { score: 10 } },
  { kind: 'story', text: 'Trees are old, according to the vendor', fields: {} },
];

test.describe('Shared record source assistant', () => {
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('reviews every extracted part, applies only selected missing facts, and preserves a later typed answer', async ({ page }) => {
    await installCompassHarness(page, { compassEntries: [{ id: teaId, name: 'Assistant tea', category: 'tea', status: 'noted', notes: 'Spring 2019 from Yiwu; 120 yuan per cake. Vendor says excellent and old trees.', photos: '[]', audio_clips: '[]', price_currency: 'Yuan', created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:00:00Z' }], saidParts: parts });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'More about Assistant tea', exact: true }).click();
    await page.getByTestId('library-entry-detail').filter({ visible: true }).getByRole('button', { name: 'Build this tea', exact: true }).click();
    const assistant = page.getByRole('dialog', { name: 'Build this tea', exact: true }).getByTestId('tea-record-assistant');
    await expect(assistant.locator('details').first()).toHaveAttribute('open');
    await expect(assistant.getByText(/Material to review · 1 source$/)).toBeVisible();
    await expect(assistant.getByText(/^Original material/)).toHaveCount(0);
    await expect(assistant.getByRole('button', { name: 'Apply reviewed details' })).toHaveCount(0);
    await assistant.getByRole('button', { name: 'Find tea details', exact: true }).dblclick();
    await expect(assistant.getByText('Vendor says excellent', { exact: true })).toBeVisible();
    await expect(assistant.getByRole('textbox', { name: 'Excerpt to review', exact: true })).toBeVisible();
    await expect(assistant.getByText('Trees are old, according to the vendor', { exact: true })).toBeVisible();
    const apply = assistant.getByRole('button', { name: 'Save accepted changes', exact: true });
    await expect(apply).toBeDisabled();
    expect(compassRequestCount(page, 'POST /api/curate/said/file')).toBe(1);
    await assistant.getByRole('checkbox', { name: 'Year: 2019', exact: true }).check();
    await assistant.getByRole('checkbox', { name: 'Origin: Yiwu', exact: true }).check();
    await page.evaluate(async id => {
      // @ts-expect-error Vite source import in browser test.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      useTeaCompassStore.getState().updateEntry(id, { year: 2024 });
    }, teaId);
    await expect.poll(async () => page.evaluate(async id => {
      // @ts-expect-error Vite source import in browser test.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().getEntry(id)?.synced;
    }, teaId)).toBe(true);
    await apply.click();
    await expect(page.getByRole('dialog', { name: 'Build this tea', exact: true })).not.toBeVisible();
    const saved = await page.evaluate(async id => {
      // @ts-expect-error Vite source import in browser test.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const entry = useTeaCompassStore.getState().getEntry(id);
      return { year: entry.year, origin: entry.originRegion, amount: entry.priceAmount, tasting: entry.tasting, description: entry.description, notes: entry.notes };
    }, teaId);
    expect(saved).toEqual({ year: 2024, origin: 'Yiwu', amount: undefined, tasting: undefined, description: undefined, notes: 'Spring 2019 from Yiwu; 120 yuan per cake. Vendor says excellent and old trees.' });
  });

  test('blocks oversized material until a source excerpt is shortened', async ({ page }) => {
    await installCompassHarness(page, { compassEntries: [{ id: teaId, name: 'Assistant tea', category: 'tea', status: 'noted', notes: 'Original source details. '.repeat(210), photos: '[]', audio_clips: '[]', created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:00:00Z' }], saidParts: [] });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'More about Assistant tea', exact: true }).click();
    await page.getByTestId('library-entry-detail').filter({ visible: true }).getByRole('button', { name: 'Build this tea', exact: true }).click();
    const assistant = page.getByRole('dialog', { name: 'Build this tea', exact: true }).getByTestId('tea-record-assistant');
    await expect(assistant.getByRole('button', { name: 'Find tea details', exact: true })).toBeDisabled();
    await assistant.getByRole('textbox', { name: 'Excerpt to review', exact: true }).fill('Original source details.');
    await assistant.getByRole('button', { name: 'Find tea details', exact: true }).click();
    await expect(assistant.getByText('No details could be extracted from this material.', { exact: true })).toBeVisible();
    expect(compassRequestCount(page, 'POST /api/curate/said/file')).toBe(1);
    expect(await page.evaluate(async id => {
      // @ts-expect-error Vite source import in browser test.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      return useTeaCompassStore.getState().getEntry(id)?.notes.length;
    }, teaId)).toBeGreaterThan(4000);
  });
});
