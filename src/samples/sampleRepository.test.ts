import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleRepository, sampleFromApi, sampleSetFromApi } from './sampleRepository';
import { useSampleStore } from './sampleStore';
import { createEmptySample, createEmptySampleSet } from './types';

const remoteSet = {
  id: 'server-set', account_id: 'acct-a', name: 'Spring requests', source_id: 'vendor-1',
  source_name: 'Wuyi vendor', purpose: 'sourcing', notes: 'Fresh arrivals', shared_with: ['member-1'],
  panel_account_ids: [], created_at: '2026-03-01 10:00:00', updated_at: '2026-03-02 10:00:00',
};
const remoteSample = {
  id: 'server-sample', account_id: 'acct-a', name: 'Rou Gui', chinese_name: '肉桂', type: 'Oolong',
  origin_region: 'Wuyishan', source_id: 'vendor-1', source_name: 'Wuyi vendor', product_id: 'product-1',
  compass_entry_id: 'compass-1', set_id: 'server-set', status: 'untasted', grams: 8, notes: 'Floral',
  photos: ['photo.jpg'], created_at: '2026-03-01 10:00:00', updated_at: '2026-03-02 10:00:00',
  created_by: 'admin',
};

describe('sample repository', () => {
  beforeEach(() => {
    useSampleStore.setState({
      samples: [], sampleSets: [], activeSampleId: null, activeSetId: null,
      sampleTombstones: [], sampleSetTombstones: [],
      accountScopeId: null, dataByAccount: {},
    });
  });

  it('adapts D1 snake_case rows into synced client models', () => {
    const sample = sampleFromApi({ ...remoteSample, status: 'requested', created_by: 'customer' });
    const set = sampleSetFromApi(remoteSet, [sample]);

    expect(sample).toMatchObject({
      id: 'server-sample', accountId: 'acct-a', chineseName: '肉桂', originRegion: 'Wuyishan',
      sourceId: 'vendor-1', productId: 'product-1', compassEntryId: 'compass-1', setId: 'server-set',
      photos: ['photo.jpg'], createdAt: '2026-03-01 10:00:00', synced: true,
      status: 'requested', createdBy: 'customer',
    });
    expect(set).toMatchObject({
      id: 'server-set', accountId: 'acct-a', sourceName: 'Wuyi vendor',
      sharedWith: ['member-1'], sampleIds: ['server-sample'], synced: true,
    });
  });

  it('uses typed remote CRUD boundaries and returns server identities', async () => {
    const remote = {
      sampleSets: {
        list: vi.fn(),
        create: vi.fn().mockResolvedValue(remoteSet),
        update: vi.fn().mockResolvedValue({ ...remoteSet, name: 'Updated' }),
        remove: vi.fn().mockResolvedValue({ success: true as const }),
      },
      samples: {
        list: vi.fn(),
        create: vi.fn().mockResolvedValue(remoteSample),
        update: vi.fn().mockResolvedValue({ ...remoteSample, grams: 12 }),
        remove: vi.fn().mockResolvedValue({ success: true as const }),
      },
    };
    const repository = createSampleRepository({ remote, isReady: () => true });

    const createdSet = await repository.createSet({ ...createEmptySampleSet(), id: 'local-set', name: 'Spring requests' });
    const createdSample = await repository.createSample({ ...createEmptySample('server-set'), id: 'local-sample', name: 'Rou Gui' });
    expect(remote.sampleSets.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-set', source_name: undefined }));
    expect(remote.samples.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-sample', set_id: 'server-set' }));
    expect(createdSet.id).toBe('server-set');
    expect(createdSample.id).toBe('server-sample');
    expect((await repository.updateSet('server-set', { name: 'Updated' })).name).toBe('Updated');
    expect((await repository.updateSample('server-sample', { grams: 12 })).grams).toBe(12);
    expect(remote.sampleSets.update).toHaveBeenCalledWith('server-set', { name: 'Updated' });
    expect(remote.samples.update).toHaveBeenCalledWith('server-sample', { grams: 12 });
    await repository.removeSample('server-sample');
    await repository.removeSet('server-set');
    expect(remote.samples.remove).toHaveBeenCalledWith('server-sample');
    expect(remote.sampleSets.remove).toHaveBeenCalledWith('server-set');
  });

  it('hydrates only when account and token are ready, without applying a stale response', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const remote = {
      sampleSets: { list: vi.fn(async () => { await gate; return { sets: [remoteSet] }; }), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
      samples: { list: vi.fn(async () => { await gate; return { samples: [remoteSample] }; }), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    };
    let ready = false;
    const repository = createSampleRepository({ remote, isReady: (accountId) => ready && accountId === 'acct-a' });
    useSampleStore.getState().switchAccount('acct-a');

    expect(await repository.hydrate('acct-a')).toEqual({ status: 'not-ready' });
    expect(remote.samples.list).not.toHaveBeenCalled();

    ready = true;
    const hydration = repository.hydrate('acct-a');
    useSampleStore.getState().switchAccount('acct-b');
    release();
    expect(await hydration).toEqual({ status: 'stale' });
    expect(useSampleStore.getState().samples).toEqual([]);
    useSampleStore.getState().switchAccount('acct-a');
    expect(useSampleStore.getState().samples).toEqual([]);
  });

  it('discards responses after token readiness changes or a newer hydrate starts', async () => {
    const releases: Array<() => void> = [];
    const responses = [
      { sets: [{ ...remoteSet, name: 'Older' }] },
      { sets: [{ ...remoteSet, name: 'Newer' }] },
      { sets: [{ ...remoteSet, name: 'Revoked' }] },
    ];
    let setCall = 0;
    const remote = {
      sampleSets: {
        list: vi.fn(async () => {
          const call = setCall++;
          await new Promise<void>((resolve) => { releases[call] = resolve; });
          return responses[call];
        }),
        create: vi.fn(), update: vi.fn(), remove: vi.fn(),
      },
      samples: {
        list: vi.fn().mockResolvedValue({ samples: [remoteSample] }),
        create: vi.fn(), update: vi.fn(), remove: vi.fn(),
      },
    };
    let ready = true;
    const repository = createSampleRepository({ remote, isReady: () => ready });
    useSampleStore.getState().switchAccount('acct-a');

    const older = repository.hydrate('acct-a');
    const newer = repository.hydrate('acct-a');
    releases[1]();
    expect(await newer).toEqual({ status: 'hydrated' });
    releases[0]();
    expect(await older).toEqual({ status: 'stale' });
    expect(useSampleStore.getState().getSampleSet('server-set')?.name).toBe('Newer');

    const tokenRevoked = repository.hydrate('acct-a');
    ready = false;
    releases[2]();
    expect(await tokenRevoked).toEqual({ status: 'stale' });
  });

  it('reconciles repeatedly without duplicates and preserves unsynced local work', async () => {
    const local = { ...createEmptySample('server-set'), id: 'server-sample', name: 'Local edit', synced: false };
    const localOnly = { ...createEmptySample('local-set'), id: 'local-only', name: 'Offline', synced: false };
    useSampleStore.getState().switchAccount('acct-a');
    useSampleStore.getState().addSampleSet({ ...createEmptySampleSet(), id: 'local-set', sampleIds: ['local-only'] });
    useSampleStore.getState().addSample(localOnly);
    useSampleStore.getState().addSample(local);
    const remote = {
      sampleSets: { list: vi.fn().mockResolvedValue({ sets: [remoteSet] }), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
      samples: { list: vi.fn().mockResolvedValue({ samples: [remoteSample] }), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    };
    const repository = createSampleRepository({ remote, isReady: () => true });

    expect(await repository.hydrate('acct-a')).toEqual({ status: 'hydrated' });
    expect(await repository.hydrate('acct-a')).toEqual({ status: 'hydrated' });
    expect(useSampleStore.getState().samples.map((sample) => sample.id).sort()).toEqual(['local-only', 'server-sample']);
    expect(useSampleStore.getState().getSample('server-sample')?.name).toBe('Local edit');
    expect(useSampleStore.getState().sampleSets.map((set) => set.id).sort()).toEqual(['local-set', 'server-set']);
  });

  it('syncs existing store mutations durably in dependency order and prevents delete resurrection', async () => {
    const calls: string[] = [];
    const sets = new Map<string, typeof remoteSet>();
    const samples = new Map<string, typeof remoteSample>();
    const remote = {
      sampleSets: {
        list: vi.fn(async () => ({ sets: [...sets.values()] })),
        create: vi.fn(async (write: any) => {
          calls.push(`create-set:${write.id}`);
          const row = { ...remoteSet, ...write, id: write.id, account_id: 'acct-a' };
          sets.set(row.id, row); return row;
        }),
        update: vi.fn(async (id: string, write: any) => {
          calls.push(`update-set:${id}`);
          const row = { ...sets.get(id)!, ...write, updated_at: '2026-03-03' };
          sets.set(id, row); return row;
        }),
        remove: vi.fn(async (id: string) => { calls.push(`remove-set:${id}`); sets.delete(id); return { success: true as const }; }),
      },
      samples: {
        list: vi.fn(async () => ({ samples: [...samples.values()] })),
        create: vi.fn(async (write: any) => {
          calls.push(`create-sample:${write.id}`);
          const row = { ...remoteSample, ...write, id: write.id, account_id: 'acct-a' };
          samples.set(row.id, row); return row;
        }),
        update: vi.fn(async (id: string, write: any) => {
          calls.push(`update-sample:${id}`);
          const row = { ...samples.get(id)!, ...write, updated_at: '2026-03-03' };
          samples.set(id, row); return row;
        }),
        remove: vi.fn(async (id: string) => { calls.push(`remove-sample:${id}`); samples.delete(id); return { success: true as const }; }),
      },
    };
    const repository = createSampleRepository({ remote, isReady: () => true });
    useSampleStore.getState().switchAccount('acct-a');
    useSampleStore.getState().addSampleSet({ ...createEmptySampleSet(), id: 'local-set', name: 'Local set' });
    useSampleStore.getState().addSample({ ...createEmptySample('local-set'), id: 'local-sample', name: 'Local sample' });

    expect(await repository.sync('acct-a')).toEqual({ status: 'synced' });
    expect(calls.slice(0, 2)).toEqual(['create-set:local-set', 'create-sample:local-sample']);
    expect(useSampleStore.getState().getSampleSet('local-set')).toMatchObject({ accountId: 'acct-a', synced: true });
    expect(useSampleStore.getState().getSample('local-sample')).toMatchObject({ accountId: 'acct-a', synced: true });

    useSampleStore.getState().updateSampleSet('local-set', { name: 'Edited set' });
    useSampleStore.getState().updateSample('local-sample', { grams: 12 });
    expect(await repository.sync('acct-a')).toEqual({ status: 'synced' });
    expect(calls).toContain('update-set:local-set');
    expect(calls).toContain('update-sample:local-sample');

    useSampleStore.getState().removeSample('local-sample');
    expect(useSampleStore.getState().sampleTombstones).toContain('local-sample');
    expect(await repository.hydrate('acct-a')).toEqual({ status: 'hydrated' });
    expect(useSampleStore.getState().getSample('local-sample')).toBeUndefined();
    expect(await repository.sync('acct-a')).toEqual({ status: 'synced' });
    expect(calls).toContain('remove-sample:local-sample');
    expect(useSampleStore.getState().sampleTombstones).toEqual([]);
    expect(await repository.hydrate('acct-a')).toEqual({ status: 'hydrated' });
    expect(useSampleStore.getState().getSample('local-sample')).toBeUndefined();

    useSampleStore.getState().removeSampleSet('local-set');
    expect(useSampleStore.getState().sampleSetTombstones).toContain('local-set');
    expect(await repository.hydrate('acct-a')).toEqual({ status: 'hydrated' });
    expect(useSampleStore.getState().getSampleSet('local-set')).toBeUndefined();
    expect(await repository.sync('acct-a')).toEqual({ status: 'synced' });
    expect(calls).toContain('remove-set:local-set');
    expect(useSampleStore.getState().sampleSetTombstones).toEqual([]);
  });

  it('retains offline work for retry and never acknowledges the wrong account', async () => {
    let fail = true;
    let release!: () => void;
    let gated = false;
    const remote = {
      sampleSets: {
        list: vi.fn(async () => ({ sets: [] })),
        create: vi.fn(async (write: any) => {
          if (fail) { fail = false; throw new Error('offline'); }
          if (gated) await new Promise<void>((resolve) => { release = resolve; });
          return { ...remoteSet, ...write, id: write.id, account_id: 'acct-a' };
        }),
        update: vi.fn(), remove: vi.fn(),
      },
      samples: { list: vi.fn(async () => ({ samples: [] })), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    };
    const repository = createSampleRepository({ remote, isReady: () => true });
    useSampleStore.getState().switchAccount('acct-a');
    useSampleStore.getState().addSampleSet({ ...createEmptySampleSet(), id: 'retry-set' });

    await expect(repository.sync('acct-a')).rejects.toThrow('offline');
    expect(useSampleStore.getState().getSampleSet('retry-set')?.synced).toBe(false);
    expect(await repository.sync('acct-a')).toEqual({ status: 'synced' });

    useSampleStore.getState().addSampleSet({ ...createEmptySampleSet(), id: 'switch-set' });
    gated = true;
    const pending = repository.sync('acct-a');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    useSampleStore.getState().switchAccount('acct-b');
    release();
    expect(await pending).toEqual({ status: 'stale' });
    expect(useSampleStore.getState().sampleSets).toEqual([]);
    useSampleStore.getState().switchAccount('acct-a');
    expect(useSampleStore.getState().getSampleSet('switch-set')?.synced).toBe(false);
  });
});
