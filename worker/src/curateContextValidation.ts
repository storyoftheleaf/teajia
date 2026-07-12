interface ContextEnv { DB: D1Database }

export async function validateCurateContextPair(
  env: ContextEnv,
  accountId: string,
  values: { journey_id?: unknown; visit_id?: unknown },
  existing?: Record<string, unknown> | null,
): Promise<string | null> {
  const journeyId = values.journey_id !== undefined ? values.journey_id : existing?.journey_id;
  const visitId = values.visit_id !== undefined ? values.visit_id : existing?.visit_id;
  if (journeyId != null) {
    const journey = await env.DB.prepare('SELECT id FROM curate_journeys WHERE id = ? AND account_id = ?').bind(journeyId, accountId).first();
    if (!journey) return 'Journey does not belong to the active account';
  }
  if (visitId != null) {
    const visit = await env.DB.prepare('SELECT id, journey_id FROM curate_visits WHERE id = ? AND account_id = ?').bind(visitId, accountId).first() as { journey_id?: string | null } | null;
    if (!visit) return 'Visit does not belong to the active account';
    if (journeyId != null && visit.journey_id != null && visit.journey_id !== journeyId) {
      return 'Visit is not part of the selected Journey';
    }
  }
  return null;
}
