import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeaSample, SampleSet, SampleTasting, SampleStatus } from './types';

interface SampleStoreState {
  // Data
  samples: TeaSample[];
  sampleSets: SampleSet[];

  // Active selections
  activeSampleId: string | null;
  activeSetId: string | null;

  // Sample actions
  addSample: (sample: TeaSample) => void;
  updateSample: (id: string, updates: Partial<TeaSample>) => void;
  removeSample: (id: string) => void;
  addTasting: (sampleId: string, tasting: SampleTasting) => void;
  updateSampleStatus: (id: string, status: SampleStatus) => void;

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
      activeSampleId: null,
      activeSetId: null,

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
      partialize: (state) => ({
        samples: state.samples,
        sampleSets: state.sampleSets,
      }),
    }
  )
);
