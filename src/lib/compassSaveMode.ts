import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CompassSaveMode = 'personal' | 'inventory';

interface SaveModeStore {
  mode: CompassSaveMode;
  setMode: (mode: CompassSaveMode) => void;
}

// Sticky preference: defaults to 'personal' on first use, then remembers the
// user's last choice so the segmented control reflects intent across sessions.
export const useCompassSaveMode = create<SaveModeStore>()(
  persist(
    (set) => ({
      mode: 'personal',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'teajia.compass.lastSaveMode' },
  ),
);
