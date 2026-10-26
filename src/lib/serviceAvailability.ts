/** Capacity failures cannot heal through immediate retries. Keep this separate
 * from durable-write classification: a queued edit must survive an outage. */
export const SERVICE_CAPACITY_CODES = new Set(['database_quota_exceeded', 'service_capacity_exceeded']);
const MAX_COOLDOWN_MS = 60_000;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

export function isServiceCapacityError(error: unknown): boolean {
  const data = record(record(error)?.data);
  return typeof data?.code === 'string' && SERVICE_CAPACITY_CODES.has(data.code);
}

/** React Query has its own retry layer above the transport's network retries. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || isServiceCapacityError(error)) return false;
  // A request that exceeds its own budget must be narrowed, not replayed.
  const data = record(record(error)?.data);
  if (data?.retryable === false || data?.error === 'database_read_budget_exceeded') return false;
  const status = record(error)?.status;
  if (typeof status === 'number') return status === 408 || status >= 500;
  // Transport already exhausts network/timeout retries before rejecting.
  return false;
}

/** An incident write to the same unavailable database only amplifies an outage.
 * Capacity alerts must come from the independent operational monitor. */
export function shouldReportServiceIncident(error: unknown): boolean {
  return !isServiceCapacityError(error);
}

type CapacityFailure = { until: number; body: Record<string, unknown> };

/** Short, in-memory, API-origin-scoped circuit breaker. No stored credentials,
 * cached private responses, or stale data masquerading as a successful save.
 * The maximum pause is one minute so a paid-plan change/recovery is discoverable.
 */
export function createServiceAvailabilityGuard(now = Date.now) {
  const failures = new Map<string, CapacityFailure>();
  const scope = (url: string): string | null => {
    try {
      const base = typeof window === 'undefined' ? 'https://teajia.com' : window.location.origin;
      const parsed = new URL(url, base);
      return parsed.pathname.startsWith('/api/') ? parsed.origin : null;
    } catch { return null; }
  };

  return {
    blockedResponse(url: string): Response | null {
      const key = scope(url);
      const failure = key && failures.get(key);
      if (!failure) return null;
      const remaining = failure.until - now();
      if (remaining <= 0) {
        failures.delete(key);
        return null;
      }
      return new Response(JSON.stringify(failure.body), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Retry-After': String(Math.ceil(remaining / 1000)),
        },
      });
    },

    async observeResponse(url: string, response: Response): Promise<void> {
      const key = scope(url);
      if (!key || response.status !== 503) return;
      let body: Record<string, unknown> | undefined;
      try { body = record(await response.clone().json()); } catch { return; }
      if (typeof body?.code !== 'string' || !SERVICE_CAPACITY_CODES.has(body.code)) return;
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const requested = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : MAX_COOLDOWN_MS;
      failures.set(key, { until: now() + Math.min(requested, MAX_COOLDOWN_MS), body });
    },
  };
}
