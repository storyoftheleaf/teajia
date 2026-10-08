import { ApiError, isTransientApiError } from '../../lib/api';

/**
 * A failed request in a sentence a person can act on. The server's own words
 * are kept when it refused for a reason ("Compass entry not found"); a bare
 * status line ("Request failed (500)"), a column name ("cost_amount") or a
 * server fault is said in plain terms instead, and a lost connection says so.
 * Every sentence ends in what to do next.
 */
export function plainFailure(error: unknown, what: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (isTransientApiError(error) && !(error instanceof ApiError)) return `${what} did not go through. Check the connection and try again.`;
  const reason = !!message && /\s/.test(message) && !/^request failed/i.test(message) && !/\b[a-z]+_[a-z_]+\b/.test(message)
    && !(error instanceof ApiError && error.status >= 500);
  if (reason) return /[.!?]$/.test(message) ? message : `${message}.`;
  return `${what} did not go through. Try again.`;
}
