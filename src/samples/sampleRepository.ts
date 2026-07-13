import {
  api,
  isTokenScopedToAccount,
  type SampleApiRow,
  type SampleApiWrite,
  type SampleSetApiRow,
  type SampleSetApiWrite,
} from '../lib/api';
import type { TeaForm, TeaType, VendorDetails } from '../components/TeaCompass/types';
import { useSampleStore } from './sampleStore';
import type { SampleSet, SampleSetPurpose, SampleStatus, TeaSample } from './types';

export type SyncedTeaSample = TeaSample & { accountId: string };
export type SyncedSampleSet = SampleSet & { accountId: string; synced: true };

export interface SampleRemoteApi {
  sampleSets: {
    list: () => Promise<{ sets: SampleSetApiRow[] }>;
    create: (set: SampleSetApiWrite) => Promise<SampleSetApiRow>;
    update: (id: string, updates: Partial<SampleSetApiWrite>) => Promise<SampleSetApiRow>;
    remove: (id: string) => Promise<{ success: true }>;
  };
  samples: {
    list: (params?: { setId?: string; status?: string }) => Promise<{ samples: SampleApiRow[] }>;
    create: (sample: SampleApiWrite) => Promise<SampleApiRow>;
    update: (id: string, updates: Partial<SampleApiWrite>) => Promise<SampleApiRow>;
    remove: (id: string) => Promise<{ success: true }>;
  };
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value) return [];
  try { return arrayValue(JSON.parse(value)); } catch { return []; }
}

const SAMPLE_STATUSES = new Set<SampleStatus>(['requested', 'received', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed']);

export function sampleFromApi(row: SampleApiRow): SyncedTeaSample {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    chineseName: row.chinese_name,
    type: row.type as TeaType | undefined,
    form: row.form as TeaForm | undefined,
    year: row.year,
    originRegion: row.origin_region,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceContact: row.source_contact as VendorDetails | undefined,
    productId: row.product_id,
    compassEntryId: row.compass_entry_id,
    teaKey: row.tea_key,
    setId: row.set_id,
    tastings: [],
    status: SAMPLE_STATUSES.has(row.status as SampleStatus) ? row.status as SampleStatus : 'untasted',
    grams: row.grams,
    notes: row.notes,
    photos: arrayValue(row.photos),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by === 'customer' ? 'customer' : 'admin',
    synced: true,
  };
}

export function sampleSetFromApi(row: SampleSetApiRow, samples: TeaSample[]): SyncedSampleSet {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sampleIds: samples.filter((sample) => sample.setId === row.id).map((sample) => sample.id),
    purpose: row.purpose as SampleSetPurpose,
    sharedWith: arrayValue(row.shared_with),
    panelAccountIds: arrayValue(row.panel_account_ids),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: true,
  };
}

function sampleSetToApi(sampleSet: SampleSet): SampleSetApiWrite {
  return {
    id: sampleSet.id,
    name: sampleSet.name,
    source_id: sampleSet.sourceId,
    source_name: sampleSet.sourceName,
    purpose: sampleSet.purpose,
    notes: sampleSet.notes,
    shared_with: sampleSet.sharedWith,
    panel_account_ids: sampleSet.panelAccountIds,
  };
}

function sampleToApi(sample: TeaSample): SampleApiWrite {
  return {
    id: sample.id,
    name: sample.name,
    chinese_name: sample.chineseName,
    type: sample.type,
    form: sample.form,
    year: sample.year,
    origin_region: sample.originRegion,
    source_id: sample.sourceId,
    source_name: sample.sourceName,
    source_contact: sample.sourceContact as Record<string, unknown> | undefined,
    product_id: sample.productId,
    compass_entry_id: sample.compassEntryId,
    set_id: sample.setId,
    status: sample.status,
    grams: sample.grams,
    notes: sample.notes,
    photos: sample.photos,
    tea_key: sample.teaKey,
    created_by: sample.createdBy,
  };
}

function sampleSetUpdatesToApi(updates: Partial<SampleSet>): Partial<SampleSetApiWrite> {
  const keys: Array<keyof SampleSet> = ['name', 'sourceId', 'sourceName', 'purpose', 'notes', 'sharedWith', 'panelAccountIds'];
  const apiKeys: Array<keyof SampleSetApiWrite> = ['name', 'source_id', 'source_name', 'purpose', 'notes', 'shared_with', 'panel_account_ids'];
  const output: Partial<SampleSetApiWrite> = {};
  keys.forEach((key, index) => { if (key in updates) output[apiKeys[index]] = updates[key] as never; });
  return output;
}

function sampleUpdatesToApi(updates: Partial<TeaSample>): Partial<SampleApiWrite> {
  const keyMap: Partial<Record<keyof TeaSample, keyof SampleApiWrite>> = {
    name: 'name', chineseName: 'chinese_name', type: 'type', form: 'form', year: 'year',
    originRegion: 'origin_region', sourceId: 'source_id', sourceName: 'source_name', sourceContact: 'source_contact',
    productId: 'product_id', compassEntryId: 'compass_entry_id', setId: 'set_id', status: 'status', grams: 'grams',
    notes: 'notes', photos: 'photos', teaKey: 'tea_key',
  };
  const output: Partial<SampleApiWrite> = {};
  for (const [clientKey, apiKey] of Object.entries(keyMap) as Array<[keyof TeaSample, keyof SampleApiWrite]>) {
    if (clientKey in updates) output[apiKey] = updates[clientKey] as never;
  }
  return output;
}

export function createSampleRepository(options: {
  remote?: SampleRemoteApi;
  isReady?: (accountId: string) => boolean;
  store?: typeof useSampleStore;
} = {}) {
  const remote = options.remote ?? { sampleSets: api.sampleSets, samples: api.samples };
  const isReady = options.isReady ?? isTokenScopedToAccount;
  const store = options.store ?? useSampleStore;
  let operationGeneration = 0;
  const canApply = (generation: number, accountId: string) => (
    generation === operationGeneration
    && isReady(accountId)
    && store.getState().accountScopeId === accountId
  );

  return {
    async hydrate(accountId: string): Promise<{ status: 'not-ready' | 'hydrated' | 'stale' }> {
      const requestGeneration = ++operationGeneration;
      if (!isReady(accountId)) return { status: 'not-ready' };
      const [setsResponse, samplesResponse] = await Promise.all([
        remote.sampleSets.list(),
        remote.samples.list(),
      ]);
      if (
        !canApply(requestGeneration, accountId)
      ) return { status: 'stale' };
      const samples = samplesResponse.samples.map(sampleFromApi);
      const sampleSets = setsResponse.sets.map((set) => sampleSetFromApi(set, samples));
      const active = store.getState().reconcileRemote(accountId, samples, sampleSets);
      return { status: active ? 'hydrated' : 'stale' };
    },
    async sync(accountId: string): Promise<{ status: 'not-ready' | 'synced' | 'stale' }> {
      const requestGeneration = ++operationGeneration;
      if (!isReady(accountId)) return { status: 'not-ready' };
      const [initialSets, initialSamples] = await Promise.all([
        remote.sampleSets.list(),
        remote.samples.list(),
      ]);
      if (!canApply(requestGeneration, accountId)) return { status: 'stale' };

      const snapshot = store.getState();
      const remoteSetsById = new Map(initialSets.sets.map((set) => [set.id, set]));
      const remoteSamplesById = new Map(initialSamples.samples.map((sample) => [sample.id, sample]));

      for (const id of snapshot.sampleTombstones) {
        if (!canApply(requestGeneration, accountId)) return { status: 'stale' };
        if (remoteSamplesById.has(id)) await remote.samples.remove(id);
        remoteSamplesById.delete(id);
      }
      for (const id of snapshot.sampleSetTombstones) {
        if (!canApply(requestGeneration, accountId)) return { status: 'stale' };
        if (remoteSetsById.has(id)) await remote.sampleSets.remove(id);
        remoteSetsById.delete(id);
        for (const [sampleId, sample] of remoteSamplesById) {
          if (sample.set_id === id) remoteSamplesById.delete(sampleId);
        }
      }

      // Sets are the parent record for every sample. Persist all set outbox
      // entries before attempting any sample create/update.
      for (const sampleSet of snapshot.sampleSets.filter((item) => item.synced !== true)) {
        if (!canApply(requestGeneration, accountId)) return { status: 'stale' };
        const persisted = sampleSet.accountId === accountId || remoteSetsById.has(sampleSet.id);
        const row = persisted && remoteSetsById.has(sampleSet.id)
          ? await remote.sampleSets.update(sampleSet.id, sampleSetUpdatesToApi(sampleSet))
          : await remote.sampleSets.create(sampleSetToApi(sampleSet));
        remoteSetsById.set(row.id, row);
      }
      for (const sample of snapshot.samples.filter((item) => !item.synced)) {
        if (!canApply(requestGeneration, accountId)) return { status: 'stale' };
        if (!remoteSetsById.has(sample.setId)) {
          throw new Error(`Cannot sync sample ${sample.id}: set ${sample.setId} is not persisted`);
        }
        const persisted = sample.accountId === accountId || remoteSamplesById.has(sample.id);
        const row = persisted && remoteSamplesById.has(sample.id)
          ? await remote.samples.update(sample.id, sampleUpdatesToApi(sample))
          : await remote.samples.create(sampleToApi(sample));
        remoteSamplesById.set(row.id, row);
      }

      const [finalSets, finalSamples] = await Promise.all([
        remote.sampleSets.list(),
        remote.samples.list(),
      ]);
      if (!canApply(requestGeneration, accountId)) return { status: 'stale' };
      const samples = finalSamples.samples.map(sampleFromApi);
      const sampleSets = finalSets.sets.map((set) => sampleSetFromApi(set, samples));
      const current = store.getState();
      const committedSampleIds = snapshot.samples.filter((sample) => (
        !sample.synced
        && current.samples.find((candidate) => candidate.id === sample.id)?.updatedAt === sample.updatedAt
      )).map((sample) => sample.id);
      const committedSetIds = snapshot.sampleSets.filter((sampleSet) => (
        sampleSet.synced !== true
        && current.sampleSets.find((candidate) => candidate.id === sampleSet.id)?.updatedAt === sampleSet.updatedAt
      )).map((sampleSet) => sampleSet.id);
      if (!store.getState().markRemoteCommitted(
        accountId,
        committedSampleIds,
        committedSetIds,
      )) return { status: 'stale' };
      if (!store.getState().clearRemoteTombstones(
        accountId,
        snapshot.sampleTombstones,
        snapshot.sampleSetTombstones,
      )) return { status: 'stale' };
      const active = store.getState().reconcileRemote(accountId, samples, sampleSets);
      return { status: active ? 'synced' : 'stale' };
    },
    async createSet(sampleSet: SampleSet): Promise<SyncedSampleSet> {
      return sampleSetFromApi(await remote.sampleSets.create(sampleSetToApi(sampleSet)), []);
    },
    async updateSet(id: string, updates: Partial<SampleSet>): Promise<SyncedSampleSet> {
      return sampleSetFromApi(await remote.sampleSets.update(id, sampleSetUpdatesToApi(updates)), []);
    },
    async removeSet(id: string): Promise<void> { await remote.sampleSets.remove(id); },
    async createSample(sample: TeaSample): Promise<SyncedTeaSample> {
      return sampleFromApi(await remote.samples.create(sampleToApi(sample)));
    },
    async updateSample(id: string, updates: Partial<TeaSample>): Promise<SyncedTeaSample> {
      return sampleFromApi(await remote.samples.update(id, sampleUpdatesToApi(updates)));
    },
    async removeSample(id: string): Promise<void> { await remote.samples.remove(id); },
  };
}

export const sampleRepository = createSampleRepository();
