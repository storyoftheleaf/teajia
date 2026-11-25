import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminRouteHasOwnBack, historyIndex } from './adminHistory';

describe('admin back row', () => {
  it('stays off pages that carry their own Back', () => {
    for (const path of ['/admin/compass', '/admin/compass/v2', '/admin/vendors/v1', '/admin/people/c1', '/admin/products/p1/story', '/admin/events/e1', '/admin/tasting-events/new', '/admin/collections/x', '/admin/platform/audit-log']) {
      expect(adminRouteHasOwnBack(path), path).toBe(true);
    }
  });

  it('shows on section pages that have none', () => {
    for (const path of ['/admin/people', '/admin/stock', '/admin/activity', '/admin/network', '/admin/events', '/admin/tasting-events', '/admin/wisdom', '/admin/compassion']) {
      expect(adminRouteHasOwnBack(path), path).toBe(false);
    }
  });
});

describe('historyIndex', () => {
  const withState = (state: unknown) => vi.stubGlobal('window', { history: { state } });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the position React Router records', () => {
    withState({ idx: 3, key: 'k' });
    expect(historyIndex()).toBe(3);
  });

  it('is 0 on the first page of a visit or without a recorded position', () => {
    withState(null);
    expect(historyIndex()).toBe(0);
    withState({ idx: 'x' });
    expect(historyIndex()).toBe(0);
  });
});
