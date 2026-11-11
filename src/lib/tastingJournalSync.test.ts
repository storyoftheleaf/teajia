import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));

vi.mock('./api', () => ({
  hasToken: () => true,
  api: { tastingJournal: { list: listMock, sync: vi.fn() } },
}));

import { useAppStore } from './store';
import { hydrateTastingJournal } from './tastingJournalSync';
import type { CustomerTasting } from '../types';

const sitting = (id: string, createdAt: string, words: string) => ({ id, createdAt, tasting: { notes: [words] } as any });

describe('pulling the journal joins it with what this device holds', () => {
  beforeEach(() => listMock.mockReset());

  it('an unsynced local edit of a sitting the shop also holds survives the pull', async () => {
    const local: CustomerTasting = {
      id: 'entry', productId: 'tea', productName: 'Tea', productType: 'Oolong',
      note: { tasting: { notes: ['edited here'] } as any, updatedAt: '2026-11-09T08:00:00.000Z' },
      tastings: [sitting('first', '2026-11-01T08:00:00.000Z', 'edited here')],
      createdAt: '2026-11-01T08:00:00.000Z', synced: false,
    };
    useAppStore.setState({ tastingJournal: [local] });
    listMock.mockResolvedValue([{
      id: 'entry', product_id: 'tea', product_name: 'Tea', product_type: 'Oolong', created_at: '2026-11-01T08:00:00.000Z',
      note: JSON.stringify({ tasting: { notes: ['older'] }, updatedAt: '2026-11-02T08:00:00.000Z' }),
      tastings: JSON.stringify([
        sitting('first', '2026-11-01T08:00:00.000Z', 'older'),
        sitting('other-device', '2026-11-03T08:00:00.000Z', 'from the laptop'),
      ]),
    }]);

    await hydrateTastingJournal();

    const [entry] = useAppStore.getState().tastingJournal;
    expect(entry.tastings.map(t => [t.id, t.tasting.notes?.[0]])).toEqual([
      ['first', 'edited here'],
      ['other-device', 'from the laptop'],
    ]);
    expect(entry.note.tasting.notes).toEqual(['edited here']);
    expect(entry.synced).toBe(false);
  });
});
