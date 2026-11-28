import { claimInvoiceLinkLease, releaseInvoiceLinkLease } from './invoiceDomain';

/** A pay-link save and an existing ownership relationship are independent. */
export const LINKED_BUYER_SQL = `EXISTS (
  SELECT 1 FROM invoice_buyer_identity b WHERE b.account_id = i.account_id AND b.invoice_id = i.id AND b.user_id = ?
)`;
export const SAVED_INVOICE_SQL = `EXISTS (
  SELECT 1 FROM invoice_keep_grants k WHERE k.account_id = i.account_id AND k.invoice_id = i.id AND k.user_id = ?
)`;
export const EXPLICIT_INVOICE_ACCESS_SQL = `(${LINKED_BUYER_SQL} OR ${SAVED_INVOICE_SQL})`;

type KeepInvoiceResult =
  | { ok: true; already: boolean }
  | { ok: false; status: 403 | 404 | 409; error: string; code?: 'own_invoice' | 'not_your_invoice' };

type Db = { DB: D1Database };

/** Whether this person sends the invoice rather than receives it. */
export async function sendsInvoice(
  env: Db, accountId: string, invoiceId: string, userId: string, contributorUserId?: string | null,
): Promise<boolean> {
  if (contributorUserId && contributorUserId === userId) return true;
  const row = await env.DB.prepare(
    `SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND (sold_by_user_id = ? OR payment_recipient_user_id = ?)
     UNION ALL
     SELECT 1 FROM account_members WHERE account_id = ? AND user_id = ? AND status = 'active' AND role IN ('owner', 'staff')
     LIMIT 1`
  ).bind(invoiceId, accountId, userId, userId, accountId, userId).first();
  return Boolean(row);
}

export async function savedInvoiceHolder(env: Db, accountId: string, invoiceId: string): Promise<string | null> {
  const keep = await env.DB.prepare('SELECT user_id FROM invoice_keep_grants WHERE account_id = ? AND invoice_id = ?')
    .bind(accountId, invoiceId).first<{ user_id: string }>();
  return keep?.user_id ?? null;
}

export async function keepInvoiceForUser(
  env: Db,
  accountId: string,
  invoiceId: string,
  user: { userId: string; email: string },
  linkId: string,
  contributorUserId?: string | null,
): Promise<KeepInvoiceResult> {
  const lease = await claimInvoiceLinkLease(env, accountId, invoiceId);
  if (!lease) {
    const invoice = await env.DB.prepare('SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND deleted_at IS NULL')
      .bind(invoiceId, accountId).first();
    return invoice ? { ok: false, status: 409, error: 'This invoice is being updated. Try again in a moment.' }
      : { ok: false, status: 404, error: 'Invoice not found' };
  }
  try {
    if (lease.invoice.deleted_at) return { ok: false, status: 404, error: 'Invoice not found' };
    if (await sendsInvoice(env, accountId, invoiceId, user.userId, contributorUserId)) {
      return { ok: false, status: 403, code: 'own_invoice', error: 'This is your own invoice to send.' };
    }
    const buyer = await env.DB.prepare(
      `SELECT user_id, email FROM invoice_buyer_identity WHERE invoice_id = ? AND account_id = ?`
    ).bind(invoiceId, accountId).first<{ user_id: string | null; email: string | null }>();
    if (buyer?.user_id === user.userId) return { ok: true, already: true };
    const holder = await savedInvoiceHolder(env, accountId, invoiceId);
    if (holder === user.userId) return { ok: true, already: true };
    if (buyer?.user_id || holder) return { ok: false, status: 409, error: 'This invoice is already kept by someone else' };
    const buyerEmail = buyer?.email?.trim().toLowerCase();
    if (buyerEmail && buyerEmail !== user.email?.trim().toLowerCase()) {
      return { ok: false, status: 403, code: 'not_your_invoice', error: 'This invoice is for another email. Sign in with the email the shop has for you.' };
    }

    const keepId = crypto.randomUUID();
    const [written] = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO pay_invoice_keeps (id, account_id, invoice_id, user_id)
         SELECT ?, i.account_id, i.id, ? FROM invoices i
         LEFT JOIN invoice_buyer_identity b ON b.invoice_id = i.id AND b.account_id = i.account_id
         WHERE i.id = ? AND i.account_id = ? AND i.fulfillment_claim_token = ? AND i.deleted_at IS NULL
           AND b.user_id IS NULL AND b.email IS ?
           AND NOT EXISTS (SELECT 1 FROM invoice_keep_grants k WHERE k.account_id = i.account_id AND k.invoice_id = i.id)
         ON CONFLICT (account_id, invoice_id) DO NOTHING`
      ).bind(keepId, user.userId, invoiceId, accountId, lease.claimToken, buyer?.email ?? null),
      env.DB.prepare(
        `INSERT INTO platform_audit_log (action, actor_id, actor_email, target_type, target_id, details, account_id, actor_account_id)
         SELECT 'pay_invoice.kept', user_id, ?, 'invoice', invoice_id, ?, account_id, account_id
         FROM pay_invoice_keeps WHERE id = ?`
      ).bind(user.email, JSON.stringify({ link_id: linkId, keep_id: keepId }), keepId),
    ]);
    return written.meta.changes === 1 ? { ok: true, already: false }
      : { ok: false, status: 409, error: 'This invoice just changed. Reload and try again.' };
  } finally {
    await releaseInvoiceLinkLease(env, accountId, invoiceId, lease.claimToken);
  }
}

/** Whether this invoice is already in the signed-in person's orders. */
export async function invoiceKeptBy(env: Db, accountId: string, invoiceId: string, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM invoices i WHERE i.id = ? AND i.account_id = ? AND i.deleted_at IS NULL
       AND ${EXPLICIT_INVOICE_ACCESS_SQL}`
  ).bind(invoiceId, accountId, userId, userId).first();
  return Boolean(row);
}

export type InvoiceKeep = {
  id: string;
  invoiceId: string;
  keptBy: { userId: string; name: string | null; email: string | null };
};

export async function findInvoiceKeep(env: Db, accountId: string, invoiceId: string): Promise<InvoiceKeep | null> {
  const row = await env.DB.prepare(
    `SELECT k.id, k.invoice_id, k.user_id, u.name, u.email FROM invoice_keep_grants k
     JOIN users u ON u.id = k.user_id
     WHERE k.account_id = ? AND k.invoice_id = ?`
  ).bind(accountId, invoiceId).first<{ id: string; invoice_id: string; user_id: string; name: string | null; email: string | null }>();
  return row ? { id: row.id, invoiceId: row.invoice_id, keptBy: { userId: row.user_id, name: row.name, email: row.email } } : null;
}

/** Revoke the exact save that was previewed, so the invoice can be saved again. */
export async function releaseInvoiceKeep(
  env: Db, accountId: string, keep: InvoiceKeep, actorId: string, agent: string,
): Promise<boolean> {
  const [released] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO platform_audit_log (action, actor_id, target_type, target_id, details, account_id, actor_account_id)
       SELECT 'pay_invoice.released', ?, 'invoice', invoice_id, ?, account_id, account_id
       FROM invoice_keep_grants WHERE account_id = ? AND invoice_id = ? AND id = ?`
    ).bind(actorId, JSON.stringify({ keep_id: keep.id, released_user_id: keep.keptBy.userId, agent }), accountId, keep.invoiceId, keep.id),
    env.DB.prepare('DELETE FROM pay_invoice_keeps WHERE account_id = ? AND invoice_id = ? AND id = ?')
      .bind(accountId, keep.invoiceId, keep.id),
  ]);
  return released.meta.changes === 1;
}
