import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

/**
 * walkthroughStore, the "walk with me" companion state. When the owner starts
 * a walk-through from the guide, the active walk-through + its steps live here,
 * and a floating dock (mounted at the app root) reads this so it follows the
 * owner across every page as they click "try it". Per-step verdicts and notes
 * (works / broken / looks wrong) are logged here and rolled up into the
 * "problems found" view back in the guide.
 *
 * Persisted to localStorage so navigating to a real admin page, or a full
 * reload mid-walk, never loses the active session or the problems logged.
 * This is owner-only tooling; nothing here is customer data.
 *
 * Durable save: every verdict/note also writes through to D1 (feature_status,
 * keyed by `${activeId}#${stepIndex}`) the instant it's set, so flagging a
 * problem on step 1 of 3 is saved server-side immediately, not just in
 * localStorage. The local log is the live working copy; D1 is the record that
 * the briefing guide's "problems found" rollup and the TODO.md sync read from.
 * Finishing a walk-through no longer wipes the log, problems persist until the
 * next walk-through is started.
 */

/** Map a dock verdict onto the feature_status `works` enum the backend stores. */
const WORKS_FOR_VERDICT: Record<StepVerdict, string> = {
  unset: 'unknown',
  ok: 'works',
  looks_wrong: 'needs_revision',
  broken: 'broken',
};

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

/**
 * Write one step's verdict + note through to D1. The step id matches the guide's
 * checkbox key (`${walkthroughId}#${index}`) so a flagged problem and the manual
 * "done" checkbox share the same feature_status row. Debounced per step so
 * typing a note doesn't fire a request per keystroke; verdict changes flush on
 * the same timer. Fire-and-forget: a failed save keeps the localStorage copy, so
 * nothing is lost, it just isn't on the server until the next successful write.
 */
const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function persistStep(walkId: string, index: number, verdict: StepVerdict, note: string) {
  const featureId = `${walkId}#${index}`;
  if (saveTimers[featureId]) clearTimeout(saveTimers[featureId]);
  saveTimers[featureId] = setTimeout(() => {
    delete saveTimers[featureId];
    api.featureStatus
      .save(featureId, {
        works: WORKS_FOR_VERDICT[verdict],
        tested: verdict === 'ok',
        notes: note,
      })
      .catch(() => { /* localStorage keeps the working copy; retry on next edit */ });
  }, 500);
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

      // Starting a new walk-through clears the local working log (the prior
      // walk's problems are already saved in D1). Stopping keeps the log so the
      // owner can reopen the dock or review what they flagged before moving on.
      start: (id, title, steps) => set({ activeId: id, activeTitle: title, steps, current: 0, log: {}, collapsed: false }),
      stop: () => set({ activeId: null, activeTitle: '', steps: [], current: 0, collapsed: false }),
      setCurrent: (i) => set({ current: i }),
      setVerdict: (i, verdict) => set((s) => {
        const note = s.log[i]?.note ?? '';
        if (s.activeId) persistStep(s.activeId, i, verdict, note);
        return { log: { ...s.log, [i]: { verdict, note } } };
      }),
      setNote: (i, note) => set((s) => {
        const verdict = s.log[i]?.verdict ?? 'unset';
        if (s.activeId) persistStep(s.activeId, i, verdict, note);
        return { log: { ...s.log, [i]: { verdict, note } } };
      }),
      setCollapsed: (v) => set({ collapsed: v }),
    }),
    { name: 'teajia-walkthrough' },
  ),
);
