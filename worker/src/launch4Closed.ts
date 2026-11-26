/**
 * Launch 4's routes while their switch is off (A4 review, finding 12).
 *
 * A closed route must answer exactly as a route that does not exist: the same
 * status, body and headers, before any sign-in or role is read. So the router
 * asks here first, and a closed route is taken out of the table for that
 * request; whatever the request then matches (usually nothing, so the
 * unknown-route 404) is the answer. Each handler keeps its own switch check
 * as well, for the tests and agent tools that call it directly.
 */
import { favouritesOpen } from '../../src/lib/favouritesOpen';
import { hostArticlesOpen } from '../../src/lib/hostArticles';
import { teaHousesOpen } from '../../src/lib/teaHouses';
import { teaTableOpen } from '../../src/lib/teaTable';
import { topTeasOpen } from '../../src/lib/topTeas';
import { yourTablePageOpen } from '../../src/lib/yourTablePage';
import { yourTablePlaceOpen } from '../../src/lib/yourTablePlace';
import { fewHostsOpen } from '../../src/lib/fewHosts';
import { acknowledgementOpen } from './photographCredit';

export type Launch4Env = {
  TEA_TABLE_OPEN?: string; FAVOURITES_OPEN?: string; YOUR_TABLE_PAGE_OPEN?: string; HOST_ARTICLES_OPEN?: string;
  TOP_TEAS_OPEN?: string; TEA_HOUSES_OPEN?: string; YOUR_TABLE_PLACE_OPEN?: string; FEW_HOSTS_OPEN?: string;
};

type Gate = (env: Launch4Env) => boolean;

/** Route patterns (as written in the route table, without the method), each with what opens it. */
const GATES: Array<[RegExp, Gate]> = [
  [/^\/api\/(admin\/)?tea-table(\/|$)/, env => teaTableOpen(env)],
  [/^\/api\/family\/photographs\/:id\/credit$/, env => acknowledgementOpen(env)],
  [/^\/api\/me\/favourites(\/|$)/, env => favouritesOpen(env)],
  [/^\/api\/me\/cellar\/:id\/favourite$/, env => favouritesOpen(env)],
  [/^\/api\/(admin\/)?tea-houses(\/|$)/, env => teaHousesOpen(env)],
  [/^\/api\/(me\/|admin\/)?article-offers(\/|$)/, env => hostArticlesOpen(env)],
  [/^\/api\/public\/people\/:slug\/top-teas(\/|$)/, env => topTeasOpen(env)],
  [/^\/api\/family\/tasting-shares$/, env => yourTablePageOpen(env)],
  [/^\/api\/me\/your-table$/, env => yourTablePlaceOpen(env) && fewHostsOpen(env)],
];

/** Whether the route with this pattern belongs to a Launch 4 part that is closed. */
export function launch4RouteClosed(pattern: string, env: Launch4Env): boolean {
  for (const [match, open] of GATES) {
    if (match.test(pattern)) return !open(env);
  }
  return false;
}

/** The route table as it stands for this request, with every closed Launch 4 route left out. */
export function openRoutes<R extends [string, string, ...unknown[]]>(routes: R[], env: Launch4Env): R[] {
  return routes.filter(route => !launch4RouteClosed(route[1], env));
}
