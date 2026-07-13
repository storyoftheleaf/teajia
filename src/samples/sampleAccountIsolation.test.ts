import { beforeEach, describe, expect, it } from 'vitest';

import { createEmptySample, createEmptySampleSet } from './types';
import { createSampleStore, useSampleStore } from './sampleStore';
import { createSampleCartStore, useSampleCartStore } from './sampleCartStore';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { useAppStore } from '../lib/store';

describe('sample account isolation', () => {
  beforeEach(() => {
    useAppStore.setState({ activeAccountId: null });
    useSampleStore.setState({
      samples: [], sampleSets: [], activeSampleId: null, activeSetId: null,
      sampleTombstones: [], sampleSetTombstones: [],
      accountScopeId: null, dataByAccount: {},
    });
    useSampleCartStore.setState({ items: [], accountScopeId: null, itemsByAccount: {} });
  });

  it('partitions sample sets and portions by active account', () => {
    useSampleStore.getState().switchAccount('acct-a');
    const setA = { ...createEmptySampleSet(), id: 'set-a', name: 'A set', sampleIds: ['sample-a'] };
    const sampleA = { ...createEmptySample('set-a'), id: 'sample-a', name: 'A portion' };
    useSampleStore.getState().addSampleSet(setA);
    useSampleStore.getState().addSample(sampleA);

    useSampleStore.getState().switchAccount('acct-b');
    expect(useSampleStore.getState().sampleSets).toEqual([]);
    expect(useSampleStore.getState().samples).toEqual([]);
    const setB = { ...createEmptySampleSet(), id: 'set-b', name: 'B set' };
    useSampleStore.getState().addSampleSet(setB);

    useSampleStore.getState().switchAccount('acct-a');
    expect(useSampleStore.getState().sampleSets.map((item) => item.id)).toEqual(['set-a']);
    expect(useSampleStore.getState().samples.map((item) => item.id)).toEqual(['sample-a']);
    useSampleStore.getState().switchAccount('acct-b');
    expect(useSampleStore.getState().sampleSets.map((item) => item.id)).toEqual(['set-b']);
    expect(useSampleStore.getState().samples).toEqual([]);
  });

  it('keeps deletion outboxes scoped to their owning account', () => {
    useSampleStore.getState().switchAccount('acct-a');
    useSampleStore.getState().addSampleSet({
      ...createEmptySampleSet(), id: 'server-set-a', accountId: 'acct-a', synced: true,
    });
    useSampleStore.getState().removeSampleSet('server-set-a');
    expect(useSampleStore.getState().sampleSetTombstones).toEqual(['server-set-a']);

    useSampleStore.getState().switchAccount('acct-b');
    expect(useSampleStore.getState().sampleSetTombstones).toEqual([]);
    useSampleStore.getState().switchAccount('acct-a');
    expect(useSampleStore.getState().sampleSetTombstones).toEqual(['server-set-a']);
  });

  it('partitions the sample cart and clears the visible cart when signed out', () => {
    useSampleCartStore.getState().switchAccount('acct-a');
    useSampleCartStore.getState().addItem({ id: 'cart-a', name: 'A tea' });
    useSampleCartStore.getState().switchAccount('acct-b');
    expect(useSampleCartStore.getState().items).toEqual([]);
    useSampleCartStore.getState().addItem({ id: 'cart-b', name: 'B tea' });

    useSampleCartStore.getState().switchAccount('acct-a');
    expect(useSampleCartStore.getState().items.map((item) => item.id)).toEqual(['cart-a']);
    useSampleCartStore.getState().switchAccount(null);
    expect(useSampleCartStore.getState().items).toEqual([]);
  });

  it('moves legacy sample and cart data into only the first known account', () => {
    const legacySet = { ...createEmptySampleSet(), id: 'legacy-set', name: 'Legacy' };
    const legacySample = { ...createEmptySample('legacy-set'), id: 'legacy-sample', name: 'Legacy portion' };
    useSampleStore.setState({ sampleSets: [legacySet], samples: [legacySample] });
    useSampleCartStore.setState({ items: [{ id: 'legacy-cart', name: 'Legacy cart', grams: 10 }] });

    useSampleStore.getState().switchAccount('acct-first');
    useSampleCartStore.getState().switchAccount('acct-first');
    useSampleStore.getState().switchAccount('acct-second');
    useSampleCartStore.getState().switchAccount('acct-second');

    expect(useSampleStore.getState().samples).toEqual([]);
    expect(useSampleStore.getState().dataByAccount['acct-first']?.samples.map((item) => item.id)).toEqual(['legacy-sample']);
    expect(useSampleCartStore.getState().items).toEqual([]);
    expect(useSampleCartStore.getState().itemsByAccount['acct-first']?.map((item) => item.id)).toEqual(['legacy-cart']);
  });

  it('rehydrates v0 persisted sample and cart data for one-time first-account adoption', async () => {
    const values = new Map<string, string>();
    const storage: StateStorage = {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => { values.set(name, value); },
      removeItem: (name) => { values.delete(name); },
    };
    const legacySet = { ...createEmptySampleSet(), id: 'persisted-set', name: 'Persisted' };
    const legacySample = { ...createEmptySample('persisted-set'), id: 'persisted-sample', name: 'Persisted portion' };
    values.set('teajia-samples', JSON.stringify({
      state: { samples: [legacySample], sampleSets: [legacySet] }, version: 0,
    }));
    values.set('teajia-sample-cart', JSON.stringify({
      state: { items: [{ id: 'persisted-cart', name: 'Persisted cart', grams: 10 }] }, version: 0,
    }));
    useAppStore.setState({ activeAccountId: 'acct-first' });
    const sampleStorage = createJSONStorage<ReturnType<typeof useSampleStore.getState>>(() => storage);
    const cartStorage = createJSONStorage<ReturnType<typeof useSampleCartStore.getState>>(() => storage);
    const rehydratedSamples = createSampleStore(sampleStorage);
    const rehydratedCart = createSampleCartStore(cartStorage);
    rehydratedSamples.getState().switchAccount('acct-first');
    rehydratedCart.getState().switchAccount('acct-first');
    rehydratedSamples.getState().switchAccount('acct-second');
    rehydratedCart.getState().switchAccount('acct-second');

    expect(rehydratedSamples.getState().dataByAccount['acct-first']?.samples.map((item) => item.id)).toEqual(['persisted-sample']);
    expect(rehydratedCart.getState().itemsByAccount['acct-first']?.map((item) => item.id)).toEqual(['persisted-cart']);
    expect(rehydratedSamples.getState().samples).toEqual([]);
    expect(rehydratedCart.getState().items).toEqual([]);
  });

  it.each([['acct-b'], [null]])('does not expose persisted account A samples or cart when current account is %s', (activeAccountId) => {
    const values = new Map<string, string>();
    const storage: StateStorage = {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => { values.set(name, value); },
      removeItem: (name) => { values.delete(name); },
    };
    const setA = { ...createEmptySampleSet(), id: 'set-a', name: 'A set' };
    const sampleA = { ...createEmptySample('set-a'), id: 'sample-a', name: 'A sample' };
    values.set('teajia-samples', JSON.stringify({
      state: {
        accountScopeId: 'acct-a', samples: [sampleA], sampleSets: [setA],
        dataByAccount: { 'acct-a': { samples: [sampleA], sampleSets: [setA], activeSampleId: null, activeSetId: null } },
      }, version: 1,
    }));
    values.set('teajia-sample-cart', JSON.stringify({
      state: {
        accountScopeId: 'acct-a', items: [{ id: 'cart-a', name: 'A cart', grams: 10 }],
        itemsByAccount: { 'acct-a': [{ id: 'cart-a', name: 'A cart', grams: 10 }] },
      }, version: 1,
    }));
    useAppStore.setState({ activeAccountId });
    const rehydratedSamples = createSampleStore(
      createJSONStorage<ReturnType<typeof useSampleStore.getState>>(() => storage),
    );
    const rehydratedCart = createSampleCartStore(
      createJSONStorage<ReturnType<typeof useSampleCartStore.getState>>(() => storage),
    );

    expect(rehydratedSamples.getState().accountScopeId).toBe(activeAccountId);
    expect(rehydratedSamples.getState().samples).toEqual([]);
    expect(rehydratedSamples.getState().sampleSets).toEqual([]);
    expect(rehydratedCart.getState().accountScopeId).toBe(activeAccountId);
    expect(rehydratedCart.getState().items).toEqual([]);

    rehydratedSamples.getState().switchAccount('acct-a');
    rehydratedCart.getState().switchAccount('acct-a');
    expect(rehydratedSamples.getState().samples.map((item) => item.id)).toEqual(['sample-a']);
    expect(rehydratedCart.getState().items.map((item) => item.id)).toEqual(['cart-a']);
  });
});
