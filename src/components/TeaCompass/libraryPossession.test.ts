import { describe, expect, it } from 'vitest';
import { buildEntryPossessionMap } from './libraryPossession';
import { migrateCompassPersistedState } from '../../lib/teaCompassStore';

describe('buildEntryPossessionMap', () => {
  it('links products by source entry or the entry draft product and uses effective purpose', () => {
    const entries = [
      { id: 'source-linked' },
      { id: 'draft-linked', draftProductId: 'draft-product' },
      { id: 'legacy-sample' },
      { id: 'unheld', status: 'in_stock' },
    ];
    const products = [
      { id: 'source-product', source_compass_entry_id: 'source-linked', inventory_purpose: 'working' },
      { id: 'draft-product', inventory_purpose: 'personal' },
      { id: 'sample-product', sourceCompassEntryId: 'legacy-sample', inventory_purpose: null, is_sample: 1 },
    ];

    expect(buildEntryPossessionMap(entries, products)).toEqual(new Map([
      ['source-linked', 'working'],
      ['draft-linked', 'personal'],
      ['legacy-sample', 'sample'],
    ]));
  });

  it('does not infer possession from legacy Curate status or sample state', () => {
    expect(buildEntryPossessionMap([
      { id: 'legacy-stock', status: 'in_stock' },
      { id: 'requested', sampleState: 'received', isSample: true },
    ], [])).toEqual(new Map());
  });

  it('migrates the old broad Stock filter to Working', () => {
    expect(migrateCompassPersistedState({ libraryFilters: { possession: 'stock' } }, 6))
      .toMatchObject({ libraryFilters: { possession: 'working' } });
  });
});
