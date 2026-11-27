// When a session ends (Launch 2, slices H7 and H8). One rule, read by the
// worker (worker/src/sessionWalkthrough.ts, which decides who sees the way to
// the house) and by the guest's phone (src/components/events/VenueGuide.tsx,
// which removes its kept copy of the way once the session has ended).
//
// - a session that is completed, archived or cancelled has ended;
// - otherwise it ends at event_end_date when that falls after event_date;
// - otherwise it ends SESSION_DEFAULT_HOURS after event_date.
// A date with no time of day ends at the end of that day. A time written
// without an offset is the wall clock in the session's own time zone, or UTC
// when it has none.

/** How long a session lasts when it does not say. */
export const SESSION_DEFAULT_HOURS = 4;

const HOUR_MS = 60 * 60 * 1000;
const ENDED_LIFECYCLES = new Set(['completed', 'archived', 'cancelled']);
const ENDED_STATUSES = new Set(['cancelled', 'archived']);
const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export type SessionTimes = {
  event_date?: unknown;
  event_end_date?: unknown;
  timezone?: unknown;
  lifecycle_status?: unknown;
  status?: unknown;
};

function zoneOffsetMs(instant: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
    const asUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    return Number.isFinite(asUtc) ? asUtc - Math.floor(instant / 1000) * 1000 : 0;
  } catch {
    return 0;
  }
}

/** The instant a stored session time names, and whether it carried a time of day. */
export function sessionInstant(value: unknown, timeZone: unknown): { at: number; dateOnly: boolean } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (HAS_OFFSET.test(text)) {
    const at = Date.parse(text);
    return Number.isFinite(at) ? { at, dateOnly: false } : null;
  }
  const match = WALL_TIME.exec(text);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0));
  if (!Number.isFinite(wall)) return null;
  const zone = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'UTC';
  // Two passes settle the offset across a daylight saving change.
  let at = wall - zoneOffsetMs(wall, zone);
  at = wall - zoneOffsetMs(at, zone);
  return { at, dateOnly: h === undefined };
}

/** When the session ends, or null when its date cannot be read. */
export function sessionEndsAt(session: SessionTimes): number | null {
  const start = sessionInstant(session.event_date, session.timezone);
  if (!start) return null;
  const end = sessionInstant(session.event_end_date, session.timezone);
  if (end && end.at > start.at) return end.dateOnly ? end.at + 24 * HOUR_MS : end.at;
  return start.dateOnly ? start.at + 24 * HOUR_MS : start.at + SESSION_DEFAULT_HOURS * HOUR_MS;
}

/** Whether the session has ended, by its state first and its time second. */
export function sessionHasEnded(session: SessionTimes, now = Date.now()): boolean {
  if (ENDED_LIFECYCLES.has(String(session.lifecycle_status ?? ''))) return true;
  if (ENDED_STATUSES.has(String(session.status ?? ''))) return true;
  const end = sessionEndsAt(session);
  return end !== null && now >= end;
}

/** Where a session stands at one instant: before its start, during it, or after its end. */
export type SessionMoment = 'before' | 'during' | 'after';

/**
 * A session's "now" (review A9, A6-4). After: it has ended, by its state or
 * by sessionEndsAt. During: from its start to its end, both read in the
 * session's own time zone. Before: anything earlier, and a session whose
 * date cannot be read. One rule for the worker and the guest's phone: the
 * app asks a guest for nothing during, a table completes only after, and an
 * upcoming list carries only what is before.
 */
export function sessionMoment(session: SessionTimes, now = Date.now()): SessionMoment {
  if (sessionHasEnded(session, now)) return 'after';
  const start = sessionInstant(session.event_date, session.timezone);
  return start && start.at <= now ? 'during' : 'before';
}

/** Whether the session's host cancelled it. A cancelled table tells its guests so. */
export function sessionCancelled(session: Pick<SessionTimes, 'lifecycle_status' | 'status'>): boolean {
  return session.lifecycle_status === 'cancelled' || session.status === 'cancelled';
}
