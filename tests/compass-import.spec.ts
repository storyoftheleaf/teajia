import { expect, test, type Page } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

type ImportItem = {
  id: string; batch_id: string; source_id: string; position: number; category: 'tea' | 'teaware';
  name: string | null; raw_text: string; parsed_data: Record<string, unknown>; confidence: number;
  uncertainty: Record<string, unknown>; review_state: 'pending' | 'accepted' | 'merged';
  compass_entry_id: string | null; reserved_compass_entry_id: string;
};
const evidenceOrdinalByPage = new WeakMap<Page, { ordinal: number; injectSecondFailure: boolean }>();
const manualAddFailureByPage = new WeakMap<Page, { remaining: number }>();
async function installImportApi(page: Page) {
  let attempts = 0;
  const items: ImportItem[] = [];
  const sources: Array<Record<string, unknown>> = [];
  let batch: Record<string, unknown> | null = null;
  const acceptedCompass: Array<Record<string, unknown>> = [];
  await page.route('**/api/compass/entries', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: acceptedCompass }) });
  });
  await page.route('**/api/curate/imports**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'GET' && path === '/api/curate/imports') {
      const detail = batch ? { batch, sources, items } : null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imports: detail ? [detail] : [] }) });
    }
    const contentMatch = path.match(/\/api\/curate\/imports\/batch-1\/sources\/(evidence-\d+)\/content$/);
    if (method === 'GET' && contentMatch) {
      const source = sources.find(candidate => candidate.id === contentMatch[1])!;
      const type = String((source.metadata as Record<string, unknown>).content_type);
      const body = type.startsWith('image/') ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') : Buffer.from('%PDF-test');
      return route.fulfill({ status: 200, contentType: type, body });
    }
    if (method === 'GET' && /^\/api\/curate\/imports\/[^/]+$/.test(path)) {
      if (batch && items.length > 0 && items.every(item => ['accepted', 'merged'].includes(item.review_state))) batch.review_state = 'completed';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ batch, sources, items }) });
    }
    if (method === 'POST' && path === '/api/curate/imports') {
      attempts += 1;
      const body = request.postDataJSON() as { title: string; pasted_text?: string; source_kind: string; items?: ImportItem[] };
      if (body.pasted_text?.includes('RETRY') && attempts === 1) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Parser unavailable' }) });
      }
      const lines = body.items?.length
        ? body.items.map(item => item.raw_text)
        : (body.pasted_text || '').split('\n').filter(Boolean);
      items.splice(0, items.length, ...lines.map((line, position) => ({
        id: `item-${position}`, batch_id: 'batch-1', source_id: 'source-1', position,
        category: line.toLowerCase().includes('pot') ? 'teaware' : 'tea', name: line.replace(/^\?\s*/, '').split(/[-—]/)[0].trim(),
        raw_text: line, parsed_data: { name: line.replace(/^\?\s*/, '').split(/[-—]/)[0].trim() },
        confidence: line.startsWith('?') ? 0.42 : 0.94,
        uncertainty: line.startsWith('?') ? { name: 'Could be a transliteration' } : {},
        review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: `compass-${position}`,
      })));
      batch = { id: 'batch-1', title: body.title, review_state: 'pending', journey_id: null, visit_id: null };
      sources.splice(0, sources.length, ...(body.pasted_text ? [{ id: 'source-text', batch_id: 'batch-1', kind: body.source_kind, pasted_text: body.pasted_text, r2_object_key: null, metadata: {} }] : []));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        batch, sources, items,
      }) });
    }
    if (method === 'POST' && /\/evidence$/.test(path)) {
      const ordinal = evidenceOrdinalByPage.get(page);
      if (ordinal) {
        ordinal.ordinal += 1;
        if (ordinal.injectSecondFailure && ordinal.ordinal === 2) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary evidence failure' }) });
      }
      const clientId = request.headers()['x-client-evidence-id'];
      const filename = decodeURIComponent(request.headers()['x-filename']);
      const source = { id: `evidence-${sources.length}`, batch_id: 'batch-1', kind: request.headers()['content-type'] === 'application/pdf' ? 'invoice' : 'photo', pasted_text: null, r2_object_key: `curate/acct-bali/batch-1/${filename}`, metadata: { filename, content_type: request.headers()['content-type'], size: request.postDataBuffer()?.length || 0, extraction_status: 'not_available', client_evidence_id: request.headers()['x-client-evidence-id'] } };
      sources.push(source);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(source) });
    }
    if (method === 'POST' && /\/abandon$/.test(path)) {
      if (batch) batch.review_state = 'abandoned';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, review_state: 'abandoned' }) });
    }
    if (method === 'POST' && /\/items$/.test(path)) {
      const failure = manualAddFailureByPage.get(page);
      if (failure && failure.remaining > 0) {
        failure.remaining -= 1;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Manual item temporarily unavailable' }) });
      }
      const body = request.postDataJSON();
      const item = { id: `item-${items.length}`, batch_id: 'batch-1', source_id: body.source_id || null, position: items.length, category: body.category, name: body.name, raw_text: null, parsed_data: {}, confidence: null, uncertainty: {}, review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: `compass-${items.length}` } as ImportItem;
      items.push(item); return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(item) });
    }
    const updateMatch = path.match(/\/items\/(item-\d+)$/);
    if (method === 'PUT' && updateMatch) {
      const item = items.find(candidate => candidate.id === updateMatch[1])!;
      Object.assign(item, request.postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
    }
    const itemMatch = path.match(/\/items\/(item-\d+)\/(accept|merge)$/);
    if (method === 'POST' && itemMatch) {
      const item = items.find(candidate => candidate.id === itemMatch[1])!;
      item.review_state = itemMatch[2] === 'accept' ? 'accepted' : 'merged';
      item.compass_entry_id = item.reserved_compass_entry_id;
      if (itemMatch[2] === 'accept') acceptedCompass.push({ id: item.compass_entry_id, account_id: 'acct-bali', user_id: 'test-admin-uid', name: item.name, category: item.category, notes: item.raw_text, status: 'logged', import_item_id: item.id });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
    }
    return route.fallback();
  });
}

test.describe('Curate Import panel', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await installImportApi(page);
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens as a temporary modal, traps focus, and restores the unchanged tea draft', async ({ page }) => {
    await openCompass(page);
    const name = page.getByPlaceholder(/Tea name \(e\.g\., Tieguanyin/).filter({ visible: true });
    await name.fill('Field tea');
    const trigger = page.getByRole('button', { name: 'Import' }).first();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('button').filter({ hasText: 'Add files or invoices' })).toBeFocused();
    await expect(page.getByLabel('Add photos')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByLabel('Add files or invoices')).toHaveAttribute('tabindex', '-1');
    await page.getByRole('button', { name: 'Close Import' }).click();
    await expect(trigger).toBeFocused();
    await expect(name).toHaveValue('Field tea');
    await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
    const teawareName = page.getByPlaceholder(/Teaware name/).filter({ visible: true });
    await teawareName.fill('Field pot');
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(teawareName).toHaveValue('Field pot');
    await expect(page.getByRole('tab', { name: 'Samples', exact: true })).toBeVisible();
  });

  test('accepts pasted fragments with parsing, textual uncertainty, merge, one/all review, and deferred batch chip', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill('Ali Shan — 600 TWD\n? Red Jade\nClay pot — 2 units');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Parsing your evidence…')).toBeVisible();
    await expect(page.getByText('Could be a transliteration')).toBeVisible();
    await page.getByRole('button', { name: /^Red Jade/ }).click();
    await page.getByLabel('Corrected name').fill('Red Jade corrected');
    await page.getByRole('button', { name: 'Save corrections' }).click();
    await expect(page.getByText('Could be a transliteration')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept Red Jade corrected' })).toBeDisabled();
    await page.getByRole('button', { name: /^Ali Shan/ }).click();
    await page.getByRole('button', { name: 'Merge Ali Shan' }).click();
    await page.getByLabel('Reviewed uncertain fields').click();
    await page.getByRole('button', { name: 'Accept Red Jade corrected' }).click();
    await expect(page.getByPlaceholder(/Tea name \(e\.g\., Tieguanyin/).filter({ visible: true })).toHaveValue('Red Jade corrected');
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByRole('button', { name: 'Accept all remaining' }).click();
    await page.getByRole('button', { name: 'Review later' }).click();
    await expect(page.getByRole('button', { name: /Imported list: 3 items/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByRole('button', { name: 'New import' }).click();
    await expect(page.getByLabel('Paste a list or invoice text')).toBeVisible();
  });

  test('shows every incomplete batch and clears account A import state immediately on account switch', async ({ page }) => {
    const detail = (id: string, title: string) => ({ batch: { id, title, review_state: 'pending', journey_id: null, visit_id: null }, sources: [{ id: `source-${id}`, batch_id: id, kind: 'paste', pasted_text: title, r2_object_key: null, metadata: {} }], items: [] });
    let switched = false;
    await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imports: switched ? [] : [detail('batch-a', 'First list'), detail('batch-b', 'Second list')] }) }));
    await openCompass(page);
    await expect(page.getByRole('button', { name: /Imported list: 0 items/ })).toHaveCount(2);
    await page.getByRole('button', { name: /Imported list: 0 items/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeVisible();
    switched = true;
    await page.evaluate(async () => {
      // @ts-expect-error Vite source modules are available in Playwright.
      const { useAppStore } = await import('/src/lib/store.ts');
      useAppStore.getState().setActiveAccountId('acct-empty');
    });
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Imported list: 0 items/ })).toHaveCount(0);
  });

  test('supports photo, document, and invoice evidence plus retry after parsing failure', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await expect(page.getByLabel('Add photos')).toHaveAttribute('accept', /image/);
    await expect(page.getByLabel('Add files or invoices')).toHaveAttribute('accept', /pdf/);
    await page.getByLabel('Add photos').setInputFiles({ name: 'vendor-board.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo') });
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await expect(page.getByText('vendor-board.jpg')).toBeVisible();
    await expect(page.getByText('invoice.pdf')).toBeVisible();
    await page.getByLabel('Paste a list or invoice text').fill('RETRY tea');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Parser unavailable')).toBeVisible();
    await page.getByRole('button', { name: 'Retry import' }).click();
    await expect(page.getByText('RETRY tea', { exact: false })).toBeVisible();
    await expect(page.getByText('Saved · extraction not available · needs review').first()).toBeVisible();
    await expect(page.getByAltText('Evidence preview: vendor-board.jpg')).toBeVisible();
  });

  test('persists corrections and opens the exact accepted server Compass identity', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill('Wrong Name — 12');
    await page.getByRole('button', { name: 'Start import' }).click();
    await page.getByRole('button', { name: /^Wrong Name/ }).click();
    await page.getByLabel('Corrected name').fill('Correct Name');
    await page.getByTestId('import-item-row').filter({ hasText: 'Wrong Name' }).locator('select').selectOption('teaware');
    await page.getByLabel('Origin').fill('Yixing');
    await page.getByRole('button', { name: 'Save corrections' }).click();
    await page.getByRole('button', { name: 'Accept Correct Name' }).click();
    await expect(page.getByPlaceholder(/Teaware name/).filter({ visible: true })).toHaveValue('Correct Name');
    await expect.poll(() => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('teajia-compass') || '{}').state;
      return state?.entries?.some((entry: { id: string }) => entry.id === 'compass-0');
    })).toBe(true);
    const synced = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/compass/sync' && (request.postData() || '').includes('compass-0'));
    await page.getByPlaceholder(/Teaware name/).filter({ visible: true }).fill('Correct Name Edited');
    await synced;
  });

  test('keeps unsupported evidence recoverable and never invents a tea from its filename', async ({ page }) => {
    await page.route('**/api/curate/imports/batch-1/evidence', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Evidence storage is not configured. Your file was not saved.' }) }));
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'not-a-tea.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Evidence storage is not configured. Your file was not saved.')).toBeVisible();
    await expect(page.getByTestId('import-item-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry import' })).toBeVisible();
  });

  test('recovers saved evidence and its grouped incomplete batch after reload', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Saved · extraction not available · needs review')).toBeVisible();
    await page.getByRole('button', { name: 'Review later' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: /invoice: 0 items, 0 reviewed, 0 remaining/ })).toBeVisible();
    await page.getByRole('button', { name: /invoice: 0 items/ }).click();
    await expect(page.getByText('invoice.pdf')).toBeVisible();
    const retrieval = page.waitForRequest(request => request.method() === 'GET' && request.url().includes('/sources/evidence-0/content'));
    await page.getByRole('button', { name: 'Open invoice.pdf' }).click();
    await retrieval;
  });

  test('resolves an evidence-only batch with a manual item or explicit abandon', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-evidence') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await page.getByLabel('Manual review item name').fill('Manual tea');
    await page.getByRole('button', { name: 'Add review item' }).click();
    await expect(page.getByText('Manual tea')).toBeVisible();
    const abandon = page.getByRole('button', { name: 'Abandon import' });
    await abandon.click();
    await expect(page.getByRole('alertdialog', { name: 'Confirm abandon import' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel abandon' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancel abandon' }).click();
    await expect(abandon).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeVisible();
    await abandon.click();
    await page.getByRole('button', { name: 'Confirm abandon' }).click();
    await expect(page.getByRole('button', { name: /invoice: 1 items/ })).toHaveCount(0);
  });

  test('preserves a failed manual item and clears it only after managed retry succeeds', async ({ page }) => {
    manualAddFailureByPage.set(page, { remaining: 1 });
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'retry-evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-retry') });
    await page.getByRole('button', { name: 'Start import' }).click();
    const name = page.getByLabel('Manual review item name');
    const category = page.getByLabel('Manual review item category');
    await name.fill('Recoverable gaiwan');
    await category.selectOption('teaware');
    await page.getByRole('button', { name: 'Add review item' }).click();
    await expect(page.getByRole('alert')).toContainText('Manual item temporarily unavailable');
    await expect(name).toHaveValue('Recoverable gaiwan');
    await expect(category).toHaveValue('teaware');
    await expect(page.getByText('retry-evidence.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Retry action' }).click();
    await expect(page.getByText('Recoverable gaiwan')).toBeVisible();
    await expect(name).toHaveValue('');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('keeps 25 recovered batches compact and capture visible without overflow', async ({ page }) => {
    const imports = Array.from({ length: 25 }, (_, index) => ({ batch: { id: `batch-${index}`, title: `Batch ${index}`, review_state: 'pending', journey_id: null, visit_id: null }, sources: [{ id: `source-${index}`, batch_id: `batch-${index}`, kind: 'paste', pasted_text: `Batch ${index}`, r2_object_key: null, metadata: {} }], items: [] }));
    await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imports }) }));
    await openCompass(page);
    await expect(page.getByRole('button', { name: /Imported list: 0 items/ })).toHaveCount(2);
    await page.getByRole('button', { name: '23 more imports' }).click();
    await expect(page.getByRole('button', { name: /Imported list: 0 items/ })).toHaveCount(25);
    await expect(page.getByPlaceholder(/Tea name \(e\.g\., Tieguanyin/).filter({ visible: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('retries only the failed attachment after a partial upload', async ({ page }) => {
    const attempts = new Map<string, number>();
    const ordinal = { ordinal: 0, injectSecondFailure: true };
    evidenceOrdinalByPage.set(page, ordinal);
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/evidence')) { const id = request.headers()['x-client-evidence-id']; attempts.set(id, (attempts.get(id) || 0) + 1); } });
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Add photos').setInputFiles({ name: 'one.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('one') });
    await expect(page.getByText('one.jpg')).toBeVisible();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'two.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-two') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect.poll(() => attempts.size, { message: `Expected both evidence requests; attempts=${JSON.stringify([...attempts])}` }).toBe(2);
    expect(ordinal.ordinal).toBe(2);
    await expect(page.getByText('Temporary evidence failure')).toBeVisible();
    await page.getByRole('button', { name: 'Retry import' }).click();
    await expect(page.getByText('one.jpg')).toBeVisible();
    await expect(page.getByText('two.pdf')).toBeVisible();
    expect([...attempts.values()].sort()).toEqual([1, 2]);
    expect(ordinal.ordinal).toBe(3);
  });

  test('preserves separately selected files with the same filename', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Add photos').setInputFiles({ name: 'same.evidence', mimeType: 'image/jpeg', buffer: Buffer.from('one') });
    await expect(page.getByText('same.evidence')).toBeVisible();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'same.evidence', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-two') });
    await expect(page.getByText('same.evidence')).toHaveCount(2);
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Saved · extraction not available · needs review').first()).toBeVisible();
  });

  test('keeps a 30-item batch grouped instead of flooding the capture session', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('button', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill(Array.from({ length: 30 }, (_, index) => `Tea ${index + 1}`).join('\n'));
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('30 items to review')).toBeVisible();
    await expect(page.getByTestId('import-item-row')).toHaveCount(10);
    await page.getByRole('button', { name: 'Show 10 more' }).click();
    await expect(page.getByTestId('import-item-row')).toHaveCount(20);
  });
});
