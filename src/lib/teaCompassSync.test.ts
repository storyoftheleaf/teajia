import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncMock } = vi.hoisted(() => ({ syncMock: vi.fn() }));

vi.mock('./api', () => ({
  hasToken: () => true,
  api: {
    compass: {
      sync: syncMock,
      remove: vi.fn(),
      promote: vi.fn(),
      list: vi.fn(),
    },
  },
}));

import { createEmptyEntry } from '../components/TeaCompass/types';
import { useTeaCompassStore } from './teaCompassStore';
import { syncCompassEntries } from './teaCompassSync';

function entry(id: string) {
  return { ...createEmptyEntry(), id, name: id, synced: false };
}

describe('Compass sync acknowledgements', () => {
  beforeEach(() => {
    syncMock.mockReset();
    useTeaCompassStore.setState({
      entries: [],
      deletedIds: [],
      pendingPromotions: [],
      syncError: false,
    });
  });

  it('marks only acknowledged ids synced and keeps collisions queued', async () => {
    syncMock.mockResolvedValue({
      synced: 1,
      syncedIds: ['accepted'],
      conflicts: ['collision'],
    });
    useTeaCompassStore.setState({ entries: [entry('accepted'), entry('collision')] });

    expect(await syncCompassEntries()).toBe(1);
    expect(useTeaCompassStore.getState().entries.map(({ id, synced }) => ({ id, synced }))).toEqual([
      { id: 'accepted', synced: true },
      { id: 'collision', synced: false },
    ]);
    expect(useTeaCompassStore.getState().syncError).toBe(true);
  });

  it('does not trust a numeric count without explicit id acknowledgements', async () => {
    syncMock.mockResolvedValue({ synced: 2 });
    useTeaCompassStore.setState({ entries: [entry('one'), entry('two')] });

    expect(await syncCompassEntries()).toBe(0);
    expect(useTeaCompassStore.getState().entries.every(item => !item.synced)).toBe(true);
    expect(useTeaCompassStore.getState().syncError).toBe(true);
  });
});
