import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * walkthroughStore — the "walk with me" companion state. When the owner starts
 * a walk-through from the guide, the active walk-through + its steps live here,
 * and a floating dock (mounted at the app root) reads this so it follows the
 * owner across every page as they click "try it". Per-step verdicts and notes
 * (works / broken / looks wrong) are logged here and rolled up into the
 * "problems found" view back in the guide.
 *
 * Persisted to localStorage so navigating to a real admin page — or a full
 * reload mid-walk — never loses the active session or the problems logged.
 * This is owner-only tooling; nothing here is customer data.
 */

export type StepVerdict = 'unset' | 'ok' | 'broken' | 'looks_wrong';

export interface WalkStep {
  text: string;
  to?: string;
  goLabel?: string;
}

export interface WalkLogEntry {
  verdict: StepVerdict;
  note: string;
}

interface WalkthroughState {
  /** id of the walk-through currently being walked, or null. */
  activeId: string | null;
  activeTitle: string;
  steps: WalkStep[];
  /** index of the step the dock is focused on. */
  current: number;
  /** stepIndex -> verdict + note. */
  log: Record<number, WalkLogEntry>;
  /** dock collapsed to a pill vs expanded. */
  collapsed: boolean;

  start: (id: string, title: string, steps: WalkStep[]) => void;
  stop: () => void;
  setCurrent: (i: number) => void;
  setVerdict: (i: number, verdict: StepVerdict) => void;
  setNote: (i: number, note: string) => void;
  setCollapsed: (v: boolean) => void;
}

export const useWalkthrough = create<WalkthroughState>()(
  persist(
    (set) => ({
      activeId: null,
      activeTitle: '',
      steps: [],
      current: 0,
      log: {},
      collapsed: false,

      start: (id, title, steps) => set({ activeId: id, activeTitle: title, steps, current: 0, log: {}, collapsed: false }),
      stop: () => set({ activeId: null, activeTitle: '', steps: [], current: 0, log: {}, collapsed: false }),
      setCurrent: (i) => set({ current: i }),
      setVerdict: (i, verdict) => set((s) => ({ log: { ...s.log, [i]: { verdict, note: s.log[i]?.note ?? '' } } })),
      setNote: (i, note) => set((s) => ({ log: { ...s.log, [i]: { verdict: s.log[i]?.verdict ?? 'unset', note } } })),
      setCollapsed: (v) => set({ collapsed: v }),
    }),
    { name: 'teajia-walkthrough' },
  ),
);
