// Who may hold a guest's own page link (Launch 2, slice H7).
//
// A guest's magic token is a bearer link: whoever holds it reads that guest's
// page, the way to the house included once the seat is confirmed, and can
// change or cancel the seat. Staff answers carry it only to the account's
// owner and to the session's host. The host is events.host_user_id, else the
// user of the session's lead host contributor, the same person
// order_session_sources names.

/** SQL for the session's host user, for an events alias. */
export function sessionHostUserSql(event: string): string {
  return `COALESCE(${event}.host_user_id,
    (SELECT c.user_id FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
      WHERE ec.event_id = ${event}.id AND ec.account_id = ${event}.account_id AND ec.role = 'lead_host' AND c.user_id IS NOT NULL
      ORDER BY ec.display_order ASC, ec.id ASC LIMIT 1))`;
}

/**
 * The sessions among `eventIds` whose guest links this caller may hold. An
 * owner holds every one; anyone else holds only those they host.
 */
export async function guestLinkSessions(
  db: D1Database,
  caller: { userId: string; accountId: string; isOwner: boolean },
  eventIds: string[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (caller.isOwner) return new Set(ids);
  if (!ids.length || !caller.userId) return new Set();
  const held = new Set<string>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const rows = await db.prepare(
      `SELECT e.id FROM events e
        WHERE e.account_id = ? AND e.id IN (${chunk.map(() => '?').join(',')})
          AND ${sessionHostUserSql('e')} = ?`,
    ).bind(caller.accountId, ...chunk, caller.userId).all<{ id: string }>();
    for (const row of rows.results ?? []) held.add(row.id);
  }
  return held;
}

/** The rows with magic_token removed wherever the caller may not hold it. */
export async function withoutForeignGuestLinks<T extends Record<string, unknown>>(
  db: D1Database,
  caller: { userId: string; accountId: string; isOwner: boolean },
  rows: T[],
): Promise<T[]> {
  if (caller.isOwner) return rows;
  const held = await guestLinkSessions(db, caller, rows.map(row => String(row.event_id ?? '')));
  return rows.map(row => {
    if (held.has(String(row.event_id ?? ''))) return row;
    const { magic_token: _token, ...rest } = row;
    return rest as T;
  });
}
