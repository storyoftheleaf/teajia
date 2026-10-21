import { test, expect, type Page } from './fixtures';
import { compassCreatedProducts, expectNoUnhandledCompassApi, installCompassHarness } from './helpers/compassHarness';

const entryId = 'ar-linked-tea';
const productId = 'ar-linked-inventory';
const sourceId = 'ar-source-cloud-talk';
const title = 'Cloud Peak: a conversation with the farmer';
const hash = '7'.repeat(64);
const excerpt = 'We picked the spring leaves before the rain. The garden sits above the river, and the tea finishes with a clear mineral sweetness.';
const fullText = `Opening remarks.\n\n${excerpt}\n\nA closing conversation about next season.`;
const originalNotes = 'Adrian noted a bright apricot aroma in the cup.';
const originalDescription = 'A spring tea from Yunnan.';
const entry = { id: entryId, name: 'Cloud Peak', category: 'tea', type: 'Sheng', form: 'Loose', year: 2024, status: 'noted', notes: originalNotes, description: originalDescription, draft_product_id: productId, photos: '[]', audio_clips: '[]', price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const record = (page: Page) => page.getByTestId('library-entry-detail').filter({ visible: true });
const assistant = (page: Page) => page.getByRole('dialog', { name: 'Build this tea', exact: true }).getByTestId('tea-record-assistant');
async function openBuild(page: Page) { await record(page).getByRole('button', { name: 'Build this tea', exact: true }).click(); }
type Link = { id: string; entryId: string; sourceId: string; title: string; hash: string; text: string; start: number; end: number };

async function install(page: Page) {
  await installCompassHarness(page, { compassEntries: [entry], products: [{ id: productId, source_compass_entry_id: entryId, given_name: 'Cloud Peak', product_name: 'Cloud Peak', type: 'Sheng', status: 'Draft', stock_grams: 100, inventory_purpose: 'working', is_public: 0, shown_in_shop: 0 }] });
  const links: Link[] = [];
  const requests: any[] = [];
  const linkBodies: any[] = [];
  const deletions: string[] = [];
  const extractionBodies: any[] = [];
  const descriptionBodies: any[] = [];
  const jobs = new Map<string, any>();
  const claims: any[] = [];
  await page.route('**/api/curate/ar-create/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const prefix = '/api/curate/ar-create';
    const path = url.pathname.slice(prefix.length);
    if (path === '/pair/claim' && request.method() === 'POST') { claims.push(request.postDataJSON()); return route.fulfill({ json: { paired: true } }); }
    if (path === '/status') return route.fulfill({ json: { connected: true, lastSeen: new Date().toISOString() } });
    if (path === '/links' && request.method() === 'GET') return route.fulfill({ json: { links: url.searchParams.get('entryId') === entryId ? links : [] } });
    if (path === '/requests' && request.method() === 'POST') {
      const input = request.postDataJSON(); requests.push(input);
      const id = `ar-job-${requests.length}`;
      const result = input.kind === 'search' ? { sources: [{ id: sourceId, title, hash, snippet: excerpt }] } : { source: { id: sourceId, title, hash, text: fullText } };
      jobs.set(id, { id, status: 'complete', result, expiresAt: new Date(Date.now() + 3600000).toISOString() });
      return route.fulfill({ json: { id, status: 'pending' } });
    }
    if (path.startsWith('/requests/') && request.method() === 'GET') return route.fulfill({ json: jobs.get(path.split('/').at(-1)!) });
    if (path === '/links' && request.method() === 'POST') {
      const input = request.postDataJSON(); linkBodies.push(input);
      // Mirror the canonical one-link-per-record-and-source response after refresh.
      const link: Link = { id: 'canonical-cloud-talk-link', entryId, sourceId: input.sourceId, title: input.title, hash: input.hash, text: input.text, start: input.start, end: input.end };
      const existing = links.findIndex(row => row.entryId === input.entryId && row.sourceId === input.sourceId);
      if (existing >= 0) links[existing] = link; else links.push(link);
      return route.fulfill({ json: { link } });
    }
    if (path.startsWith('/links/') && request.method() === 'DELETE') {
      const id = path.split('/').at(-1)!; deletions.push(id);
      const index = links.findIndex(link => link.id === id); if (index >= 0) links.splice(index, 1);
      return route.fulfill({ json: { removed: true } });
    }
    return route.fallback();
  });
  await page.route('**/api/curate/said/file', async route => {
    extractionBodies.push(route.request().postDataJSON());
    return route.fulfill({ json: { parts: [{ kind: 'story', text: excerpt, fields: {} }] } });
  });
  await page.route('**/api/curate/description-proposal', async route => {
    const body = route.request().postDataJSON(); descriptionBodies.push(body);
    return route.fulfill({ json: { description: 'Picked before spring rain, this garden tea has a mineral sweetness.', baseDescription: originalDescription, citations: [{ sourceId: body.sources[0].id, quote: excerpt }] } });
  });
  return { links, requests, linkBodies, deletions, extractionBodies, descriptionBodies, claims };
}
async function open(page: Page) {
  await page.goto(`/admin/compass?tab=library&entry=${entryId}`, { waitUntil: 'domcontentloaded' });
  await expect(record(page)).toBeVisible();
  await openBuild(page);
  await expect(assistant(page).getByRole('button', { name: 'Link a talk from AR Create', exact: true })).toBeVisible();
}
async function linkTalk(page: Page, update = false) {
  await assistant(page).getByRole('button', { name: 'Link a talk from AR Create', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Find a talk', exact: true });
  await input.fill('spring leaves');
  await assistant(page).getByRole('button', { name: 'Search', exact: true }).click();
  const result = page.getByRole('button', { name: new RegExp('^Cloud Peak: a conversation with the farmer') });
  await expect(result).toBeVisible();
  const viewport = page.viewportSize()!.width < 900 ? 'phone' : 'desktop';
  if (!update) await page.screenshot({ path: `/private/tmp/tea-record-ar-search-${viewport}.png`, fullPage: false, animations: 'disabled' });
  await result.click();
  await expect(page.getByRole('region', { name: 'Review linked passage', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /^Use the full transcript/ }).uncheck();
  await page.getByRole('textbox', { name: 'Passage to link', exact: true }).fill(excerpt);
  const linkAction = assistant(page).getByRole('button', { name: 'Review this passage', exact: true });
  await linkAction.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (!update) await page.screenshot({ path: `/private/tmp/tea-record-ar-passage-${viewport}.png`, fullPage: false, animations: 'disabled' });
  if (viewport === 'phone') {
    const buttonBox = await linkAction.boundingBox();
    const nav = await page.locator('nav[aria-label="Main navigation"]').boundingBox();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(nav!.y + 1);
  }
  await linkAction.click();
  await expect(assistant(page).getByText('Passage ready for review. Nothing saved.', { exact: true })).toBeVisible();
  await assistant(page).getByRole('button', { name: 'Save accepted changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Build this tea', exact: true })).not.toBeVisible();
  await openBuild(page);
}
async function counts(page: Page) {
  const entries = await page.evaluate(async () => {
    // @ts-expect-error Vite browser source import for fixture inspection.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return useTeaCompassStore.getState().entries.map((row: any) => ({ id: row.id, draftProductId: row.draftProductId, notes: row.notes, description: row.description }));
  });
  const products = await page.evaluate(async () => (await fetch('/api/products')).json());
  return { entries, products };
}

for (const viewport of ['phone', 'desktop'] as const) {
  test(`${viewport} links a searched talk to the same tea and selects its passage for both AI reviews`, async ({ page }) => {
    await page.setViewportSize(viewport === 'phone' ? { width: 393, height: 851 } : { width: 1440, height: 950 });
    const state = await install(page);
    await open(page);
    await linkTalk(page);
    expect(state.requests).toEqual([{ kind: 'search', query: 'spring leaves' }, { kind: 'read', sourceId }]);
    expect(state.linkBodies[0]).toMatchObject({ entryId, sourceId, title, hash, text: excerpt, start: fullText.indexOf(excerpt), end: fullText.indexOf(excerpt) + excerpt.length, requestId: 'ar-job-2' });
    expect(state.links).toHaveLength(1);
    expect(state.extractionBodies).toHaveLength(0);
    expect(state.descriptionBodies).toHaveLength(0);
    const before = await counts(page);
    expect(before.entries).toEqual([{ id: entryId, draftProductId: productId, notes: originalNotes, description: originalDescription }]);
    expect(before.products).toHaveLength(1);
    expect(compassCreatedProducts(page)).toHaveLength(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(record(page)).toBeVisible();
    await openBuild(page);
    await expect(assistant(page).locator('summary').filter({ hasText: title })).toHaveCount(1);
    await linkTalk(page, true);
    expect(state.links).toHaveLength(1);
    expect(state.linkBodies[1].expectedHash).toBe(hash);
    expect(state.links[0].id).toBe('canonical-cloud-talk-link');

    await assistant(page).getByRole('checkbox', { name: 'Tea notes', exact: true }).uncheck();
    const selected = assistant(page).getByRole('checkbox', { name: `AR Create · ${title}`, exact: true });
    await expect(selected).toBeChecked();
    await assistant(page).getByText('Fill missing record details from notes or a passage', { exact: true }).click();
    await assistant(page).getByRole('button', { name: 'Find tea details', exact: true }).click();
    await expect.poll(() => state.extractionBodies.length).toBe(1);
    expect(state.extractionBodies[0].text).toContain(excerpt);
    expect(state.extractionBodies[0].text).toContain(`AR Create · ${title}`);
    expect(state.extractionBodies[0].text).not.toContain(originalNotes);
    await assistant(page).getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
    await expect.poll(() => state.descriptionBodies.length).toBe(1);
    expect(state.descriptionBodies[0]).toMatchObject({ entryId, sources: [{ id: 'ar:canonical-cloud-talk-link', title: `AR Create · ${title}`, text: excerpt }] });
    await expect(assistant(page).getByRole('textbox', { name: 'Proposed description', exact: true })).toBeVisible();
    expect((await counts(page)).entries[0].description).toBe(originalDescription);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `/private/tmp/tea-record-ar-linking-${viewport}.png`, fullPage: false, animations: 'disabled' });
    await expectNoUnhandledCompassApi(page);
  });
}

test('unlink is staged and undoable until acceptance, then removes only the passage reference', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const state = await install(page);
  await open(page); await linkTalk(page);
  await assistant(page).locator('summary').filter({ hasText: title }).click();
  await assistant(page).getByRole('button', { name: 'Unlink', exact: true }).click();
  await expect(assistant(page).getByText(/^Link marked for removal/)).toBeVisible();
  expect(state.deletions).toEqual([]);
  expect(state.links).toHaveLength(1);
  await assistant(page).getByRole('button', { name: 'Keep link', exact: true }).click();
  await expect(assistant(page).getByText(/^Link marked for removal/)).toHaveCount(0);
  expect(state.deletions).toEqual([]);
  const savedLink = assistant(page).locator('details').filter({ has: page.locator('summary').filter({ hasText: title }) });
  if (!await savedLink.getByRole('button', { name: 'Unlink', exact: true }).isVisible()) await savedLink.locator(':scope > summary').click();
  await assistant(page).getByRole('button', { name: 'Unlink', exact: true }).click();
  expect(state.deletions).toEqual([]);
  await assistant(page).getByRole('button', { name: 'Save accepted changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Build this tea', exact: true })).not.toBeVisible();
  expect(state.links).toHaveLength(0);
  expect(state.deletions).toEqual(['canonical-cloud-talk-link']);
  const current = await counts(page);
  expect(current.entries).toHaveLength(1); expect(current.products).toHaveLength(1);
  expect(current.entries[0]).toMatchObject({ id: entryId, notes: originalNotes, description: originalDescription });
  expect(compassCreatedProducts(page)).toHaveLength(0);
  await openBuild(page);
  await expect(assistant(page).locator('summary').filter({ hasText: title })).toHaveCount(0);
  await linkTalk(page);
  expect(state.links[0]).toMatchObject({ sourceId, hash, text: excerpt });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expectNoUnhandledCompassApi(page);
});


test('a pairing link asks for an explicit current-store connection before claiming the code', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const state = await install(page);
  await page.goto('/admin/compass?tab=library&arPair=PAIR-SYNTHETIC', { waitUntil: 'domcontentloaded' });
  const connect = page.getByRole('button', { name: 'Connect to this store', exact: true });
  await expect(connect).toBeVisible();
  await expect(page.getByText('You choose which talks and passages to link. The originals stay in AR Create.', { exact: true })).toBeVisible();
  expect(state.claims).toHaveLength(0);
  expect(state.requests).toHaveLength(0);
  await connect.click();
  await expect.poll(() => state.claims).toEqual([{ code: 'PAIR-SYNTHETIC' }]);
  await expect(page).not.toHaveURL(/arPair=/);
  expect(state.requests).toHaveLength(0);
  expect(state.links).toHaveLength(0);
  expect(state.extractionBodies).toHaveLength(0);
  expect(state.descriptionBodies).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expectNoUnhandledCompassApi(page);
});
