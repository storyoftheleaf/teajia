import { describe, expect, it, vi } from 'vitest';
import type { TeaCompassEntry } from '../components/TeaCompass/types';
import type { SampleCartItem } from './sampleCartStore';
import {
  buildSampleBatchDraft,
  compassLifecycleForSample,
  requestedCompassUpdate,
  saveSampleBatchLifecycle,
} from './sampleLifecycle';

const cartItem: SampleCartItem = {
  id: 'entry-1',
  name: 'Dong Ding',
  grams: 10,
  compassEntryId: 'entry-1',
};

describe('sample lifecycle', () => {
  it('links a requested portion without changing sourcing decision or tasting verdict', () => {
    expect(requestedCompassUpdate('set-1')).toEqual({
      isSample: true,
      sampleState: 'requested',
      sampleSetId: 'set-1',
    });
    expect(requestedCompassUpdate('set-1')).not.toHaveProperty('decision');
    expect(requestedCompassUpdate('set-1')).not.toHaveProperty('verdict');
    expect(requestedCompassUpdate('set-1')).not.toHaveProperty('status');
  });

  it('advances receipt and actual tasting without collapsing favorite or pass into sourcing status', () => {
    expect(compassLifecycleForSample({ status: 'received', tastings: [] })).toBe('received');
    expect(compassLifecycleForSample({ status: 'untasted', tastings: [] })).toBe('received');
    expect(compassLifecycleForSample({ status: 'favorite', tastings: [{ id: 'taste-1' }] })).toBe('tasted');
    expect(compassLifecycleForSample({ status: 'passed', tastings: [{ id: 'taste-1' }] })).toBe('tasted');
    expect(compassLifecycleForSample({ status: 'favorite', tastings: [] })).toBeUndefined();
  });

  it('persists portions before linking Compass and clears only after Compass sync succeeds', async () => {
    const draft = buildSampleBatchDraft([cartItem], {
      setId: 'set-1',
      sampleId: () => 'sample-1',
      now: new Date('2026-07-13T00:00:00.000Z'),
    });
    const events: string[] = [];
    const entry = { id: 'entry-1', decision: 'selected', verdict: 'love', synced: true } as TeaCompassEntry;
    const clear = vi.fn();

    await saveSampleBatchLifecycle({
      accountId: 'acct-a',
      draft,
      isCurrentAccount: () => true,
      persistSamples: async () => { events.push('samples'); },
      getCompassEntry: () => entry,
      updateCompassEntry: (_id, update) => {
        events.push('compass-local');
        Object.assign(entry, update, { synced: false });
      },
      persistCompass: async () => { events.push('compass-remote'); entry.synced = true; },
      clearList: () => { events.push('clear'); clear(); },
    });

    expect(events).toEqual(['samples', 'compass-local', 'compass-remote', 'clear']);
    expect(entry).toMatchObject({
      decision: 'selected', verdict: 'love', sampleState: 'requested', sampleSetId: 'set-1', isSample: true,
    });
    expect(clear).toHaveBeenCalledOnce();
  });

  it('preserves the list on failure and retries the same draft idempotently', async () => {
    const draft = buildSampleBatchDraft([cartItem], {
      setId: 'set-retry',
      sampleId: () => 'sample-retry',
      now: new Date('2026-07-13T00:00:00.000Z'),
    });
    const clear = vi.fn();
    const persistSamples = vi.fn()
      .mockRejectedValueOnce(new Error('Sample batches could not be saved'))
      .mockResolvedValueOnce(undefined);

    const dependencies = {
      accountId: 'acct-a',
      draft,
      isCurrentAccount: () => true,
      persistSamples,
      getCompassEntry: () => undefined,
      updateCompassEntry: vi.fn(),
      persistCompass: vi.fn(),
      clearList: clear,
    };

    await expect(saveSampleBatchLifecycle(dependencies)).rejects.toThrow('Sample batches could not be saved');
    expect(clear).not.toHaveBeenCalled();
    await expect(saveSampleBatchLifecycle(dependencies)).rejects.toThrow('could not be linked');
    expect(persistSamples).toHaveBeenNthCalledWith(1, draft);
    expect(persistSamples).toHaveBeenNthCalledWith(2, draft);
    expect(clear).not.toHaveBeenCalled();
  });

  it('rejects a missing Compass link after persisting the recoverable sample outbox', async () => {
    const draft = buildSampleBatchDraft([cartItem], { setId: 'set-missing', sampleId: () => 'sample-missing' });
    const clear = vi.fn();
    await expect(saveSampleBatchLifecycle({
      accountId: 'acct-a', draft, isCurrentAccount: () => true,
      persistSamples: vi.fn().mockResolvedValue(undefined),
      getCompassEntry: () => undefined,
      updateCompassEntry: vi.fn(), persistCompass: vi.fn(), clearList: clear,
    })).rejects.toThrow('entry-1 could not be linked');
    expect(clear).not.toHaveBeenCalled();
  });

  it('changes the retry identity for every persisted cart field', () => {
    const fields: Array<keyof SampleCartItem> = [
      'id', 'name', 'chineseName', 'type', 'vendorName', 'grams', 'compassEntryId', 'productId', 'teaKey',
    ];
    const baseline: SampleCartItem = {
      id: 'cart-1', name: 'Tea', chineseName: '茶', type: 'Oolong', vendorName: 'Vendor', grams: 10,
      compassEntryId: 'entry-1', productId: 'product-1', teaKey: 'tea:key',
    };
    const signature = buildSampleBatchDraft([baseline]).signature;
    for (const field of fields) {
      const changed = { ...baseline, [field]: field === 'grams' ? 11 : `${String(baseline[field])}-changed` } as SampleCartItem;
      expect(buildSampleBatchDraft([changed]).signature, field).not.toBe(signature);
    }
  });

  it('aborts when account ownership changes during a remote save', async () => {
    let current = true;
    const draft = buildSampleBatchDraft([cartItem], { setId: 'set-1', sampleId: () => 'sample-1' });
    const clear = vi.fn();
    await expect(saveSampleBatchLifecycle({
      accountId: 'acct-a',
      draft,
      isCurrentAccount: () => current,
      persistSamples: async () => { current = false; },
      getCompassEntry: () => undefined,
      updateCompassEntry: vi.fn(),
      persistCompass: vi.fn(),
      clearList: clear,
    })).rejects.toThrow('account changed');
    expect(clear).not.toHaveBeenCalled();
  });
});
