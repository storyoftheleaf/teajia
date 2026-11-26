// Launch 1, the first table: where an order request began.
//
// A thank-you's tea links carry `via=<events.thanks_ref>`. The site keeps that
// reference with the bag and sends it as `via` on POST /api/inquiries. Once the
// request is saved, this writes one row to order_session_sources naming the
// session and its host. Nothing is paid, shown or ranked from it yet; the
// credit rule is Adrian's to set later (Q8 in the build plan).
//
// Rules: the order never fails because of `via`. An unknown, malformed,
// foreign-account or unfinished session's reference writes nothing. The host
// is read from the session on the server, never taken from the browser.

const VIA_FORMAT = /^[a-f0-9]{18}$/;

/** A `via` value as the browser sent it, or null when it cannot be a thanks_ref. */
export function readVia(value: unknown): string | null {
  return typeof value === 'string' && VIA_FORMAT.test(value) ? value : null;
}

/**
 * Record that a saved order request began from a session's thank-you.
 * Safe to call more than once for the same request: the first row stands.
 * Returns true when a row exists for this request afterwards.
 */
export async function recordOrderSessionSource(db: D1Database, inquiryId: string, via: unknown): Promise<boolean> {
  const ref = readVia(via);
  if (!ref || typeof inquiryId !== 'string' || !inquiryId) return false;
  try {
    const result = await db.prepare(
      `INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
       SELECT q.id, q.account_id, e.id,
         (SELECT c.user_id FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
           WHERE ec.event_id = e.id AND ec.account_id = e.account_id AND ec.role = 'lead_host' AND c.user_id IS NOT NULL
           ORDER BY ec.display_order ASC, ec.id ASC LIMIT 1)
       FROM inquiries q
       JOIN events e ON e.thanks_ref = ? AND e.account_id = q.account_id
         AND e.lifecycle_status IN ('completed', 'archived')
       WHERE q.id = ?
       ON CONFLICT(inquiry_id) DO NOTHING`,
    ).bind(ref, inquiryId).run();
    if (result.meta?.changes) return true;
    return Boolean(await db.prepare('SELECT 1 FROM order_session_sources WHERE inquiry_id = ?').bind(inquiryId).first());
  } catch {
    // Where an order came from is never worth failing the order over.
    return false;
  }
}
