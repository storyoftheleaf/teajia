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

/** What a write did to the ledger: opened a row, reopened a resolved one, or only counted. */
export type IncidentChange = 'new' | 'reopened' | 'repeat';
export interface IncidentWrite {
  row: Record<string, unknown> | null;
  change: IncidentChange;
}

export async function upsertIncident(
  db: D1Database,
  incident: NormalizedIncident,
  context: { accountId?: string | null; userId?: string | null },
): Promise<IncidentWrite> {
  const id = crypto.randomUUID();
  const sampleJson = JSON.stringify(incident.sample);
  // The ledger has a global UNIQUE(signature). Include the verified tenant in
  // that key so one store's report cannot reopen or escalate another's row.
  const signature = `${context.accountId ?? '__global__'}:${incident.signature}`.slice(0, 240);
  // Read the status first so the caller can tell a new problem from a repeat.
  // Not atomic with the upsert; two simultaneous first reports may both read
  // "new", which costs at most one extra alert, and the daily cap bounds that.
  const before = await db.prepare('SELECT status FROM incident_ledger WHERE signature = ?')
    .bind(signature).first<{ status: string }>();
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
      resolution_ref = CASE WHEN incident_ledger.status = 'resolved' THEN NULL ELSE incident_ledger.resolution_ref END,
      safe_message = excluded.safe_message,
      sample_json = CASE
        WHEN length(excluded.sample_json) > length(incident_ledger.sample_json) THEN excluded.sample_json
        ELSE incident_ledger.sample_json
      END
  `).bind(
    id, signature, incident.category, incident.severity,
    incident.route, incident.method, incident.httpStatus, incident.errorCode,
    incident.safeMessage, incident.deployment, context.accountId ?? null, context.userId ?? null, sampleJson,
  ).run();
  const row = await db.prepare('SELECT * FROM incident_ledger WHERE signature = ?').bind(signature).first<Record<string, unknown>>();
  const change: IncidentChange = !before ? 'new' : before.status === 'resolved' ? 'reopened' : 'repeat';
  return { row, change };
}

/**
 * Server-side health problems: the cron's way of putting a standing fault in
 * the same ledger the site's other problems live in.
 *
 * `message` here is written by this codebase, never by a client, which is why
 * it is allowed to say more than the one-sentence category classification
 * `normalizeIncidentInput` forces on reported incidents. That rule exists to
 * keep client narrative out of the AI repair queue; a sentence built from our
 * own counters and our own failure strings is not that.
 *
 * The signature is the caller's and FIXED, so an hourly check upserts one row
 * rather than opening a new one each tick. A row that was resolved and goes bad
 * again reopens (`upsertIncident` flips resolved back to open, clears the
 * resolution and counts the occurrence), which is what makes a recurring fault
 * visible as a recurring fault instead of a series of unrelated tickets.
 */
export interface HealthProblemInput {
  signature: string;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  route?: string;
  method?: string;
  errorCode: string;
  message: string;
  httpStatus?: number | null;
}

export async function recordHealthProblem(db: D1Database, input: HealthProblemInput): Promise<IncidentWrite> {
  const normalized = normalizeIncidentInput({
    category: input.category ?? 'server',
    severity: input.severity ?? 'high',
    signature: input.signature,
    route: input.route,
    method: input.method,
    http_status: input.httpStatus ?? null,
    error_code: input.errorCode,
  });
  normalized.safeMessage = input.message.replace(/\s+/g, ' ').trim().slice(0, MAX_STRING_LENGTH);
  return upsertIncident(db, normalized, { accountId: null, userId: null });
}

/**
 * The problem has gone away: mark it resolved, once. Idempotent and cheap, so a
 * check can call it on every healthy tick without first asking whether there is
 * anything to clear. Returns whether a row actually changed.
 */
export async function clearHealthProblem(db: D1Database, signature: string, ref: string): Promise<boolean> {
  const key = `__global__:${slug(signature, signature)}`.slice(0, 240);
  const result = await db.prepare(`
    UPDATE incident_ledger
       SET status = 'resolved', resolved_at = datetime('now'), resolution_ref = ?
     WHERE signature = ? AND status != 'resolved'
  `).bind(ref.slice(0, 200), key).run();
  return Number(result.meta?.changes ?? 0) > 0;
}
