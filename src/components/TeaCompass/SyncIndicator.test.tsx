import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { createEmptyEntry } from './types';
import { SyncIndicator } from './SyncIndicator';

vi.mock('../../lib/teaCompassSync', () => ({ syncCompassEntries: vi.fn(), ensureCompassEncounterSaved: vi.fn() }));
// SSR normally uses Zustand's initial snapshot. Render the state under test.
vi.mock('../../lib/teaCompassStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/teaCompassStore')>();
  return { ...actual, useTeaCompassStore: Object.assign(
    (selector: (state: ReturnType<typeof actual.useTeaCompassStore.getState>) => unknown) => selector(actual.useTeaCompassStore.getState()),
    actual.useTeaCompassStore,
  ) };
});
vi.mock('../../lib/notesStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/notesStore')>();
  return { ...actual, useNotesStore: Object.assign(
    (selector: (state: ReturnType<typeof actual.useNotesStore.getState>) => unknown) => selector(actual.useNotesStore.getState()),
    actual.useNotesStore,
  ) };
});

describe('Source save status belongs to its tea', () => {
  beforeEach(() => {
    useTeaCompassStore.setState({ entries: [], pendingEntries: [], syncError: true, accountScopeId: 'shop', userScopeId: 'person' });
    useNotesStore.setState({ notes: [] });
  });

  it('does not label a saved tea as failed because another tea cannot sync', () => {
    useTeaCompassStore.setState({ entries: [
      { ...createEmptyEntry(), id: 'saved', name: 'Saved tea', synced: true },
      { ...createEmptyEntry(), id: 'other', name: 'Other pending tea', synced: false },
    ], activeEntryId: 'saved' });
    expect(renderToStaticMarkup(<SyncIndicator />)).toBe('');
  });

  it('does not show a failure on an empty new capture', () => {
    const draft = createEmptyEntry();
    useTeaCompassStore.setState({ pendingEntries: [draft], activeEntryId: draft.id });
    expect(renderToStaticMarkup(<SyncIndicator />)).toBe('');
  });

  it('offers saving for the current tea with deliberate unsaved input', () => {
    useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry(), id: 'edited', name: 'Edited tea', synced: false }], activeEntryId: 'edited' });
    expect(renderToStaticMarkup(<SyncIndicator />)).toContain('>Save</button>');
  });
});
