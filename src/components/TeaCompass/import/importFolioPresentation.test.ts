import { describe, expect, it } from 'vitest';
import type { CurateImportFinalizeResult, CurateImportItem, CurateImportVendorGroup } from '../../../lib/api';
import {
  folioPhase,
  folioPhaseContext,
  nextBlockingImportItemId,
  partitionImportItems,
} from './importFolioPresentation';

type PresentationItem = Pick<CurateImportItem, 'id' | 'category' | 'blocking_fields'>;
type PresentationDetail = {
  items: PresentationItem[];
  groups: Array<Pick<CurateImportVendorGroup, 'id'>>;
};

const item = (id: string, blocked: boolean, category: CurateImportItem['category'] = 'tea'): PresentationItem => ({
  id,
  category,
  blocking_fields: blocked ? ['currency'] : [],
});

const row = (id: string, blocked: boolean) => ({ item: item(id, blocked) });

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
      item('tea-3', true),
    ], 2);
    expect(folioPhaseContext('review', reviewDetail)).toEqual({
      title: 'Review 3 teas from 2 vendors',
      status: '2 need review',
    });
    expect(folioPhaseContext('review', detail([item('pot-1', false, 'teaware')], 1))).toEqual({
      title: 'Review 1 teaware item from 1 vendor',
      status: 'Ready to add',
    });
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
