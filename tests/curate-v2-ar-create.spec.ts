/**
 * One Curate, stage 2: AR Create reaches v2. A transcript link (?arSource=),
 * a pairing code (?arPair=) and a talk linked from inside Build this tea are
 * the old Curate's own sheets mounted on v2; these are the v2 twins of
 * ar-transcript-handoff and tea-record-ar-linking. Phone size.
 */
import { test, expect, type Page } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';

const sourceId = 'ar-v2-source';
const hash = 'b'.repeat(64);
const title = 'Shop conversation';
const excerpt = 'This is aged Shuixian, picked before the spring rain.';
const transcript = `Speaker 1: ${excerpt}\nSpeaker 2: We are also discussing a second tea.`;
const entry = (id: string, name: string) => ({ id, name, category: 'tea', type: 'Oolong', form: 'Loose', status: 'noted', notes: '', description: 'Original public copy', photos: '[]', audio_clips: '[]', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/curate-v2-ar-create/${name}.png` });

/** AR Create's bridge, answered locally: the live bridge is never reached. */
async function stubArCreate(page: Page) {
  const links: any[] = []; const linkBodies: any[] = []; const requests: any[] = []; const claims: any[] = [];
  await page.route('**/api/curate/ar-create/**', route => {
    const request = route.request(); const url = new URL(request.url());
    const path = url.pathname.split('/ar-create')[1];
    if (path === '/status') return route.fulfill({ json: { connected: true, paired: true, canSearch: true } });
    if (path === '/pair/claim' && request.method() === 'POST') { claims.push(request.postDataJSON()); return route.fulfill({ json: { paired: true } }); }
    if (path === '/requests' && request.method() === 'POST') {
      const input = request.postDataJSON(); requests.push(input);
      const result = input.kind === 'search' ? { sources: [{ id: sourceId, title, hash, snippet: excerpt }] } : { source: { id: sourceId, title, hash, text: transcript } };
      return route.fulfill({ json: { id: `job-${requests.length}`, status: 'complete', result } });
    }
    if (path === '/links' && request.method() === 'GET') {
      const forEntry = url.searchParams.get('entryId');
      return route.fulfill({ json: { links: forEntry ? links.filter(l => l.entryId === forEntry) : links } });
    }
    if (path === '/links' && request.method() === 'POST') {
      const input = request.postDataJSON(); linkBodies.push(input);
      const link = { ...input, id: `link-${input.entryId}` }; links.push(link);
      return route.fulfill({ json: { link } });
    }
    return route.fallback();
  });
  return { links, linkBodies, requests, claims };
}

test.describe('Curate v2 and AR Create (phone)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'Walked at phone size');
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('a transcript link opens over v2, links the chosen teas only on confirm, and Close leaves v2 where it was', async ({ page }) => {
    await installCompassHarness(page, { compassEntries: [entry('tea-one', 'Aged Shuixian'), entry('tea-two', 'Second tea')] });
    const ar = await stubArCreate(page);
    await page.goto(`/admin/compass/v2?tab=teas&arSource=${sourceId}`, { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog', { name: 'Link transcript to teas', exact: true });
    await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
    expect(ar.linkBodies).toHaveLength(0);
    await dialog.getByRole('checkbox', { name: 'Link Aged Shuixian', exact: true }).check();
    await dialog.getByRole('checkbox', { name: 'Link Second tea', exact: true }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await shot(page, '1-transcript-link');
    await dialog.getByRole('button', { name: 'Link selected teas', exact: true }).click();
    await expect(dialog.getByText('2 teas linked to this transcript. Tea details and descriptions were kept.', { exact: true })).toBeVisible();
    expect(ar.linkBodies.map(row => row.entryId)).toEqual(['tea-one', 'tea-two']);
    expect(ar.linkBodies.every(row => row.mode === 'full' && row.text === transcript && row.sourceId === sourceId)).toBe(true);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/compass\/v2\?tab=teas$/);
    await expect(page.getByRole('tab', { name: 'Teas', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('a pairing code asks before connecting, and connects this shop on confirm', async ({ page }) => {
    await installCompassHarness(page, { compassEntries: [entry('tea-one', 'Aged Shuixian')] });
    const ar = await stubArCreate(page);
    await page.goto('/admin/compass/v2?arPair=PAIR-1234', { waitUntil: 'domcontentloaded' });
    const sheet = page.getByRole('dialog', { name: 'Connect AR Create' });
    await expect(sheet).toBeVisible();
    expect(ar.claims).toHaveLength(0);
    await shot(page, '2-pairing');
    await sheet.getByRole('button', { name: 'Connect to this store', exact: true }).click();
    await expect(sheet).toBeHidden();
    expect(ar.claims).toHaveLength(1);
    await expect(page).not.toHaveURL(/arPair=/);
  });

  test('a talk linked from Build this tea on the tea screen is saved to that tea', async ({ page }) => {
    await installCompassHarness(page, { compassEntries: [entry('tea-one', 'Aged Shuixian')] });
    const ar = await stubArCreate(page);
    await page.goto('/admin/compass/v2?tab=teas', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Aged Shuixian/ }).first().click();
    await page.getByTestId('curate-tea-overlay').getByTestId('tea-face-build').click();
    const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
    const assistant = workspace.getByTestId('tea-record-assistant');
    await assistant.getByRole('button', { name: 'Link a talk from AR Create', exact: true }).click();
    await workspace.getByRole('textbox', { name: 'Find a talk', exact: true }).fill('spring rain');
    await assistant.getByRole('button', { name: 'Search', exact: true }).click();
    await workspace.getByRole('button', { name: new RegExp(`^${title}`) }).click();
    await expect(workspace.getByRole('region', { name: 'Review linked passage', exact: true })).toBeVisible();
    await workspace.getByRole('checkbox', { name: /^Use the full transcript/ }).uncheck();
    await workspace.getByRole('textbox', { name: 'Passage to link', exact: true }).fill(excerpt);
    await assistant.getByRole('button', { name: 'Review this passage', exact: true }).click();
    await expect(assistant.getByText('Passage ready for review. Nothing saved.', { exact: true })).toBeVisible();
    await shot(page, '3-talk-in-build');
    expect(ar.linkBodies).toHaveLength(0);
    await assistant.getByRole('button', { name: 'Save accepted changes', exact: true }).click();
    await expect(workspace).toBeHidden();
    expect(ar.linkBodies).toHaveLength(1);
    expect(ar.linkBodies[0]).toMatchObject({ entryId: 'tea-one', sourceId, text: excerpt, start: transcript.indexOf(excerpt), end: transcript.indexOf(excerpt) + excerpt.length });
    await expect(page.getByTestId('curate-tea-overlay').getByTestId('curate-tea-face')).toBeVisible();
  });
});
