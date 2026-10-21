import { test, expect } from './fixtures';
import { installCompassHarness, expectNoUnhandledCompassApi } from './helpers/compassHarness';
const entryId = 'full-material-tea';
const sourceId = 'whole-shop-conversation';
const title = 'Aged tea shop conversation';
const quote = 'You bought the thirty-year-old Shuixian.';
const lead = 'A different tea is discussed here. '.repeat(600);
const original = `${lead}\n${quote}`;
const entry = { id: entryId, name: 'Aged Shuixian', category: 'tea', type: 'Oolong', form: 'Loose', status: 'noted', notes: '', description: '', photos: '[]', audio_clips: '[]', price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
for (const viewport of ['phone', 'desktop'] as const) {
  test(`${viewport} full transcript, private notes and public draft stay connected without saving`, async ({ page }) => {
    await page.setViewportSize(viewport === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    await installCompassHarness(page, { compassEntries: [entry] });
    let text = original; let version = 1; let sequence = 0;
    const jobs = new Map<string, any>(); const reviews: any[] = []; const proposals: any[] = []; const writes: string[] = [];
    page.on('request', request => { if (request.method() !== 'GET' && /\/api\/(compass\/sync|notes|curate\/ar-create\/links)/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
    await page.route('**/api/curate/ar-create/**', route => {
      const path = new URL(route.request().url()).pathname.split('/ar-create')[1];
      if (path === '/status') return route.fulfill({ json: { connected: true, paired: true, canSearch: true } });
      if (path === '/links') return route.fulfill({ json: { links: [] } });
      if (path === '/requests') {
        const input = route.request().postDataJSON(); const id = `full-job-${++sequence}`;
        const source = { id: sourceId, title, hash: String(version).repeat(64), text };
        const result = input.kind === 'search' ? { sources: [{ ...source, snippet: quote }] } : { source };
        const job = { id, status: 'complete', result }; jobs.set(id, job); return route.fulfill({ json: job });
      }
      if (path.startsWith('/requests/')) return route.fulfill({ json: jobs.get(path.split('/').at(-1)!) });
      return route.fallback();
    });
    await page.route('**/api/curate/working-material', route => {
      const body = route.request().postDataJSON(); reviews.push(body);
      const source = body.sources[0]; const start = source.text.indexOf(quote);
      return route.fulfill({ json: { notes: [{ id: `note-${version}`, kind: 'purchase', text: `Acquired as over thirty years old (review ${version}).`, quote, requestId: source.requestId, sourceId, title, start, end: start + quote.length, attribution: 'supplier', relevance: 'this_tea' }], coverage: { sources: 1, characters: source.text.length, chunks: 2, completedChunks: 2 }, sourceSignature: `signature-${version}` } });
    });
    await page.route('**/api/curate/description-proposal', route => {
      const body = route.request().postDataJSON(); proposals.push(body); const source = body.stagedArSources[0];
      return route.fulfill({ json: { description: 'An aged Fenghuang Shuixian oolong, acquired as over thirty years old.', baseDescription: null, citations: [{ sourceId: `staged-ar:${source.requestId}:${sourceId}:${source.start}:${source.end}`, quote }] } });
    });
    await page.goto(`/admin/compass?tab=library&entry=${entryId}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('library-entry-detail').getByRole('button', { name: 'Build this tea', exact: true }).click();
    const workspace = page.getByRole('dialog', { name: 'Build this tea', exact: true });
    const initialWrites = writes.length;
    await workspace.getByRole('button', { name: 'Link a talk from AR Create', exact: true }).click();
    await workspace.getByRole('textbox', { name: 'Find a talk', exact: true }).fill('Aged tea');
    await workspace.getByRole('button', { name: 'Search', exact: true }).click();
    await workspace.getByRole('button', { name: /^Aged tea shop conversation/ }).click();
    await workspace.getByRole('button', { name: 'Review full transcript', exact: true }).click();
    await expect(workspace.getByRole('button', { name: 'Record a voice memo', exact: true })).toBeVisible();
    await workspace.getByRole('button', { name: 'Review full transcripts', exact: true }).click();
    await expect(workspace.getByText(`All ${original.length.toLocaleString()} characters reviewed in 2 parts`, { exact: true })).toBeVisible();
    expect(reviews[0].sources[0]).toMatchObject({ mode: 'full', start: 0, end: original.length, text: original });
    await workspace.getByRole('checkbox', { name: /^Use Acquired as/ }).check();
    await workspace.getByRole('textbox', { name: 'Working notes', exact: true }).fill('Acquired as over thirty years old. No tasting notes recorded yet.');
    await workspace.getByText('Research and references', { exact: true }).click();
    await workspace.getByRole('textbox', { name: 'Research working material', exact: true }).fill('Fenghuang is in Chaozhou, Guangdong. Regional context, not evidence of this lot’s age. https://www.chaozhou.gov.cn/');
    await workspace.getByRole('button', { name: 'Draft description from selected material', exact: true }).click();
    const draft = workspace.getByRole('textbox', { name: 'Proposed description', exact: true });
    await expect(draft).toHaveValue(/acquired as over thirty years old/);
    expect(proposals[0].stagedArSources[0]).toMatchObject({ fragment: true, text: quote, start: original.indexOf(quote) });
    expect(proposals[0].draftSources).toHaveLength(2);
    await draft.fill('My reviewed public draft stays here.');
    await workspace.getByRole('checkbox', { name: 'Save this description', exact: true }).check();
    await page.screenshot({ path: `/private/tmp/tea-full-material-${viewport}.png`, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const header = await workspace.locator('header').boundingBox();
    const footer = await workspace.locator('footer').boundingBox();
    expect(header!.height + footer!.height).toBeLessThan(page.viewportSize()!.height * 0.25);
    text = `${original}\nThe source has been corrected.`; version = 2;
    await workspace.getByRole('button', { name: 'Refresh originals', exact: true }).click();
    await expect.poll(() => reviews.length).toBe(2);
    await expect(workspace.getByRole('checkbox', { name: /^Use Acquired as/ })).toHaveAccessibleName('Use Acquired as over thirty years old (review 2).');
    await expect(draft).toHaveValue('My reviewed public draft stays here.');
    await expect(workspace.getByText('The selected source material changed. Draft from the current selection again.', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(initialWrites);
    await workspace.getByRole('button', { name: 'Discard changes', exact: true }).click();
    expect(writes).toHaveLength(initialWrites);
    await expectNoUnhandledCompassApi(page);
  });
}
