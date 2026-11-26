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

import { sessionHasEnded, type SessionTimes } from '../../shared/sessionEnd';

// The rule itself lives in shared/sessionEnd.ts so the guest's phone reads the
// same end as the worker does.
export { SESSION_DEFAULT_HOURS, sessionEndsAt, sessionHasEnded, sessionInstant, type SessionTimes } from '../../shared/sessionEnd';

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
// cache keeps them and a browser keeps them only briefly. A step photograph
// is also served only by a signed address (wayMedia.ts); house photographs
// under venues/ are public by Adrian's decision (2026-11-26).

export const WALKTHROUGH_MEDIA_CACHE = 'private, max-age=300';

/**
 * A host's own tea photographs (hostTableTeas.ts) are served the same way: a
 * photograph taken off the list, or one of a host who is stopped, must not
 * stay in a shared cache for a year.
 */
export const HOST_TEA_MEDIA_KEY = /^accounts\/[^/]+\/host-teas\//;

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
