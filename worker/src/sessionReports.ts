type TargetKind = 'session' | 'person';
type Resolution = 'acted' | 'dismissed';

interface ReportInput {
  targetKind: TargetKind;
  targetId: string;
  reason?: string | null;
  reporterUserId: string | null;
  reporterSeatId: string | null;
}

interface OpenReport {
  id: string;
  target_kind: TargetKind;
  target_id: string;
  reason: string | null;
  status: 'open';
  created_at: string;
  label: string | null;
}

interface OwnerReport extends OpenReport {
  reporter_user_id: string | null;
  reporter_seat_id: string | null;
}

function refuse(status: number, code: string, error: string) {
  return { refused: { status, code, error } };
}

export async function fileReport(db: D1Database, input: ReportInput) {
  const { targetKind, targetId, reporterUserId, reporterSeatId } = input;
  if ((targetKind !== 'session' && targetKind !== 'person') || !targetId.trim()) {
    return refuse(400, 'validation_failed', 'Say what you are reporting.');
  }
  const reason = input.reason?.trim() || null;
  if (reason && Array.from(reason).length > 1000) {
    return refuse(400, 'validation_failed', 'Keep the reason to 1000 characters or fewer.');
  }

  const targetTable = targetKind === 'session' ? 'events' : 'contributors';
  const targetExists = `EXISTS (SELECT 1 FROM ${targetTable} WHERE id = ?2)`;
  const sameOpenReport = `target_kind = ?1 AND target_id = ?2 AND status = 'open'
    AND ((?4 IS NOT NULL AND reporter_user_id = ?4)
      OR (?4 IS NULL AND reporter_user_id IS NULL AND reporter_seat_id = ?5))`;

  // D1 executes the batch as one transaction, so simultaneous repeats cannot
  // both insert. With neither identity available, each visitor files separately.
  const values = [targetKind, targetId, reason, reporterUserId, reporterSeatId] as const;
  const [updated, inserted] = await db.batch([
    db.prepare(`UPDATE session_reports SET reason = ?3 WHERE ${targetExists} AND ${sameOpenReport}`).bind(...values),
    db.prepare(`
      INSERT INTO session_reports (target_kind, target_id, reason, reporter_user_id, reporter_seat_id, id)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE ${targetExists} AND NOT EXISTS (SELECT 1 FROM session_reports WHERE ${sameOpenReport})
    `).bind(...values, crypto.randomUUID()),
  ]);
  if (!updated.meta.changes && !inserted.meta.changes) {
    return refuse(404, 'target_not_found', 'That is no longer on Teajia.');
  }
  return { received: true as const };
}

/** The route may set platformOwner only after checking the platform role. */
export function openReports(db: D1Database, access: { platformOwner: true }): Promise<OwnerReport[]>;
export function openReports(db: D1Database, access?: { platformOwner?: boolean }): Promise<OpenReport[]>;
export async function openReports(db: D1Database, access?: { platformOwner?: boolean }) {
  const reporterFields = access?.platformOwner === true ? ', r.reporter_user_id, r.reporter_seat_id' : '';
  const { results } = await db.prepare(`
    SELECT r.id, r.target_kind, r.target_id, r.reason, r.status, r.created_at,
           COALESCE(e.title, c.display_name) AS label${reporterFields}
      FROM session_reports r
      LEFT JOIN events e ON r.target_kind = 'session' AND e.id = r.target_id
      LEFT JOIN contributors c ON r.target_kind = 'person' AND c.id = r.target_id
     WHERE r.status = 'open'
     ORDER BY r.created_at DESC, r.id DESC
  `).all<OpenReport>();
  return results;
}

export async function resolveReport(db: D1Database, { id, status, actorId }: {
  id: string;
  status: Resolution;
  actorId: string;
}) {
  if (status !== 'acted' && status !== 'dismissed') {
    return refuse(400, 'validation_failed', 'Choose Acted or Dismiss.');
  }
  const result = await db.prepare(`
    UPDATE session_reports SET status = ?, resolved_at = datetime('now'), resolved_by = ?
     WHERE id = ? AND status = 'open'
  `).bind(status, actorId, id).run();
  if (!result.meta.changes) {
    return refuse(404, 'report_not_found', 'That report is no longer open.');
  }
  return { id, status };
}
