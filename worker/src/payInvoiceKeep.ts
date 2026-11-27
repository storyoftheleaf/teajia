import { claimInvoiceLinkLease, releaseInvoiceLinkLease } from './invoiceDomain';

/**
 * An invoice sent by its pay link becomes the buyer's (Adrian, 2026-11-27).
 *
 * The person holding the link presses "Save to my account" while signed in, and
 * the invoice joins their orders, which /account/orders reads through
 * `customers.user_id`.
 *
 * Who may keep it (Adrian, 2026-11-27: "anyone with the link can save it and
 * then they can't save it. That doesn't seem right"):
 * - never the shop that sent it: its owner or staff, the seller, or the person
 *   the money goes to. They see the invoice as theirs to send;
 * - when the invoice names a customer with an email, only someone signed in
 *   with that email;
 * - otherwise the first signed-in person, and the shop can give it back with
 *   `releaseInvoiceKeep` (the `release_invoice_keep` tool) so the right person
 *   can save it.
 *
 * When the invoice already names a customer with no account yet, that customer
 * record is the one linked, so the shop's own record of the buyer stays whole.
 * Otherwise the person's customer record in this shop is used, or made.
 */
export type KeepLinked = 'customer' | 'invoice';
export type KeepInvoiceResult =
  | { ok: true; customerId: string; already: boolean; linked: KeepLinked }
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

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a?.trim() && b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase());

export async function keepInvoiceForUser(
  env: Db,
  accountId: string,
  invoiceId: string,
  user: { userId: string; email: string; name: string },
  contributorUserId?: string | null,
): Promise<KeepInvoiceResult> {
  const invoice = await env.DB.prepare(
    'SELECT customer_id, customer_name FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoiceId, accountId).first<{ customer_id: string | null; customer_name: string | null }>();
  if (!invoice) return { ok: false, status: 404, error: 'Invoice not found' };
  if (await sendsInvoice(env, accountId, invoiceId, user.userId, contributorUserId)) {
    return { ok: false, status: 403, code: 'own_invoice', error: 'This is your own invoice to send.' };
  }

  const named = invoice.customer_id
    ? await env.DB.prepare('SELECT id, user_id, email FROM customers WHERE id = ? AND account_id = ?')
      .bind(invoice.customer_id, accountId).first<{ id: string; user_id: string | null; email: string | null }>()
    : null;
  if (named?.user_id === user.userId) return { ok: true, customerId: named.id, already: true, linked: 'customer' };
  if (named?.user_id) return { ok: false, status: 409, error: 'This invoice is already kept by someone else' };
  if (named?.email?.trim() && !sameEmail(named.email, user.email)) {
    return { ok: false, status: 403, code: 'not_your_invoice', error: 'This invoice is for another email. Sign in with the email the shop has for you.' };
  }

  const lease = await claimInvoiceLinkLease(env, accountId, invoiceId);
  if (!lease) return { ok: false, status: 409, error: 'This invoice is being updated. Try again in a moment.' };
  try {
    if ((lease.invoice.customer_id ?? null) !== (invoice.customer_id ?? null)) {
      return { ok: false, status: 409, error: 'This invoice just changed. Reload and try again.' };
    }
    if (named) {
      const linked = await env.DB.prepare(
        'UPDATE customers SET user_id = ? WHERE id = ? AND account_id = ? AND user_id IS NULL'
      ).bind(user.userId, named.id, accountId).run();
      if (!Number(linked.meta?.changes || 0)) return { ok: false, status: 409, error: 'This invoice is already kept by someone else' };
      return { ok: true, customerId: named.id, already: false, linked: 'customer' };
    }
    const known = await env.DB.prepare(
      'SELECT id FROM customers WHERE user_id = ? AND account_id = ? ORDER BY created_at LIMIT 1'
    ).bind(user.userId, accountId).first<{ id: string }>();
    const customerId = known?.id ?? `web_${accountId}_${user.userId}`;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO customers (id, account_id, user_id, name, email, source) VALUES (?, ?, ?, ?, ?, 'claimed_order')"
      ).bind(customerId, accountId, user.userId, invoice.customer_name || user.name || 'Customer', user.email),
      env.DB.prepare(
        'UPDATE invoices SET customer_id = ? WHERE id = ? AND account_id = ? AND customer_id IS NULL AND fulfillment_claim_token = ?'
      ).bind(customerId, invoiceId, accountId, lease.claimToken),
    ]);
    return { ok: true, customerId, already: false, linked: 'invoice' };
  } finally {
    await releaseInvoiceLinkLease(env, accountId, invoiceId, lease.claimToken);
  }
}

/** Whether this invoice is already in the signed-in person's orders. */
export async function invoiceKeptBy(env: Db, accountId: string, invoiceId: string, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id
      WHERE i.id = ? AND i.account_id = ? AND c.user_id = ?`
  ).bind(invoiceId, accountId, userId).first();
  return Boolean(row);
}

export type InvoiceKeep = {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  keptBy: { userId: string; name: string | null; email: string | null };
  linked: KeepLinked;
};

/**
 * Who saved this invoice through its link, read from the save's own log row so
 * a release undoes exactly that save: a named customer loses the account it was
 * joined to, or the invoice goes back to naming no customer. Null when the
 * invoice was not saved through its link, or has changed hands since.
 */
export async function findInvoiceKeep(env: Db, accountId: string, invoiceId: string): Promise<InvoiceKeep | null> {
  const row = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.customer_id, c.user_id, u.name, u.email
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id
       LEFT JOIN users u ON u.id = c.user_id
      WHERE i.id = ? AND i.account_id = ? AND c.user_id IS NOT NULL`
  ).bind(invoiceId, accountId).first<{ id: string; invoice_number: string | null; customer_id: string; user_id: string; name: string | null; email: string | null }>();
  if (!row) return null;
  const log = await env.DB.prepare(
    `SELECT details FROM platform_audit_log
      WHERE action = 'pay_invoice.kept' AND target_type = 'invoice' AND target_id = ? AND account_id = ? AND actor_id = ?
      ORDER BY created_at DESC, rowid DESC LIMIT 1`
  ).bind(invoiceId, accountId, row.user_id).first<{ details: string | null }>();
  if (!log) return null;
  let details: { customer_id?: string; linked?: KeepLinked } = {};
  try { details = JSON.parse(log.details || '{}'); } catch { /* an unreadable row is no keep */ }
  if (details.customer_id !== row.customer_id) return null;
  return {
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    keptBy: { userId: row.user_id, name: row.name, email: row.email },
    linked: details.linked === 'customer' ? 'customer' : 'invoice',
  };
}

/** Undo a save, so the person the invoice is for can save it. */
export async function releaseInvoiceKeep(env: Db, accountId: string, keep: InvoiceKeep): Promise<boolean> {
  const result = keep.linked === 'customer'
    ? await env.DB.prepare(
      'UPDATE customers SET user_id = NULL WHERE id = ? AND account_id = ? AND user_id = ?'
    ).bind(keep.customerId, accountId, keep.keptBy.userId).run()
    : await env.DB.prepare(
      'UPDATE invoices SET customer_id = NULL WHERE id = ? AND account_id = ? AND customer_id = ? AND fulfillment_claim_token IS NULL'
    ).bind(keep.invoiceId, accountId, keep.customerId).run();
  return Number(result.meta?.changes || 0) === 1;
}
