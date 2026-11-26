/**
 * Shared structured results contain ratings and picks, while prose and sensory
 * notes stay with the author. This shape is for the giver and for the host's
 * own live screen (/host-live), the one place a host sees results during their
 * session (Adrian, 2026-11-26).
 */
export function sharedSessionVerdict(row: Record<string, unknown>) {
  let tasting: Record<string, unknown> = {};
  try {
    const parsed = typeof row.tasting_data === 'string' ? JSON.parse(row.tasting_data) : row.tasting_data;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) tasting = parsed;
  } catch { /* A malformed private payload supplies no shared rating. */ }
  const verdict = ['love', 'like', 'neutral', 'pass'].includes(String(row.verdict)) ? row.verdict : null;
  const quality = typeof tasting.quality === 'number' && Number.isFinite(tasting.quality)
    && tasting.quality >= 1 && tasting.quality <= 10 ? tasting.quality : null;
  return {
    user_id: row.user_id,
    session_tea_id: row.session_tea_id,
    verdict,
    tasting_data: { quality, wouldBuy: tasting.wouldBuy === true },
    ...(typeof row.user_name === 'string' ? { user_name: row.user_name } : {}),
    ...(typeof row.tea_name === 'string' ? { tea_name: row.tea_name } : {}),
    ...(typeof row.position === 'number' ? { position: row.position } : {}),
  };
}

/**
 * What another member of the session reads of someone's result: that they
 * gave one, for which tea. A score and a verdict are the giver's own.
 */
export function peerSessionVerdict(row: Record<string, unknown>) {
  return {
    user_id: row.user_id,
    session_tea_id: row.session_tea_id,
    ...(typeof row.user_name === 'string' ? { user_name: row.user_name } : {}),
    ...(typeof row.tea_name === 'string' ? { tea_name: row.tea_name } : {}),
    ...(typeof row.position === 'number' ? { position: row.position } : {}),
  };
}

/** The giver reads their own result whole; every other member reads that a result was given. */
export function sessionVerdictFor(viewerUserId: string) {
  return (row: Record<string, unknown>) => row.user_id === viewerUserId ? sharedSessionVerdict(row) : peerSessionVerdict(row);
}
