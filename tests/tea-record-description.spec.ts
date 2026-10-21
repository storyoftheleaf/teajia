import { test, expect, type Page } from './fixtures';
import { installCompassHarness, openCompass, expectNoUnhandledCompassApi } from './helpers/compassHarness';
const entryId = 'description-review-tea';
const source = { id: entryId, name: 'Description Mountain Tea', category: 'tea', type: 'Sheng', form: 'Loose', year: 2024, status: 'noted', notes: 'I noticed a clean mineral finish in this spring tea.', description: 'Existing description written by Adrian.', photos: '[]', audio_clips: '[]', price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const generated = 'A spring tea with a clean mineral finish.';
async function current(page: Page) {
  return page.evaluate(async id => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return useTeaCompassStore.getState().getEntry(id);
  }, entryId);
}
async function changeDescription(page: Page, description: string) {
  await page.evaluate(async ({ id, description }) => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    useTeaCompassStore.getState().updateEntry(id, { description });
  }, { id: entryId, description });
}
async function openRecord(page: Page) {
  await page.setViewportSize({ width: 393, height: 851 });
  await installCompassHarness(page, { compassEntries: [source] });
  await openCompass(page);
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByTestId(`library-entry-${entryId}`).filter({ visible: true }).getByRole('button', { name: `More about ${source.name}`, exact: true }).click();
  await expect(page.getByTestId('library-entry-detail').filter({ visible: true })).toBeVisible();
  return page.getByTestId('tea-description-review').filter({ visible: true });
}
const proposal = (body: any) => ({ description: generated, baseDescription: source.description, citations: [{ sourceId: body.sources[0].id, quote: body.sources[0].text }] });

test('phone description proposal stays editable and saves only after explicit acceptance', async ({ page }) => {
  const review = await openRecord(page);
  const requests: any[] = [];
  await page.route('**/api/curate/description-proposal', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: proposal(requests.at(-1)) });
  });
  await review.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
  const text = review.getByRole('textbox', { name: 'Proposed description', exact: true });
  await expect(text).toHaveValue(generated);
  expect((await current(page))?.description).toBe(source.description);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ entryId, sources: [{ id: `entry:${entryId}`, text: source.notes }] });
  await review.getByText('Current description', { exact: true }).click();
  await expect(review.getByText(source.description, { exact: true })).toBeVisible();
  await review.getByText('Sources used (1)', { exact: true }).click();
  await expect(review.locator('blockquote')).toContainText(source.notes);
  await text.fill('Reviewed spring tea with a mineral finish.');
  await page.screenshot({ path: '/private/tmp/tea-record-description-phone-proposal.png', fullPage: true, animations: 'disabled' });
  await review.getByRole('button', { name: 'Use this description', exact: true }).click();
  await expect.poll(async () => (await current(page))?.description).toBe('Reviewed spring tea with a mineral finish.');
  expect(await current(page)).toMatchObject({ id: entryId, notes: source.notes, year: source.year, type: source.type, priceAmount: source.price_amount });
  await review.getByRole('button', { name: 'Undo description change', exact: true }).click();
  await expect.poll(async () => (await current(page))?.description).toBe(source.description);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expectNoUnhandledCompassApi(page);
});

test('phone description generation keeps a human edit made while the proposal is pending', async ({ page }) => {
  const review = await openRecord(page);
  let complete: (() => void) | undefined;
  let started = false;
  await page.route('**/api/curate/description-proposal', async route => {
    const body = route.request().postDataJSON(); started = true;
    await new Promise<void>(resolve => { complete = resolve; });
    await route.fulfill({ json: proposal(body) });
  });
  await review.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await changeDescription(page, 'Human correction while AI was drafting.');
  complete!();
  await expect(review.getByRole('alert')).toContainText('description changed');
  expect((await current(page))?.description).toBe('Human correction while AI was drafting.');
  await expect(review.getByRole('button', { name: 'Use this description', exact: true })).toHaveCount(0);
  await expectNoUnhandledCompassApi(page);
});

test('phone review refuses an approved excerpt that changes before use', async ({ page }) => {
  const review = await openRecord(page);
  await page.route('**/api/curate/description-proposal', async route => route.fulfill({ json: proposal(route.request().postDataJSON()) }));
  await review.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
  await expect(review.getByRole('textbox', { name: 'Proposed description', exact: true })).toHaveValue(generated);
  const material = page.getByTestId('tea-record-assistant').filter({ visible: true });
  const excerpt = material.getByRole('textbox', { name: 'Excerpt to review', exact: true });
  if (!await excerpt.isVisible()) await material.locator('summary').filter({ hasText: 'Material to review' }).click();
  await excerpt.fill('I noticed a clean mineral finish.');
  await expect(review.getByRole('alert')).toContainText('source material changed');
  await expect(review.getByRole('button', { name: 'Use this description', exact: true })).toBeDisabled();
  expect((await current(page))?.description).toBe(source.description);
  expect((await current(page))?.notes).toBe(source.notes);
  await expectNoUnhandledCompassApi(page);
});

test('phone drafting stops if the local tea facts could not reach the server', async ({ page }) => {
  const review = await openRecord(page);
  let proposals = 0;
  await page.route('**/api/compass/sync', async route => route.fulfill({ status: 503, json: { error: 'Offline for this test' } }));
  await page.route('**/api/curate/description-proposal', async route => { proposals += 1; await route.fulfill({ json: proposal(route.request().postDataJSON()) }); });
  await page.evaluate(async id => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    useTeaCompassStore.getState().updateEntry(id, { year: 2025 });
  }, entryId);
  await review.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('has not finished saving');
  expect(proposals).toBe(0);
  expect((await current(page))?.description).toBe(source.description);
  expect((await current(page))?.year).toBe(2025);
  await expectNoUnhandledCompassApi(page);
});
