type Scope = { accountId: string; userId: string };

export const privateAttendeeSeatMatch = `
    a.account_id = ? AND a.status = 'confirmed' AND a.attended = 1
    AND EXISTS (SELECT 1 FROM events e WHERE e.id = a.event_id AND e.account_id = a.account_id
      AND e.lifecycle_status IN ('completed', 'archived'))
    AND (a.user_id = ? OR (
      a.user_id IS NULL
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.email_verified_at IS NOT NULL
        AND lower(trim(u.email)) = lower(trim(a.email)))
      AND 1 = (SELECT count(*) FROM event_attendees other WHERE other.event_id = a.event_id
        AND other.account_id = a.account_id AND lower(trim(other.email)) = lower(trim(a.email)))
    ))
`;

export const privateAttendeeMatch = `a.magic_token = ? AND ${privateAttendeeSeatMatch}`;

/** The reflection's saved owner is independent of the host-editable customer association. */
export async function listPrivateSessionReflections(db: D1Database, scope: Scope) {
  const { results } = await db.prepare(
    `SELECT r.attendee_id, r.event_id, e.title, e.event_date, r.reflection, r.updated_at
     FROM private_session_reflections r
     JOIN events e ON e.id = r.event_id AND e.account_id = r.account_id
     WHERE r.account_id = ? AND r.user_id = ?
     ORDER BY r.updated_at DESC LIMIT 100`
  ).bind(scope.accountId, scope.userId).all();
  return results;
}

export async function readPrivateSessionReflection(db: D1Database, scope: Scope, token: string) {
  return db.prepare(
    `SELECT r.reflection, r.updated_at, r.event_id
     FROM private_session_reflections r JOIN event_attendees a
       ON a.id = r.attendee_id AND a.event_id = r.event_id AND a.account_id = r.account_id
     WHERE a.magic_token = ? AND r.account_id = ? AND r.user_id = ?`
  ).bind(token, scope.accountId, scope.userId).first();
}

export async function writePrivateSessionReflection(db: D1Database, scope: Scope, token: string, reflection: string) {
  const now = new Date().toISOString();
  const eligible = `${privateAttendeeMatch}
    AND NOT EXISTS (SELECT 1 FROM private_session_reflections r
      WHERE r.attendee_id = a.id AND r.user_id <> ?)
  `;
  const binds = [token, scope.accountId, scope.userId, scope.userId, scope.userId];
  const results = await db.batch([
    db.prepare(
      `UPDATE event_attendees AS a SET user_id = ? WHERE a.user_id IS NULL AND ${eligible}`
    ).bind(scope.userId, ...binds),
    db.prepare(
      `INSERT INTO private_session_reflections (attendee_id, event_id, account_id, user_id, reflection, updated_at)
       SELECT a.id, a.event_id, a.account_id, ?, ?, ? FROM event_attendees a
       WHERE ${eligible}
       ON CONFLICT(attendee_id) DO UPDATE SET reflection = excluded.reflection, updated_at = excluded.updated_at
       WHERE private_session_reflections.user_id = excluded.user_id
         AND private_session_reflections.account_id = excluded.account_id
         AND private_session_reflections.event_id = excluded.event_id`
    ).bind(scope.userId, reflection, now, ...binds),
  ]);
  return Number(results[1].meta?.changes || 0) > 0;
}
