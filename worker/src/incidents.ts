export const INCIDENT_CATEGORIES = ['network', 'configuration', 'server', 'auth', 'authorization', 'workflow', 'client'] as const;
export const INCIDENT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const INCIDENT_STATUSES = ['open', 'acknowledged', 'repairing', 'observing', 'resolved'] as const;

export type IncidentCategory = typeof INCIDENT_CATEGORIES[number];
export type IncidentSeverity = typeof INCIDENT_SEVERITIES[number];
export type IncidentStatus = typeof INCIDENT_STATUSES[number];

export interface IncidentInput {
  category?: string;
  severity?: string;
  signature?: string;
  route?: string;
  method?: string;
  http_status?: number | null;
  error_code?: string;
  safe_message?: string;
  deployment?: string | null;
  sample?: unknown;
}

export interface NormalizedIncident {
  signature: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  route: string | null;
  method: string | null;
  httpStatus: number | null;
  errorCode: string;
  safeMessage: string;
  deployment: string | null;
  sample: Record<string, unknown>;
}

const ALLOWED_SAMPLE_KEYS = new Set([
  'online', 'browser_online', 'visibility', 'correlation_id', 'query_key', 'response_reason',
  'active_account_present', 'attempt', 'timeout_ms', 'status',
]);
const MAX_PAYLOAD_BYTES = 8 * 1024;
const MAX_STRING_LENGTH = 500;

function slug(value: string, fallback: string): string {
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized.slice(0, 80) || fallback;
}

function routeSlug(route: string | null): string {
  if (!route) return 'unknown_route';
  return route.replace(/^\/+/, '').replace(/\?.*$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 100) || 'root';
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 2) return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return /^[a-zA-Z0-9._:/ -]{1,120}$/.test(value) ? value : undefined;
  if (Array.isArray(value)) return undefined;
  if (typeof value !== 'object') return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    if (!ALLOWED_SAMPLE_KEYS.has(key)) continue;
    const safeChild = sanitizeValue(child, depth + 1);
    if (safeChild !== undefined) result[key] = safeChild;
  }
  return result;
}

export function sanitizeIncidentSample(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(value, 0);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
}

export function normalizeIncidentInput(input: IncidentInput): NormalizedIncident {
  if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_PAYLOAD_BYTES) {
    throw new Error('Incident payload exceeds 8 KB');
  }
  if (!INCIDENT_CATEGORIES.includes(input.category as IncidentCategory)) throw new Error('Invalid incident category');
  if (!INCIDENT_SEVERITIES.includes(input.severity as IncidentSeverity)) throw new Error('Invalid incident severity');

  const category = input.category as IncidentCategory;
  const severity = input.severity as IncidentSeverity;
  const route = typeof input.route === 'string' ? input.route.split('?')[0].slice(0, 240) : null;
  const method = typeof input.method === 'string' ? input.method.toUpperCase().slice(0, 10) : null;
  const httpStatus = Number.isInteger(input.http_status) ? Number(input.http_status) : null;
  const errorCode = slug(input.error_code || 'unknown', 'unknown');
  const generated = `${category}:${(method || 'unknown').toLowerCase()}:${routeSlug(route)}:${httpStatus ?? 'none'}:${errorCode}`;
  const signature = input.signature ? slug(input.signature, generated) : generated;

  return {
    signature: signature.slice(0, 240), category, severity, route, method, httpStatus, errorCode,
    // Narrative supplied by a client is untrusted and must never enter an AI
    // repair queue. Persist a server-owned classification sentence only.
    safeMessage: category === 'configuration' ? 'Service configuration failure.'
      : category === 'network' ? 'Network transport failure.'
      : category === 'server' ? 'Server request failure.'
      : category === 'auth' ? 'Authentication state failure.'
      : category === 'authorization' ? 'Authorization state failure.'
      : category === 'workflow' ? 'Workflow could not progress.'
      : 'Client application failure.',
    deployment: typeof input.deployment === 'string' ? input.deployment.slice(0, 80) : null,
    sample: sanitizeIncidentSample(input.sample),
  };
}

export function incidentToApi(row: Record<string, unknown>) {
  let sample: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.sample_json || '{}'));
    sample = sanitizeIncidentSample(parsed);
  } catch { /* malformed legacy sample remains empty */ }
  const { sample_json: _sampleJson, ...rest } = row;
  return { ...rest, sample };
}

export async function upsertIncident(
  db: D1Database,
  incident: NormalizedIncident,
  context: { accountId?: string | null; userId?: string | null },
) {
  const id = crypto.randomUUID();
  const sampleJson = JSON.stringify(incident.sample);
  await db.prepare(`
    INSERT INTO incident_ledger
      (id, signature, category, severity, status, first_seen, last_seen, occurrence_count,
       route, method, http_status, error_code, safe_message, deployment, account_id, user_id, sample_json)
    VALUES (?, ?, ?, ?, 'open', datetime('now'), datetime('now'), 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(signature) DO UPDATE SET
      last_seen = datetime('now'),
      occurrence_count = incident_ledger.occurrence_count + 1,
      severity = CASE
        WHEN excluded.severity = 'critical' THEN 'critical'
        WHEN excluded.severity = 'high' AND incident_ledger.severity NOT IN ('critical') THEN 'high'
        WHEN excluded.severity = 'medium' AND incident_ledger.severity = 'low' THEN 'medium'
        ELSE incident_ledger.severity
      END,
      status = CASE WHEN incident_ledger.status = 'resolved' THEN 'open' ELSE incident_ledger.status END,
      resolved_at = CASE WHEN incident_ledger.status = 'resolved' THEN NULL ELSE incident_ledger.resolved_at END,
      sample_json = CASE
        WHEN length(excluded.sample_json) > length(incident_ledger.sample_json) THEN excluded.sample_json
        ELSE incident_ledger.sample_json
      END
  `).bind(
    id, incident.signature, incident.category, incident.severity,
    incident.route, incident.method, incident.httpStatus, incident.errorCode,
    incident.safeMessage, incident.deployment, context.accountId ?? null, context.userId ?? null, sampleJson,
  ).run();
  return db.prepare('SELECT * FROM incident_ledger WHERE signature = ?').bind(incident.signature).first<Record<string, unknown>>();
}
