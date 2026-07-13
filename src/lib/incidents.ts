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

function routeSlug(route: string): string {
  return normalizedRoute(route).replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
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
