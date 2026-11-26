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
// is read from the session on the server, never taken from the browser:
// events.host_user_id first (a hosted table names its host even when the host
// has no public page, Launch 2), else the lead host the public page names
// (sessionHost.ts, the one rule "Hosted by" and guest links use too). Only a
// fresh save (201) writes a row: a replay of an earlier request does not.
//
// To reach the invoice an order became, join through
// inquiries.converted_invoice_id, which every conversion sets. Do not use
// invoices.source_inquiry_id: only website checkouts set it, and it drives the
// website order rules, so a converted cart request leaves it empty.

import { sessionHostUserSql } from './sessionHost';

const VIA_FORMAT = /^[a-f0-9]{18}$/;

// A hosted table lives in its host's own private account, and its thank-you
// leads to the platform owner's shop (Launch 2). That one crossing counts: a
// hosted table of a person's own account, ordered from in the platform
// owner's shop. Any other foreign account still writes nothing.
const HOSTED_TABLE_TO_SHOP = `shop.is_platform_owner = 1
  AND host.personal_inventory_user_id IS NOT NULL
  AND host.owner_user_id = host.personal_inventory_user_id
  AND e.host_user_id = host.owner_user_id`;

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
       SELECT q.id, q.account_id, e.id, ${sessionHostUserSql('e')}
       FROM inquiries q
       JOIN events e ON e.thanks_ref = ? AND e.lifecycle_status IN ('completed', 'archived')
       JOIN accounts host ON host.id = e.account_id
       JOIN accounts shop ON shop.id = q.account_id
       WHERE q.id = ?
         AND (e.account_id = q.account_id OR (${HOSTED_TABLE_TO_SHOP}))
       ON CONFLICT(inquiry_id) DO NOTHING`,
    ).bind(ref, inquiryId).run();
    if (result.meta?.changes) return true;
    return Boolean(await db.prepare('SELECT 1 FROM order_session_sources WHERE inquiry_id = ?').bind(inquiryId).first());
  } catch {
    // Where an order came from is never worth failing the order over.
    return false;
  }
}
