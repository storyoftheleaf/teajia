import { describe, expect, it, vi } from 'vitest';
import { buildSampleBatchDraft, saveSampleBatchLifecycle } from './sampleLifecycle';

describe('server owned sample lifecycle', () => {
  it('persists the stable draft, reads canonical Curate state, then clears', async () => {
    const draft = buildSampleBatchDraft([{ id: 'tea', name: 'Tea', grams: 8, compassEntryId: 'tea' }]);
    const events: string[] = [];
    await saveSampleBatchLifecycle({ accountId: 'a', draft, isCurrentAccount: () => true,
      persistSamples: async () => { events.push('samples'); },
      refreshCompass: async () => { events.push('read'); }, clearList: () => { events.push('clear'); } });
    expect(events).toEqual(['samples', 'read', 'clear']);
  });
  it('retains the recoverable draft when persistence fails or the account changes', async () => {
    const clearList = vi.fn();
    const draft = buildSampleBatchDraft([{ id: 'tea', name: 'Tea', grams: 8 }]);
    const options = { accountId: 'a', draft, isCurrentAccount: () => true,
      persistSamples: vi.fn().mockRejectedValue(new Error('offline')), refreshCompass: vi.fn(), clearList };
    await expect(saveSampleBatchLifecycle(options)).rejects.toThrow('offline');
    expect(clearList).not.toHaveBeenCalled();
    await expect(saveSampleBatchLifecycle({ ...options, isCurrentAccount: () => false })).rejects.toThrow('account changed');
  });
});
