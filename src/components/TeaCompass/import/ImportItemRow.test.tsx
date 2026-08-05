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
  it('shows a continuous collapsed row without audit or destination controls', () => {
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
    expect(markup).toContain('500g × 1 = 500g');
    expect(markup).toContain('CNY 380 total');
    expect(markup).not.toContain('陈年六堡茶380元/500克 x1=380元');
    expect(markup).not.toContain('normalized legacy row');
    expect(markup).not.toContain('AI interpretation');
    expect(markup).not.toContain('Source fact');
    expect(markup).not.toContain('Canonical match');
    expect(markup).not.toContain('Received now');
    expect(markup).not.toContain('In transit');
    expect(markup).not.toContain('Library only');
    expect(markup).not.toContain('data-testid="import-source-excerpt"');
    expect(markup).not.toContain('Exact source excerpt');
    expect(markup).toContain('>Review<');
    expect(markup).not.toContain('Close editing');
    expect(markup).not.toContain('All details');
  });

  it('orders the shared editor zones and marks only unresolved fields for confirmation', () => {
    const markup = renderToStaticMarkup(<ImportItemRow
      item={{ ...item, blocking_fields: ['english_name', 'price_basis'] }}
      blockingFields={['english_name', 'price_basis']}
      open
      busy={false}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdate={async () => true}
    />);

    expect(markup.indexOf('>Identity<')).toBeLessThan(markup.indexOf('>Purchase<'));
    expect(markup).not.toContain('>Inventory<');
    expect(markup.match(/>Confirm</g)).toHaveLength(2);
    expect(markup).toContain('aria-label="English name"');
    expect(markup).toContain('aria-label="Price interpretation"');
    expect(markup).not.toContain('aria-label="Chinese name"');
    expect(markup).not.toContain('aria-label="Pack count"');
    expect(markup).not.toContain('aria-label="Destination"');
    expect(markup).toContain('More tea details');
    expect(markup).toContain('>Cancel<');
    expect(markup).toContain('>Save tea<');
    expect(markup).not.toContain('data-provenance');
  });

  it('opens every field behind More tea details for a ready row', () => {
    const markup = renderToStaticMarkup(<ImportItemRow
      item={item}
      blockingFields={[]}
      open
      busy={false}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdate={async () => true}
    />);

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="English name"');
    expect(markup).toContain('aria-label="Pack count"');
    expect(markup).toContain('aria-label="Destination"');
    expect(markup).toContain('aria-label="Production or classification"');
  });

  it('separates the blocked group from More tea details, and counts what is waiting', () => {
    const markup = renderToStaticMarkup(<ImportItemRow
      item={{ ...item, blocking_fields: ['english_name', 'price_basis'] }}
      blockingFields={['english_name', 'price_basis']}
      open
      busy={false}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdate={async () => true}
    />);

    // Blocked sections wear the accent wash and say how many fields are waiting.
    expect(markup).toContain('bg-tea-accent-sub');
    expect(markup.match(/>1 to confirm</g)).toHaveLength(2);
    expect(markup).toContain('curate-field-attention');
    // Every blocked section title is bronze; there is no dim one while collapsed.
    expect(markup).not.toContain('tracking-[1.2px] text-tea-text-dim');
  });

  it('marks values the wisdom base supplied and the suggestion lists behind a field', () => {
    const markup = renderToStaticMarkup(<ImportItemRow
      item={item}
      blockingFields={[]}
      open
      busy={false}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdate={async () => true}
    />);

    // 陈年六堡茶 resolves to a Dark tea from Guangxi, so those arrive derived.
    expect(markup).toContain('>From base<');
    expect(markup).toContain('curate-field-marks');
    // The datalists are invisible on their own, so the field says what is behind them.
    expect(markup).toContain('cultivars<');
    expect(markup).toContain('regions<');
    expect(markup).toContain('placeholder="Type to search"');
  });

  it('never falls back to raw excerpts, UUIDs, or evidence ranges in review', () => {
    const uuid = 'be8f2e98-f44e-4c2d-a927-e788e6ed9c70';
    const markup = renderToStaticMarkup(<ImportItemRow
      item={{
        ...item, name: null, english_name: null, original_name: null, chinese_name: null,
        raw_text: `raw supplier excerpt ${uuid}:14-49`, proposed_compass_entry_id: uuid,
        parsed_data: { ...item.parsed_data, evidenceRefs: [`${uuid}:14-49`] }, blocking_fields: ['duplicate_identity'],
      }}
      blockingFields={['duplicate_identity']}
      open
      busy={false}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdate={async () => true}
    />);

    expect(markup).toContain('Unnamed tea');
    expect(markup).toContain('Suggested Library identity');
    expect(markup).not.toContain('raw supplier excerpt');
    expect(markup).not.toContain(uuid);
    expect(markup).not.toContain('14-49');
  });
});
