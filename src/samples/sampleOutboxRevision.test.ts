import { describe, expect, it } from 'vitest';
import { createSampleStore } from './sampleStore';
import type { SampleSet, TeaSample } from './types';

/**
 * Regression guard for the July 2026 request loop: a finished sync rewrote the
 * store, the sync trigger was derived from that rewritten state, and the tab
 * re-synced every ~3 seconds forever (~120k requests/day until it was closed).
 *
 * The rule this locks in: server reconciliation must never move the counter the
 * sync trigger watches. Only local edits may move it.
 */
const ACCOUNT = 'acc_test';

function makeSample(overrides: Partial<TeaSample> = {}): TeaSample {
  return {
    id: 'sample-1',
    name: 'Test tea',
    setId: 'set-1',
    tastings: [],
    status: 'untasted',
    grams: 10,
    photos: [],
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    createdBy: 'admin',
    synced: true,
    accountId: ACCOUNT,
    ...overrides,
  } as TeaSample;
}

function makeSet(overrides: Partial<SampleSet> = {}): SampleSet {
  return {
    id: 'set-1',
    name: 'Test set',
    sampleIds: ['sample-1'],
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    synced: true,
    accountId: ACCOUNT,
    ...overrides,
  } as SampleSet;
}

describe('sample outbox revision', () => {
  it('does not move when the server reconciles state', () => {
    const store = createSampleStore();
    store.getState().switchAccount(ACCOUNT);
    const before = store.getState().outboxRevision;

    store.getState().reconcileRemote(ACCOUNT, [makeSample()], [makeSet()]);
    store.getState().markRemoteCommitted(ACCOUNT, ['sample-1'], ['set-1']);
    store.getState().clearRemoteTombstones(ACCOUNT, [], []);
    store.getState().reconcileRemote(ACCOUNT, [makeSample()], [makeSet()]);

    expect(store.getState().outboxRevision).toBe(before);
  });

  it('moves once for each local edit the user makes', () => {
    const store = createSampleStore();
    store.getState().switchAccount(ACCOUNT);
    const before = store.getState().outboxRevision;

    store.getState().addSampleSet(makeSet({ synced: false }));
    store.getState().addSample(makeSample({ synced: false }));
    store.getState().updateSampleStatus('sample-1', 'tasted');

    expect(store.getState().outboxRevision).toBe(before + 3);
  });
});
