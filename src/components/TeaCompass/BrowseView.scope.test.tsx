import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ state: {} as Record<string, any> }));
vi.mock('../../lib/teaCompassStore', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../../lib/teaCompassStore')>();
  return { ...original, useTeaCompassStore: Object.assign((selector?: (state: any) => unknown) => selector ? selector(fixture.state) : fixture.state, original.useTeaCompassStore) };
});
vi.mock('../../admin/hooks/useAdminData', () => ({ useRates: () => ({ data: [] }), useCustomers: () => ({ data: [{ id: 'supplier-1', name: 'Renamed shared supplier' }] }) }));
vi.mock('../../lib/libraryPurchaseState', () => ({ useLibraryPurchases: () => ({ stateFor: () => ({ status: 'none', quantities: [] }), isLoading: false, isError: false }) }));
vi.mock('./BrowseCard', () => ({ BrowseCard: ({ entry }: { entry: { name: string } }) => <div>{entry.name}</div> }));
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { createEmptyEntry } from './types';
import { BrowseView } from './BrowseView';
const render = () => renderToStaticMarkup(<MemoryRouter><BrowseView onEditEntry={() => {}} onNewCapture={() => {}} onOpenDetail={() => {}} /></MemoryRouter>);

beforeEach(() => { fixture.state = { ...useTeaCompassStore.getState(), entries: [], browseFilter: 'all', browseLayout: 'list', hydrationStatus: 'ready' }; });
describe('Library active record scope', () => {
  it('keeps transferred acquisitions discoverable in All alongside unlinked encounters', () => {
    fixture.state.entries = [
      { ...createEmptyEntry(), id: 'active', name: 'Received encounter', status: 'in_stock' },
      { ...createEmptyEntry(), id: 'transferred', name: 'Promoted encounter', draftProductId: 'product-1' },
    ];
    const markup = render();
    expect(markup).toContain('Received encounter');
    expect(markup).toContain('Promoted encounter');
    expect(markup).toContain('Most recent'); // Transfer-only view remains in View & sort.
    expect(markup).toMatch(/All<\/span><span[^>]*>2</);
  });
  it('keeps untasted received samples in the queue even after product linking', () => {
    fixture.state.browseFilter = 'to_taste';
    fixture.state.entries = [
      { ...createEmptyEntry(), id: 'sample', name: 'Sample ready to taste', sampleState: 'received' },
      { ...createEmptyEntry(), id: 'moved', name: 'Transferred sample', sampleState: 'received', draftProductId: 'product-2' },
    ];
    const markup = render();
    expect(markup).toContain('Sample ready to taste');
    expect(markup).toContain('Transferred sample');
    expect(markup).toMatch(/To taste<\/span><span[^>]*>2</);
  });
});

describe('Library supplier organization', () => {
  it.each(['all', 'to_taste', 'selected'])('groups %s by supplier, merges spelling whitespace/case, and keeps unknown suppliers last', (filter) => {
    fixture.state.browseFilter = filter;
    fixture.state.browseSort = 'name';
    fixture.state.entries = [
      { ...createEmptyEntry(), id: '1', name: 'Zebra tea', vendorName: ' Huang   Wei ', decision: 'selected', sampleState: 'received' },
      { ...createEmptyEntry(), id: '2', name: 'Amber tea', vendorName: 'huang wei', decision: 'selected', sampleState: 'received' },
      { ...createEmptyEntry(), id: '3', name: 'Missing supplier tea', vendorName: '', decision: 'selected', sampleState: 'received' },
      { ...createEmptyEntry(), id: '4', name: 'Other supplier tea', vendorName: 'An Tea', decision: 'selected', sampleState: 'received' },
    ];
    const markup = render();
    expect(markup.match(/<section /g)).toHaveLength(3);
    expect(markup.indexOf('Other supplier tea')).toBeLessThan(markup.indexOf('Amber tea'));
    expect(markup.indexOf('Amber tea')).toBeLessThan(markup.indexOf('Zebra tea'));
    expect(markup.indexOf('Zebra tea')).toBeLessThan(markup.indexOf('Missing supplier tea'));
    expect(markup).toContain('aria-label="Supplier not recorded"');
    expect(markup).not.toContain('Today');
  });

  it('applies supplier filters before grouping', () => {
    fixture.state.libraryFilters = { vendor: 'huang' };
    fixture.state.entries = [
      { ...createEmptyEntry(), id: '1', name: 'Matching tea', vendorName: 'Huang Wei' },
      { ...createEmptyEntry(), id: '2', name: 'Unrelated tea', vendorName: 'Other supplier' },
    ];
    const markup = render();
    expect(markup).toContain('aria-label="Huang Wei"');
    expect(markup).toContain('Matching tea');
    expect(markup).not.toContain('Unrelated tea');
  });
});


describe('Library workflow decisions', () => {
  it('keeps rejected records separate even when ordered, and counts chat orders as chosen', () => {
    fixture.state.browseFilter = 'selected';
    fixture.state.entries = [
      { ...createEmptyEntry(), id: 'chat-order', name: 'Chat order', status: 'incoming' },
      { ...createEmptyEntry(), id: 'rejected', name: 'Rejected order', status: 'incoming', decision: 'passed_on' },
      { ...createEmptyEntry(), id: 'draft', name: 'Unconfirmed draft', status: 'buying' },
    ];
    const markup = render();
    expect(markup).toContain('Chat order');
    expect(markup).not.toContain('Rejected order');
    expect(markup).not.toContain('Unconfirmed draft');
    expect(markup).toMatch(/Chosen<\/span><span[^>]*>1</);
    expect(markup).toMatch(/Rejected<\/span><span[^>]*>1</);
  });
  it('uses the shared supplier name instead of the captured name', () => {
    fixture.state.entries = [{ ...createEmptyEntry(), id: '1', name: 'Linked tea', linkedCustomerId: 'supplier-1', vendorName: 'Old name' }];
    expect(render()).toContain('aria-label="Renamed shared supplier"');
    expect(render()).not.toContain('Old name');
  });
});
