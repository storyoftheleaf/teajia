import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CurateImportDetail, CurateImportFinalizeResult } from '../../../lib/api';
import { ImportCompletionSummary } from './ImportCompletionSummary';

describe('ImportCompletionSummary', () => {
  it('describes a Library-only result without receipt or Inventory navigation', () => {
    const detail: CurateImportDetail = {
      batch: { id: 'batch', title: 'Archive', review_state: 'completed', journey_id: null, visit_id: null },
      sources: [],
      groups: [{ id: 'group', batch_id: 'batch', position: 0, proposed_vendor_name: 'Chen Family', resolved_vendor_customer_id: 'vendor', resolved_vendor_name: 'Chen Family', uncertainty: {} }],
      items: [{
        id: 'item', batch_id: 'batch', source_id: null, vendor_group_id: 'group', position: 0, category: 'tea',
        name: 'Aged Liu Bao Tea', english_name: 'Aged Liu Bao Tea', original_name: '陈年六堡茶', raw_text: null,
        parsed_data: { disposition: 'library_only' }, confidence: 1, uncertainty: {}, review_state: 'accepted',
        compass_entry_id: 'library', reserved_compass_entry_id: 'library', acquired: false,
      }],
    };
    const result: CurateImportFinalizeResult = {
      journey: null, receipts: [],
      items: [{ id: 'item', compassEntryId: 'library', productId: null, movementId: null, identityDisposition: 'created', holdingDisposition: null }],
    };

    const markup = renderToStaticMarkup(<ImportCompletionSummary detail={detail} result={result} onClose={() => undefined} onNew={() => undefined} />);
    expect(markup).toContain('1 tea saved · No sourcing run');
    expect(markup).toContain('Library records');
    expect(markup).toContain('Library only · no Inventory holding');
    expect(markup).not.toContain('Receipt unavailable');
    expect(markup).not.toContain('Open Inventory holding');
  });
});
