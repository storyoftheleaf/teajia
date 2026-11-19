/** Shared structured results contain ratings and picks, while prose and sensory notes stay with the author. */
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
