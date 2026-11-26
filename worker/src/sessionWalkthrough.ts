// The way to the house (Launch 2, slice H7:
// todo/plans/guests-and-tea-masters-launch-2-run.md, hard question 4).
//
// The walkthrough is the address, the map link, the photographed way in
// (events.venue_guide) and the venue's photographs. It is shown to a guest
// whose seat is confirmed, and only until the session ends. A seat that
// becomes denied, waitlisted or cancelled loses it on the next read, because
// the guest's page reads the seat's status each time and is never cached.
//
// When a session ends, stated in one place:
// - a session that is completed, archived or cancelled has ended;
// - otherwise it ends at events.event_end_date when that falls after
//   events.event_date;
// - otherwise it ends SESSION_DEFAULT_HOURS after events.event_date.
// A date with no time of day ends at the end of that day. A time written
// without an offset is the wall clock in the session's own time zone
// (events.timezone), or UTC when it has none.

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

/**
 * Whether this guest may see the way to the house now: their seat is
 * confirmed, the session has not ended, and the session's host may still
 * open it (`doorOpen`, false once a private host is stopped).
 */
export function mayShowWalkthrough(seatStatus: unknown, session: SessionTimes, doorOpen: boolean, now = Date.now()): boolean {
  return seatStatus === 'confirmed' && doorOpen && !sessionHasEnded(session, now);
}

// ── The photographs of the way in ──
// Step photographs are uploaded under accounts/<id>/venue-guide/ and venue
// photographs under accounts/<id>/venues/. Older step photographs were
// uploaded as flyers, so a flyer key named in a guide counts too. They are
// served private and short-lived, never public and immutable, so no shared
// cache keeps them and a browser keeps them only briefly.

export const WALKTHROUGH_MEDIA_CACHE = 'private, max-age=300';

const WALKTHROUGH_KEY = /^accounts\/[^/]+\/(?:venue-guide|venues)\//;
const FLYER_KEY = /^accounts\/([^/]+)\/flyers\/[^/]+$/;

/** Whether a media key is a photograph of the way to a session. */
export async function isWalkthroughMedia(db: D1Database | undefined, key: string): Promise<boolean> {
  if (WALKTHROUGH_KEY.test(key)) return true;
  const flyer = FLYER_KEY.exec(key);
  if (!flyer || !db) return false;
  try {
    const row = await db.prepare(
      `SELECT 1 FROM events WHERE account_id = ?1 AND venue_guide IS NOT NULL AND instr(venue_guide, ?2) > 0
       UNION ALL
       SELECT 1 FROM saved_locations WHERE account_id = ?1 AND venue_guide IS NOT NULL AND instr(venue_guide, ?2) > 0
       LIMIT 1`,
    ).bind(flyer[1], key).first();
    return Boolean(row);
  } catch {
    // When it cannot be told, keep the photograph private.
    return true;
  }
}
