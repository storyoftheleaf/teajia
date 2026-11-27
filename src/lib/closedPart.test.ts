import { describe, expect, it, vi } from 'vitest';
import { isNotHereYet, partRetry, partView } from './closedPart';

const base = { data: undefined, error: null, isError: false, isPending: true, fetchStatus: 'fetching' as const, refetch: () => undefined };

describe('closedPart: a door reads its own route', () => {
  it('reads a 404 from the part as "not here yet", and nothing else', () => {
    expect(isNotHereYet({ status: 404 })).toBe(true);
    for (const error of [{ status: 500 }, { status: 403 }, new Error('Request timed out. Please try again.'), null, undefined, 'x']) {
      expect(isNotHereYet(error)).toBe(false);
    }
  });

  it('never retries a 404, retries a 5xx or 408 once, and nothing else', () => {
    expect(partRetry(0, { status: 404 })).toBe(false);
    expect(partRetry(0, { status: 500 })).toBe(true);
    expect(partRetry(0, { status: 408 })).toBe(true);
    expect(partRetry(1, { status: 500 })).toBe(false);
    expect(partRetry(0, { status: 400 })).toBe(false);
    expect(partRetry(0, new Error('offline'))).toBe(false);
  });

  it('a closed route is closed, a failed load offers a retry that refetches', () => {
    expect(partView({ ...base, isError: true, isPending: false, error: { status: 404 } })).toEqual({ state: 'closed' });
    const refetch = vi.fn();
    const failed = partView({ ...base, isError: true, isPending: false, error: { status: 500 }, refetch });
    expect(failed.state).toBe('failed');
    if (failed.state === 'failed') failed.retry();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('loading, not asked, and ready', () => {
    expect(partView(base)).toEqual({ state: 'loading' });
    expect(partView({ ...base, fetchStatus: 'idle' })).toEqual({ state: 'off' });
    expect(partView({ ...base, isPending: false, data: { items: [] } })).toEqual({ state: 'ready', data: { items: [] } });
  });

  it('an answer of the wrong shape is a failed load, not a crash', () => {
    const view = partView<{ event_date?: string }>({ ...base, isPending: false, data: {} }, data => typeof data.event_date === 'string');
    expect(view.state).toBe('failed');
  });
});
