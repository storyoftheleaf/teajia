import { expect, test, type Page } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

type ImportItem = {
  id: string; batch_id: string; source_id: string; position: number; category: 'tea' | 'teaware';
  name: string | null; raw_text: string; parsed_data: Record<string, unknown>; confidence: number;
  uncertainty: Record<string, unknown>; review_state: 'pending' | 'accepted' | 'merged';
  compass_entry_id: string | null; reserved_compass_entry_id: string;
  vendor_group_id?: string | null; english_name?: string | null; original_name?: string | null;
  pack_weight?: number | null; weight_unit?: 'g' | 'kg' | 'count' | null; pack_count?: number | null;
  price_amount?: number | null; currency?: string | null; price_basis?: 'per_pack' | 'line_total' | 'unknown';
  total_quantity_grams?: number | null; total_units?: number | null; line_cost?: number | null;
  unit_cost?: number | null; blocking_fields?: string[];
};
const evidenceOrdinalByPage = new WeakMap<Page, { ordinal: number; injectSecondFailure: boolean }>();

const analyzedTeaNames = [
  ['Yunnan Ancient Tree Raw Pu’er', '云南古树生普'],
  ['Menghai Spring Sheng Pu’er', '勐海春尖生普'],
  ['Yiwu Old Arbor Raw Pu’er', '易武古树生茶'],
  ['Jingmai Mountain Raw Pu’er', '景迈山生普'],
  ['Bulang Mountain Ripe Pu’er', '布朗山熟普'],
  ['Alishan High Mountain Oolong', '阿里山高山乌龙'],
  ['Lishan Winter Oolong', '梨山冬片'],
  ['Sun Moon Lake Red Jade', '日月潭红玉'],
  ['Oriental Beauty Oolong', '东方美人'],
  ['Shan Lin Xi Charcoal Oolong', '杉林溪炭焙乌龙'],
] as const;

function analyzedImportDetail() {
  const groups = [
    {
      id: 'group-chen', batch_id: 'batch-analyzed', position: 0,
      proposed_vendor_name: 'Chen Family Ancient Tree Tea Cooperative of Xishuangbanna',
      resolved_vendor_customer_id: 'vendor-chen',
      resolved_vendor_name: 'Chen Family Ancient Tree Tea Cooperative of Xishuangbanna',
      confidence: 0.98, uncertainty: {},
    },
    {
      id: 'group-lin', batch_id: 'batch-analyzed', position: 1,
      proposed_vendor_name: 'Lin Family High Mountain Tea Workshop, Nantou County',
      resolved_vendor_customer_id: 'vendor-lin',
      resolved_vendor_name: 'Lin Family High Mountain Tea Workshop, Nantou County',
      confidence: 0.93, uncertainty: {},
    },
  ];
  const items = analyzedTeaNames.map(([englishName, originalName], index) => ({
    id: `analyzed-item-${index + 1}`, batch_id: 'batch-analyzed', source_id: 'source-analyzed',
    vendor_group_id: index < 5 ? 'group-chen' : 'group-lin', position: index, category: 'tea' as const,
    name: englishName, english_name: englishName, original_name: originalName,
    raw_text: `${originalName} 500g ×2 ¥380`,
    parsed_data: { english_name: englishName, original_name: originalName },
    confidence: index === 9 ? 0.51 : 0.96,
    uncertainty: index === 9 ? {
      pack_count: 'The multiplier is faint in the photograph',
      weight_unit: 'The unit is partly covered',
      price_basis: 'The invoice does not clearly say per pack',
      currency: 'The currency mark is blurred',
    } : {},
    review_state: 'pending' as const, compass_entry_id: null, reserved_compass_entry_id: `compass-${index + 1}`,
    pack_weight: 500, weight_unit: 'g', pack_count: 2, price_amount: index < 5 ? 380 : 600,
    currency: index < 5 ? 'CNY' : 'TWD', price_basis: 'per_pack',
    total_quantity_grams: 1000, total_units: null, line_cost: index < 5 ? 760 : 1200,
    unit_cost: index < 5 ? 0.76 : 1.2, blocking_fields: index === 9 ? ['pack_count', 'weight_unit', 'price_basis', 'currency'] : [],
    evidence_refs: [`source-analyzed:${index * 20}-${index * 20 + 18}`],
  }));
  return {
    batch: {
      id: 'batch-analyzed', title: 'Two vendor Chinese tea list', review_state: 'reviewing',
      journey_id: null, visit_id: null, analysis_state: 'completed', analysis_language: 'zh',
      analysis_overview: '10 teas found across 2 vendors. Chinese names translated; one pack count needs confirmation.',
      analysis_error: null,
    },
    sources: [{ id: 'source-analyzed', batch_id: 'batch-analyzed', kind: 'paste', pasted_text: 'Chinese vendor list', r2_object_key: null, metadata: {} }],
    groups,
    items,
  };
}

async function installAnalyzedImportApi(page: Page) {
  const detail = analyzedImportDetail();
  let finalizeCalls = 0;
  await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ json: { imports: [detail] } }));
  await page.route('**/api/curate/imports/batch-analyzed', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: detail });
    return route.fallback();
  });
  await page.route('**/api/curate/imports/batch-analyzed/items/*', async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const itemId = new URL(route.request().url()).pathname.split('/').at(-1);
    const item = detail.items.find(candidate => candidate.id === itemId)!;
    Object.assign(item, route.request().postDataJSON());
    if (item.id === 'analyzed-item-10') {
      item.blocking_fields = [];
      item.uncertainty = {};
      item.confidence = 0.96;
    }
    return route.fulfill({ json: item });
  });
  await page.route('**/api/curate/imports/batch-analyzed/finalize', async route => {
    finalizeCalls += 1;
    detail.batch.review_state = 'completed';
    return route.fulfill({ json: { batch: detail.batch, receipts: [{ id: 'receipt-chen' }, { id: 'receipt-lin' }], items: detail.items } });
  });
  return { detail, finalizeCalls: () => finalizeCalls };
}

async function installImportApi(page: Page) {
  let attempts = 0;
  const items: ImportItem[] = [];
  const sources: Array<Record<string, unknown>> = [];
  const groups: Array<Record<string, unknown>> = [];
  let batch: Record<string, unknown> | null = null;
  let finalizeCalls = 0;
  const detail = () => ({ batch, sources, groups, items });
  await page.route('**/api/compass/entries', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) });
  });
  await page.route('**/api/curate/imports**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'GET' && path === '/api/curate/imports') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imports: batch ? [detail()] : [] }) });
    }
    const contentMatch = path.match(/\/api\/curate\/imports\/batch-1\/sources\/(evidence-\d+)\/content$/);
    if (method === 'GET' && contentMatch) {
      const source = sources.find(candidate => candidate.id === contentMatch[1])!;
      const type = String((source.metadata as Record<string, unknown>).content_type);
      const body = type.startsWith('image/') ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
        : type === 'application/json' ? Buffer.from('[{"name":"Ali Shan","price":600},{"name":"Red Jade","price":450}]')
        : Buffer.from('%PDF-test');
      return route.fulfill({ status: 200, contentType: type, body });
    }
    if (method === 'GET' && /^\/api\/curate\/imports\/[^/]+$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail()) });
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
      batch = { id: 'batch-1', title: body.title, review_state: 'pending', journey_id: null, visit_id: null, analysis_state: 'pending' };
      sources.splice(0, sources.length, ...(body.pasted_text ? [{ id: 'source-text', batch_id: 'batch-1', kind: body.source_kind, pasted_text: body.pasted_text, r2_object_key: null, metadata: {} }] : []));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail()) });
    }
    if (method === 'POST' && path === '/api/curate/imports/batch-1/analyze') {
      if (batch) Object.assign(batch, { review_state: 'reviewing', analysis_state: 'completed', analysis_language: 'en', analysis_overview: `${items.length} items analyzed from saved evidence.` });
      groups.splice(0, groups.length, ...(items.length ? [{
        id: 'group-import', batch_id: 'batch-1', position: 0, proposed_vendor_name: 'Chen Family',
        resolved_vendor_customer_id: 'vendor-chen', resolved_vendor_name: 'Chen Family', confidence: 0.96, uncertainty: {},
      }] : []));
      for (const item of items) Object.assign(item, {
        vendor_group_id: 'group-import', english_name: item.name, pack_weight: 100, weight_unit: 'g', pack_count: 1,
        price_amount: 12, currency: 'USD', price_basis: 'line_total', total_quantity_grams: item.category === 'tea' ? 100 : null,
        total_units: item.category === 'teaware' ? 1 : null, line_cost: 12, unit_cost: item.category === 'tea' ? 0.12 : 12,
        blocking_fields: [],
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail()) });
    }
    if (method === 'POST' && /\/evidence$/.test(path)) {
      const ordinal = evidenceOrdinalByPage.get(page);
      if (ordinal) {
        ordinal.ordinal += 1;
        if (ordinal.injectSecondFailure && ordinal.ordinal === 2) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary evidence failure' }) });
      }
      const clientId = request.headers()['x-client-evidence-id'];
      const filename = decodeURIComponent(request.headers()['x-filename']);
      const contentType = request.headers()['content-type'];
      const source = { id: `evidence-${sources.length}`, batch_id: 'batch-1', kind: contentType === 'application/pdf' ? 'invoice' : contentType.startsWith('image/') ? 'photo' : 'file', pasted_text: null, r2_object_key: `curate/acct-bali/batch-1/${filename}`, metadata: { filename, content_type: contentType, size: request.postDataBuffer()?.length || 0, extraction_status: 'not_available', client_evidence_id: request.headers()['x-client-evidence-id'] } };
      sources.push(source);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(source) });
    }
    if (method === 'POST' && /\/abandon$/.test(path)) {
      if (batch) batch.review_state = 'abandoned';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, review_state: 'abandoned' }) });
    }
    const updateMatch = path.match(/\/items\/(item-\d+)$/);
    if (method === 'PUT' && updateMatch) {
      const item = items.find(candidate => candidate.id === updateMatch[1])!;
      Object.assign(item, request.postDataJSON());
      item.blocking_fields = [];
      item.uncertainty = {};
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
    }
    if (method === 'POST' && path === '/api/curate/imports/batch-1/finalize') {
      finalizeCalls += 1;
      if (batch) batch.review_state = 'completed';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ batch, receipts: [{ id: 'receipt-import' }], items }) });
    }
    return route.fallback();
  });
  return { finalizeCalls: () => finalizeCalls };
}

test.describe('Curate Import panel', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await installImportApi(page);
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens as a temporary modal, traps focus, and restores the unchanged tea draft', async ({ page }) => {
    await openCompass(page);
    const name = page.getByRole('textbox', { name: 'Tea name…' });
    await name.fill('Field tea');
    const trigger = page.getByRole('tab', { name: 'Import' }).first();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('button').filter({ hasText: 'Add files or invoices' })).toBeFocused();
    await expect(page.getByLabel('Add photos')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByLabel('Add files or invoices')).toHaveAttribute('tabindex', '-1');
    await page.getByRole('button', { name: 'Close Import' }).click();
    await expect(trigger).toBeFocused();
    await expect(name).toHaveValue('Field tea');
    await expect(page.getByRole('tab', { name: 'Import', exact: true }).first()).toBeVisible();
  });

  test('analyzes pasted tea and teaware fragments into one editable vendor group', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill('Ali Shan — 600 TWD\n? Red Jade\nClay pot — 2 units');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Analyzing your evidence…')).toBeVisible();
    await expect(page.getByTestId('import-vendor-group')).toHaveCount(1);
    await expect(page.getByTestId('import-item-row')).toHaveCount(3);
    await expect(page.getByTestId('import-item-row').filter({ hasText: 'Clay pot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add 3 items to Inventory' })).toBeEnabled();
    await page.getByRole('button', { name: 'Review later' }).click();
    await expect(page.getByRole('button', { name: /Imported list: 3 items/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByRole('button', { name: 'New import' }).click();
    await expect(page.getByLabel('Paste a list or invoice text')).toBeVisible();
  });

  test('uses a category-aware final action for a teaware-only import', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill('Clay pot — 2 units');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByTestId('import-item-row')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Add 1 teaware item to Inventory' })).toBeEnabled();
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
    await page.getByRole('tab', { name: 'Import' }).first().click();
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

  test('extracts selected JSON into reviewed rows and keeps the original evidence retrievable', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    const original = '[{"name":"Ali Shan","price":600},{"name":"Red Jade","price":450}]';
    await page.getByLabel('Add files or invoices').setInputFiles({
      name: 'vendor-list.json', mimeType: 'application/json', buffer: Buffer.from(original),
    });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByTestId('import-item-row')).toHaveCount(2);
    await expect(page.getByTestId('import-item-row').nth(0)).toContainText('Ali Shan');
    await expect(page.getByTestId('import-item-row').nth(1)).toContainText('Red Jade');
    await expect(page.getByText('vendor-list.json')).toBeVisible();
    const retrieval = page.waitForResponse(response => response.request().method() === 'GET'
      && /\/sources\/evidence-\d+\/content$/.test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: 'Open vendor-list.json' }).click();
    const response = await retrieval;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('keeps unsupported evidence recoverable and never invents a tea from its filename', async ({ page }) => {
    await page.route('**/api/curate/imports/batch-1/evidence', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Evidence storage is not configured. Your file was not saved.' }) }));
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'not-a-tea.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Evidence storage is not configured. Your file was not saved.')).toBeVisible();
    await expect(page.getByTestId('import-item-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry import' })).toBeVisible();
  });

  test('recovers saved evidence and its grouped incomplete batch after reload', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
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

  test('keeps an evidence-only batch recoverable through explicit abandon', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-evidence') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('No analyzed teas yet. Retry analysis from this saved evidence.')).toBeVisible();
    const abandon = page.getByRole('button', { name: 'Abandon import' });
    await abandon.click();
    await expect(page.getByRole('alertdialog', { name: 'Confirm abandon import' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel abandon' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancel abandon' }).click();
    await expect(abandon).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' })).toBeVisible();
    await abandon.click();
    await page.getByRole('button', { name: 'Confirm abandon' }).click();
    await expect(page.getByRole('button', { name: /invoice: 0 items/ })).toHaveCount(0);
  });

  test('keeps 25 recovered batches compact and capture visible without overflow', async ({ page }) => {
    const imports = Array.from({ length: 25 }, (_, index) => ({ batch: { id: `batch-${index}`, title: `Batch ${index}`, review_state: 'pending', journey_id: null, visit_id: null }, sources: [{ id: `source-${index}`, batch_id: `batch-${index}`, kind: 'paste', pasted_text: `Batch ${index}`, r2_object_key: null, metadata: {} }], items: [] }));
    await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imports }) }));
    await openCompass(page);
    await expect(page.getByRole('button', { name: /Imported list: 0 items/ })).toHaveCount(2);
    await page.getByRole('button', { name: '23 more imports' }).click();
    await expect(page.getByRole('button', { name: /Imported list: 0 items/ })).toHaveCount(25);
    await expect(page.getByRole('tab', { name: 'Source', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('retries only the failed attachment after a partial upload', async ({ page }) => {
    const attempts = new Map<string, number>();
    const ordinal = { ordinal: 0, injectSecondFailure: true };
    evidenceOrdinalByPage.set(page, ordinal);
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/evidence')) { const id = request.headers()['x-client-evidence-id']; attempts.set(id, (attempts.get(id) || 0) + 1); } });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
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
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add photos').setInputFiles({ name: 'same.evidence', mimeType: 'image/jpeg', buffer: Buffer.from('one') });
    await expect(page.getByText('same.evidence')).toBeVisible();
    await page.getByLabel('Add files or invoices').setInputFiles({ name: 'same.evidence', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-two') });
    await expect(page.getByText('same.evidence')).toHaveCount(2);
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Saved · extraction not available · needs review').first()).toBeVisible();
  });

  test('keeps every row in a 30-item batch vertically reachable', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Paste a list or invoice text').fill(Array.from({ length: 30 }, (_, index) => `Tea ${index + 1}`).join('\n'));
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('30 teas · 1 vendor')).toBeVisible();
    await expect(page.getByTestId('import-item-row')).toHaveCount(30);
    await page.getByTestId('import-item-row').last().scrollIntoViewIfNeeded();
    await expect(page.getByTestId('import-item-row').last()).toContainText('Tea 30');
    expect(await page.getByRole('dialog', { name: 'Import into Curate' }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
});

test.describe('analyzed inventory import review', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('groups ten editable teas by vendor without repeated controls or overflow', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'Mobile Chrome') await page.setViewportSize({ width: 390, height: 844 });
    const api = await installAnalyzedImportApi(page);
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('select[aria-label="Sourcing run"]')).toHaveCount(1);
    await expect(dialog.locator('label').filter({ hasText: 'Sourcing run · optional' })).toHaveCount(1);
    await expect(dialog.getByTestId('import-vendor-group')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: /^Change vendor for / })).toHaveCount(2);
    await expect(dialog.getByText('Chen Family Ancient Tree Tea Cooperative of Xishuangbanna', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Lin Family High Mountain Tea Workshop, Nantou County', { exact: true })).toBeVisible();

    const changeActions = dialog.getByRole('button', { name: /^Change vendor for / });
    for (let index = 0; index < await changeActions.count(); index += 1) {
      expect(await changeActions.nth(index).evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(13);
    }

    const rows = dialog.getByTestId('import-item-row');
    await expect(rows).toHaveCount(10);
    const compactHeights = await rows.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    expect(Math.max(...compactHeights), 'collapsed review rows should stay compact').toBeLessThanOrEqual(120);
    for (let index = 0; index < analyzedTeaNames.length; index += 1) {
      await rows.nth(index).scrollIntoViewIfNeeded();
      await expect(rows.nth(index)).toContainText(analyzedTeaNames[index][0]);
      await expect(rows.nth(index)).toContainText(analyzedTeaNames[index][1]);
    }

    const finalAction = dialog.getByRole('button', { name: /^Add 10 teas to Inventory/ });
    await expect(dialog.getByText('Confirm pack count, weight or unit, price interpretation, and currency.')).toBeVisible();
    await expect(finalAction).toBeDisabled();

    const readyRow = rows.nth(0);
    await readyRow.getByRole('button', { name: 'Edit tea' }).click();
    await expect(readyRow.getByLabel(/English (inventory )?name/i)).toHaveValue('Yunnan Ancient Tree Raw Pu’er');
    await readyRow.getByLabel(/English (inventory )?name/i).fill('Yunnan Ancient Tree Raw Pu’er — Spring Lot');
    await expect(readyRow.getByLabel('Sourcing run')).toHaveCount(0);
    await expect(readyRow.getByRole('button', { name: /^Change vendor for / })).toHaveCount(0);
    await readyRow.getByRole('button', { name: 'Save tea' }).click();
    await expect(readyRow).toContainText('Yunnan Ancient Tree Raw Pu’er — Spring Lot');

    const uncertainRow = rows.nth(9);
    await uncertainRow.scrollIntoViewIfNeeded();
    await uncertainRow.getByRole('button', { name: 'Edit tea' }).click();
    await uncertainRow.getByLabel('Pack count').fill('3');
    await expect(uncertainRow.getByLabel('Sourcing run')).toHaveCount(0);
    await expect(uncertainRow.getByRole('button', { name: /^Change vendor for / })).toHaveCount(0);

    if (testInfo.project.name === 'Mobile Chrome') {
      const controlFontSizes = await dialog.locator('input:visible, textarea:visible, select:visible').evaluateAll(elements =>
        elements.map(element => ({ label: element.getAttribute('aria-label') || element.getAttribute('name') || element.tagName, size: Number.parseFloat(getComputedStyle(element).fontSize) })),
      );
      expect(controlFontSizes.length).toBeGreaterThan(0);
      expect(controlFontSizes.filter(control => control.size < 16), `Mobile import controls below 16px: ${JSON.stringify(controlFontSizes)}`).toEqual([]);
    }

    await uncertainRow.getByRole('button', { name: 'Save tea' }).click();
    await expect(finalAction).toBeEnabled();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await finalAction.click();
    await expect.poll(api.finalizeCalls).toBe(1);
  });

  test('keeps every visible import input at 16px on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'iOS-style focus zoom is a mobile-only constraint');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ json: { imports: [] } }));
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await expect(dialog.locator('select[aria-label="Sourcing run"]')).toHaveCount(1);
    await expect(dialog.locator('label').filter({ hasText: 'Sourcing run · optional' })).toHaveCount(1);
    const controls = dialog.locator('input:visible, textarea:visible, select:visible');
    await expect(controls.first()).toBeVisible();
    const controlFontSizes = await controls.evaluateAll(elements =>
      elements.map(element => ({ label: element.getAttribute('aria-label') || element.getAttribute('name') || element.tagName, size: Number.parseFloat(getComputedStyle(element).fontSize) })),
    );
    expect(controlFontSizes.filter(control => control.size < 16), `Mobile import controls below 16px: ${JSON.stringify(controlFontSizes)}`).toEqual([]);
  });
});
