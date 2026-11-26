// The host's private guest book (Launch 2, slice H9:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H9").
//
// One private line per guest, kept by the table's host and read by that host
// alone. It is never joined into a guest's page, a public or recap answer, an
// export made for anyone else, the shop owner's screens, staff screens or an
// agent tool of anyone but the host (the host's own tools, set_guest_note and
// get_guest_notes in mcpTools/fewHosts.ts, call this module): every read and write of host_guest_notes lives in this module,
// and worker/tests/host-guest-notes.test.ts fails if another worker file names
// the table. No contact details are kept here.

export const GUEST_NOTE_MAX = 500;

type Scope = { hostUserId: string; accountId: string; eventId: string };
type GuestScope = Scope & { attendeeId: string };

export type GuestNote = { attendee_id: string; note: string; updated_at: string };
export type GuestNoteResult =
  | { ok: true; note: GuestNote | null }
  | { notFound: true }
  | { refused: { code: string; error: string } };

const notFound = { notFound: true } as const;

/**
 * The session is in this account, names this person as its host, and the
 * account is that person's own personal account. One shape of failure for all.
 */
const OWN_TABLE = `
  SELECT 1 FROM events e
    JOIN accounts a ON a.id = e.account_id
   WHERE e.id = ? AND e.account_id = ? AND e.host_user_id = ?
     AND a.personal_inventory_user_id = e.host_user_id AND a.owner_user_id = e.host_user_id
     AND a.status = 'active'`;

async function ownTable(db: D1Database, { hostUserId, accountId, eventId }: Scope) {
  if (!hostUserId || !accountId || !eventId) return false;
  return Boolean(await db.prepare(OWN_TABLE).bind(eventId, accountId, hostUserId).first());
}

async function ownGuest(db: D1Database, scope: GuestScope) {
  if (!scope.attendeeId || !(await ownTable(db, scope))) return false;
  return Boolean(await db.prepare('SELECT 1 FROM event_attendees WHERE id = ? AND event_id = ? AND account_id = ?')
    .bind(scope.attendeeId, scope.eventId, scope.accountId).first());
}

/** Remove the host's line about one guest. Clearing a line that was never written is fine. */
export async function clearGuestNote(db: D1Database, scope: GuestScope): Promise<GuestNoteResult> {
  if (!(await ownGuest(db, scope))) return notFound;
  await db.prepare('DELETE FROM host_guest_notes WHERE host_user_id = ? AND event_id = ? AND attendee_id = ? AND account_id = ?')
    .bind(scope.hostUserId, scope.eventId, scope.attendeeId, scope.accountId).run();
  return { ok: true, note: null };
}

/** Write, change or (with an empty note) clear the host's line about one guest. */
export async function saveGuestNote(db: D1Database, scope: GuestScope & { note: unknown }): Promise<GuestNoteResult> {
  if (scope.note !== null && scope.note !== undefined && typeof scope.note !== 'string') {
    return { refused: { code: 'guest_note_invalid', error: 'Write the note as words.' } };
  }
  const note = (scope.note ?? '').trim();
  if (note.length > GUEST_NOTE_MAX) {
    return { refused: { code: 'guest_note_too_long', error: `Keep the note to ${GUEST_NOTE_MAX} characters.` } };
  }
  if (!note) return clearGuestNote(db, scope);
  if (!(await ownGuest(db, scope))) return notFound;
  const updatedAt = new Date().toISOString();
  await db.prepare(`
    INSERT INTO host_guest_notes (id, account_id, host_user_id, event_id, attendee_id, note, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (host_user_id, event_id, attendee_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at
  `).bind(crypto.randomUUID(), scope.accountId, scope.hostUserId, scope.eventId, scope.attendeeId, note, updatedAt).run();
  return { ok: true, note: { attendee_id: scope.attendeeId, note, updated_at: updatedAt } };
}

/** Every line this host keeps about the guests of one of their tables. */
export async function guestNotesFor(db: D1Database, scope: Scope): Promise<{ notes: GuestNote[] } | { notFound: true }> {
  if (!(await ownTable(db, scope))) return notFound;
  const { results } = await db.prepare(`
    SELECT n.attendee_id, n.note, n.updated_at FROM host_guest_notes n
      JOIN event_attendees a ON a.id = n.attendee_id AND a.event_id = n.event_id AND a.account_id = n.account_id
     WHERE n.host_user_id = ? AND n.event_id = ? AND n.account_id = ?
     ORDER BY a.created_at ASC, a.id ASC
  `).bind(scope.hostUserId, scope.eventId, scope.accountId).all<GuestNote>();
  return { notes: results };
}
