/**
 * One Curate, stage 1: the tea's own record on v2's tea screen.
 * Given name, what the quote covers, the story, and Build this tea are the
 * old Curate's own pieces mounted on TeaFace; these are their v2 twins of
 * tea-record-description, tea-record-nested-review and tasting-save-stay.
 * Phone size: TeaFace is what Adrian holds at the vendor's table.
 */
import { test, expect, type Page } from './fixtures';
import { installCompassHarness, openCurateV2, expectNoUnhandledCompassApi } from './helpers/compassHarness';

const entryId = 'v2-record-cake';
const tea = {
  id: entryId, name: 'Record Mountain Cake', category: 'tea', type: 'Sheng', form: 'Cake', year: 2019,
  status: 'noted', notes: 'I noticed a clean mineral finish in this spring tea.',
  description: 'Old trees on a north slope.\nPressed in spring.', photos: '[]', audio_clips: '[]',
  price_amount: 700, price_currency: 'Yuan', vendor_name: 'Wang Laoshi',
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/curate-v2-tea-record/${name}.png` });
const face = (page: Page) => page.getByTestId('curate-tea-overlay').getByTestId('curate-tea-face');

async function current(page: Page) {
  return page.evaluate(async id => {
    // @ts-expect-error Vite source import in browser fixture.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return useTeaCompassStore.getState().getEntry(id);
  }, entryId);
}

async function openTea(page: Page) {
  await installCompassHarness(page, { compassEntries: [tea] });
  await openCurateV2(page, 'teas');
  await page.getByRole('button', { name: /^Record Mountain Cake/ }).first().click();
  await expect(face(page)).toBeVisible();
}

test.describe('Curate v2 tea record (phone)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'TeaFace is walked at phone size');
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('the tea screen shows its given name, quote weight, story and Build this tea on one line each', async ({ page }) => {
    await openTea(page);
    await expect(face(page).getByTestId('tea-face-given-name')).toContainText('add');
    await expect(face(page).getByTestId('tea-face-quote-weight')).toContainText('357 g assumed');
    await expect(face(page).getByTestId('tea-face-story')).toContainText('Old trees on a north slope.');
    await expect(face(page).getByTestId('tea-face-story')).not.toContainText('Pressed in spring');
    await expect(face(page).getByTestId('tea-face-build')).toBeVisible();
    for (const id of ['tea-face-given-name', 'tea-face-quote-weight', 'tea-face-story']) {
      const box = await face(page).getByTestId(id).boundingBox();
      expect(box!.height, `${id} stays on one line`).toBeLessThanOrEqual(48);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await shot(page, '1-tea-face');
  });

  test('a given name is saved to the shop and kept apart from the supplier name', async ({ page }) => {
    await openTea(page);
    await face(page).getByRole('button', { name: 'Given name', exact: true }).click();
    await face(page).getByRole('textbox', { name: 'Given name', exact: true }).fill('North Slope 2019');
    await face(page).getByRole('textbox', { name: 'Given name', exact: true }).press('Enter');
    await expect(face(page).getByTestId('tea-face-given-name')).toContainText('North Slope 2019');
    await expect.poll(async () => (await current(page))?.givenName).toBe('North Slope 2019');
    expect((await current(page))?.name).toBe(tea.name);
    await expect.poll(async () => (await current(page))?.synced).toBe(true);
    await shot(page, '2-given-name');
  });

  test('confirming what the quote covers replaces the assumed cake weight, and the shelf price follows it', async ({ page }) => {
    await openTea(page);
    await face(page).getByRole('button', { name: `Confirm quoted grams for ${tea.name}`, exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'What does the quote cover?' });
    await expect(sheet.getByRole('button', { name: 'Cake', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await shot(page, '3-quote-weight-sheet');
    await sheet.getByRole('textbox', { name: 'Approximate quoted grams' }).fill('400');
    await sheet.getByRole('button', { name: 'Confirm weight', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(face(page).getByTestId('tea-face-quote-weight')).toContainText('400');
    await expect(face(page).getByTestId('tea-face-quote-weight')).not.toContainText('assumed');
    await expect(face(page).getByTestId('tea-face-shelf')).not.toContainText('at 357 g');
    await expect.poll(async () => (await current(page))?.pricePerUnitGrams).toBe(400);
  });

  test('the story opens on its own sheet and a change is kept on the tea', async ({ page }) => {
    await openTea(page);
    await face(page).getByTestId('tea-face-story').click();
    const sheet = page.getByRole('dialog', { name: 'Story' });
    const text = sheet.getByRole('textbox', { name: 'Description' });
    await expect(text).toHaveValue(tea.description);
    await shot(page, '4-story-sheet');
    await text.fill('A spring cake from old trees.');
    await text.blur();
    await expect.poll(async () => (await current(page))?.description).toBe('A spring cake from old trees.');
    await page.keyboard.press('Escape');
    await expect(face(page).getByTestId('tea-face-story')).toContainText('A spring cake from old trees.');
  });

  test('Build this tea opens over the tea screen, takes typing, drafts a description and saves only what was accepted', async ({ page }) => {
    await openTea(page);
    await page.route('**/api/curate/ar-create/status', route => route.fulfill({ json: { connected: true, paired: true, canSearch: true } }));
    const proposals: any[] = [];
    await page.route('**/api/curate/description-proposal', async route => {
      const body = route.request().postDataJSON();
      proposals.push(body);
      await route.fulfill({ json: { description: 'A spring cake with a clean mineral finish.', baseDescription: tea.description, citations: [{ sourceId: body.sources[0].id, quote: body.sources[0].text }] } });
    });
    await face(page).getByTestId('tea-face-build').click();
    const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
    await expect(workspace).toBeVisible();
    // Interactive over TeaFace's overlay: a search box takes focus and typing.
    await workspace.getByRole('button', { name: 'Link a talk from AR Create', exact: true }).click();
    const search = workspace.getByRole('textbox', { name: 'Find a talk', exact: true });
    await search.fill('Mountain');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('Mountain');
    await shot(page, '5-build-this-tea');

    const review = workspace.getByTestId('tea-description-review');
    await review.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
    const proposed = review.getByRole('textbox', { name: 'Proposed description', exact: true });
    await expect(proposed).toHaveValue('A spring cake with a clean mineral finish.');
    expect(proposals[0]).toMatchObject({ entryId, sources: [{ id: `entry:${entryId}`, text: tea.notes }] });
    expect((await current(page))?.description).toBe(tea.description);
    await review.getByRole('checkbox', { name: 'Save this description', exact: true }).check();
    await workspace.getByRole('button', { name: 'Save accepted changes', exact: true }).click();
    await expect.poll(async () => (await current(page))?.description).toBe('A spring cake with a clean mineral finish.');
    await expect(workspace).toBeHidden();
    await expect(face(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });

  test('Discard closes Build this tea back to the tea screen without saving anything', async ({ page }) => {
    await openTea(page);
    await page.route('**/api/curate/ar-create/status', route => route.fulfill({ json: { connected: true, paired: true, canSearch: true } }));
    const writes: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET' && (path === '/api/compass/sync' || path.includes('/ar-create/links'))) writes.push(path);
    });
    await face(page).getByTestId('tea-face-build').click();
    const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
    await workspace.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(workspace).toBeHidden();
    await expect(face(page)).toBeVisible();
    expect(writes).toHaveLength(0);
  });

  test('Full tasting stays open after Save, as it does in the old Curate', async ({ page }) => {
    await openTea(page);
    await face(page).getByRole('button', { name: 'Full tasting', exact: true }).click();
    const nav = page.getByRole('navigation', { name: 'Tasting sections' });
    await nav.getByRole('button', { name: 'Effect', exact: true }).click();
    await page.getByRole('button', { name: 'Calm', exact: true }).click();
    await page.getByRole('button', { name: 'Save tasting', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tasting saved', exact: true })).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How do you feel?' })).toBeVisible();
  });
});
