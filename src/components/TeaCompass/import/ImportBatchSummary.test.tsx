import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImportBatchSummary } from './ImportBatchSummary';

describe('ImportBatchSummary', () => {
  it('surfaces non-item analysis annotations without treating them as inventory lines', () => {
    const markup = renderToStaticMarkup(<ImportBatchSummary
      model={{ groups: [], readyCount: 2, needsReviewCount: 0, currencyTotals: [], totalQuantityGrams: 0, totalUnits: 0, canFinalize: true }}
      overview="Two teas and one shipping line found."
      annotations={[{ kind: 'shipping_or_fee', label: 'Shipping', amountExact: '20', currency: 'CNY', sourceExcerpt: '运费 20元' }]}
      journeyId={null}
      journeyLookup={{ status: 'empty', options: [], error: null }}
      busy={false}
      onRetryJourneys={() => undefined}
      onJourneyChange={async () => true}
      onCreateJourney={async () => true}
      itemNoun="teas"
    />);

    expect(markup).toContain('Import notes');
    expect(markup).toContain('Shipping');
    expect(markup).toContain('CNY 20');
    expect(markup).not.toContain('运费 20元');
  });

  it('does not describe Library-only groups as vendors', () => {
    const markup = renderToStaticMarkup(<ImportBatchSummary
      model={{
        groups: [{ id: 'library', batch_id: 'batch', position: 0, proposed_vendor_name: null, resolved_vendor_customer_id: null, resolved_vendor_name: null, uncertainty: {}, items: [], vendorRequired: false, vendorResolved: true }],
        readyCount: 1, needsReviewCount: 0, currencyTotals: [], totalQuantityGrams: 0, totalUnits: 0, canFinalize: true,
      }}
      journeyId={null}
      journeyLookup={{ status: 'empty', options: [], error: null }}
      busy={false}
      onRetryJourneys={() => undefined}
      onJourneyChange={async () => true}
      onCreateJourney={async () => true}
      itemNoun="tea"
    />);

    expect(markup).toContain('1 tea · Quantity needs review');
    expect(markup).not.toContain('vendor');
  });
});
