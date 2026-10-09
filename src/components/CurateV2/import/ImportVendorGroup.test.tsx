import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CurateImportItem } from '../../../lib/api';
import { ImportVendorGroup } from './ImportVendorGroup';

const libraryItem: CurateImportItem = {
  id: 'library-item', batch_id: 'batch', source_id: null, vendor_group_id: 'group', position: 0, category: 'tea',
  name: 'Library tea', raw_text: null, parsed_data: { disposition: 'library_only', englishName: 'Library tea' },
  confidence: 1, uncertainty: {}, review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: 'reserved',
  acquired: false, blocking_fields: [],
};

describe('ImportVendorGroup', () => {
  it('presents an all-Library group without vendor resolution controls', () => {
    const markup = renderToStaticMarkup(<ImportVendorGroup
      group={{
        id: 'group', batch_id: 'batch', position: 0, proposed_vendor_name: 'Suggested supplier', resolved_vendor_customer_id: null,
        resolved_vendor_name: null, uncertainty: {}, vendorRequired: false, vendorResolved: true,
        items: [{ item: libraryItem, blockingFields: [], blockingMessage: null, ready: true }],
      }}
      vendorLookup={{ status: 'empty', options: [], error: null }}
      identityLookup={{ status: 'empty', options: [], error: null }}
      holdingLookup={{ status: 'empty', options: [], error: null }}
      busyId={null}
      onRetryVendors={() => undefined}
      onRetryIdentities={() => undefined}
      onRetryHoldings={() => undefined}
      onUpdateItem={async () => true}
      onChangeVendor={async () => true}
      onCreateVendor={async () => true}
    />);

    expect(markup).toContain('Library records');
    expect(markup).not.toContain('Change vendor');
    expect(markup).not.toContain('Vendor ·');
    expect(markup).toContain('1 ready');
    expect(markup).not.toContain('>Ready<');
    expect(markup).not.toContain('Library tea');
  });
});
