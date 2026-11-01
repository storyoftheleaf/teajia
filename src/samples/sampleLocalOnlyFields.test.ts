import { describe, expect, it } from 'vitest';
import { createSampleStore } from './sampleStore';
import type { SampleSet, TeaSample } from './types';

/**
 * The server stores none of a sample's holding bookkeeping. A synced sample used
 * to be replaced wholesale by the server's copy, so the pending movement's
 * idempotency key vanished on the next sync and a retry after a lost response
 * minted a new key: the same grams could come off the shelf twice.
 */
const ACCOUNT = 'acc_test';
const remote = (overrides: Partial<TeaSample> = {}): TeaSample => ({
  id: 'sample-1', name: 'Dong Ding', setId: 'set-1', tastings: [], status: 'received', grams: 10, photos: [],
  createdAt: '2026-10-31T00:00:00.000Z', updatedAt: '2026-10-31T00:00:00.000Z', createdBy: 'admin', synced: true, accountId: ACCOUNT,
  ...overrides,
} as TeaSample);
const set = (): SampleSet => ({ id: 'set-1', name: 'Batch', sampleIds: ['sample-1'], createdAt: '2026-10-31T00:00:00.000Z', updatedAt: '2026-10-31T00:00:00.000Z', synced: true, accountId: ACCOUNT } as SampleSet);

describe('a sync keeps the holding bookkeeping the server does not store', () => {
  it('keeps the pending use key and the holding link through reconciliation', () => {
    const store = createSampleStore();
    store.getState().switchAccount(ACCOUNT);
    store.getState().reconcileRemote(ACCOUNT, [remote()], [set()]);
    store.setState(state => ({ samples: state.samples.map(sample => ({
      ...sample,
      inventoryHoldingProductId: 'holding-1',
      holdingUsePendingIdempotencyKey: 'key-1',
      holdingUsePendingQuantity: 10,
      holdingUsePendingExpectedBalance: 42,
      holdingUsePendingProductId: 'holding-1',
    })) }));

    store.getState().reconcileRemote(ACCOUNT, [remote({ name: 'Dong Ding (renamed)' })], [set()]);

    expect(store.getState().samples[0]).toMatchObject({
      name: 'Dong Ding (renamed)',
      inventoryHoldingProductId: 'holding-1',
      holdingUsePendingIdempotencyKey: 'key-1',
      holdingUsePendingQuantity: 10,
      holdingUsePendingExpectedBalance: 42,
      holdingUsePendingProductId: 'holding-1',
    });
  });

  it('adds nothing to a sample that had none of it', () => {
    const store = createSampleStore();
    store.getState().switchAccount(ACCOUNT);
    store.getState().reconcileRemote(ACCOUNT, [remote()], [set()]);
    store.getState().reconcileRemote(ACCOUNT, [remote()], [set()]);
    expect(store.getState().samples[0].holdingUsePendingIdempotencyKey).toBeUndefined();
    expect(store.getState().samples[0].inventoryHoldingProductId).toBeUndefined();
  });
});
