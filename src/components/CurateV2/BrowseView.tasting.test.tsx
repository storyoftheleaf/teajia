import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ state: {} as Record<string, any> }));
vi.mock('../../lib/teaCompassStore', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../../lib/teaCompassStore')>();
  return { ...original, useTeaCompassStore: Object.assign((selector?: (state: any) => unknown) => selector ? selector(fixture.state) : fixture.state, original.useTeaCompassStore) };
});
vi.mock('../../admin/hooks/useAdminData', () => ({ useRates: () => ({ data: undefined }) }));
vi.mock('./BrowseCard', () => ({ BrowseCard: ({ entry }: { entry: { name: string } }) => <div>{entry.name}</div> }));
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { createEmptyEntry } from './types';
import { BrowseView } from './BrowseView';

const render = () => renderToStaticMarkup(<MemoryRouter><BrowseView onEditEntry={() => {}} onNewCapture={() => {}} /></MemoryRouter>);
describe('CurateV2 tasting queue', () => {
  beforeEach(() => {
    fixture.state = { ...useTeaCompassStore.getState(), entries: [], browseFilter: 'to_taste', browseLayout: 'cards', hydrationStatus: 'ready' };
  });
  it('uses the canonical tasted lifecycle for the counter and queue membership', () => {
    fixture.state.entries = [{ ...createEmptyEntry(), name: 'Shelf tasted tea', sampleState: 'tasted' }];
    const markup = render();
    expect(markup).toMatch(/To taste<\/span><span[^>]*>0</);
    expect(markup).toContain('All caught up');
    expect(markup).not.toContain('Shelf tasted tea');
  });
  it('keeps received samples waiting to taste while excluding finished samples', () => {
    fixture.state.entries = [
      { ...createEmptyEntry(), id: 'received', name: 'Waiting sample', sampleState: 'received' },
      { ...createEmptyEntry(), id: 'tasted', name: 'Finished sample', sampleState: 'tasted' },
    ];
    const markup = render();
    expect(markup).toMatch(/To taste<\/span><span[^>]*>1</);
    expect(markup).toContain('Waiting sample');
    expect(markup).not.toContain('Finished sample');
  });
});
