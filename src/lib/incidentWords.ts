/**
 * Plain words for the problem ledger.
 *
 * The server records every failure as a row of codes (`http_503`, a route, a
 * category). That is the right shape for a machine and the wrong one for the
 * person who has to decide what to do about it, so the "Needs fixing" page runs
 * every row through here. Pure on purpose: no React, no clock of its own, so
 * what a row says and how it is sorted can be asked directly in a test.
 */

export interface IncidentRow {
  id: string;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  occurrence_count?: number | null;
  route?: string | null;
  method?: string | null;
  http_status?: number | null;
  error_code?: string | null;
  safe_message?: string | null;
}

/** Quiet means not seen for this many days; the page tucks those away. */
export const QUIET_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

/** The ledger writes SQLite's `YYYY-MM-DD HH:MM:SS` in UTC with no zone marker. */
export function parseLedgerTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const at = new Date(/[Zz]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`).getTime();
  return Number.isFinite(at) ? at : null;
}

/** Route prefix to the thing a person would call it. First match wins. */
const AREAS: Array<[RegExp, string]> = [
  [/^\/api\/products/, "the shop's product list"],
  [/^\/api\/rates/, 'the exchange rates'],
  [/^\/api\/events/, 'the sessions'],
  [/^\/api\/articles|^\/api\/journal|^\/api\/magazine/, 'the journal'],
  [/^\/api\/me\/orders|^\/api\/orders|^\/api\/invoices/, 'orders'],
  [/^\/api\/me|^\/api\/auth|^\/api\/verify/, 'sign-in'],
  [/^\/api\/collections/, 'collections'],
  [/^\/api\/people|^\/api\/profile/, 'people and profiles'],
  [/^\/api\/accounts|^\/api\/platform/, 'shop settings'],
];

/** What a route is about, in words. Falls back to the route itself, tidied. */
export function areaFor(route: string | null | undefined): string {
  const path = (route || '').split('?')[0];
  if (!path) return 'the site';
  for (const [pattern, name] of AREAS) if (pattern.test(path)) return name;
  const tidy = path.replace(/^\/api\//, '').replace(/\/[0-9a-f-]{8,}(?=\/|$)/gi, '').replace(/[/_-]+/g, ' ').trim();
  return tidy ? `"${tidy}"` : 'the site';
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One sentence for what broke. */
export function describeIncident(row: IncidentRow): string {
  const code = (row.error_code || '').toLowerCase();
  const area = areaFor(row.route);
  const status = row.http_status ?? null;

  // The server writes its own sentences for the problems it raises itself.
  if (code === 'rates_stale' && row.safe_message) return row.safe_message;

  if (code === 'session_expired' || status === 401) return `A visitor's sign-in ran out while using ${area}.`;
  if (code === 'access_denied' || status === 403) return `Someone was refused access to ${area}.`;
  if (code === 'upstream_not_configured') return `A service that ${area} depends on isn't set up.`;
  if (code === 'timeout') return `${capitalise(area)} took too long to answer for a visitor.`;
  if (code === 'transport_failure') return `A visitor's browser couldn't reach ${area}.`;
  if (/^http_5\d\d$/.test(code) || (status !== null && status >= 500)) {
    const n = status ?? Number(code.slice(5));
    return `${capitalise(area)} failed to load (server error ${n}).`;
  }
  if (row.safe_message) return row.safe_message;
  return `Something went wrong with ${area}.`;
}

/** "3 days ago", "just now". A missing time reads as unknown, never as now. */
export function relativeTime(value: string | null | undefined, now: number = Date.now()): string {
  const at = parseLedgerTime(value);
  if (at === null) return 'at an unknown time';
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** How many times, in words. */
export function countPhrase(count: number | null | undefined): string {
  const n = Math.max(1, Number(count) || 1);
  return n === 1 ? 'once' : `${n} times`;
}

/**
 * Splits open problems into the ones still happening and the ones that have
 * gone quiet. A row with no readable last-seen time counts as active: a
 * problem nobody can date is not safe to hide.
 */
export function splitIncidents<T extends IncidentRow>(
  rows: readonly T[],
  now: number = Date.now(),
): { active: T[]; quiet: T[] } {
  const active: T[] = [];
  const quiet: T[] = [];
  for (const row of rows) {
    if (row.status === 'resolved') continue;
    const seen = parseLedgerTime(row.last_seen);
    if (seen !== null && now - seen >= QUIET_AFTER_DAYS * DAY_MS) quiet.push(row);
    else active.push(row);
  }
  return { active, quiet };
}
