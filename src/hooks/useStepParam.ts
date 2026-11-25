import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The one way an admin screen records where the person is.
 *
 * A tab, a screen, an open record or panel is a STEP: it lives in the address
 * and is its own history entry, so the browser's back and forward (and the
 * admin's Back row) walk through it. Typing, filters and sorting REFINE the
 * page in place: they live in the address too, so a link or a reload keeps
 * them, but they replace the current entry rather than flood history.
 *
 * Rule and reasons: CLAUDE.md, "Back and forward". Guard:
 * src/admin/guards/historySteps.test.ts.
 *
 *   const [tab, setTab] = useStepParam('tab', 'customers');
 *   setTab('sources');                    // a step: back returns to customers
 *   const [q, setQ] = useStepParam('q');
 *   setQ(text, { refine: true });         // a refinement: no new history entry
 *
 * `null` or '' removes the key. Other keys in the address are kept
 * unless `only` is set, which writes this key alone (a tab change that should
 * drop the previous tab's filters).
 */
export function useStepParam(key: string, fallback = '') {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = raw ?? fallback;
  const set = useCallback(
    (next: string | null, options: { refine?: boolean; only?: boolean } = {}) => {
      // Choosing what is already showing is not a step.
      if ((next || fallback) === (raw ?? fallback)) return;
      setParams(current => {
        const out = options.only ? new URLSearchParams() : new URLSearchParams(current);
        if (next === null || next === '') out.delete(key);
        else out.set(key, next);
        return out;
      }, options.refine ? { replace: true } : undefined);
    },
    [key, fallback, raw, setParams],
  );
  return [value, set] as const;
}
