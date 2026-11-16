/** Shapes a path segment takes when it is an identifier rather than a word. */
const PATH_IDENTIFIER: RegExp[] = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[0-9a-f]{16,}$/i,
  /^\d+$/,
  /^[A-Za-z0-9_-]{32,}$/,
];

/**
 * One route, one signature: an identifier in the path is not part of what broke.
 *
 * `GET /api/curate/ar-create/requests/<job id>` is polled with a fresh id for
 * every archive read, so leaving the id in meant the ledger's
 * `UNIQUE(signature)` never matched. The same recurring fault opened a brand-new
 * `high` row per request, each counted as new and so each handed to the repair
 * queue, instead of raising the occurrence count on one row. It also crowded the
 * status and the error code off the end of the signature, which are its last two
 * fields, so a 500 and a 504 on that route became one indistinguishable row.
 *
 * The display side already reads a route this way: `areaFor` in
 * `incidentWords.ts` strips the id out of the words it writes for the owner. The
 * identity side did not.
 */
export function incidentRouteTemplate(route: string): string {
  const path = (route || '').split('?')[0];
  if (!path) return '/unknown';
  return path
    .split('/')
    .map(segment => (segment && PATH_IDENTIFIER.some(shape => shape.test(segment)) ? ':id' : segment))
    .join('/');
}

export function incidentRouteSlug(route: string): string {
  return route.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
}
