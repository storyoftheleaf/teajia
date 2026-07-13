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
      accountScopeId: null, dataByAccount: {},
    });
  });

  it('adapts D1 snake_case rows into synced client models', () => {
    const sample = sampleFromApi(remoteSample);
    const set = sampleSetFromApi(remoteSet, [sample]);

    expect(sample).toMatchObject({
      id: 'server-sample', accountId: 'acct-a', chineseName: '肉桂', originRegion: 'Wuyishan',
      sourceId: 'vendor-1', productId: 'product-1', compassEntryId: 'compass-1', setId: 'server-set',
      photos: ['photo.jpg'], createdAt: '2026-03-01 10:00:00', synced: true,
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
});
