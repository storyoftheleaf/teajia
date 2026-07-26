import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CurateImportDetail } from '../../lib/api';
import { LibraryImportsSection, nextLibraryImportFocusId } from './LibraryImportsSection';

const importDetail = (
  id: string,
  title: string,
  reviewState: CurateImportDetail['batch']['review_state'] = 'reviewing',
): CurateImportDetail => ({
  batch: { id, title, review_state: reviewState, journey_id: null, visit_id: null },
  sources: [{ id: `source-${id}`, batch_id: id, kind: 'paste', pasted_text: title, r2_object_key: null, metadata: {} }],
  groups: [],
  items: [
    {
      id: `item-${id}-1`, batch_id: id, source_id: `source-${id}`, position: 0, category: 'tea',
      name: 'Reviewed tea', raw_text: 'Reviewed tea', parsed_data: {}, confidence: 0.95, uncertainty: {},
      review_state: 'accepted', compass_entry_id: null, reserved_compass_entry_id: `compass-${id}-1`, blocking_fields: [],
    },
    {
      id: `item-${id}-2`, batch_id: id, source_id: `source-${id}`, position: 1, category: 'tea',
      name: 'Tea needing attention', raw_text: 'Tea needing attention', parsed_data: {}, confidence: 0.5, uncertainty: { currency: 'Confirm currency' },
      review_state: 'pending', compass_entry_id: null, reserved_compass_entry_id: `compass-${id}-2`, blocking_fields: ['currency'],
    },
  ],
});

describe('LibraryImportsSection', () => {
  it('chooses the next visible row after deletion and falls back when none remain', () => {
    const imports = [
      importDetail('batch-1', 'First list'),
      importDetail('batch-2', 'Second list'),
      importDetail('batch-3', 'Third list'),
    ];

    expect(nextLibraryImportFocusId(imports, 'batch-2')).toBe('batch-3');
    expect(nextLibraryImportFocusId(imports, 'batch-3')).toBe('batch-2');
    expect(nextLibraryImportFocusId([imports[0]], 'batch-1')).toBeNull();
  });

  it('renders active imports as accessible Curate record rows with review and attention counts', () => {
    const html = renderToStaticMarkup(
      <LibraryImportsSection
        imports={[importDetail('batch-1', 'Summer vendor list')]}
        busyImportId={null}
        errorByImportId={{}}
        onOpen={() => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).toContain('aria-label="Imports"');
    expect(html).toContain('Summer vendor list');
    expect(html).toContain('1/2 reviewed');
    expect(html).toContain('1 needs attention');
    expect(html).toContain('aria-label="Open Summer vendor list"');
    expect(html).toContain('aria-label="Delete Summer vendor list"');
    expect(html).toContain('curate-cluster');
  });

  it('omits completed and abandoned imports, including the empty section', () => {
    const html = renderToStaticMarkup(
      <LibraryImportsSection
        imports={[
          importDetail('batch-complete', 'Completed list', 'completed'),
          importDetail('batch-abandoned', 'Abandoned list', 'abandoned'),
        ]}
        busyImportId={null}
        errorByImportId={{}}
        onOpen={() => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).toBe('');
  });

  it('keeps a failed deletion on its row with a retry action', () => {
    const html = renderToStaticMarkup(
      <LibraryImportsSection
        imports={[importDetail('batch-1', 'Summer vendor list')]}
        busyImportId={null}
        errorByImportId={{ 'batch-1': 'Delete import is temporarily unavailable' }}
        onOpen={() => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Delete import is temporarily unavailable');
    expect(html).toContain('aria-label="Retry delete Summer vendor list"');
  });
});
