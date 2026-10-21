import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ state: {} as Record<string, any> }));
vi.mock('../../lib/teaCompassStore', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../../lib/teaCompassStore')>();
  return { ...original, useTeaCompassStore: Object.assign((selector?: (state: any) => unknown) => selector ? selector(fixture.state) : fixture.state, original.useTeaCompassStore) };
});
vi.mock('../../admin/hooks/useAdminData', () => ({ useRates: () => ({ data: [] }) }));
vi.mock('../../lib/libraryPurchaseState', () => ({ useLibraryPurchases: () => ({ stateFor: () => ({ status: 'none', quantities: [] }), isLoading: false, isError: false }) }));
vi.mock('./BrowseCard', () => ({ BrowseCard: ({ entry }: { entry: { name: string } }) => <div>{entry.name}</div> }));
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { createEmptyEntry } from './types';
import { BrowseView } from './BrowseView';
const render = () => renderToStaticMarkup(<MemoryRouter><BrowseView onEditEntry={() => {}} onNewCapture={() => {}} onOpenDetail={() => {}} /></MemoryRouter>);

beforeEach(() => { fixture.state = { ...useTeaCompassStore.getState(), entries: [], browseFilter: 'all', browseLayout: 'list', hydrationStatus: 'ready' }; });
describe('Library active record scope', () => {
  it('hides durable transfers by default without hiding received tea that has no product link', () => {
    fixture.state.entries = [
      { ...createEmptyEntry(), id: 'active', name: 'Received encounter', status: 'in_stock' },
      { ...createEmptyEntry(), id: 'transferred', name: 'Promoted encounter', draftProductId: 'product-1' },
    ];
    const markup = render();
    expect(markup).toContain('Received encounter');
    expect(markup).not.toContain('Promoted encounter');
    expect(markup).toContain('Transferred · 1');
    expect(markup).toMatch(/All<\/span><span[^>]*>1</);
  });
  it('keeps received samples in the tasting queue and removes promoted sample records', () => {
    fixture.state.browseFilter = 'to_taste';
    fixture.state.entries = [
      { ...createEmptyEntry(), id: 'sample', name: 'Sample ready to taste', sampleState: 'received' },
      { ...createEmptyEntry(), id: 'moved', name: 'Transferred sample', sampleState: 'received', draftProductId: 'product-2' },
    ];
    const markup = render();
    expect(markup).toContain('Sample ready to taste');
    expect(markup).not.toContain('Transferred sample');
    expect(markup).toMatch(/To taste<\/span><span[^>]*>1</);
  });
});
