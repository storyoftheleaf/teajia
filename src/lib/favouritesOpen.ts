// Launch 4, favourites in three kinds (todo/plans/guests-and-tea-masters-launch-4-run.md, K3).
//
// One switch for everything the favourites part adds: the page at
// /account/favourites, "Keep" on an article, the favourite mark on a Tea Chest
// tea, and the routes under /api/me/favourites and /api/me/cellar/:id/favourite.
// Off until Adrian says "ship" for the launch. Closed, the routes answer 404
// and none of the controls appear.
//
// An explicit setting wins over the constant, either way: the site reads
// VITE_FAVOURITES_OPEN ('true' or 'false'), the worker reads the
// FAVOURITES_OPEN variable.
export const FAVOURITES_OPEN = false;

type Env = { FAVOURITES_OPEN?: string } | null | undefined;

/** Whether favourites are open, on the site or in the worker. */
export function favouritesOpen(env?: Env): boolean {
  if (env?.FAVOURITES_OPEN === 'true') return true;
  if (env?.FAVOURITES_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FAVOURITES_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return FAVOURITES_OPEN;
}

export function favouritesPath(): string {
  return favouritesOpen() ? '/account/favourites' : '/account/collection';
}
