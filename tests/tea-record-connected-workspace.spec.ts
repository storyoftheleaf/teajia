import { test, expect, type Page } from './fixtures';
import { compassCreatedProducts, expectNoUnhandledCompassApi, installCompassHarness } from './helpers/compassHarness';

const entryId = 'connected-workspace-tea';
const sourceId = 'connected-workspace-talk';
const title = 'Cloud Peak — spring harvest conversation';
const hash = 'a'.repeat(64);
const excerpt = 'These spring leaves were picked in Yiwu in 2019. I notice a clean mineral finish.';
const fullText = `A greeting before the tasting.\n\n${excerpt}\n\nNow we are discussing a different tea.`;
const originalDescription = 'Adrian’s existing description.';
const proposalText = 'A spring tea with a clean mineral finish, discussed during its 2019 Yiwu harvest conversation.';
const entry = {
  id: entryId, name: 'Cloud Peak', category: 'tea', type: 'Sheng', form: 'Loose', status: 'noted',
  notes: '', description: originalDescription, photos: '[]', audio_clips: '[]',
  price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

async function current(page: Page) {
  return page.evaluate(async id => {
    // @ts-expect-error Vite browser import for inspection of the existing shared record.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    const store = useTeaCompassStore.getState();
    return { entry: store.getEntry(id), ids: store.entries.map((row: { id: string }) => row.id) };
  }, entryId);
}

async function install(page: Page) {
  await installCompassHarness(page, { compassEntries: [entry] });
  const links: any[] = [];
  const linkWrites: any[] = [];
  const teaWrites: any[] = [];
  const extractionBodies: any[] = [];
  const descriptionBodies: any[] = [];
  const jobs = new Map<string, any>();
  let jobNumber = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/compass/sync') teaWrites.push(request.postDataJSON());
  });
  await page.route('**/api/curate/ar-create/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice('/api/curate/ar-create'.length);
    if (path === '/status') return route.fulfill({ json: { connected: true, paired: true, canSearch: true, lastSeen: new Date().toISOString() } });
    if (path === '/links' && request.method() === 'GET') return route.fulfill({ json: { links } });
    if (path === '/requests' && request.method() === 'POST') {
      const input = request.postDataJSON();
      const id = `job-${++jobNumber}`;
      const result = input.kind === 'search' ? { sources: [{ id: sourceId, title, hash, snippet: excerpt }] } : { source: { id: sourceId, title, hash, text: fullText } };
      jobs.set(id, { id, status: 'complete', result, expiresAt: new Date(Date.now() + 3600000).toISOString() });
      return route.fulfill({ json: { id, status: 'pending' } });
    }
    if (path.startsWith('/requests/') && request.method() === 'GET') return route.fulfill({ json: jobs.get(path.split('/').at(-1)!) });
    if (path === '/links' && request.method() === 'POST') {
      const input = request.postDataJSON(); linkWrites.push(input);
      const link = { ...input, id: 'retained-cloud-passage' };
      const index = links.findIndex(row => row.entryId === input.entryId && row.sourceId === input.sourceId);
      if (index >= 0) links[index] = link; else links.push(link);
      return route.fulfill({ json: { link } });
    }
    return route.fallback();
  });
  await page.route('**/api/curate/said/file', async route => {
    extractionBodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { parts: [{ kind: 'tea', text: 'A spring 2019 tea from Yiwu.', fields: { year: 2019, origin_region: 'Yiwu' } }] } });
  });
  await page.route('**/api/curate/description-proposal', async route => {
    const body = route.request().postDataJSON(); descriptionBodies.push(body);
    const staged = body.stagedArSources?.[0];
    const citationId = staged ? `staged-ar:${staged.requestId}:${staged.sourceId}` : body.sources[0].id;
    return route.fulfill({ json: { description: proposalText, baseDescription: originalDescription, citations: [{ sourceId: citationId, quote: excerpt }] } });
  });
  return { links, linkWrites, teaWrites, extractionBodies, descriptionBodies };
}

async function openWorkspace(page: Page) {
  await page.goto(`/admin/compass?tab=library&entry=${entryId}`, { waitUntil: 'domcontentloaded' });
  const record = page.getByTestId('library-entry-detail').filter({ visible: true });
  await expect(record).toBeVisible();
  await record.getByRole('button', { name: 'Build this tea', exact: true }).click();
  const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
  await expect(workspace).toBeVisible();
  return workspace;
}

async function stagePassage(page: Page) {
  const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
  const search = workspace.getByRole('textbox', { name: 'Find a talk', exact: true });
  if (!await search.isVisible()) await workspace.getByRole('button', { name: 'Link a talk from AR Create', exact: true }).click();
  await search.fill('spring harvest');
  await workspace.getByRole('button', { name: 'Search', exact: true }).click();
  await workspace.getByRole('button', { name: new RegExp('^Cloud Peak — spring harvest conversation') }).click();
  await workspace.getByRole('checkbox', { name: /^Use the full transcript/ }).uncheck();
  await workspace.getByRole('textbox', { name: 'Passage to link', exact: true }).fill(excerpt);
  await workspace.getByRole('button', { name: 'Review this passage', exact: true }).click();
  await expect(workspace.getByRole('checkbox', { name: /^Keep this passage/ })).toBeVisible();
  return workspace;
}

for (const viewport of ['phone', 'desktop'] as const) {
  test(`${viewport} previews passage, extracted facts and editable description before one explicit save`, async ({ page }) => {
    await page.setViewportSize(viewport === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 900 });
    const state = await install(page);
    const workspace = await openWorkspace(page);
    const initialWrites = state.teaWrites.length;
    await stagePassage(page);
    expect(state.linkWrites).toHaveLength(0);
    expect(state.teaWrites).toHaveLength(initialWrites);
    expect((await current(page)).entry).toMatchObject({ id: entryId, description: originalDescription });

    await workspace.getByText('Fill missing record details from notes or a passage', { exact: true }).click();
    await workspace.getByRole('button', { name: 'Find tea details', exact: true }).click();
    await expect(workspace.getByRole('checkbox', { name: 'Year: 2019', exact: true })).toBeVisible();
    await workspace.getByRole('checkbox', { name: 'Year: 2019', exact: true }).check();
    await workspace.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
    const description = workspace.getByRole('textbox', { name: 'Proposed description', exact: true });
    await expect(description).toHaveValue(proposalText);
    await description.fill('Reviewed spring tea with a clean mineral finish.');
    await workspace.getByRole('checkbox', { name: 'Save this description', exact: true }).check();
    await workspace.getByRole('checkbox', { name: /^Keep this passage/ }).check();

    expect(state.extractionBodies).toHaveLength(1);
    expect(state.extractionBodies[0].text).toContain(excerpt);
    expect(state.descriptionBodies).toHaveLength(1);
    expect(state.descriptionBodies[0]).toMatchObject({ entryId, stagedArSources: [{ requestId: 'job-2', sourceId, title, hash, text: excerpt, start: fullText.indexOf(excerpt), end: fullText.indexOf(excerpt) + excerpt.length }] });
    expect(state.linkWrites).toHaveLength(0);
    expect(state.teaWrites).toHaveLength(initialWrites);
    const before = await current(page);
    expect(before.entry?.year).toBeFalsy();
    expect(before.entry?.description).toBe(originalDescription);
    expect(before.ids).toEqual([entryId]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const dialogWidth = (await workspace.boundingBox())!.width;
    expect(dialogWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: `/private/tmp/tea-record-connected-workspace-${viewport}.png`, fullPage: false, animations: 'disabled' });

    await workspace.getByRole('button', { name: 'Save accepted changes', exact: true }).click();
    await expect.poll(async () => (await current(page)).entry?.description).toBe('Reviewed spring tea with a clean mineral finish.');
    const saved = await current(page);
    expect(saved.ids).toEqual([entryId]);
    expect(saved.entry).toMatchObject({ id: entryId, year: 2019, description: 'Reviewed spring tea with a clean mineral finish.', priceAmount: 70, notes: '' });
    expect(saved.entry?.originRegion).toBeFalsy();
    expect(state.links).toHaveLength(1);
    expect(state.linkWrites).toHaveLength(1);
    expect(state.linkWrites[0]).toMatchObject({ entryId, sourceId, text: excerpt });
    expect(compassCreatedProducts(page)).toHaveLength(0);
    await expectNoUnhandledCompassApi(page);
  });
}

test('discarding a complete review keeps the tea and all talk links unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await install(page);
  const workspace = await openWorkspace(page);
  const initialWrites = state.teaWrites.length;
  await stagePassage(page);
  await workspace.getByText('Fill missing record details from notes or a passage', { exact: true }).click();
  await workspace.getByRole('button', { name: 'Find tea details', exact: true }).click();
  await workspace.getByRole('checkbox', { name: 'Year: 2019', exact: true }).check();
  await workspace.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
  await expect(workspace.getByRole('textbox', { name: 'Proposed description', exact: true })).toHaveValue(proposalText);
  await workspace.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(workspace).not.toBeVisible();
  expect(state.links).toHaveLength(0);
  expect(state.linkWrites).toHaveLength(0);
  expect(state.teaWrites).toHaveLength(initialWrites);
  const unchanged = await current(page);
  expect(unchanged.ids).toEqual([entryId]);
  expect(unchanged.entry?.description).toBe(originalDescription);
  expect(unchanged.entry?.year).toBeFalsy();
  expect(compassCreatedProducts(page)).toHaveLength(0);
  await expectNoUnhandledCompassApi(page);
});
