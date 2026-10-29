export type ClientIncidentCategory = 'network' | 'configuration' | 'server' | 'auth' | 'authorization' | 'workflow' | 'client';

export interface ClassifiedIncident {
  signature: string;
  category: ClientIncidentCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  route: string;
  method: string;
  http_status: number | null;
  error_code: string;
  safe_message: string;
  userMessage: string;
  sample: { browser_online: boolean | null };
}

function normalizedRoute(route: string): string {
  return route.split('?')[0] || '/unknown';
}

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
 * The display side already reads a route this way — `areaFor` in
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

function routeSlug(route: string): string {
  return incidentRouteTemplate(normalizedRoute(route)).replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
}

function errorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' && Number.isInteger(status) ? status : null;
}

export function classifyIncident(error: unknown, context: { route: string; method?: string }): ClassifiedIncident {
  const status = errorStatus(error);
  const message = error instanceof Error ? error.message : 'Unexpected client failure';
  const lower = message.toLowerCase();
  const route = normalizedRoute(context.route);
  const method = (context.method || 'GET').toUpperCase();
  let category: ClientIncidentCategory = 'client';
  let severity: ClassifiedIncident['severity'] = 'medium';
  let errorCode = 'unknown';
  let userMessage = 'Something prevented this from loading. Incident recorded.';

  if (/upstream is not configured|missing.*configuration|configuration.*missing/.test(lower)) {
    category = 'configuration'; severity = 'high'; errorCode = 'upstream_not_configured';
    userMessage = 'A service configuration problem is preventing this from loading. Incident recorded.';
  } else if (status === 401 || /session expired/.test(lower)) {
    category = 'auth'; severity = 'high'; errorCode = 'session_expired';
    userMessage = 'Your session needs to be renewed. Incident recorded.';
  } else if (status === 403 || /account access denied/.test(lower)) {
    category = 'authorization'; severity = 'high'; errorCode = 'access_denied';
    userMessage = 'Your access state could not be resolved. Incident recorded.';
  } else if (status !== null && status >= 500) {
    category = 'server'; severity = 'high'; errorCode = `http_${status}`;
    userMessage = 'The service could not complete this request. Incident recorded.';
  } else if (/timed out/.test(lower)) {
    category = 'network'; severity = 'medium'; errorCode = 'timeout';
    userMessage = 'The connection timed out. Incident recorded.';
  } else if (/couldn.t reach|network|offline|failed to fetch|load failed/.test(lower)) {
    category = 'network'; severity = 'medium'; errorCode = 'transport_failure';
    userMessage = 'The service could not be reached. Incident recorded.';
  }

  return {
    signature: `${category}:${method.toLowerCase()}:${routeSlug(route)}:${status ?? 'none'}:${errorCode}`,
    category, severity, route, method, http_status: status, error_code: errorCode,
    safe_message: message.slice(0, 300), userMessage,
    sample: { browser_online: typeof navigator === 'undefined' ? null : navigator.onLine },
  };
}
