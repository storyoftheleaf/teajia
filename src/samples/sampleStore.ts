import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaSample, SampleSet, SampleTasting, SampleStatus } from './types';

interface SampleStoreState {
  // Data
  samples: TeaSample[];
  sampleSets: SampleSet[];
  accountScopeId: string | null;
  dataByAccount: Record<string, {
    samples: TeaSample[];
    sampleSets: SampleSet[];
    activeSampleId: string | null;
    activeSetId: string | null;
  }>;
  switchAccount: (accountId: string | null) => void;

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

  // Selection
  setActiveSample: (id: string | null) => void;
  setActiveSet: (id: string | null) => void;

  // Getters
  getSample: (id: string) => TeaSample | undefined;
  getSampleSet: (id: string) => SampleSet | undefined;
  getSamplesForSet: (setId: string) => TeaSample[];
  getSetForSample: (sampleId: string) => SampleSet | undefined;
}

export const useSampleStore = create<SampleStoreState>()(
  persist(
    (set, get) => ({
      samples: [],
      sampleSets: [],
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
            activeSampleId: state.activeSampleId,
            activeSetId: state.activeSetId,
          };
        } else if (
          accountId &&
          (state.samples.length > 0 || state.sampleSets.length > 0) &&
          !dataByAccount[accountId]
        ) {
          dataByAccount[accountId] = {
            samples: state.samples,
            sampleSets: state.sampleSets,
            activeSampleId: state.activeSampleId,
            activeSetId: state.activeSetId,
          };
        }
        const target = accountId ? dataByAccount[accountId] : undefined;
        return {
          samples: target?.samples ?? [],
          sampleSets: target?.sampleSets ?? [],
          activeSampleId: target?.activeSampleId ?? null,
          activeSetId: target?.activeSetId ?? null,
          accountScopeId: accountId,
          dataByAccount,
        };
      }),

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
          return {
            samples: state.samples.filter((s) => s.id !== id),
            sampleSets: state.sampleSets.map((ss) =>
              ss.id === sample?.setId
                ? { ...ss, sampleIds: ss.sampleIds.filter((sid) => sid !== id) }
                : ss
            ),
            activeSampleId: state.activeSampleId === id ? null : state.activeSampleId,
          };
        }),

      addTasting: (sampleId, tasting) =>
        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === sampleId
              ? {
                  ...s,
                  tastings: [...s.tastings, tasting],
                  status: s.status === 'untasted' ? 'tasted' : s.status,
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
          sampleSets: [sampleSet, ...state.sampleSets],
        })),

      updateSampleSet: (id, updates) =>
        set((state) => ({
          sampleSets: state.sampleSets.map((ss) =>
            ss.id === id ? { ...ss, ...updates, updatedAt: new Date().toISOString() } : ss
          ),
        })),

      removeSampleSet: (id) =>
        set((state) => {
          const sampleSet = state.sampleSets.find((ss) => ss.id === id);
          const idsToRemove = new Set(sampleSet?.sampleIds || []);
          return {
            sampleSets: state.sampleSets.filter((ss) => ss.id !== id),
            samples: state.samples.filter((s) => !idsToRemove.has(s.id)),
            activeSetId: state.activeSetId === id ? null : state.activeSetId,
            activeSampleId:
              state.activeSampleId && idsToRemove.has(state.activeSampleId)
                ? null
                : state.activeSampleId,
          };
        }),

      archiveSampleSet: (id) => {
        set((state) => ({
          sampleSets: state.sampleSets.map((ss) =>
            ss.id === id ? { ...ss, archived: true, updatedAt: new Date().toISOString() } : ss
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
                ? { ...ss, sampleIds: [...ss.sampleIds, ...newSamples.map((s) => s.id)], updatedAt: now }
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
      partialize: (state) => {
        const dataByAccount = { ...state.dataByAccount };
        if (state.accountScopeId) {
          dataByAccount[state.accountScopeId] = {
            samples: state.samples,
            sampleSets: state.sampleSets,
            activeSampleId: state.activeSampleId,
            activeSetId: state.activeSetId,
          };
        }
        return {
          samples: state.samples,
          sampleSets: state.sampleSets,
          accountScopeId: state.accountScopeId,
          dataByAccount,
        };
      },
    }
  )
);
