import { authReturnTo, safeAuthReturnTo } from '../lib/authNavigation';

type AdminLocation = { pathname: string; search: string; hash: string };

/** Keep legacy consent links working while all authentication uses /signin. */
export function adminAuthReturnTo(location: AdminLocation): string {
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    const next = safeAuthReturnTo(new URLSearchParams(location.search).get('next'));
    if (next && next !== '/admin' && next !== '/admin/') return next;
  }
  return authReturnTo(location.pathname + location.search + location.hash);
}
