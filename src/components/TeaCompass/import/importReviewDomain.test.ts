import { describe, expect, it } from 'vitest';
import type { CurateImportDetail, CurateImportItem } from '../../../lib/api';
import { buildImportCorrectionParsedData, buildImportReviewModel, importBlockingMessage, normalizeImportDetail } from './importReviewDomain';
import { filterImportJourneys, importItemNoun, inventoryTargetFromFinalize, resolveImportBlockingFields, withoutImportDerivedFields } from './importReviewDomain';

const item = (overrides: Partial<CurateImportItem> = {}): CurateImportItem => ({
  id: 'item-1', batch_id: 'batch-1', source_id: null, vendor_group_id: 'group-1', position: 0,
  category: 'tea', name: 'Yunnan Raw Pu’er', english_name: 'Yunnan Raw Pu’er', original_name: '云南古树生普',
  raw_text: '500g ×2 ¥380', parsed_data: { inventoryPurpose: 'working' }, confidence: 0.94, uncertainty: {}, blocking_fields: [],
  pack_weight: 500, weight_unit: 'g', pack_count: 2, price_amount: 380, currency: 'CNY',
  price_basis: 'per_pack', total_quantity_grams: 1000, total_units: null, line_cost: 760, unit_cost: 0.76,
  review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: 'reserved-1',
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
    expect(buildImportReviewModel(detail({ items: [item({ parsed_data: { inventoryPurpose: 'service' } })], groups: [detail().groups[1]] })).canFinalize).toBe(false);
    expect(buildImportReviewModel(detail({ items: [item({ parsed_data: { inventoryPurpose: 'sample' } })], groups: [detail().groups[1]] })).canFinalize).toBe(true);
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

  it('names identity, holding, and physical-stock blockers precisely', () => {
    expect(importBlockingMessage(item({ blocking_fields: ['duplicateIdentity', 'productId', 'acquisitionState'] })))
      .toBe('Confirm tea identity, Inventory holding, and physical stock status.');
  });
});

describe('review navigation and journey helpers', () => {
  it('searches sourcing runs by name, season, or year', () => {
    const journeys = [
      { id: 'spring', account_id: 'a', name: 'Yunnan sourcing', season: 'Spring', year: 2026 },
      { id: 'winter', account_id: 'a', name: 'Taiwan visit', season: 'Winter', year: 2025 },
    ];
    expect(filterImportJourneys(journeys, '2026').map(journey => journey.id)).toEqual(['spring']);
    expect(filterImportJourneys(journeys, 'winter').map(journey => journey.id)).toEqual(['winter']);
  });

  it('opens the first created Inventory holding after finalization', () => {
    expect(inventoryTargetFromFinalize({ batchId: 'b', idempotencyKey: 'k', receipts: [], items: [{ id: 'i', compassEntryId: 'c', productId: 'product-7', movementId: 'm' }] })).toBe('product-7');
    expect(inventoryTargetFromFinalize({ batchId: 'b', idempotencyKey: 'k', receipts: [], items: [] })).toBeNull();
  });

  it('clears only blockers explicitly resolved by edited values', () => {
    expect(resolveImportBlockingFields(['packCount', 'priceBasis', 'duplicateIdentity', 'productId', 'acquisitionState', 'year'], {
      packCount: 2, priceBasis: 'per_pack', duplicateResolution: 'new', proposedCompassEntryId: null, proposedProductId: null, acquired: true,
    })).toEqual(['year']);
  });

  it('omits derived arithmetic and blockers from correction payloads', () => {
    expect(withoutImportDerivedFields({ englishName: 'Tea', unknownMetadata: true, totalQuantityGrams: 1000, lineCost: 80, unitCost: 0.08, blockingFields: ['priceBasis'] }))
      .toEqual({ englishName: 'Tea' });
  });

  it('builds correction payloads with only canonical Worker identity and stock keys', () => {
    const payload = buildImportCorrectionParsedData({ sourceItemId: 'source-1', teaType: 'legacy', compassEntryId: 'legacy', productId: 'legacy', acquiredIntoStock: true }, {
      englishName: 'Tea', originalName: null, type: 'raw puer', classification: null, year: 2024, form: 'cake',
      originRegion: 'Yunnan', description: null, inventoryPurpose: 'working', compassSelection: 'compass-1',
      productSelection: 'product-1', acquired: true, packWeight: 357, weightUnit: 'g', packCount: 1,
      priceAmount: 80, currency: 'CNY', priceBasis: 'per_pack',
    });
    expect(payload).toMatchObject({ type: 'raw puer', proposedCompassEntryId: 'compass-1', proposedProductId: 'product-1', acquired: true, duplicateResolution: 'matched' });
    expect(payload).not.toHaveProperty('teaType');
    expect(payload).not.toHaveProperty('compassEntryId');
    expect(payload).not.toHaveProperty('productId');
    expect(payload).not.toHaveProperty('acquiredIntoStock');
  });

  it('promotes Worker identity and stock fields into normalized editor aliases', () => {
    const normalized = normalizeImportDetail(detail({ items: [item({ parsed_data: {
      inventoryPurpose: 'personal', proposedCompassEntryId: 'compass-2', proposedProductId: 'product-2',
      acquired: true, duplicateResolution: 'matched',
    } })] }));
    expect(normalized.items[0]).toMatchObject({
      proposed_compass_entry_id: 'compass-2', proposed_product_id: 'product-2', acquired: true, duplicate_resolution: 'matched',
    });
  });

  it('uses category-aware Inventory action nouns', () => {
    expect(importItemNoun([{ category: 'tea' }], 1)).toBe('tea');
    expect(importItemNoun([{ category: 'teaware' }], 1)).toBe('teaware item');
    expect(importItemNoun([{ category: 'tea' }, { category: 'teaware' }], 2)).toBe('items');
  });
});
