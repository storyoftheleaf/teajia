import type { Route } from '@playwright/test';

/**
 * Answer GET /api/curate/holdings the way the worker does.
 *
 * Asked with `paged=1` (api.curate.allHoldings, which the Samples screens use),
 * the worker sends one bounded page, `{ holdings, has_more, next_cursor }`
 * (worker/src/curateHoldings.ts). Without it, the plain array. A mock that only
 * knows the array hands the paged reader an object with no `holdings`, which it
 * reads as an empty shelf, so the Samples screen shows nothing.
 */
export function fulfillHoldings(route: Route, holdings: unknown[]) {
  const paged = new URL(route.request().url()).searchParams.get('paged') === '1';
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(paged ? { holdings, has_more: false, next_cursor: null } : holdings),
  });
}
