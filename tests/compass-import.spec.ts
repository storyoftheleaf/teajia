import { expect, test, type Page, type Route } from '@playwright/test';
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
const workerImportParsedDataKeys = new Set([
  'sourceItemId', 'category', 'originalName', 'englishName', 'packWeight', 'weightUnit', 'packCount',
  'priceAmount', 'priceAmountExact', 'currency', 'priceBasis', 'confidence', 'uncertainty', 'evidenceRefs', 'acquired',
  'duplicateResolution', 'proposedCompassEntryId', 'proposedProductId', 'chineseName', 'type', 'form',
  'year', 'originCountry', 'originRegion', 'classification', 'description', 'inventoryPurpose',
]);
const evidenceOrdinalByPage = new WeakMap<Page, { ordinal: number; injectSecondFailure: boolean }>();
const importApiStateByPage = new WeakMap<Page, { createBodies: Array<Record<string, unknown>>; sources: Array<Record<string, unknown>> }>();

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
    parsed_data: {
      englishName, originalName, type: index < 5 ? 'pu_er' : 'oolong', inventoryPurpose: index === 9 ? null : 'working',
      acquired: index !== 9, duplicateResolution: index === 9 ? 'unresolved' : 'new',
      proposedCompassEntryId: null, proposedProductId: null,
    },
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
    unit_cost: index < 5 ? 0.76 : 1.2,
    acquired: index !== 9, duplicate_resolution: index === 9 ? 'unresolved' as const : 'new' as const,
    proposed_compass_entry_id: null, proposed_product_id: null,
    blocking_fields: index === 9 ? ['pack_count', 'weight_unit', 'price_basis', 'currency', 'duplicate_identity', 'acquired', 'inventory_purpose'] : [],
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
  let detailGetCalls = 0;
  let journeyPutCalls = 0;
  const correctionBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ json: { imports: [detail] } }));
  await page.route('**/api/curate/imports/batch-analyzed', async route => {
    if (route.request().method() === 'GET') {
      detailGetCalls += 1;
      return route.fulfill({ json: detail });
    }
    return route.fallback();
  });
  await page.route('**/api/curate/imports/batch-analyzed/journey', async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    journeyPutCalls += 1;
    const body = route.request().postDataJSON() as { journey_id: string | null };
    detail.batch.journey_id = body.journey_id;
    return route.fulfill({ json: detail.batch });
  });
  await page.route('**/api/curate/imports/batch-analyzed/groups/*', async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const groupId = new URL(route.request().url()).pathname.split('/').at(-1);
    const group = detail.groups.find(candidate => candidate.id === groupId)!;
    const body = route.request().postDataJSON() as { resolved_vendor_customer_id: string };
    group.resolved_vendor_customer_id = body.resolved_vendor_customer_id;
    return route.fulfill({ json: group });
  });
  await page.route('**/api/curate/imports/batch-analyzed/items/*', async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const itemId = new URL(route.request().url()).pathname.split('/').at(-1);
    const item = detail.items.find(candidate => candidate.id === itemId)!;
    const updates = route.request().postDataJSON() as Record<string, unknown> & { parsed_data?: Record<string, unknown> };
    const parsedData = updates.parsed_data || {};
    const unknownKeys = Object.keys(parsedData).filter(key => !workerImportParsedDataKeys.has(key));
    if (unknownKeys.length) {
      return route.fulfill({ status: 400, json: { error: `Unknown parsed_data fields: ${unknownKeys.join(', ')}` } });
    }
    correctionBodies.push(updates);
    Object.assign(item, updates, {
      acquired: parsedData.acquired,
      duplicate_resolution: parsedData.duplicateResolution,
      proposed_compass_entry_id: parsedData.proposedCompassEntryId,
      proposed_product_id: parsedData.proposedProductId,
    });
    item.blocking_fields = (item.blocking_fields || []).filter(field => {
      if (field === 'pack_count') return !(typeof parsedData.packCount === 'number' && parsedData.packCount > 0);
      if (field === 'weight_unit') return !parsedData.weightUnit;
      if (field === 'price_basis') return !parsedData.priceBasis || parsedData.priceBasis === 'unknown';
      if (field === 'currency') return !parsedData.currency;
      if (field === 'duplicate_identity') return parsedData.duplicateResolution !== 'new' && !parsedData.proposedCompassEntryId;
      if (field === 'acquired') return parsedData.acquired !== true;
      if (field === 'inventory_purpose') return !parsedData.inventoryPurpose;
      return true;
    });
    if (!item.blocking_fields.length) {
      item.uncertainty = {};
      item.confidence = 0.96;
    }
    return route.fulfill({ json: item });
  });
  await page.route('**/api/curate/imports/batch-analyzed/finalize', async route => {
    finalizeCalls += 1;
    detail.batch.review_state = 'completed';
    return route.fulfill({ json: {
      batch: detail.batch,
      journey: detail.batch.journey_id ? { id: detail.batch.journey_id, name: 'Taiwan · Spring · 2026' } : null,
      receipts: [
        { id: 'receipt-lin', groupId: 'group-lin', vendorId: 'vendor-lin', vendorName: 'Lin Family High Mountain Tea Workshop, Nantou County' },
        { id: 'receipt-chen', groupId: 'group-chen', vendorId: 'vendor-chen', vendorName: 'Chen Family Ancient Tree Tea Cooperative of Xishuangbanna' },
      ],
      items: detail.items.map((item, index) => ({ id: item.id, compassEntryId: `library-${item.id}`, productId: `holding-${item.id}`, movementId: `movement-${item.id}`, identityDisposition: index === 0 ? 'reused' : 'created', holdingDisposition: index === 0 ? 'reused' : 'created' })),
    } });
  });
  return {
    detail,
    finalizeCalls: () => finalizeCalls,
    detailGetCalls: () => detailGetCalls,
    journeyPutCalls: () => journeyPutCalls,
    correctionBodies,
  };
}

async function installImportApi(page: Page) {
  let attempts = 0;
  let analysisAttempts = 0;
  const items: ImportItem[] = [];
  const sources: Array<Record<string, unknown>> = [];
  const createBodies: Array<Record<string, unknown>> = [];
  importApiStateByPage.set(page, { createBodies, sources });
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
      createBodies.push(body);
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
      analysisAttempts += 1;
      const retrySource = sources.find(source => (source.metadata as Record<string, unknown>)?.filename === 'retry-source.pdf');
      if (retrySource && analysisAttempts === 1) {
        Object.assign(retrySource, { analysis_status: 'failed', analysis_error: 'analysis_evidence_unavailable' });
        if (batch) Object.assign(batch, { review_state: 'pending', analysis_state: 'failed', analysis_error: 'analysis_no_usable_evidence' });
        return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Import analysis failed', code: 'analysis_no_usable_evidence' }) });
      }
      if (retrySource && analysisAttempts > 1) {
        const body = request.postDataJSON() as { source_ids?: string[] };
        if (JSON.stringify(body.source_ids) !== JSON.stringify([retrySource.id])) return route.fulfill({ status: 409, json: { error: 'Retry must target only failed evidence' } });
      }
      if (!items.length) {
        const jsonSource = sources.find(source => (source.metadata as Record<string, unknown>)?.content_type === 'application/json' && typeof source.__testBody === 'string');
        if (jsonSource) {
          const rows = JSON.parse(String(jsonSource.__testBody)) as Array<Record<string, unknown>>;
          items.push(...rows.map((row, position) => ({
            id: `item-${position}`, batch_id: 'batch-1', source_id: String(jsonSource.id), position,
            category: 'tea', name: String(row.name || 'Unnamed tea'), raw_text: JSON.stringify(row), parsed_data: { ...row },
            confidence: 0.94, uncertainty: {}, review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: `compass-${position}`,
          })));
        }
      }
      if (batch) Object.assign(batch, { review_state: 'reviewing', analysis_state: 'completed', analysis_language: 'en', analysis_overview: `${items.length} items analyzed from saved evidence.` });
      for (const source of sources) if (source.analysis_status !== 'reference_only') source.analysis_status = 'analyzed';
      groups.splice(0, groups.length, ...(items.length ? [{
        id: 'group-import', batch_id: 'batch-1', position: 0, proposed_vendor_name: 'Chen Family',
        resolved_vendor_customer_id: 'vendor-chen', resolved_vendor_name: 'Chen Family', confidence: 0.96, uncertainty: {},
      }] : []));
      for (const item of items) Object.assign(item, {
        vendor_group_id: 'group-import', english_name: item.name, pack_weight: 100, weight_unit: 'g', pack_count: 1,
        price_amount: 12, currency: 'USD', price_basis: 'line_total', total_quantity_grams: item.category === 'tea' ? 100 : null,
        total_units: item.category === 'teaware' ? 1 : null, line_cost: 12, unit_cost: item.category === 'tea' ? 0.12 : 12,
        parsed_data: {
          category: item.category, englishName: item.name, packWeight: 100, weightUnit: 'g', packCount: 1,
          priceAmount: 12, currency: 'USD', priceBasis: 'line_total', inventoryPurpose: 'working', acquired: true,
          duplicateResolution: 'new', proposedCompassEntryId: null, proposedProductId: null,
        },
        acquired: true, duplicate_resolution: 'new', blocking_fields: [],
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
      const referenceOnly = /wordprocessingml|msword/.test(contentType);
      const source = { id: `evidence-${sources.length}`, batch_id: 'batch-1', kind: contentType === 'application/pdf' ? 'invoice' : contentType.startsWith('image/') ? 'photo' : 'file', pasted_text: null, r2_object_key: `curate/acct-bali/batch-1/${filename}`, analysis_status: referenceOnly ? 'reference_only' : 'pending', analysis_error: null, reference_metadata: {}, metadata: { filename, content_type: contentType, size: request.postDataBuffer()?.length || 0, extraction_status: 'not_available', client_evidence_id: request.headers()['x-client-evidence-id'] }, __testBody: request.postDataBuffer()?.toString('utf8') };
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        batch, journey: null,
        receipts: [{ id: 'receipt-import', groupId: 'group-import', vendorId: 'vendor-chen', vendorName: 'Chen Family' }],
        items: items.map(item => ({ id: item.id, compassEntryId: item.reserved_compass_entry_id, productId: `product-${item.id}`, movementId: `movement-${item.id}`, identityDisposition: 'created', holdingDisposition: 'created' })),
      }) });
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

  test('opens as a full-screen Curate workspace and preserves capture state', async ({ page }) => {
    await openCompass(page);
    const name = page.getByRole('textbox', { name: 'Tea name…' });
    await name.fill('Field tea');
    const trigger = page.getByRole('tab', { name: 'Import' }).first();
    await trigger.click();

    const shell = page.getByTestId('import-folio-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveClass(/fixed/);
    await expect(shell).toHaveClass(/inset-0/);
    await expect(shell).toHaveClass(/sidebar-inset/);
    await expect(shell).toHaveClass(/z-modal/);
    await expect(shell).toHaveClass(/bg-tea-bg/);
    await expect(shell).not.toHaveClass(/max-w-2xl|ml-auto|border-l/);

    const dialog = page.getByRole('dialog', { name: 'Import' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const progress = page.getByRole('navigation', { name: 'Import progress' });
    await expect(progress).toContainText('EvidenceReviewAdded');
    await expect(progress).toHaveAttribute('data-current-phase', 'evidence');
    await expect(progress.locator('[aria-current="step"]')).toHaveText('Evidence');
    await expect(page.getByText('Add vendor evidence', { exact: true })).toBeVisible();
    await expect(page.getByText('Draft saved', { exact: true })).toBeVisible();
    const sourceDocument = page.getByRole('textbox', { name: 'Vendor list or invoice' });
    await expect(sourceDocument).toBeVisible();
    await expect(sourceDocument).toHaveClass(/min-h-64/);
    await expect(sourceDocument).toHaveClass(/bg-transparent/);
    await expect(sourceDocument).toHaveClass(/font-body/);
    await expect(sourceDocument).toHaveClass(/text-ui-16/);
    await expect(sourceDocument).toHaveClass(/border-b/);
    await expect(sourceDocument).not.toHaveClass(/rounded|bg-tea-surface/);
    await expect(page.getByText('DOC and DOCX are saved as reference-only and are not analyzed.')).toBeVisible();
    const photoAction = page.getByRole('button', { name: 'Add photos' });
    const fileAction = page.getByRole('button', { name: 'Add files' });
    await expect(photoAction).not.toHaveClass(/rounded|border-tea-border/);
    await expect(fileAction).not.toHaveClass(/rounded|border-tea-border/);
    await page.keyboard.press('Shift+Tab');
    await expect(fileAction).toBeFocused();
    await expect(page.getByRole('button', { name: 'Add photos' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Add files' })).toHaveCount(1);
    await expect(page.locator('input[type="file"][aria-hidden="true"]')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const compassSurface = dialog.locator('xpath=../..');
    expect(await compassSurface.locator(':scope > *').filter({ hasNot: dialog }).evaluateAll(elements => elements.every(element => element.getAttribute('aria-hidden') === 'true' && element.hasAttribute('inert')))).toBe(true);
    await page.getByRole('button', { name: 'Close Import' }).click();
    await expect(trigger).toBeFocused();
    await expect(name).toHaveValue('Field tea');
    await expect(page.getByRole('tab', { name: 'Import', exact: true }).first()).toBeVisible();
  });

  test('analyzes pasted tea and teaware fragments into one editable vendor group', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Vendor list or invoice').fill('Ali Shan — 600 TWD\n? Red Jade\nClay pot — 2 units');
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
    await expect(page.getByLabel('Vendor list or invoice')).toBeVisible();
  });

  test('uses a category-aware final action for a teaware-only import', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Vendor list or invoice').fill('Clay pot — 2 units');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByTestId('import-item-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Add 1 teaware item to Inventory' }).click();
    const completion = page.getByRole('region', { name: 'Import complete' });
    await expect(completion.getByLabel('Connected records')).toBeVisible();
    await expect(completion.getByText('1 Library identity connected')).toBeVisible();
    await expect(completion.getByText('1 Inventory holding connected')).toBeVisible();
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
    await expect(page.getByLabel('Add files')).toHaveAttribute('accept', /pdf/);
    await page.getByLabel('Add photos').setInputFiles({ name: 'vendor-board.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo') });
    await page.getByLabel('Add files').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await expect(page.getByText('vendor-board.jpg')).toBeVisible();
    await expect(page.getByText('invoice.pdf')).toBeVisible();
    const readyEvidence = page.getByTestId('import-evidence-item').filter({ hasText: 'invoice.pdf' });
    await expect(readyEvidence).toHaveClass(/border-b/);
    await expect(readyEvidence).not.toHaveClass(/rounded|bg-tea-surface/);
    await page.getByLabel('Vendor list or invoice').fill('RETRY tea');
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Parser unavailable')).toBeVisible();
    await page.getByRole('button', { name: 'Retry import' }).click();
    await expect(page.getByText('RETRY tea', { exact: false })).toBeVisible();
    await expect(page.getByText('Analyzed').first()).toBeVisible();
    const analyzedEvidence = page.getByTestId('import-evidence-source').filter({ hasText: 'invoice.pdf' });
    await expect(analyzedEvidence).toHaveClass(/border-b/);
    await expect(analyzedEvidence).not.toHaveClass(/rounded|bg-tea-surface/);
    await expect(page.getByAltText('Evidence preview: vendor-board.jpg')).toBeVisible();
  });

  test('keeps pasted text and an uploaded text file as exactly one source each', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Vendor list or invoice').fill('Pasted vendor line');
    await page.getByLabel('Add files').setInputFiles({ name: 'vendor-list.txt', mimeType: 'text/plain', buffer: Buffer.from('Attached vendor line') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Analyzed').first()).toBeVisible();

    const state = importApiStateByPage.get(page)!;
    expect(state.createBodies).toHaveLength(1);
    expect(state.createBodies[0].pasted_text).toBe('Pasted vendor line');
    expect(state.sources.filter(source => source.pasted_text === 'Pasted vendor line')).toHaveLength(1);
    expect(state.sources.filter(source => (source.metadata as Record<string, unknown>)?.filename === 'vendor-list.txt')).toHaveLength(1);
    expect(JSON.stringify(state.createBodies[0])).not.toContain('Attached vendor line');
  });

  test('removes, replaces, and clears attachments before upload', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add files').setInputFiles([
      { name: 'first.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-first') },
      { name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-second') },
    ]);
    await page.getByRole('button', { name: 'Remove first.pdf' }).click();
    await expect(page.getByText('first.pdf')).toHaveCount(0);
    await page.getByLabel('Replace second.pdf').setInputFiles({ name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-replacement') });
    await expect(page.getByText('replacement.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Clear all attachments' }).click();
    await expect(page.getByLabel('Attached evidence')).toHaveCount(0);
  });

  test('recovers an account-scoped dirty draft and requires restored files to be reselected', async ({ page }) => {
    await openCompass(page);
    const trigger = page.getByRole('tab', { name: 'Import' }).first();
    await trigger.click();
    await page.getByLabel('Vendor list or invoice').fill('Saved vendor conversation');
    await page.getByRole('button', { name: 'Add sourcing run' }).click();
    await page.getByLabel('Sourcing run', { exact: true }).selectOption('journey-taiwan');
    await page.getByLabel('Add files').setInputFiles({ name: 'saved.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-saved') });
    await page.getByRole('button', { name: 'Close Import' }).click();
    const draftChoice = page.getByRole('group', { name: 'Keep import draft' });
    await expect(draftChoice).toBeVisible();
    await expect(draftChoice).toContainText('Files will need to be reselected');
    await expect(page.getByRole('button', { name: 'Keep draft' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Discard draft' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Close Import' })).toBeFocused();
    await page.getByRole('button', { name: 'Close Import' }).click();
    await page.getByRole('button', { name: 'Keep draft' }).click();

    await trigger.click();
    await expect(page.getByLabel('Vendor list or invoice')).toHaveValue('Saved vendor conversation');
    await expect(page.getByText('Taiwan · Spring · 2026')).toBeVisible();
    await expect(page.getByText('Reselect to upload')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start import' })).toBeEnabled();
    await page.getByRole('button', { name: 'Close Import' }).click();
    await page.getByRole('button', { name: 'Discard draft' }).click();

    await trigger.click();
    await expect(page.getByLabel('Vendor list or invoice')).toHaveValue('');
    await expect(page.getByText('saved.pdf')).toHaveCount(0);
  });

  test('preflights the Worker 5 MB limit and labels DOCX as reference-only', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await expect(page.getByText('DOC and DOCX are saved as reference-only and are not analyzed.')).toBeVisible();
    await page.getByLabel('Add files').setInputFiles({ name: 'too-large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6 * 1024 * 1024) });
    await expect(page.getByText('Files must be 5 MB or smaller')).toBeVisible();
    await page.getByLabel('Add files').setInputFiles({ name: 'vendor-notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK-docx') });
    await expect(page.getByText('Reference only · not analyzed')).toBeVisible();
  });

  test('extracts selected JSON into reviewed rows and keeps the original evidence retrievable', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    const original = '[{"name":"Ali Shan","price":600},{"name":"Red Jade","price":450}]';
    await page.getByLabel('Add files').setInputFiles({
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
    await page.getByLabel('Add files').setInputFiles({ name: 'not-a-tea.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByRole('alert').getByText('Evidence storage is not configured. Your file was not saved.')).toBeVisible();
    await expect(page.getByTestId('import-item-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry import' })).toBeVisible();
  });

  test('reloads persisted source outcomes after initial analysis failure and retries only failed evidence', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add files').setInputFiles({ name: 'retry-source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-retry') });
    await page.getByRole('button', { name: 'Start import' }).click();

    await expect(page.getByText('Analysis failed · analysis_evidence_unavailable')).toBeVisible();
    const retryRequest = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/curate/imports/batch-1/analyze') && request.postDataJSON()?.source_ids);
    await page.getByRole('button', { name: 'Retry import' }).click();
    expect((await retryRequest).postDataJSON()).toEqual({ source_ids: ['evidence-0'] });
  });

  test('recovers saved evidence and its grouped incomplete batch after reload', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add files').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invoice') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Analyzed', { exact: true })).toBeVisible();
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
    await page.getByLabel('Add files').setInputFiles({ name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-evidence') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('No analyzed teas yet. Retry analysis from this saved evidence.')).toBeVisible();
    const abandon = page.getByRole('button', { name: 'Abandon import' });
    await abandon.click();
    const confirmation = page.getByRole('group', { name: 'Abandon import confirmation' });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('permanently stop reviewing this import');
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
    let analysisAttempts = 0;
    const analysisBodies: Array<Record<string, unknown>> = [];
    const ordinal = { ordinal: 0, injectSecondFailure: true };
    evidenceOrdinalByPage.set(page, ordinal);
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/evidence')) { const id = request.headers()['x-client-evidence-id']; attempts.set(id, (attempts.get(id) || 0) + 1); }
      if (request.method() === 'POST' && request.url().endsWith('/analyze')) { analysisAttempts += 1; analysisBodies.push(request.postDataJSON() as Record<string, unknown>); }
    });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add photos').setInputFiles({ name: 'one.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('one') });
    await expect(page.getByText('one.jpg')).toBeVisible();
    const replacePicker = page.getByRole('button', { name: 'Replace attachment one.jpg' });
    await expect(replacePicker).toBeVisible();
    await replacePicker.focus();
    await expect(replacePicker).toBeFocused();
    await page.getByLabel('Add files').setInputFiles({ name: 'two.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-two') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect.poll(() => attempts.size, { message: `Expected both evidence requests; attempts=${JSON.stringify([...attempts])}` }).toBe(2);
    expect(ordinal.ordinal).toBe(2);
    await expect.poll(() => analysisAttempts).toBe(1);
    await expect(page.getByText('one.jpg')).toHaveCount(1);
    await expect(page.getByText('Analyzed', { exact: true })).toBeVisible();
    await expect(page.getByText('two.pdf')).toBeVisible();
    await expect(page.getByRole('alert').getByText('Temporary evidence failure')).toBeVisible();
    const failedEvidence = page.getByTestId('import-evidence-item').filter({ hasText: 'two.pdf' });
    await expect(failedEvidence).toHaveClass(/rounded-md/);
    await expect(failedEvidence).toHaveClass(/border-tea-border/);
    await page.getByRole('button', { name: 'Retry import' }).click();
    await expect(page.getByText('one.jpg')).toBeVisible();
    await expect(page.getByText('two.pdf')).toBeVisible();
    await expect.poll(() => [...attempts.values()].sort()).toEqual([1, 2]);
    await expect.poll(() => ordinal.ordinal).toBe(3);
    await expect.poll(() => analysisAttempts).toBe(2);
    expect(analysisBodies[1]).toEqual({ source_ids: ['evidence-1'] });
  });

  test('locks close, Escape, and import input across create, upload, and analyze', async ({ page }) => {
    let releaseCreate!: () => void;
    let releaseAnalyze!: () => void;
    const createGate = new Promise<void>(resolve => { releaseCreate = resolve; });
    const analyzeGate = new Promise<void>(resolve => { releaseAnalyze = resolve; });
    let analyzeReached = false;
    await page.route('**/api/curate/imports', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      await createGate;
      return route.fallback();
    });
    await page.route('**/api/curate/imports/batch-1/analyze', async route => {
      analyzeReached = true;
      await analyzeGate;
      return route.fallback();
    });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await page.getByLabel('Vendor list or invoice').fill('Locked tea');
    await page.getByLabel('Add files').setInputFiles({ name: 'locked.txt', mimeType: 'text/plain', buffer: Buffer.from('file tea') });
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(dialog.getByRole('button', { name: 'Close Import' })).toBeDisabled();
    await expect(dialog.getByLabel('Vendor list or invoice')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    releaseCreate();
    await expect.poll(() => analyzeReached).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Close Import' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    releaseAnalyze();
    await expect(dialog.getByRole('button', { name: 'Close Import' })).toBeEnabled();
  });

  test('preserves separately selected files with the same filename', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Add photos').setInputFiles({ name: 'same.evidence', mimeType: 'image/jpeg', buffer: Buffer.from('one') });
    await expect(page.getByText('same.evidence')).toBeVisible();
    await page.getByLabel('Add files').setInputFiles({ name: 'same.evidence', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-two') });
    await expect(page.getByText('same.evidence')).toHaveCount(2);
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByText('Analyzed').first()).toBeVisible();
  });

  test('keeps every row in a 30-item batch vertically reachable', async ({ page }) => {
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import' }).first().click();
    await page.getByLabel('Vendor list or invoice').fill(Array.from({ length: 30 }, (_, index) => `Tea ${index + 1}`).join('\n'));
    await page.getByRole('button', { name: 'Start import' }).click();
    await expect(page.getByTestId('import-batch-context')).toContainText('30 teas from 1 vendor');
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

  test('presents a vendor-led review and cycles through actual blockers', async ({ page }) => {
    const api = await installAnalyzedImportApi(page);
    api.detail.items[1].blocking_fields = ['english_name'];
    api.detail.items[1].confidence = 0.54;
    api.detail.items[1].uncertainty = { english_name: 'The translated name needs confirmation' };
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await expect(dialog.getByText('AI reading', { exact: true })).toBeVisible();
    const overview = dialog.getByText(api.detail.batch.analysis_overview!, { exact: true });
    await expect(overview).toHaveClass(/italic/);
    await expect(overview).not.toHaveClass(/border|rounded|bg-tea-surface/);
    await expect(dialog.getByTestId('import-batch-context')).toContainText('10 teas');
    await expect(dialog.getByTestId('import-batch-context')).toContainText('2 vendors');
    await expect(dialog.getByTestId('import-batch-context')).toContainText('10kg');
    await expect(dialog.getByTestId('import-batch-context')).toContainText('CNY 3,800');
    await expect(dialog.getByTestId('import-batch-context')).toContainText('TWD 6,000');

    const groups = dialog.getByTestId('import-vendor-group');
    const firstGroup = groups.first();
    const firstVendorName = firstGroup.getByRole('heading', { name: api.detail.groups[0].resolved_vendor_name! });
    await expect(firstVendorName).toHaveClass(/font-display/);
    await expect(firstVendorName).toHaveClass(/text-ui-28/);
    await expect(firstGroup).not.toHaveClass(/rounded|bg-tea-surface/);
    await expect(firstGroup.getByText('Needs review', { exact: true })).toHaveCount(1);
    await expect(firstGroup.getByText('Ready', { exact: true })).toHaveCount(1);
    const needsReviewSection = firstGroup.getByRole('region', { name: 'Needs review' });
    const readySection = firstGroup.getByRole('region', { name: 'Ready' });
    await expect(needsReviewSection).toBeVisible();
    await expect(readySection).toBeVisible();
    await expect(needsReviewSection.getByRole('heading', { name: 'Needs review', level: 5 })).toBeVisible();
    await expect(readySection.getByRole('heading', { name: 'Ready', level: 5 })).toBeVisible();

    const firstGroupRows = firstGroup.getByTestId('import-item-row');
    await expect(firstGroupRows.first()).toHaveAttribute('data-import-item-id', api.detail.items[1].id);
    await expect(firstGroupRows.first()).toHaveAttribute('data-blocked', 'true');
    await expect(firstGroupRows.nth(1)).toHaveAttribute('data-blocked', 'false');
    await expect(firstGroupRows.first()).toHaveAttribute('tabindex', '-1');
    await expect(firstGroupRows.first()).toHaveClass(/scroll-mt/);
    await expect(firstGroupRows.first().getByText(api.detail.items[1].english_name!, { exact: true })).toHaveClass(/font-display/);
    await expect(firstGroupRows.first().getByText(api.detail.items[1].english_name!, { exact: true })).toHaveClass(/text-ui-20/);
    await expect(firstGroupRows.first().getByRole('heading', { name: api.detail.items[1].english_name!, level: 6 })).toBeVisible();
    await expect(firstGroupRows.first()).toHaveAccessibleName(api.detail.items[1].english_name!);
    await expect(firstGroupRows.first().locator('.font-mono')).toHaveCount(1);

    const secondGroup = groups.nth(1);
    await expect(secondGroup.getByText('Needs review', { exact: true })).toHaveCount(1);
    await expect(secondGroup.getByText('Ready', { exact: true })).toHaveCount(1);
    await expect(secondGroup.getByTestId('import-item-row').first()).toHaveAttribute('data-import-item-id', api.detail.items[9].id);

    const nextIssue = dialog.getByRole('button', { name: 'Next issue' });
    await expect(dialog.getByText('2 unresolved', { exact: true })).toBeVisible();
    await nextIssue.click();
    const firstFocusedIssue = dialog.locator(`[data-import-item-id="${api.detail.items[1].id}"]`);
    await expect(firstFocusedIssue).toBeFocused();
    await expect(firstFocusedIssue).toHaveAccessibleName(api.detail.items[1].english_name!);
    await nextIssue.click();
    await expect(dialog.locator(`[data-import-item-id="${api.detail.items[9].id}"]`)).toBeFocused();
    await nextIssue.click();
    await expect(dialog.locator(`[data-import-item-id="${api.detail.items[1].id}"]`)).toBeFocused();
    await expect(dialog.getByRole('button', { name: /^Add 10 teas to Inventory/ })).toHaveCount(0);

    await firstGroup.getByRole('button', { name: /^Change vendor for / }).click();
    await expect(firstGroup.locator('.border-l-2')).toHaveCount(0);
    await expect(dialog.locator('.border-l-2')).toHaveCount(0);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });

  test('groups ten editable teas by vendor without repeated controls or overflow', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'Mobile Chrome') await page.setViewportSize({ width: 390, height: 844 });
    const api = await installAnalyzedImportApi(page);
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Import progress' })).toHaveAttribute('data-current-phase', 'review');
    await expect(page.getByRole('navigation', { name: 'Import progress' }).locator('[aria-current="step"]')).toHaveText('Review');
    await expect(page.getByText('Review 10 teas from 2 vendors', { exact: true })).toBeVisible();
    await expect(page.getByTestId('import-folio-shell').locator('header').getByText('1 need review', { exact: true })).toBeVisible();
    await expect(dialog.locator('select[aria-label="Sourcing run"]')).toHaveCount(0);
    await expect(dialog.getByText('No sourcing run')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add sourcing run' }).click();
    await expect(dialog.locator('select[aria-label="Sourcing run"]')).toHaveCount(1);
    const detailGetsBeforeJourneyChange = api.detailGetCalls();
    await dialog.getByLabel('Sourcing run', { exact: true }).selectOption('journey-taiwan');
    await expect.poll(api.journeyPutCalls).toBe(1);
    await expect.poll(api.detailGetCalls).toBeGreaterThan(detailGetsBeforeJourneyChange);
    await expect(dialog.locator('select[aria-label="Sourcing run"]')).toHaveCount(0);
    await expect(dialog.getByText('Taiwan · Spring · 2026')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Change sourcing run' })).toBeVisible();
    await expect(dialog.getByTestId('import-vendor-group')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: /^Change vendor for / })).toHaveCount(2);
    await expect(dialog.getByTestId('import-vendor-group').first().getByText('Needs review', { exact: true })).toHaveCount(0);
    await expect(dialog.getByTestId('import-vendor-group').first().getByText('Ready', { exact: true })).toHaveCount(1);
    await expect(dialog.getByText('Chen Family Ancient Tree Tea Cooperative of Xishuangbanna', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Lin Family High Mountain Tea Workshop, Nantou County', { exact: true })).toBeVisible();

    const changeActions = dialog.getByRole('button', { name: /^Change vendor for / });
    for (let index = 0; index < await changeActions.count(); index += 1) {
      expect(await changeActions.nth(index).evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(13);
    }

    const rows = dialog.getByTestId('import-item-row');
    await expect(rows).toHaveCount(10);
    const readyHeights = await dialog.locator('[data-blocked="false"]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    const blockedHeights = await dialog.locator('[data-blocked="true"]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    expect(Math.max(...readyHeights), 'ready collapsed review rows should stay compact').toBeLessThanOrEqual(120);
    expect(Math.max(...blockedHeights), 'rows listing required confirmations should stay compact').toBeLessThanOrEqual(150);
    for (let index = 0; index < analyzedTeaNames.length; index += 1) {
      const itemRow = dialog.locator(`[data-import-item-id="analyzed-item-${index + 1}"]`);
      await itemRow.scrollIntoViewIfNeeded();
      await expect(itemRow).toContainText(analyzedTeaNames[index][0]);
      await expect(itemRow).toContainText(analyzedTeaNames[index][1]);
    }

    const finalAction = dialog.getByRole('button', { name: /^Add 10 teas to Inventory/ });
    await expect(dialog.getByText('Confirm pack count, weight or unit, price interpretation, currency, tea identity, physical stock status, and Inventory purpose.')).toBeVisible();
    await expect(finalAction).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Next issue' })).toBeVisible();

    const readyRow = rows.nth(0);
    await readyRow.getByRole('button', { name: 'Edit tea' }).click();
    await readyRow.getByRole('button', { name: 'All details' }).click();
    await expect(readyRow.getByLabel(/English (inventory )?name/i)).toHaveValue('Yunnan Ancient Tree Raw Pu’er');
    await readyRow.getByLabel(/English (inventory )?name/i).fill('Yunnan Ancient Tree Raw Pu’er — Spring Lot');
    await expect(readyRow.getByLabel('Sourcing run')).toHaveCount(0);
    await expect(readyRow.getByRole('button', { name: /^Change vendor for / })).toHaveCount(0);
    await readyRow.getByRole('button', { name: 'Save tea' }).click();
    await expect(readyRow).toContainText('Yunnan Ancient Tree Raw Pu’er — Spring Lot');

    const uncertainRow = dialog.locator('[data-import-item-id="analyzed-item-10"]');
    await uncertainRow.scrollIntoViewIfNeeded();
    await uncertainRow.getByRole('button', { name: 'Edit tea' }).click();
    await expect(uncertainRow.getByRole('button', { name: 'All details' })).toBeVisible();
    await expect(uncertainRow.getByLabel('Tea type')).toHaveCount(0);
    await expect(uncertainRow.getByLabel('Production or classification')).toHaveCount(0);
    await uncertainRow.getByLabel('Pack count').fill('3');
    await uncertainRow.getByLabel('Inventory purpose').selectOption('working');
    await uncertainRow.getByLabel('Match tea').click();
    await uncertainRow.getByRole('option').filter({ hasText: 'Create new Library identity' }).click();
    await uncertainRow.getByLabel('Acquired into physical stock').selectOption('yes');
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
    await uncertainRow.getByRole('button', { name: 'Edit tea' }).click();
    await uncertainRow.getByRole('button', { name: 'All details' }).click();
    await expect(uncertainRow.getByLabel('Pack count')).toHaveValue('3');
    await expect(uncertainRow.getByLabel('Tea type')).toBeVisible();
    await expect(uncertainRow.getByLabel('Production or classification')).toBeVisible();
    await uncertainRow.getByRole('button', { name: 'Close editing' }).click();
    const uncertainCorrection = api.correctionBodies.find(body => body.name === analyzedTeaNames[9][0]);
    expect(uncertainCorrection).toBeTruthy();
    expect(uncertainCorrection?.parsed_data).toMatchObject({
      duplicateResolution: 'new', acquired: true, inventoryPurpose: 'working',
      proposedCompassEntryId: null, proposedProductId: null,
    });
    expect(uncertainCorrection?.reviewed_fields).toEqual([
      'packWeight', 'weightUnit', 'packCount', 'priceBasis', 'priceAmount', 'currency', 'acquired', 'identity',
    ]);
    expect(Object.keys(uncertainCorrection?.parsed_data as Record<string, unknown>).filter(key => !workerImportParsedDataKeys.has(key))).toEqual([]);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await finalAction.click();
    await expect.poll(api.finalizeCalls).toBe(1);
    const completion = dialog.getByRole('region', { name: 'Import complete' });
    await expect(completion).toBeVisible();
    await expect(completion.getByLabel('Connected records')).toBeVisible();
    await expect(completion.getByText('10 Library identities connected')).toBeVisible();
    await expect(completion.getByText('10 Inventory holdings connected')).toBeVisible();
    await expect(completion.getByRole('link', { name: /Open Inventory holding/ })).toHaveCount(10);
    await expect(completion.getByText(/2 vendor receipts/)).toBeVisible();
    await expect(completion.getByText('Library identity reused · Inventory holding reused')).toBeVisible();
    await expect(completion.getByText('Taiwan · Spring · 2026')).toBeVisible();
    await expect(completion.getByRole('link', { name: /Chen Family Ancient Tree Tea Cooperative.*receipt/ })).toHaveAttribute('href', '/admin/stock?receipt=receipt-chen');
    await expect(completion.getByRole('link', { name: /Lin Family High Mountain Tea Workshop.*receipt/ })).toHaveAttribute('href', '/admin/stock?receipt=receipt-lin');
    await expect(completion.getByRole('link', { name: /Open Library identity/ }).first()).toHaveAttribute('href', /\/admin\/compass\?tab=library&entry=/);
    await expect(page).toHaveURL(/\/admin\/compass/);
    await completion.getByRole('button', { name: 'Close summary' }).click();
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' }).getByLabel('Vendor list or invoice')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Import into Curate' }).getByTestId('import-item-row')).toHaveCount(0);
  });

  test('preserves active edits when vendor, identity, and holding lookups resolve late', async ({ page }) => {
    const gates = new Map<string, { promise: Promise<void>; release: () => void }>();
    for (const key of ['vendor', 'identity', 'holding']) {
      let release!: () => void;
      gates.set(key, { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() });
    }
    const lookupResponses = new Map<string, number>();
    const delayed = (key: string, body: unknown) => async (route: Route) => {
      await gates.get(key)!.promise;
      lookupResponses.set(key, (lookupResponses.get(key) ?? 0) + 1);
      return route.fulfill({ json: body });
    };
    await installAnalyzedImportApi(page);
    await page.route('**/api/customers', delayed('vendor', [{ id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] }]));
    await page.route('**/api/compass/entries', delayed('identity', { entries: [{ id: 'identity-yunnan', name: 'Yunnan Tea', category: 'tea' }] }));
    await page.route('**/api/products', delayed('holding', [{ id: 'holding-yunnan', given_name: 'Yunnan holding', type: 'tea', source_compass_entry_id: 'identity-yunnan', inventory_purpose: 'working' }]));
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const row = page.getByRole('dialog', { name: 'Import into Curate' }).getByTestId('import-item-row').first();
    await row.getByRole('button', { name: 'Edit tea' }).click();
    await row.getByRole('button', { name: 'All details' }).click();
    const name = row.getByLabel('English inventory name');
    await name.fill('Typed while matching');

    for (const key of ['vendor', 'identity', 'holding']) {
      gates.get(key)!.release();
      await expect.poll(() => lookupResponses.get(key) ?? 0).toBeGreaterThanOrEqual(1);
      await expect(name).toHaveValue('Typed while matching');
    }
    await expect(row.getByRole('button', { name: 'Close editing' })).toBeVisible();
  });

  test('promotes naming blockers and referenced image or PDF evidence before all details', async ({ page }) => {
    const api = await installAnalyzedImportApi(page);
    const item = api.detail.items[0];
    item.raw_text = null as unknown as string;
    item.blocking_fields = ['english_name'];
    item.parsed_data.evidenceRefs = ['source-analyzed:page=2'];
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const row = page.getByRole('dialog', { name: 'Import into Curate' }).getByTestId('import-item-row').first();
    await row.getByRole('button', { name: 'Edit tea' }).click();
    await expect(row.getByLabel('English inventory name')).toBeVisible();
    await expect(row.getByLabel('Original or Chinese name')).toBeVisible();
    await expect(row.getByText(/source-analyzed · Page 2/)).toBeVisible();
    await expect(row.getByRole('button', { name: 'All details' })).toBeVisible();
  });

  test('searches ranked vendor, Library identity, and compatible Inventory holding matches', async ({ page }) => {
    const api = await installAnalyzedImportApi(page);
    const proposedItem = api.detail.items[9];
    proposedItem.proposed_compass_entry_id = 'identity-jingmai';
    proposedItem.proposed_product_id = 'holding-working';
    Object.assign(proposedItem.parsed_data, { proposedCompassEntryId: 'identity-jingmai', proposedProductId: 'holding-working', duplicateResolution: 'matched' });
    await page.route(/\/api\/customers(?:\?|$)/, route => route.fulfill({ json: [
      { id: 'vendor-other', name: 'Mountain Tea Market' },
      { id: 'vendor-chen', name: 'Chen Family Ancient Tree Tea Cooperative of Xishuangbanna' },
    ] }));
    await page.route('**/api/compass/entries', route => route.fulfill({ json: { entries: [
      { id: 'identity-jingmai', name: 'Jingmai Mountain Raw Pu’er', chinese_name: '景迈山生普', category: 'tea', year: 2026 },
      { id: 'identity-yiwu', name: 'Yiwu Old Arbor Raw Pu’er', chinese_name: '易武古树生茶', category: 'tea', year: 2025 },
      { id: 'identity-pot', name: 'Jingmai clay pot', category: 'teaware' },
    ] } }));
    await page.route('**/api/products', route => route.fulfill({ json: [
      { id: 'holding-working', given_name: 'Jingmai service holding', type: 'tea', source_compass_entry_id: 'identity-jingmai', inventory_purpose: 'working' },
      { id: 'holding-personal', given_name: 'Jingmai personal holding', type: 'tea', source_compass_entry_id: 'identity-jingmai', inventory_purpose: 'personal' },
    ] }));
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await dialog.getByRole('button', { name: /^Change vendor for Chen Family/ }).click();
    const vendorSearch = dialog.getByRole('combobox', { name: /^Vendor for Chen Family/ });
    await vendorSearch.fill('Chen');
    await expect(dialog.getByRole('listbox', { name: /Vendor .* matches/ }).getByRole('option').first()).toContainText('Closest existing match');
    await vendorSearch.press('ArrowDown');
    await vendorSearch.press('Enter');

    const row = dialog.locator('[data-import-item-id="analyzed-item-10"]');
    await row.getByRole('button', { name: 'Edit tea' }).click();
    await expect(row.getByText('Suggested: Jingmai Mountain Raw Pu’er')).toBeVisible();
    const holdingPicker = row.getByRole('combobox', { name: 'Choose stock record' });
    await holdingPicker.click();
    await expect(row.getByRole('option').filter({ hasText: 'Jingmai service holding' })).toHaveCount(0);
    await expect(row.getByRole('option').filter({ hasText: 'Create new Inventory holding' })).toBeVisible();
    await holdingPicker.press('Escape');
    const identityPicker = row.getByRole('combobox', { name: 'Match tea' });
    await identityPicker.click();
    await expect(identityPicker).toHaveAttribute('aria-expanded', 'true');
    await identityPicker.press('Tab');
    await expect(identityPicker).toHaveAttribute('aria-expanded', 'false');
    await identityPicker.click();
    await row.getByRole('option').filter({ hasText: 'Jingmai Mountain Raw Pu’er' }).click();
    await row.getByLabel('Inventory purpose').selectOption('working');
    await holdingPicker.click();
    await expect(row.getByRole('option').filter({ hasText: 'Jingmai service holding' })).toBeVisible();
    await expect(row.getByRole('option').filter({ hasText: 'Jingmai personal holding' })).toHaveCount(0);
    await row.getByRole('option').filter({ hasText: 'Jingmai service holding' }).click();
    await expect(row.getByText('Selected: Jingmai service holding')).toBeVisible();
    await row.getByLabel('Inventory purpose').selectOption('personal');
    await expect(row.getByText('Selected: Jingmai service holding')).toHaveCount(0);
  });

  test('shows failed lookup retries and blocks vendor creation until reuse lookup succeeds', async ({ page }) => {
    await installAnalyzedImportApi(page);
    let vendorAvailable = false;
    await page.route(/\/api\/customers(?:\?|$)/, route => {
      if (!vendorAvailable) return route.fulfill({ status: 400, json: { error: 'Vendor lookup unavailable' } });
      return route.fulfill({ json: [{ id: 'vendor-chen', name: 'Chen Family Tea' }] });
    });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await dialog.getByRole('button', { name: /^Change vendor for Chen Family/ }).click();
    const lookupAlert = dialog.getByRole('alert').filter({ hasText: 'Vendor lookup unavailable' });
    await expect(lookupAlert).toBeVisible();
    await expect(dialog.getByLabel('Create new vendor')).toBeDisabled();
    vendorAvailable = true;
    await lookupAlert.getByRole('button', { name: 'Retry' }).click();
    await expect(dialog.getByRole('combobox', { name: /^Vendor for Chen Family/ })).toBeEnabled({ timeout: 15_000 });
    await expect(dialog.getByLabel('Create new vendor')).toBeEnabled();
  });

  test('distinguishes failed and empty sourcing-run lookups and retries without making a run required', async ({ page }) => {
    await installAnalyzedImportApi(page);
    let journeyAvailable = false;
    await page.route('**/api/curate/journeys', route => {
      if (!journeyAvailable) return route.fulfill({ status: 400, json: { error: 'Sourcing run lookup unavailable' } });
      return route.fulfill({ json: { journeys: [] } });
    });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await dialog.getByRole('button', { name: 'Add sourcing run' }).click();
    const lookupAlert = dialog.getByRole('alert').filter({ hasText: 'Sourcing run lookup unavailable' });
    await expect(lookupAlert).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create new sourcing run' })).toBeDisabled();
    journeyAvailable = true;
    await lookupAlert.getByRole('button', { name: 'Retry' }).click();
    await expect(dialog.getByText('No existing sourcing runs.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create new sourcing run' })).toBeEnabled();
    await expect(dialog.getByLabel('Sourcing run', { exact: true })).toHaveValue('');
  });

  test('disables every conflicting review control while an item save is active', async ({ page }) => {
    const api = await installAnalyzedImportApi(page);
    let releaseSave!: () => void;
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
    await page.route('**/api/curate/imports/batch-analyzed/items/analyzed-item-1', async route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      await saveGate;
      const updates = route.request().postDataJSON() as Record<string, unknown>;
      Object.assign(api.detail.items[0], updates);
      return route.fulfill({ json: api.detail.items[0] });
    });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    const first = dialog.getByTestId('import-item-row').first();
    await first.getByRole('button', { name: 'Edit tea' }).click();
    await first.getByRole('button', { name: 'Save tea' }).click();
    await expect(first.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(dialog.getByTestId('import-item-row').nth(1).getByRole('button', { name: 'Edit tea' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: /^Change vendor for / }).first()).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Next issue' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close Import' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    releaseSave();
    await expect(first.getByRole('button', { name: 'Edit tea' })).toBeEnabled();
  });

  test('persists an explicitly cleared proposed holding after purpose makes it incompatible', async ({ page }) => {
    const api = await installAnalyzedImportApi(page);
    const firstItem = api.detail.items[0];
    firstItem.proposed_compass_entry_id = 'identity-yunnan';
    firstItem.proposed_product_id = 'holding-working';
    Object.assign(firstItem.parsed_data, { proposedCompassEntryId: 'identity-yunnan', proposedProductId: 'holding-working', duplicateResolution: 'matched' });
    await page.route('**/api/compass/entries', route => route.fulfill({ json: { entries: [{ id: 'identity-yunnan', name: 'Yunnan Ancient Tree Raw Pu’er', category: 'tea' }] } }));
    await page.route('**/api/products', route => route.fulfill({ json: [{ id: 'holding-working', given_name: 'Yunnan service holding', type: 'tea', source_compass_entry_id: 'identity-yunnan', inventory_purpose: 'working' }] }));
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const row = page.getByRole('dialog', { name: 'Import into Curate' }).getByTestId('import-item-row').first();
    await row.getByRole('button', { name: 'Edit tea' }).click();
    await row.getByRole('button', { name: 'All details' }).click();
    await expect(row.getByText('Selected: Yunnan service holding')).toBeVisible();
    await row.getByLabel('Inventory purpose').selectOption('personal');
    await expect(row.getByText('Selected: Yunnan service holding')).toHaveCount(0);
    await row.getByRole('button', { name: 'Save tea' }).click();
    const correction = api.correctionBodies.find(body => body.name === firstItem.english_name);
    expect(correction?.parsed_data).toMatchObject({ proposedCompassEntryId: 'identity-yunnan', proposedProductId: null });
  });

  test('locks import input while a sourcing run is being created', async ({ page }) => {
    let releaseCreate!: () => void;
    const createGate = new Promise<void>(resolve => { releaseCreate = resolve; });
    let importCreates = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/curate/imports') importCreates += 1; });
    await page.route('**/api/curate/journeys', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      await createGate;
      return route.fulfill({ json: { id: 'journey-new', account_id: 'acct-bali', name: 'Yunnan run', year: 2026 } });
    });
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await dialog.getByLabel('Vendor list or invoice').fill('Tea one');
    await dialog.getByRole('button', { name: 'Add sourcing run' }).click();
    await dialog.getByRole('button', { name: 'Create new sourcing run' }).click();
    await dialog.getByLabel('New sourcing run name').fill('Yunnan run');
    await dialog.getByRole('button', { name: 'Create run' }).click();
    await expect(dialog.getByLabel('Vendor list or invoice')).toBeDisabled();
    await expect(dialog.locator('button').filter({ hasText: 'Add photos' })).toBeDisabled();
    await expect(dialog.locator('button').filter({ hasText: 'Add files' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Start import' })).toBeDisabled();
    expect(importCreates).toBe(0);
    releaseCreate();
    await expect(dialog.getByLabel('Vendor list or invoice')).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Start import' })).toBeEnabled();
  });

  test('keeps every visible import input at 16px on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'iOS-style focus zoom is a mobile-only constraint');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/curate/imports?state=incomplete', route => route.fulfill({ json: { imports: [] } }));
    await openCompass(page);
    await page.getByRole('tab', { name: 'Import', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Import into Curate' });
    await dialog.getByRole('button', { name: 'Add sourcing run' }).click();
    await expect(dialog.locator('select[aria-label="Sourcing run"]')).toHaveCount(1);
    const controls = dialog.locator('input:visible, textarea:visible, select:visible');
    await expect(controls.first()).toBeVisible();
    const controlFontSizes = await controls.evaluateAll(elements =>
      elements.map(element => ({ label: element.getAttribute('aria-label') || element.getAttribute('name') || element.tagName, size: Number.parseFloat(getComputedStyle(element).fontSize) })),
    );
    expect(controlFontSizes.filter(control => control.size < 16), `Mobile import controls below 16px: ${JSON.stringify(controlFontSizes)}`).toEqual([]);
  });
});
