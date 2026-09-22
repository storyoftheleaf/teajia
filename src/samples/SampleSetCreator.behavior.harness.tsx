import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../lib/api';
import { useSampleStore } from './sampleStore';
import { useTeaCompassStore } from '../lib/teaCompassStore';
import { createEmptySample, createEmptySampleSet } from './types';
import type { TeaCompassEntry } from '../components/TeaCompass/types';
import SampleSetCreator from './SampleSetCreator';

/**
 * Harness for `SampleSetCreator.behavior.test.ts`, following the pattern in
 * `OrdersView.behavior.harness.tsx`: mount the real component with the API
 * surface it actually calls overridden by the test, so a real browser drives
 * a real "Graduate to inventory" click instead of a static render.
 *
 * Item 4's regression: `plainCostWords` is unit-tested, but nothing drives
 * this component's own call to it in `runGraduation`'s catch block, so
 * deleting that call would leave the whole suite green while the operator
 * started seeing a raw server marker in the alert again.
 */
api.customers.list = async () => [] as any;
api.products.list = async () => [] as any;

let createError: Error | null = null;
api.products.create = async () => {
  if (createError) throw createError;
  return { id: 'product-1' } as any;
};

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);

(window as any).sampleSetCreatorTest = {
  mount() {
    client.clear();
    useSampleStore.persist.clearStorage();
    useSampleStore.setState({
      samples: [], sampleSets: [], sampleTombstones: [], sampleSetTombstones: [], outboxRevision: 0,
    } as any);
    useTeaCompassStore.setState({ entries: [] } as any);

    const set = createEmptySampleSet({ purpose: 'sourcing' });
    set.name = 'Test batch';
    const now = new Date().toISOString();
    const entry: TeaCompassEntry = {
      id: 'entry-1', name: 'Test Tea', priceCurrency: 'Yuan', priceAmount: 100,
      category: 'tea', quantity: 1, notes: '', photos: [], audioClips: [], status: 'buying',
      createdAt: now, updatedAt: now, synced: false,
    };
    const sample = createEmptySample(set.id);
    sample.name = 'Test Tea';
    sample.status = 'favorite';
    sample.compassEntryId = entry.id;

    useTeaCompassStore.getState().addEntry(entry);
    useSampleStore.getState().addSampleSet(set);
    useSampleStore.getState().addSample(sample);

    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SampleSetCreator />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  },
  setCreateError(message: string | null) { createError = message ? new Error(message) : null; },
};
