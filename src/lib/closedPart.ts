/**
 * How a site door reads a part that may be closed (A10-3, W5; the run sheet's
 * contract, adopted 2026-11-27).
 *
 * Pages and the worker deploy separately, so for some minutes the site can
 * offer a part whose routes the worker still keeps closed. A closed route
 * answers 404, exactly as an address that does not exist (A10-7). So a door
 * reads a 404 from its own route as "not here yet" and shows nothing of the
 * part: a section renders nothing, a whole page renders what the address
 * showed before the launch (the site's not-found page).
 *
 * Any other failure (a 5xx, a timeout, no network) is a failed load: one plain
 * sentence and a Try again button (`LoadFailed`). The failure itself already
 * goes to the incident ledger from `handleResponse`; nothing here shows a
 * banner or the server's words.
 *
 * Use: spread `PART_QUERY` into the part's `useQuery` options, then switch on
 * `partView(query)`.
 */

/** True when the part's own route answered 404: the worker has not opened it (or there is nothing here). */
export function isNotHereYet(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404;
}

/**
 * The retry rule for a part's read: a 404 is an answer, never retried; a 408
 * or 5xx is tried once more, so a person waits seconds, not half a minute,
 * before the Try again button shows (W5-1).
 */
export function partRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || isNotHereYet(error)) return false;
  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === 'number' && (status === 408 || status >= 500);
}

/** Spread into a part's `useQuery` options. */
export const PART_QUERY = { retry: partRetry } as const;

export type PartView<T> =
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'closed' }
  | { state: 'failed'; retry: () => void }
  | { state: 'ready'; data: T };

type PartQuery<T> = {
  data: T | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
  fetchStatus?: 'fetching' | 'paused' | 'idle';
  refetch: () => unknown;
};

/**
 * The four states a door shows, from a React Query result. A query that is
 * not enabled (pending and idle) is `off`: the door is not asked, and shows
 * nothing. `accept` refuses an answer of the wrong shape, which reads as a
 * failed load rather than a crash (W5-2).
 */
export function partView<T>(query: PartQuery<T>, accept?: (data: T) => boolean): PartView<T> {
  if (query.isError) {
    if (isNotHereYet(query.error)) return { state: 'closed' };
    return { state: 'failed', retry: () => { void query.refetch(); } };
  }
  if (query.data !== undefined) {
    if (accept && !accept(query.data)) return { state: 'failed', retry: () => { void query.refetch(); } };
    return { state: 'ready', data: query.data };
  }
  if (query.isPending && query.fetchStatus === 'idle') return { state: 'off' };
  return { state: 'loading' };
}
