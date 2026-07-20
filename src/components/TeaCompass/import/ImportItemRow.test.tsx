import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CurateImportItem } from '../../../lib/api';
import { ImportItemRow } from './ImportItemRow';

const item: CurateImportItem = {
  id: 'item-1', batch_id: 'batch-1', source_id: 'source-1', position: 0, category: 'tea',
  name: 'Aged Liu Bao Tea', english_name: 'Aged Liu Bao Tea', original_name: 'Supplier lot 88', chinese_name: '陈年六堡茶',
  raw_text: 'normalized legacy row',
  parsed_data: {
    sourceExcerpt: '陈年六堡茶380元/500克 x1=380元', chineseName: '陈年六堡茶', disposition: 'in_transit', inventoryPurpose: 'working',
    fieldProvenance: { englishName: 'ai_interpretation', originalName: 'source_fact', classification: 'canonical_match' },
    classification: 'post-fermented tea', duplicateResolution: 'new',
  },
  confidence: 0.92, uncertainty: {}, review_state: 'pending', compass_entry_id: null,
  reserved_compass_entry_id: 'library-1', pack_weight: 500, weight_unit: 'g', pack_count: 1,
  price_amount: 380, price_amount_exact: '380', currency: 'CNY', price_basis: 'line_total',
  total_quantity_grams: 500, total_units: null, line_cost: 380, line_cost_exact: '380', unit_cost: 0.76,
  unit_cost_exact: '0.76', blocking_fields: [], acquired: false,
};

describe('ImportItemRow', () => {
  it('shows names, exact excerpt, arithmetic, provenance, and all disposition controls', () => {
    const markup = renderToStaticMarkup(<ImportItemRow
      item={item}
      busy={false}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdate={async () => true}
    />);

    expect(markup).toContain('Aged Liu Bao Tea');
    expect(markup).toContain('Supplier lot 88');
    expect(markup).toContain('陈年六堡茶');
    expect(markup).toContain('500g ×1');
    expect(markup).toContain('CNY 380');
    expect(markup).toContain('陈年六堡茶380元/500克 x1=380元');
    expect(markup).not.toContain('normalized legacy row');
    expect(markup).toContain('AI interpretation');
    expect(markup).toContain('Source fact');
    expect(markup).toContain('Canonical match');
    expect(markup).toContain('Received now');
    expect(markup).toContain('In transit');
    expect(markup).toContain('Library only');
    expect(markup).toContain('data-testid="import-source-excerpt"');
    expect(markup).toContain('grid-cols-3');
    expect(markup).not.toContain('grid-cols-1');
  });
});
