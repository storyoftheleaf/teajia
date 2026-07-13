import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptySample, createEmptySampleSet } from './types';
import { useSampleStore } from './sampleStore';
import { useSampleCartStore } from './sampleCartStore';

describe('sample account isolation', () => {
  beforeEach(() => {
    useSampleStore.setState({
      samples: [], sampleSets: [], activeSampleId: null, activeSetId: null,
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
});
