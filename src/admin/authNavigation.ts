import { authReturnTo, safeAuthReturnTo } from '../lib/authNavigation';
import { buildManageItems } from '../components/manageNav';
import { getVisibleAdminItemIds, type AdminNavAccess } from '../components/navigationConnections';
import type { PlatformRole } from '../types';
import { carryQuery } from './carryQuery';

type AdminLocation = { pathname: string; search: string; hash: string };

/** Keep legacy consent links working while all authentication uses /signin. */
export function adminAuthReturnTo(location: AdminLocation): string {
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    const next = safeAuthReturnTo(new URLSearchParams(location.search).get('next'));
    if (next && next !== '/admin' && next !== '/admin/') return next;
  }
  return authReturnTo(location.pathname + location.search + location.hash);
}

/** Open the first room admitted by the same rules that order and show Manage rooms. */
export function adminLandingPath(access: AdminNavAccess, platformRole: PlatformRole): string {
  const rooms = buildManageItems({ ...access, platformRole });
  const [firstRoom] = getVisibleAdminItemIds(access, rooms.map(room => room.id));
  return rooms.find(room => room.id === firstRoom)?.path ?? '/';
}

export function adminLandingRedirect(path: string, search: string, hasCatalog: boolean): string {
  if (path === '/admin/stock' && !hasCatalog) {
    const query = new URLSearchParams(search);
    // Stock is open, while its Drafts subview requires catalog access.
    if (query.get('view') === 'drafts') query.delete('view');
    return carryQuery(path, query.toString());
  }
  return carryQuery(path, search);
}
