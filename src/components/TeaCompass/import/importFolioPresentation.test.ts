import { describe, expect, it } from 'vitest';
import type { CurateImportDetail, CurateImportFinalizeResult, CurateImportItem, CurateImportVendorGroup } from '../../../lib/api';
import {
  folioPhase,
  folioPhaseContext,
  importBatchSummary,
  nextBlockingImportItemId,
  partitionImportItems,
} from './importFolioPresentation';

type PresentationItem = Pick<CurateImportItem, 'id' | 'category' | 'blocking_fields' | 'parsed_data' | 'disposition' | 'acquired' | 'vendor_group_id'>;
type PresentationDetail = {
  items: PresentationItem[];
  groups: Array<Pick<CurateImportVendorGroup, 'id'>>;
};

const item = (id: string, blocked: boolean, category: CurateImportItem['category'] = 'tea'): PresentationItem => ({
  id,
  category,
  blocking_fields: blocked ? ['currency'] : [],
  parsed_data: { disposition: 'received' },
  disposition: 'received',
  acquired: true,
  vendor_group_id: 'vendor-1',
});

const row = (id: string, blocked: boolean) => ({ item: item(id, blocked) });

const summaryItem = (id: string, overrides: Partial<CurateImportItem> = {}): CurateImportItem => ({
  id, batch_id: 'batch-1', source_id: null, vendor_group_id: 'vendor-1', position: 0, category: 'tea',
  name: id, raw_text: null, parsed_data: { disposition: 'received', inventoryPurpose: 'working' }, confidence: 1,
  uncertainty: {}, blocking_fields: [], review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: `reserved-${id}`,
  disposition: 'received', acquired: true,
  ...overrides,
});

const detail = (items: PresentationItem[], vendorCount: number): PresentationDetail => ({
  items,
  groups: Array.from({ length: vendorCount }, (_, index) => ({ id: `vendor-${index + 1}` })),
});

const completion = (ids: string[]): Pick<CurateImportFinalizeResult, 'items'> => ({
  items: ids.map(id => ({
    id,
    compassEntryId: `compass-${id}`,
    productId: `product-${id}`,
    movementId: `movement-${id}`,
    identityDisposition: 'created',
    holdingDisposition: 'created',
  })),
});

describe('import folio presentation', () => {
  it('maps workflow state into the three approved phases', () => {
    expect(folioPhase({ phase: 'input', completion: false })).toBe('evidence');
    expect(folioPhase({ phase: 'parsing', completion: false })).toBe('evidence');
    expect(folioPhase({ phase: 'error', completion: false })).toBe('evidence');
    expect(folioPhase({ phase: 'review', completion: false })).toBe('review');
    expect(folioPhase({ phase: 'review', completion: true })).toBe('added');
  });

  it('orders blocked rows before ready rows while preserving partition order', () => {
    const result = partitionImportItems([
      row('ready-1', false),
      row('blocked-1', true),
      row('ready-2', false),
      row('blocked-2', true),
    ]);

    expect(result.needsReview.map(value => value.item.id)).toEqual(['blocked-1', 'blocked-2']);
    expect(result.ready.map(value => value.item.id)).toEqual(['ready-1', 'ready-2']);
  });

  it('advances through blockers, wraps once, and returns null without blockers', () => {
    const items = [
      item('blocked-1', true),
      item('ready-1', false),
      item('blocked-2', true),
    ];

    expect(nextBlockingImportItemId(items, null)).toBe('blocked-1');
    expect(nextBlockingImportItemId(items, 'blocked-1')).toBe('blocked-2');
    expect(nextBlockingImportItemId(items, 'blocked-2')).toBe('blocked-1');
    expect(nextBlockingImportItemId([item('ready-1', false)], 'ready-1')).toBeNull();
  });

  it('provides concise record and review context from the current detail', () => {
    expect(folioPhaseContext('evidence', null)).toEqual({
      title: 'Add vendor record',
      status: 'Draft saved',
    });

    const reviewDetail = detail([
      item('tea-1', true),
      item('tea-2', false),
      { ...item('tea-3', true), vendor_group_id: 'vendor-2' },
    ], 2);
    expect(folioPhaseContext('review', reviewDetail)).toEqual({
      title: 'Review imported teas',
      status: '2 of 3 need attention',
    });
    expect(folioPhaseContext('review', detail([item('pot-1', false, 'teaware')], 1))).toEqual({
      title: 'Review imported teas',
      status: '0 of 1 need attention',
    });
    expect(folioPhaseContext('review', detail([{
      ...item('library-1', false), parsed_data: { disposition: 'library_only' }, disposition: 'library_only', acquired: false,
    }], 1))).toEqual({
      title: 'Review imported teas',
      status: '0 of 1 need attention',
    });
  });

  it('summarizes only effective review facts without rounding or inventing data', () => {
    const reviewDetail: CurateImportDetail = {
      batch: { id: 'batch-1', title: 'List', review_state: 'reviewing', journey_id: null, visit_id: null },
      sources: [],
      groups: [
        { id: 'vendor-1', batch_id: 'batch-1', position: 0, proposed_vendor_name: 'Huang Wei', resolved_vendor_customer_id: 'customer-1', resolved_vendor_name: 'Huang Wei', uncertainty: {} },
        { id: 'vendor-2', batch_id: 'batch-1', position: 1, proposed_vendor_name: 'Second vendor', resolved_vendor_customer_id: 'customer-2', resolved_vendor_name: 'Second vendor', uncertainty: {} },
      ],
      items: [
        summaryItem('tea-1', { total_quantity_grams: 1000, line_cost: 800, currency: 'CNY' }),
        summaryItem('tea-2', { total_quantity_grams: 1500, line_cost: 700, currency: 'CNY', position: 1 }),
        summaryItem('tea-3', { vendor_group_id: 'vendor-2', total_quantity_grams: 1000, line_cost: 800, currency: 'CNY', position: 2, blocking_fields: ['currency'] }),
      ],
    };

    expect(importBatchSummary(reviewDetail)).toBe('3 teas · 2 vendors · 3.5 kg · CNY 2,300');
    expect(importBatchSummary({
      ...reviewDetail,
      groups: [reviewDetail.groups[0]],
      items: [{ ...reviewDetail.items[0], total_quantity_grams: 1001, line_cost: null }],
    })).toBe('1 tea · Huang Wei · 1,001 g');
  });

  it('reports the actual finalized item count and noun after import', () => {
    const importDetail = detail([
      item('tea-1', false),
      item('pot-1', false, 'teaware'),
      item('tea-2', false),
    ], 2);

    expect(folioPhaseContext('added', importDetail, completion(['tea-1', 'pot-1']))).toEqual({
      title: 'Import complete',
      status: '2 items added',
    });
  });
});
