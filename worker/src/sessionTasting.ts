// "This is a tasting" (Launch 3, J8). A host says a session is a tasting with
// events.is_tasting; only then may a confirmed guest open a screen per tea
// during the session. Every other session asks nothing while people sit.
//
// Who creates the tasting session: the first confirmed guest who opens it.
// The menu is final by the day of the session, so the teas are read then, in
// pouring order, instead of being copied when the host ticks the choice and
// going stale as the menu changes. The session row has a fixed id per event,
// so two guests opening at once still make one session. A tasting session the
// host already made for the event (POST /api/sessions with event_id) is used
// instead, and the shop's owner holds the session either way.

import { readSessionServedTeas } from './sessionServedTeas';

type Db = D1Database;

/** true/false or 1/0 become 1 or 0; anything else is refused (undefined). */
export function enteredTastingFlag(value: unknown): 0 | 1 | undefined {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  return undefined;
}

/** The tasting session already linked to this event, preferring an active one. */
export async function eventTastingSessionId(db: Db, eventId: string, accountId: string) {
  const row = await db.prepare(
    `SELECT id FROM tasting_sessions WHERE event_id = ? AND account_id = ?
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at, id LIMIT 1`,
  ).bind(eventId, accountId).first<{ id: string }>();
  return row?.id ?? null;
}

/** The fixed id of the session a guest's first open creates for an event. */
export const eventTastingId = (eventId: string) => `event-tasting-${eventId}`;

type Seat = {
  attendee_id: string; status: string; user_id: string | null; email: string | null;
  event_id: string; account_id: string; title: string; is_tasting: number;
  lifecycle_status: string; total_capacity: number | null; owner_user_id: string | null;
};

type Outcome = { status: number; body: Record<string, unknown> };

// The signed-in person is the seat's own account, or, for a seat booked
// without one, the only seat at this session under their verified email.
const seatBelongsTo = `(a.user_id = ? OR (
  a.user_id IS NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.email_verified_at IS NOT NULL
    AND lower(trim(u.email)) = lower(trim(a.email)))
  AND 1 = (SELECT count(*) FROM event_attendees other WHERE other.event_id = a.event_id
    AND lower(trim(other.email)) = lower(trim(a.email)))
))`;

/**
 * POST /api/rsvp/:token/tasting: a signed-in, confirmed guest of a tasting
 * joins that event's tasting session, creating it on the first open.
 */
export async function joinEventTasting(db: Db, token: string, user: { userId: string; name?: string | null }): Promise<Outcome> {
  const seat = await db.prepare(
    `SELECT a.id AS attendee_id, a.status, a.user_id, a.email, e.id AS event_id, e.account_id, e.title,
            e.is_tasting, e.lifecycle_status, e.total_capacity, shop.owner_user_id
     FROM event_attendees a
     JOIN events e ON e.id = a.event_id
     JOIN accounts shop ON shop.id = e.account_id
     WHERE a.magic_token = ?`,
  ).bind(token).first<Seat>();
  if (!seat) return { status: 404, body: { error: 'RSVP not found' } };
  if (Number(seat.is_tasting) !== 1 || ['cancelled', 'archived'].includes(seat.lifecycle_status)) {
    return { status: 404, body: { error: 'This session is not a tasting.' } };
  }
  if (seat.status !== 'confirmed') return { status: 403, body: { error: 'The tasting opens to confirmed seats.' } };
  const mine = await db.prepare(`SELECT 1 AS ok FROM event_attendees a WHERE a.id = ? AND ${seatBelongsTo}`)
    .bind(seat.attendee_id, user.userId, user.userId).first<{ ok: number }>();
  if (!mine) return { status: 403, body: { error: 'Sign in with the account linked to your seat.' } };

  let sessionId = await eventTastingSessionId(db, seat.event_id, seat.account_id);
  if (!sessionId) {
    const created = await createEventTasting(db, seat);
    if (!created) return { status: 409, body: { error: 'The host has not opened the tasting yet.' } };
    sessionId = created;
  }

  await db.prepare(
    `INSERT OR IGNORE INTO tasting_session_members (id, session_id, user_id, user_name, joined_at) VALUES (?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), sessionId, user.userId, user.name || null, new Date().toISOString()).run();
  return { status: 200, body: { session_id: sessionId } };
}

async function createEventTasting(db: Db, seat: Seat) {
  const owner = seat.owner_user_id ?? (await db.prepare(
    `SELECT user_id FROM account_members WHERE account_id = ? AND role = 'owner' AND status = 'active'
     ORDER BY joined_at, user_id LIMIT 1`,
  ).bind(seat.account_id).first<{ user_id: string }>())?.user_id;
  if (!owner) return null;

  const menu = await db.prepare(
    `SELECT m.id, p.id AS product_id, COALESCE(NULLIF(trim(m.custom_name), ''), NULLIF(trim(p.given_name), ''),
              NULLIF(trim(p.product_name), ''), 'Tea') AS name,
            p.type, p.year, p.origin_region, p.image_url, p.additional_images
     FROM event_tea_menu m
     LEFT JOIN products p ON p.id = m.product_id AND p.account_id = ?
     WHERE m.event_id = ?
     ORDER BY m.brew_order IS NULL, m.brew_order, m.created_at, m.id`,
  ).bind(seat.account_id, seat.event_id).all<{
    id: string; product_id: string | null; name: string; type: string | null; year: string | number | null;
    origin_region: string | null; image_url: string | null; additional_images: string | null;
  }>();

  const sessionId = eventTastingId(seat.event_id);
  const now = new Date().toISOString();
  const inviteToken = crypto.randomUUID().replace(/-/g, '');
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO tasting_sessions (id, account_id, created_by_user_id, title, status, invite_token, max_participants, created_at, event_id)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    ).bind(sessionId, seat.account_id, owner, seat.title, inviteToken, Math.max(8, Number(seat.total_capacity) || 0), now, seat.event_id),
    db.prepare(
      `INSERT OR IGNORE INTO tasting_session_members (id, session_id, user_id, joined_at) VALUES (?, ?, ?, ?)`,
    ).bind(`${sessionId}:${owner}`, sessionId, owner, now),
    ...(menu.results ?? []).map((tea, position) => {
      let photo = tea.image_url ?? null;
      if (!photo && tea.additional_images) {
        try { photo = JSON.parse(tea.additional_images)?.[0] ?? null; } catch { photo = null; }
      }
      const metadata = JSON.stringify({
        name: tea.name, type: tea.type ?? null, year: tea.year ?? null, originRegion: tea.origin_region ?? null, photo,
      });
      return db.prepare(
        `INSERT OR IGNORE INTO tasting_session_teas (id, session_id, product_id, compass_entry_id, tea_name, tea_key, tea_metadata, position)
         VALUES (?, ?, ?, NULL, ?, NULL, ?, ?)`,
      ).bind(`${sessionId}:${tea.id}`, sessionId, tea.product_id, tea.name, metadata, position);
    }),
  ]);
  return sessionId;
}

/** The poured teas that have a record, for the after-sit "Wrote on paper?" line. */
export async function journalTeasOf(db: Db, accountId: string, eventId: string) {
  const served = await readSessionServedTeas(db, accountId, eventId);
  return (served.results ?? []).flatMap(tea => tea.product_id ? [{ id: tea.id, name: tea.name, product_id: tea.product_id }] : []);
}
