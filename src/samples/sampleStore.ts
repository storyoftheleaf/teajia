import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type { TeaSample, SampleSet, SampleTasting, SampleStatus } from './types';
import { useAppStore } from '../lib/store';

const UNSCOPED_LEGACY_ACCOUNT = '__legacy_unscoped__';

interface SampleAccountData {
  samples: TeaSample[];
  sampleSets: SampleSet[];
  sampleTombstones: string[];
  sampleSetTombstones: string[];
  activeSampleId: string | null;
  activeSetId: string | null;
}

interface SampleStoreState {
  // Data
  samples: TeaSample[];
  sampleSets: SampleSet[];
  sampleTombstones: string[];
  sampleSetTombstones: string[];
  accountScopeId: string | null;
  dataByAccount: Record<string, SampleAccountData>;
  switchAccount: (accountId: string | null) => void;
  reconcileRemote: (accountId: string, samples: TeaSample[], sampleSets: SampleSet[]) => boolean;
  markRemoteCommitted: (accountId: string, sampleIds: string[], sampleSetIds: string[]) => boolean;
  clearRemoteTombstones: (accountId: string, sampleIds: string[], sampleSetIds: string[]) => boolean;

  // Active selections
  activeSampleId: string | null;
  activeSetId: string | null;

  // Sample actions
  addSample: (sample: TeaSample) => void;
  updateSample: (id: string, updates: Partial<TeaSample>) => void;
  removeSample: (id: string) => void;
  addTasting: (sampleId: string, tasting: SampleTasting) => void;
  updateSampleStatus: (id: string, status: SampleStatus) => void;
  bulkUpdateStatus: (ids: string[], status: SampleStatus) => void;
  archiveSampleSet: (id: string) => void;
  importFromCompass: (compassEntries: Array<{
    id: string;
    name: string;
    chineseName?: string;
    type?: string;
    year?: number;
    originRegion?: string;
    grams?: number;
    vendorId?: string;
    vendorName?: string;
    teaKey?: string;
  }>, setId: string) => void;

  // Set actions
  addSampleSet: (set: SampleSet) => void;
  updateSampleSet: (id: string, updates: Partial<SampleSet>) => void;
  removeSampleSet: (id: string) => void;
  discardSampleSet: (id: string) => void;

  // Selection
  setActiveSample: (id: string | null) => void;
  setActiveSet: (id: string | null) => void;

  // Getters
  getSample: (id: string) => TeaSample | undefined;
  getSampleSet: (id: string) => SampleSet | undefined;
  getSamplesForSet: (setId: string) => TeaSample[];
  getSetForSample: (sampleId: string) => SampleSet | undefined;
}

export function createSampleStore(storage?: PersistStorage<SampleStoreState>) {
  return create<SampleStoreState>()(
  persist(
    (set, get) => ({
      samples: [],
      sampleSets: [],
      sampleTombstones: [],
      sampleSetTombstones: [],
      accountScopeId: null,
      dataByAccount: {},
      activeSampleId: null,
      activeSetId: null,

      switchAccount: (accountId) => set((state) => {
        if (state.accountScopeId === accountId) return state;
        const dataByAccount = { ...state.dataByAccount };
        if (state.accountScopeId) {
          dataByAccount[state.accountScopeId] = {
            samples: state.samples,
            sampleSets: state.sampleSets,
            sampleTombstones: state.sampleTombstones,
            sampleSetTombstones: state.sampleSetTombstones,
            activeSampleId: state.activeSampleId,
            activeSetId: state.activeSetId,
          };
        } else if (
          accountId &&
          (state.samples.length > 0 || state.sampleSets.length > 0 || dataByAccount[UNSCOPED_LEGACY_ACCOUNT] !== undefined) &&
          !dataByAccount[accountId]
        ) {
          dataByAccount[accountId] = dataByAccount[UNSCOPED_LEGACY_ACCOUNT] ?? {
            samples: state.samples,
            sampleSets: state.sampleSets,
            sampleTombstones: state.sampleTombstones,
            sampleSetTombstones: state.sampleSetTombstones,
            activeSampleId: state.activeSampleId,
            activeSetId: state.activeSetId,
          };
          delete dataByAccount[UNSCOPED_LEGACY_ACCOUNT];
        }
        const target = accountId ? dataByAccount[accountId] : undefined;
        return {
          samples: target?.samples ?? [],
          sampleSets: target?.sampleSets ?? [],
          sampleTombstones: target?.sampleTombstones ?? [],
          sampleSetTombstones: target?.sampleSetTombstones ?? [],
          activeSampleId: target?.activeSampleId ?? null,
          activeSetId: target?.activeSetId ?? null,
          accountScopeId: accountId,
          dataByAccount,
        };
      }),

      reconcileRemote: (accountId, remoteSamples, remoteSets) => {
        let appliedToActiveAccount = false;
        set((state) => {
          const current = state.accountScopeId === accountId
            ? {
                samples: state.samples,
                sampleSets: state.sampleSets,
                sampleTombstones: state.sampleTombstones,
                sampleSetTombstones: state.sampleSetTombstones,
                activeSampleId: state.activeSampleId,
                activeSetId: state.activeSetId,
              }
            : state.dataByAccount[accountId] ?? {
                samples: [], sampleSets: [], sampleTombstones: [], sampleSetTombstones: [], activeSampleId: null, activeSetId: null,
              };
          const deletedSampleIds = new Set(current.sampleTombstones ?? []);
          const deletedSetIds = new Set(current.sampleSetTombstones ?? []);
          const samplesById = new Map(remoteSamples
            .filter((sample) => !deletedSampleIds.has(sample.id) && !deletedSetIds.has(sample.setId))
            .map((sample) => [sample.id, sample]));
          for (const local of current.samples) {
            if (!local.synced) samplesById.set(local.id, local);
          }
          const samples = Array.from(samplesById.values());

          const setsById = new Map(remoteSets
            .filter((sampleSet) => !deletedSetIds.has(sampleSet.id))
            .map((sampleSet) => [sampleSet.id, sampleSet]));
          const setsWithLocalWork = new Set(samples.filter((sample) => !sample.synced).map((sample) => sample.setId));
          for (const localSet of current.sampleSets) {
            if (localSet.synced !== true || setsWithLocalWork.has(localSet.id)) {
              setsById.set(localSet.id, localSet);
            }
          }
          const sampleSets = Array.from(setsById.values()).map((sampleSet) => ({
            ...sampleSet,
            sampleIds: samples.filter((sample) => sample.setId === sampleSet.id).map((sample) => sample.id),
          }));
          const nextAccountData: SampleAccountData = {
            samples,
            sampleSets,
            sampleTombstones: current.sampleTombstones ?? [],
            sampleSetTombstones: current.sampleSetTombstones ?? [],
            activeSampleId: samples.some((sample) => sample.id === current.activeSampleId) ? current.activeSampleId : null,
            activeSetId: sampleSets.some((sampleSet) => sampleSet.id === current.activeSetId) ? current.activeSetId : null,
          };
          const dataByAccount = { ...state.dataByAccount, [accountId]: nextAccountData };
          if (state.accountScopeId !== accountId) return { dataByAccount };
          appliedToActiveAccount = true;
          return { ...nextAccountData, dataByAccount };
        });
        return appliedToActiveAccount;
      },

      clearRemoteTombstones: (accountId, sampleIds, sampleSetIds) => {
        if (get().accountScopeId !== accountId) return false;
        const sampleIdSet = new Set(sampleIds);
        const sampleSetIdSet = new Set(sampleSetIds);
        set((state) => ({
          sampleTombstones: state.sampleTombstones.filter((id) => !sampleIdSet.has(id)),
          sampleSetTombstones: state.sampleSetTombstones.filter((id) => !sampleSetIdSet.has(id)),
          dataByAccount: {
            ...state.dataByAccount,
            [accountId]: {
              samples: state.samples,
              sampleSets: state.sampleSets,
              sampleTombstones: state.sampleTombstones.filter((id) => !sampleIdSet.has(id)),
              sampleSetTombstones: state.sampleSetTombstones.filter((id) => !sampleSetIdSet.has(id)),
              activeSampleId: state.activeSampleId,
              activeSetId: state.activeSetId,
            },
          },
        }));
        return true;
      },

      markRemoteCommitted: (accountId, sampleIds, sampleSetIds) => {
        if (get().accountScopeId !== accountId) return false;
        const sampleIdSet = new Set(sampleIds);
        const sampleSetIdSet = new Set(sampleSetIds);
        set((state) => ({
          samples: state.samples.map((sample) => sampleIdSet.has(sample.id)
            ? { ...sample, accountId, synced: true }
            : sample),
          sampleSets: state.sampleSets.map((sampleSet) => sampleSetIdSet.has(sampleSet.id)
            ? { ...sampleSet, accountId, synced: true }
            : sampleSet),
        }));
        return true;
      },

      addSample: (sample) =>
        set((state) => ({
          samples: [sample, ...state.samples],
        })),

      updateSample: (id, updates) =>
        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString(), synced: false } : s
          ),
        })),

      removeSample: (id) =>
        set((state) => {
          const sample = state.samples.find((s) => s.id === id);
          const tombstone = sample?.accountId === state.accountScopeId ? id : null;
          return {
            samples: state.samples.filter((s) => s.id !== id),
            sampleSets: state.sampleSets.map((ss) =>
              ss.id === sample?.setId
                ? { ...ss, sampleIds: ss.sampleIds.filter((sid) => sid !== id) }
                : ss
            ),
            activeSampleId: state.activeSampleId === id ? null : state.activeSampleId,
            sampleTombstones: tombstone
              ? Array.from(new Set([...state.sampleTombstones, tombstone]))
              : state.sampleTombstones,
          };
        }),

      addTasting: (sampleId, tasting) =>
        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === sampleId
              ? {
                  ...s,
                  tastings: [...s.tastings, tasting],
                  status: ['requested', 'received', 'untasted'].includes(s.status) ? 'tasted' : s.status,
                  updatedAt: new Date().toISOString(),
                  synced: false,
                }
              : s
          ),
        })),

      updateSampleStatus: (id, status) =>
        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === id ? { ...s, status, updatedAt: new Date().toISOString(), synced: false } : s
          ),
        })),

      bulkUpdateStatus: (ids, status) => {
        const idSet = new Set(ids);
        set((state) => ({
          samples: state.samples.map((s) =>
            idSet.has(s.id) ? { ...s, status, updatedAt: new Date().toISOString(), synced: false } : s
          ),
        }));
      },

      addSampleSet: (sampleSet) =>
        set((state) => ({
          sampleSets: [{ ...sampleSet, synced: sampleSet.synced ?? false }, ...state.sampleSets],
        })),

      updateSampleSet: (id, updates) =>
        set((state) => ({
          sampleSets: state.sampleSets.map((ss) =>
            ss.id === id ? { ...ss, ...updates, updatedAt: new Date().toISOString(), synced: false } : ss
          ),
        })),

      removeSampleSet: (id) =>
        set((state) => {
          const sampleSet = state.sampleSets.find((ss) => ss.id === id);
          const idsToRemove = new Set(sampleSet?.sampleIds || []);
          const tombstone = sampleSet?.accountId === state.accountScopeId ? id : null;
          return {
            sampleSets: state.sampleSets.filter((ss) => ss.id !== id),
            samples: state.samples.filter((s) => !idsToRemove.has(s.id)),
            activeSetId: state.activeSetId === id ? null : state.activeSetId,
            activeSampleId:
              state.activeSampleId && idsToRemove.has(state.activeSampleId)
                ? null
                : state.activeSampleId,
            sampleSetTombstones: tombstone
              ? Array.from(new Set([...state.sampleSetTombstones, tombstone]))
              : state.sampleSetTombstones,
          };
        }),

      discardSampleSet: (id) =>
        set((state) => {
          const sampleSet = state.sampleSets.find((candidate) => candidate.id === id);
          const idsToRemove = new Set([
            ...(sampleSet?.sampleIds ?? []),
            ...state.samples.filter((sample) => sample.setId === id).map((sample) => sample.id),
          ]);
          return {
            sampleSets: state.sampleSets.filter((candidate) => candidate.id !== id),
            samples: state.samples.filter((sample) => sample.setId !== id && !idsToRemove.has(sample.id)),
            activeSetId: state.activeSetId === id ? null : state.activeSetId,
            activeSampleId: state.activeSampleId && idsToRemove.has(state.activeSampleId) ? null : state.activeSampleId,
            sampleSetTombstones: state.accountScopeId
              ? Array.from(new Set([...state.sampleSetTombstones, id]))
              : state.sampleSetTombstones,
          };
        }),

      archiveSampleSet: (id) => {
        set((state) => ({
          sampleSets: state.sampleSets.map((ss) =>
            ss.id === id ? { ...ss, archived: true, updatedAt: new Date().toISOString(), synced: false } : ss
          ),
          activeSetId: state.activeSetId === id ? null : state.activeSetId,
        }));
      },

      importFromCompass: (compassEntries, setId) => {
        const now = new Date().toISOString();
        const newSamples: TeaSample[] = compassEntries.map((ce) => ({
          id: crypto.randomUUID(),
          name: ce.name,
          chineseName: ce.chineseName,
          type: ce.type as any,
          year: ce.year,
          originRegion: ce.originRegion,
          sourceId: ce.vendorId,
          sourceName: ce.vendorName,
          teaKey: ce.teaKey,
          compassEntryId: ce.id,
          setId,
          tastings: [],
          status: 'untasted' as const,
          grams: ce.grams || 10,
          photos: [],
          createdAt: now,
          updatedAt: now,
          createdBy: 'admin' as const,
          synced: false,
        }));
        set((state) => {
          return {
            samples: [...newSamples, ...state.samples],
            sampleSets: state.sampleSets.map((ss) =>
              ss.id === setId
                ? { ...ss, sampleIds: [...ss.sampleIds, ...newSamples.map((s) => s.id)], updatedAt: now, synced: false }
                : ss
            ),
          };
        });
      },

      setActiveSample: (id) => set({ activeSampleId: id }),
      setActiveSet: (id) => set({ activeSetId: id }),

      getSample: (id) => get().samples.find((s) => s.id === id),
      getSampleSet: (id) => get().sampleSets.find((ss) => ss.id === id),
      getSamplesForSet: (setId) => get().samples.filter((s) => s.setId === setId),
      getSetForSample: (sampleId) => {
        const sample = get().samples.find((s) => s.id === sampleId);
        return sample ? get().sampleSets.find((ss) => ss.id === sample.setId) : undefined;
      },
    }),
    {
      name: 'teajia-samples',
      version: 1,
      migrate: (persisted) => persisted,
      ...(storage ? { storage } : {}),
      merge: mergeSamplePersistedState,
      partialize: (state) => {
        const dataByAccount = { ...state.dataByAccount };
        if (state.accountScopeId) {
          dataByAccount[state.accountScopeId] = {
            samples: state.samples,
            sampleSets: state.sampleSets,
            sampleTombstones: state.sampleTombstones,
            sampleSetTombstones: state.sampleSetTombstones,
            activeSampleId: state.activeSampleId,
            activeSetId: state.activeSetId,
          };
        }
        return {
          samples: state.samples,
          sampleSets: state.sampleSets,
          sampleTombstones: state.sampleTombstones,
          sampleSetTombstones: state.sampleSetTombstones,
          accountScopeId: state.accountScopeId,
          dataByAccount,
        };
      },
    }
  )
  );
}

export const useSampleStore = createSampleStore();

function mergeSamplePersistedState(
  persistedState: unknown,
  currentState: SampleStoreState,
): SampleStoreState {
  const persisted = (persistedState ?? {}) as Partial<SampleStoreState>;
  const activeAccountId = useAppStore.getState().activeAccountId;
  const dataByAccount = { ...(persisted.dataByAccount ?? {}) };
  const facade: SampleAccountData = {
    samples: persisted.samples ?? [],
    sampleSets: persisted.sampleSets ?? [],
    sampleTombstones: persisted.sampleTombstones ?? [],
    sampleSetTombstones: persisted.sampleSetTombstones ?? [],
    activeSampleId: persisted.activeSampleId ?? null,
    activeSetId: persisted.activeSetId ?? null,
  };
  const isUnscopedLegacy = persisted.accountScopeId == null && Object.keys(dataByAccount).length === 0;
  if (isUnscopedLegacy && (facade.samples.length > 0 || facade.sampleSets.length > 0)) {
    dataByAccount[UNSCOPED_LEGACY_ACCOUNT] = facade;
  }
  let target = activeAccountId ? dataByAccount[activeAccountId] : undefined;
  if (!target && activeAccountId && persisted.accountScopeId === activeAccountId) target = facade;
  if (!target && activeAccountId && dataByAccount[UNSCOPED_LEGACY_ACCOUNT]) {
    target = dataByAccount[UNSCOPED_LEGACY_ACCOUNT];
    dataByAccount[activeAccountId] = target;
    delete dataByAccount[UNSCOPED_LEGACY_ACCOUNT];
  }
  return {
    ...currentState,
    ...persisted,
    samples: target?.samples ?? [],
    sampleSets: target?.sampleSets ?? [],
    sampleTombstones: target?.sampleTombstones ?? [],
    sampleSetTombstones: target?.sampleSetTombstones ?? [],
    activeSampleId: target?.activeSampleId ?? null,
    activeSetId: target?.activeSetId ?? null,
    accountScopeId: activeAccountId,
    dataByAccount,
  };
}
