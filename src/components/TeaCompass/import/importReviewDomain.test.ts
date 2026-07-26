import { describe, expect, it } from 'vitest';
import type { CurateImportDetail, CurateImportItem } from '../../../lib/api';
import { buildImportCorrectionParsedData, buildImportReviewModel, importBlockingMessage, importDisposition, importFinalActionLabel, normalizeImportDetail, reviewedFieldsForImportSave } from './importReviewDomain';
import { compatibleImportHoldings, filterImportJourneys, importFieldNeedsConfirmation, importItemNoun, importQuantityCostEquation, inventoryTargetFromFinalize, rankImportMatches, resolveImportBlockingFields, validateImportHoldingSelection, withoutImportDerivedFields } from './importReviewDomain';

const item = (overrides: Partial<CurateImportItem> = {}): CurateImportItem => ({
  id: 'item-1', batch_id: 'batch-1', source_id: null, vendor_group_id: 'group-1', position: 0,
  category: 'tea', name: 'Yunnan Raw Pu’er', english_name: 'Yunnan Raw Pu’er', original_name: '云南古树生普',
  raw_text: '500g ×2 ¥380', parsed_data: { inventoryPurpose: 'working' }, confidence: 0.94, uncertainty: {}, blocking_fields: [],
  pack_weight: 500, weight_unit: 'g', pack_count: 2, price_amount: 380, currency: 'CNY',
  price_basis: 'per_pack', total_quantity_grams: 1000, total_units: null, line_cost: 760, unit_cost: 0.76,
  review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: 'reserved-1',
  acquired: true,
  ...overrides,
});

const detail = (overrides: Partial<CurateImportDetail> = {}): CurateImportDetail => ({
  batch: { id: 'batch-1', title: 'Kunming list', review_state: 'reviewing', journey_id: null, visit_id: null, analysis_state: 'completed', analysis_overview: 'Three teas found.' },
  sources: [],
  groups: [
    { id: 'group-2', batch_id: 'batch-1', position: 2, proposed_vendor_name: 'Second Vendor', resolved_vendor_customer_id: null, resolved_vendor_name: null, confidence: 0.52, uncertainty: { vendor: 'No strong match' } },
    { id: 'group-1', batch_id: 'batch-1', position: 1, proposed_vendor_name: 'Chen Family Tea', resolved_vendor_customer_id: 'vendor-1', resolved_vendor_name: 'Chen Family Tea', confidence: 0.96, uncertainty: {} },
  ],
  items: [
    item(),
    item({ id: 'item-2', vendor_group_id: 'group-2', position: 1, english_name: 'White Moonlight', currency: 'USD', line_cost: 24, total_quantity_grams: 200, blocking_fields: ['price_basis'] }),
    item({ id: 'item-3', vendor_group_id: 'group-1', position: 2, english_name: 'Jingmai Cake', line_cost: 420, total_quantity_grams: 357 }),
  ],
  ...overrides,
});

describe('buildImportReviewModel', () => {
  it('orders vendor groups and partitions ready items from items needing review', () => {
    const model = buildImportReviewModel(detail());
    expect(model.groups.map(group => group.id)).toEqual(['group-1', 'group-2']);
    expect(model.groups[0].items.map(row => row.item.id)).toEqual(['item-1', 'item-3']);
    expect(model.readyCount).toBe(2);
    expect(model.needsReviewCount).toBe(1);
  });

  it('totals physical quantity and keeps original currencies separate', () => {
    const model = buildImportReviewModel(detail());
    expect(model.totalQuantityGrams).toBe(1557);
    expect(model.currencyTotals).toEqual([{ currency: 'CNY', amount: 1180 }, { currency: 'USD', amount: 24 }]);
  });

  it('suppresses a currency aggregate when an exact-only line cannot safely participate', () => {
    const model = buildImportReviewModel(detail({
      groups: [detail().groups[1]],
      items: [
        item({ id: 'safe', line_cost: 20, currency: 'USD' }),
        item({
          id: 'exact-only', position: 1, line_cost: null, line_cost_exact: '999999999999999.99', currency: 'USD',
          parsed_data: { inventoryPurpose: 'working', lineCost: null, lineCostExact: '999999999999999.99' },
        }),
      ],
    }));

    expect(model.currencyTotals).toEqual([]);
  });

  it('requires every vendor group and blocking item field to be resolved', () => {
    expect(buildImportReviewModel(detail()).canFinalize).toBe(false);
    const resolved = detail({
      groups: detail().groups.map(group => ({ ...group, resolved_vendor_customer_id: group.resolved_vendor_customer_id || 'vendor-2', resolved_vendor_name: group.resolved_vendor_name || 'Second Vendor' })),
      items: detail().items.map(row => ({ ...row, blocking_fields: [] })),
    });
    expect(buildImportReviewModel(resolved).canFinalize).toBe(true);
  });

  it('requires inventoryPurpose to exactly match a finalizer-supported value', () => {
    const missing = detail({ items: [item({ parsed_data: {} })], groups: [detail().groups[1]] });
    expect(buildImportReviewModel(missing)).toMatchObject({ readyCount: 0, needsReviewCount: 1, canFinalize: false });
    expect(buildImportReviewModel(detail({ items: [item({ parsed_data: { inventoryPurpose: 'service' as never } })], groups: [detail().groups[1]] })).canFinalize).toBe(false);
    expect(buildImportReviewModel(detail({ items: [item({ parsed_data: { inventoryPurpose: 'sample' } })], groups: [detail().groups[1]] })).canFinalize).toBe(true);
  });

  it('requires purpose and a holding only for stock-bearing dispositions', () => {
    const libraryOnly = item({
      parsed_data: { disposition: 'library_only', inventoryPurpose: null, proposedProductId: null },
      acquired: false,
      vendor_group_id: 'group-2',
      blocking_fields: ['vendor', 'inventoryPurpose', 'productId', 'acquired'],
    });
    expect(buildImportReviewModel(detail({ items: [libraryOnly], groups: [detail().groups[0]] }))).toMatchObject({
      readyCount: 1,
      needsReviewCount: 0,
      canFinalize: true,
      groups: [{ vendorResolved: true, vendorRequired: false }],
    });

    const inTransit = item({
      parsed_data: { disposition: 'in_transit', inventoryPurpose: null, proposedProductId: null },
      acquired: false,
      blocking_fields: ['inventoryPurpose', 'productId', 'acquired'],
    });
    expect(buildImportReviewModel(detail({ items: [inTransit], groups: [detail().groups[1]] }))).toMatchObject({
      readyCount: 0,
      needsReviewCount: 1,
      canFinalize: false,
    });
  });
});

describe('importBlockingMessage', () => {
  it('names the exact physical-stock corrections required', () => {
    expect(importBlockingMessage(item({ blocking_fields: ['pack_count', 'weight_unit', 'price_basis', 'currency'] })))
      .toBe('Confirm pack count, weight or unit, price interpretation, and currency.');
  });

  it('does not treat descriptive uncertainty as blocking', () => {
    expect(importBlockingMessage(item({ uncertainty: { description: 'Translation could be refined' }, blocking_fields: [] }))).toBeNull();
  });

  it('uses an explicit or backwards-compatible received disposition instead of a physical-stock blocker', () => {
    expect(importBlockingMessage(item({ blocking_fields: ['duplicateIdentity', 'productId', 'acquisitionState'] })))
      .toBe('Confirm tea identity and Inventory holding.');
  });

  it('uses category-aware identity wording and disposition wording', () => {
    expect(importBlockingMessage(item({ category: 'teaware', acquired: false, blocking_fields: ['duplicateIdentity', 'disposition'] })))
      .toBe('Confirm teaware identity and destination.');
  });
});

describe('continuous import review presentation', () => {
  it('keeps the exact Chinese example values in a quiet quantity-cost equation', () => {
    expect(importQuantityCostEquation(item({
      original_name: '陈年六堡茶', chinese_name: '陈年六堡茶', pack_weight: 500, weight_unit: 'g', pack_count: 1,
      total_quantity_grams: 500, price_amount: 380, price_amount_exact: '380', price_basis: 'line_total',
      line_cost: 380, line_cost_exact: '380', currency: 'CNY',
    }))).toBe('500g × 1 = 500g · CNY 380 total');
  });

  it('maps canonical and legacy blocker aliases only to their unresolved controls', () => {
    const blockers = ['english_name', 'priceBasis', 'duplicate_identity'];
    expect(importFieldNeedsConfirmation('englishName', blockers)).toBe(true);
    expect(importFieldNeedsConfirmation('priceBasis', blockers)).toBe(true);
    expect(importFieldNeedsConfirmation('identity', blockers)).toBe(true);
    expect(importFieldNeedsConfirmation('chineseName', blockers)).toBe(false);
    expect(importFieldNeedsConfirmation('currency', blockers)).toBe(false);
  });
});

describe('review navigation and journey helpers', () => {
  it('ranks a proposed vendor name ahead of weaker searchable matches', () => {
    const ranked = rankImportMatches([
      { id: 'other', name: 'Mountain Tea Market' },
      { id: 'chen', name: 'Chen Family Tea' },
      { id: 'chen-coop', name: 'Chen Family Tea Cooperative' },
    ], 'family', 'Chen Family Tea Cooperative');
    expect(ranked.map(option => option.id)).toEqual(['chen-coop', 'chen']);
    expect(ranked[0].matchReason).toBe('Closest existing match');
  });

  it('filters holdings to the selected identity, category, and purpose', () => {
    expect(compatibleImportHoldings([
      { id: 'working', name: 'Jingmai service tea', category: 'tea', compassEntryId: 'identity-1', purpose: 'working' },
      { id: 'personal', name: 'Jingmai archive', category: 'tea', compassEntryId: 'identity-1', purpose: 'personal' },
      { id: 'other-entry', name: 'Other tea', category: 'tea', compassEntryId: 'identity-2', purpose: 'working' },
      { id: 'pot', name: 'Jingmai pot', category: 'teaware', compassEntryId: 'identity-1', purpose: 'working' },
      { id: 'unknown-purpose', name: 'Unclassified Jingmai', category: 'tea', compassEntryId: 'identity-1', purpose: null },
    ], { category: 'tea', compassEntryId: 'identity-1', purpose: 'working' }).map(option => option.id)).toEqual(['working']);
    expect(compatibleImportHoldings([
      { id: 'unrelated', name: 'Unrelated holding', category: 'tea', compassEntryId: 'identity-2', purpose: 'working' },
    ], { category: 'tea', compassEntryId: null, purpose: 'working' })).toEqual([]);
  });

  it('clears a selected holding when its Library identity changes', () => {
    expect(validateImportHoldingSelection('holding-1', [
      { id: 'holding-1', name: 'Service tea', category: 'tea', compassEntryId: 'identity-1', purpose: 'working' },
    ], { category: 'tea', compassEntryId: 'identity-2', purpose: 'working' })).toBe('');
  });

  it('clears a selected holding when its Inventory purpose changes but preserves new holding intent', () => {
    const holdings = [{ id: 'holding-1', name: 'Service tea', category: 'tea' as const, compassEntryId: 'identity-1', purpose: 'working' }];
    expect(validateImportHoldingSelection('holding-1', holdings, { category: 'tea', compassEntryId: 'identity-1', purpose: 'personal' })).toBe('');
    expect(validateImportHoldingSelection('new', holdings, { category: 'tea', compassEntryId: 'identity-1', purpose: 'personal' })).toBe('new');
  });

  it('searches sourcing runs by name, season, or year', () => {
    const journeys = [
      { id: 'spring', account_id: 'a', name: 'Yunnan sourcing', season: 'Spring', year: 2026 },
      { id: 'winter', account_id: 'a', name: 'Taiwan visit', season: 'Winter', year: 2025 },
    ];
    expect(filterImportJourneys(journeys, '2026').map(journey => journey.id)).toEqual(['spring']);
    expect(filterImportJourneys(journeys, 'winter').map(journey => journey.id)).toEqual(['winter']);
  });

  it('opens the first created Inventory holding after finalization', () => {
    expect(inventoryTargetFromFinalize({ batchId: 'b', idempotencyKey: 'k', journey: null, receipts: [], items: [{ id: 'i', compassEntryId: 'c', productId: 'product-7', movementId: 'm', identityDisposition: 'created', holdingDisposition: 'created' }] })).toBe('product-7');
    expect(inventoryTargetFromFinalize({ batchId: 'b', idempotencyKey: 'k', journey: null, receipts: [], items: [] })).toBeNull();
  });

  it('skips Library-only results when choosing an Inventory destination', () => {
    expect(inventoryTargetFromFinalize({ batchId: 'b', idempotencyKey: 'k', journey: null, receipts: [], items: [
      { id: 'library', compassEntryId: 'c-1', productId: null, movementId: null, identityDisposition: 'created', holdingDisposition: null },
      { id: 'transit', compassEntryId: 'c-2', productId: 'product-2', movementId: null, identityDisposition: 'created', holdingDisposition: 'created' },
    ] })).toBe('product-2');
  });

  it('keeps explicit identity and holding blockers until the user confirms a suggestion', () => {
    expect(resolveImportBlockingFields(['packCount', 'priceBasis', 'duplicateIdentity', 'productId', 'acquisitionState', 'year'], {
      packCount: 2, priceBasis: 'per_pack', duplicateResolution: 'new', proposedCompassEntryId: null, proposedProductId: null, acquired: true,
    })).toEqual(['duplicateIdentity', 'productId', 'year']);
    expect(resolveImportBlockingFields(['duplicateIdentity', 'productId', 'inventoryPurpose'], {
      disposition: 'in_transit', inventoryPurpose: 'working', identityResolution: { kind: 'new' }, holdingResolution: { kind: 'new' },
    })).toEqual(['duplicateIdentity', 'productId']);
  });

  it('omits derived arithmetic and blockers from correction payloads', () => {
    expect(withoutImportDerivedFields({ englishName: 'Tea', unknownMetadata: true, totalQuantityGrams: 1000, lineCost: 80, unitCost: 0.08, blockingFields: ['priceBasis'] }))
      .toEqual({ englishName: 'Tea' });
  });

  it('builds correction payloads with only canonical Worker identity and stock keys', () => {
    const payload = buildImportCorrectionParsedData({ sourceItemId: 'source-1', teaType: 'legacy', compassEntryId: 'legacy', productId: 'legacy', acquiredIntoStock: true }, {
      englishName: 'Tea', originalName: 'Supplier title', chineseName: '茶', type: 'raw puer', classification: null, year: 2024, form: 'cake',
      originRegion: 'Yunnan', description: null, inventoryPurpose: 'working', compassSelection: 'compass-1',
      productSelection: 'product-1', disposition: 'received', acquired: true, packWeight: 357, weightUnit: 'g', packCount: 1,
      priceAmount: '80', currency: 'CNY', priceBasis: 'per_pack',
    });
    expect(payload).toMatchObject({
      originalName: 'Supplier title', chineseName: '茶', type: 'raw puer', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1', disposition: 'received', acquired: true, duplicateResolution: 'matched',
      identityResolution: { kind: 'existing', compassEntryId: 'compass-1' },
      holdingResolution: { kind: 'existing', productId: 'product-1' },
    });
    expect(payload).not.toHaveProperty('teaType');
    expect(payload).not.toHaveProperty('compassEntryId');
    expect(payload).not.toHaveProperty('productId');
    expect(payload).not.toHaveProperty('acquiredIntoStock');
  });

  it('serializes fractional price corrections as canonical decimal strings', () => {
    const payload = buildImportCorrectionParsedData({ sourceItemId: 'source-1', confidence: { priceAmount: 0.4 } }, {
      englishName: 'Tea', originalName: null, type: null, classification: null, year: null, form: null,
      originRegion: null, description: null, inventoryPurpose: 'working', compassSelection: 'new', productSelection: 'new',
      disposition: 'received', acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1, priceAmount: '21.500', currency: 'USD', priceBasis: 'line_total',
    });
    expect(payload).toMatchObject({ priceAmount: '21.5', priceAmountExact: '21.5' });
    expect(typeof payload.priceAmount).toBe('string');
  });

  it('promotes Worker identity and stock fields into normalized editor aliases', () => {
    const normalized = normalizeImportDetail(detail({ items: [item({ parsed_data: {
      inventoryPurpose: 'personal', proposedCompassEntryId: 'compass-2', proposedProductId: 'product-2',
      acquired: true, duplicateResolution: 'matched',
    } })] }));
    expect(normalized.items[0]).toMatchObject({
      proposed_compass_entry_id: 'compass-2', proposed_product_id: 'product-2', acquired: true, duplicate_resolution: 'matched',
    });
    const canonical = normalizeImportDetail(detail({ items: [item({ proposed_compass_entry_id: null, proposed_product_id: null, duplicate_resolution: null, parsed_data: {
      disposition: 'in_transit', inventoryPurpose: 'sample', identityResolution: { kind: 'existing', compassEntryId: 'compass-3' }, holdingResolution: { kind: 'existing', productId: 'product-3' },
    } })] }));
    expect(canonical.items[0]).toMatchObject({
      proposed_compass_entry_id: 'compass-3', proposed_product_id: 'product-3', duplicate_resolution: 'matched', disposition: 'in_transit',
    });
  });

  it('prefers current canonical names over stale item columns', () => {
    const normalized = normalizeImportDetail(detail({ items: [item({
      english_name: 'Stale English', original_name: 'Stale supplier name', chinese_name: '旧中文',
      parsed_data: { inventoryPurpose: 'working', englishName: 'Reviewed English', originalName: 'Reviewed supplier name', chineseName: '当前中文' },
    })] }));
    expect(normalized.items[0]).toMatchObject({
      english_name: 'Reviewed English', original_name: 'Reviewed supplier name', chinese_name: '当前中文',
    });
  });

  it('normalizes persisted batch annotation JSON into typed annotations', () => {
    const normalized = normalizeImportDetail(detail({ batch: {
      ...detail().batch,
      analysis_annotations_json: JSON.stringify([{ kind: 'shipping_or_fee', label: 'Shipping', amountExact: '20', currency: 'CNY', sourceExcerpt: '运费 20元' }]),
    } }));
    expect(normalized.batch.analysis_annotations).toEqual([
      { kind: 'shipping_or_fee', label: 'Shipping', amountExact: '20', currency: 'CNY', sourceExcerpt: '运费 20元' },
    ]);
  });

  it('exposes exact prices for collapsed display when no safe numeric value exists', () => {
    const normalized = normalizeImportDetail(detail({ items: [item({ price_amount: null, parsed_data: {
      inventoryPurpose: 'working', priceAmount: null, priceAmountExact: '999999999999999.99', lineCost: null, lineCostExact: '999999999999999.99',
    } })] }));
    expect(normalized.items[0]).toMatchObject({ price_amount: null, price_amount_exact: '999999999999999.99' });
  });

  it('affirms a blocked identity only when Save has an explicit identity or holding selection', () => {
    const blocked = item({ blocking_fields: ['identity'], proposed_compass_entry_id: 'compass-1', proposed_product_id: 'product-1' });
    expect(reviewedFieldsForImportSave(blocked, 'compass-1', 'product-1', false, [])).toEqual([]);
    expect(reviewedFieldsForImportSave(blocked, 'compass-1', 'product-1', true, [])).toEqual(['identity']);
    expect(reviewedFieldsForImportSave(blocked, '', '', true, [])).toEqual([]);
    expect(reviewedFieldsForImportSave(item(), 'new', 'new', true, [])).toEqual([]);
  });

  it('confirms every visible material field even when a correct low-confidence value is unchanged', () => {
    const blocked = item({ blocking_fields: ['english_name', 'pack_weight', 'price_amount', 'acquired'] });
    const visible = ['englishName', 'packWeight', 'weightUnit', 'packCount', 'priceBasis', 'priceAmount', 'currency', 'acquired'] as const;
    expect(reviewedFieldsForImportSave(blocked, '', '', false, [...visible])).toEqual(visible);
  });

  it('does not confirm hidden material fields that the editor did not show', () => {
    const blocked = item({ blocking_fields: ['price_amount'] });
    expect(reviewedFieldsForImportSave(blocked, '', '', false, ['priceAmount', 'currency', 'priceBasis'])).toEqual(['priceAmount', 'currency', 'priceBasis']);
  });

  it('preserves proposed identity resolution on an unrelated untouched Save', () => {
    const parsed = { sourceItemId: 'source-1', duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1' };
    const payload = buildImportCorrectionParsedData(parsed, {
      englishName: 'Edited tea', originalName: null, type: null, classification: null, year: null, form: null, originRegion: null,
      description: 'Only this changed', inventoryPurpose: 'working', compassSelection: null, productSelection: null, identityTouched: false,
      disposition: 'received', acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1, priceAmount: '20', currency: 'USD', priceBasis: 'line_total',
    });
    expect(payload).toMatchObject({ duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1' });
  });

  it('preserves canonical new identity and holding resolutions on an unrelated untouched Save', () => {
    const parsed = { sourceItemId: 'source-1', identityResolution: { kind: 'new' }, holdingResolution: { kind: 'new' } };
    const payload = buildImportCorrectionParsedData(parsed, {
      englishName: 'Edited tea', originalName: null, type: null, classification: null, year: null, form: null, originRegion: null,
      description: 'Only this changed', inventoryPurpose: 'working', compassSelection: null, productSelection: null, identityTouched: false,
      disposition: 'received', acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1, priceAmount: '20', currency: 'USD', priceBasis: 'line_total',
    });
    expect(payload).toMatchObject({
      duplicateResolution: 'new', proposedCompassEntryId: null, proposedProductId: null,
      identityResolution: { kind: 'new' }, holdingResolution: { kind: 'new' },
    });
  });

  it('confirms one explicitly touched picker without clearing its proposed companion', () => {
    const parsed = { sourceItemId: 'source-1', duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1' };
    const payload = buildImportCorrectionParsedData(parsed, {
      englishName: 'Tea', originalName: null, type: null, classification: null, year: null, form: null, originRegion: null,
      description: null, inventoryPurpose: 'working', compassSelection: 'compass-1', productSelection: null, identityTouched: true,
      disposition: 'received', acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1, priceAmount: '20', currency: 'USD', priceBasis: 'line_total',
    });
    expect(payload).toMatchObject({ duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1' });
  });

  it('persists an explicitly invalidated holding as null without clearing its compatible identity', () => {
    const payload = buildImportCorrectionParsedData({ duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1' }, {
      englishName: 'Tea', originalName: null, type: null, classification: null, year: null, form: null, originRegion: null,
      description: null, inventoryPurpose: 'personal', compassSelection: 'compass-1', productSelection: null,
      identityTouched: false, productSelectionTouched: true, disposition: 'received', acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1,
      priceAmount: '20', currency: 'USD', priceBasis: 'line_total',
    });
    expect(payload).toMatchObject({ duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: null });
  });

  it('uses category-aware Inventory action nouns', () => {
    expect(importItemNoun([{ category: 'tea' }], 1)).toBe('tea');
    expect(importItemNoun([{ category: 'teaware' }], 1)).toBe('teaware item');
    expect(importItemNoun([{ category: 'tea' }, { category: 'teaware' }], 2)).toBe('items');
  });

  it('maps legacy acquired rows to received and leaves unknown legacy rows unresolved', () => {
    expect(importDisposition(item({ parsed_data: {}, acquired: true }))).toBe('received');
    expect(importDisposition(item({ parsed_data: {}, acquired: false }))).toBeNull();
  });

  it('describes every disposition in the final action', () => {
    expect(importFinalActionLabel([
      item({ id: 'received-1', parsed_data: { disposition: 'received', inventoryPurpose: 'working' } }),
      item({ id: 'received-2', parsed_data: { disposition: 'received', inventoryPurpose: 'working' } }),
      item({ id: 'transit', parsed_data: { disposition: 'in_transit', inventoryPurpose: 'working' }, acquired: false }),
      item({ id: 'library', parsed_data: { disposition: 'library_only' }, acquired: false }),
    ])).toBe('Receive 2 teas, hold 1 tea in transit, and save 1 Library record');
    expect(importFinalActionLabel([
      item({ parsed_data: { disposition: 'library_only' }, acquired: false }),
    ])).toBe('Save 1 Library record');
  });

  it('clears holding and purpose intent for a Library-only correction', () => {
    const payload = buildImportCorrectionParsedData({ duplicateResolution: 'matched', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1' }, {
      englishName: 'Tea', originalName: null, type: null, classification: null, year: null, form: null, originRegion: null,
      description: null, inventoryPurpose: 'working', compassSelection: 'compass-1', productSelection: 'product-1',
      identityTouched: false, productSelectionTouched: false, disposition: 'library_only', acquired: false,
      packWeight: 100, weightUnit: 'g', packCount: 1, priceAmount: '20', currency: 'USD', priceBasis: 'line_total',
    });
    expect(payload).toMatchObject({ disposition: 'library_only', inventoryPurpose: null, proposedProductId: null, acquired: false, holdingResolution: null });
  });
});
