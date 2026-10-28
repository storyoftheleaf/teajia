import { test, expect } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';
const sourceId = 'ar-reader-source'; const hash = 'a'.repeat(64);
const transcript = 'Speaker 1: This is aged Shuixian.\nSpeaker 2: We are also discussing a second tea.';
const entry = (id: string, name: string) => ({ id, name, category: 'tea', type: 'Oolong', form: 'Loose', status: 'noted', notes: '', description: 'Original public copy', photos: '[]', audio_clips: '[]', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });
for (const viewport of ['phone', 'desktop'] as const) {
  test(`${viewport} receives an AR transcript and links selected existing teas only on confirmation`, async ({ page }) => {
    await page.setViewportSize(viewport === 'phone' ? { width: 390, height: 844 } : { width: 1360, height: 900 });
    await installCompassHarness(page, { compassEntries: [entry('tea-one', 'Aged Shuixian'), entry('tea-two', 'Second tea')] });
    const writes: any[] = []; const links: any[] = [];
    await page.route('**/api/curate/ar-create/**', route => {
      const request = route.request(); const url = new URL(request.url()); const path = url.pathname.split('/ar-create')[1];
      if (path === '/requests') return route.fulfill({ json: { id: 'source-read-proof', status: 'complete', result: { source: { id: sourceId, title: 'Shop conversation', hash, text: transcript } } } });
      if (path === '/links' && request.method() === 'GET') return route.fulfill({ json: { links } });
      if (path === '/links' && request.method() === 'POST') {
        const input = request.postDataJSON(); writes.push(input); const link = { ...input, id: 'link-' + input.entryId }; links.push(link); return route.fulfill({ json: { link } });
      }
      return route.fallback();
    });
    await page.goto(`/admin/compass?tab=library&arSource=${sourceId}`, { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog', { name: 'Link transcript to teas', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Shop conversation', exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
    await dialog.getByRole('checkbox', { name: 'Link Aged Shuixian', exact: true }).check();
    await dialog.getByRole('checkbox', { name: 'Link Second tea', exact: true }).check();
    await page.screenshot({ path: `/private/tmp/ar-transcript-handoff-${viewport}.png`, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await dialog.getByRole('button', { name: 'Link selected teas', exact: true }).click();
    await expect(dialog.getByText('2 teas linked to this transcript. Tea details and descriptions were kept.', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(2);
    expect(writes.map(row => row.entryId)).toEqual(['tea-one', 'tea-two']);
    expect(writes.every(row => row.mode === 'full' && row.text === transcript && row.sourceId === sourceId && row.start === 0 && row.end === transcript.length)).toBe(true);
    await expect(dialog.getByRole('checkbox', { name: 'Link Aged Shuixian', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page).not.toHaveURL(/arSource=/);
    await expectNoUnhandledCompassApi(page);
  });
}
test('receiver shows existing links and makes closing without confirmation read-only', async ({ page }) => {
  await installCompassHarness(page, { compassEntries: [entry('tea-one', 'Aged Shuixian')] });
  const mutations: string[] = [];
  await page.route('**/api/curate/ar-create/**', route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.endsWith('/requests')) return route.fulfill({ json: { id: 'read-current', status: 'complete', result: { source: { id: sourceId, title: 'Shop conversation', hash, text: transcript } } } });
    if (url.pathname.endsWith('/links')) {
      if (request.method() !== 'GET') mutations.push(request.method());
      return route.fulfill({ json: { links: [{ id: 'same-link', entryId: 'tea-one', sourceId, title: 'Shop conversation', hash, text: transcript, start: 0, end: transcript.length, mode: 'full' }] } });
    }
    return route.fallback();
  });
  await page.goto(`/admin/compass?tab=library&arSource=${sourceId}`);
  const dialog = page.getByRole('dialog', { name: 'Link transcript to teas' });
  await expect(dialog.getByText('Linked · current full transcript', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Link selected teas' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  expect(mutations).toHaveLength(0);
  await expectNoUnhandledCompassApi(page);
});

for (const viewport of ['phone', 'desktop'] as const) {
  test(`${viewport} previews a transcript in the same tea workspace without saving the link`, async ({ page }) => {
    await page.setViewportSize(viewport === 'phone' ? { width: 390, height: 844 } : { width: 1360, height: 900 });
    await installCompassHarness(page, { compassEntries: [entry('tea-one', 'Aged Shuixian')] });
    const writes: string[] = [];
    await page.route('**/api/curate/ar-create/**', route => {
      const request = route.request(); const path = new URL(request.url()).pathname.split('/ar-create')[1];
      if (path === '/status') return route.fulfill({ json: { connected: true, paired: true, canSearch: true } });
      if (path === '/requests') return route.fulfill({ json: { id: 'preview-read', status: 'complete', result: { source: { id: sourceId, title: 'Shop conversation', hash, text: transcript } } } });
      if (path === '/links') {
        if (request.method() !== 'GET') writes.push(path);
        return route.fulfill({ json: { links: [] } });
      }
      return route.fallback();
    });
    await page.route('**/api/curate/working-material', route => {
      const input = route.request().postDataJSON();
      expect(input.sources[0].text).toBe(transcript);
      return route.fulfill({ json: { notes: [{ id: 'review-note', kind: 'identity', text: 'Identified as aged Shuixian.', quote: 'This is aged Shuixian.', requestId: 'preview-read', sourceId, title: 'Shop conversation', start: 11, end: 32, attribution: 'unclear', relevance: 'this_tea' }], coverage: { sources: 1, characters: transcript.length, chunks: 1, completedChunks: 1 }, sourceSignature: 'preview-signature' } });
    });
    await page.goto(`/admin/compass?tab=library&arSource=${sourceId}`);
    const handoff = page.getByRole('dialog', { name: 'Link transcript to teas', exact: true });
    await handoff.getByRole('button', { name: 'Review Aged Shuixian workspace', exact: true }).click();
    const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
    await expect(workspace.getByRole('heading', { name: 'Working material', exact: true })).toBeVisible();
    await expect(workspace.getByRole('heading', { name: 'Public description', exact: true })).toBeVisible();
    await workspace.getByRole('button', { name: 'Review full transcripts', exact: true }).click();
    await expect(workspace.getByText('Identified as aged Shuixian.', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await workspace.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(handoff).toBeVisible();
    await expect(handoff.getByRole('checkbox', { name: 'Link Aged Shuixian', exact: true })).not.toBeChecked();
    expect(writes).toHaveLength(0);
    await expectNoUnhandledCompassApi(page);
  });
}
