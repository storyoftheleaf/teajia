import { claimInvoiceLinkLease, releaseInvoiceLinkLease } from './invoiceDomain';

/**
 * An invoice sent by its pay link becomes the buyer's (Adrian, 2026-11-27).
 *
 * The person holding the link presses "Save to my account" while signed in, and
 * the invoice joins their orders, which /account/orders reads through
 * `customers.user_id`. The first signed-in person to keep it wins, as an order
 * page claim does; anyone else is told it is already kept.
 *
 * When the invoice already names a customer with no account yet, that customer
 * record is the one linked, so the shop's own record of the buyer stays whole.
 * Otherwise the person's customer record in this shop is used, or made.
 */
export type KeepInvoiceResult =
  | { ok: true; customerId: string; already: boolean }
  | { ok: false; status: 404 | 409; error: string };

export async function keepInvoiceForUser(
  env: { DB: D1Database },
  accountId: string,
  invoiceId: string,
  user: { userId: string; email: string; name: string },
): Promise<KeepInvoiceResult> {
  const invoice = await env.DB.prepare(
    'SELECT customer_id, customer_name FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoiceId, accountId).first<{ customer_id: string | null; customer_name: string | null }>();
  if (!invoice) return { ok: false, status: 404, error: 'Invoice not found' };

  const named = invoice.customer_id
    ? await env.DB.prepare('SELECT id, user_id FROM customers WHERE id = ? AND account_id = ?')
      .bind(invoice.customer_id, accountId).first<{ id: string; user_id: string | null }>()
    : null;
  if (named?.user_id === user.userId) return { ok: true, customerId: named.id, already: true };
  if (named?.user_id) return { ok: false, status: 409, error: 'This invoice is already kept by someone else' };

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
      return { ok: true, customerId: named.id, already: false };
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
    return { ok: true, customerId, already: false };
  } finally {
    await releaseInvoiceLinkLease(env, accountId, invoiceId, lease.claimToken);
  }
}

/** Whether this invoice is already in the signed-in person's orders. */
export async function invoiceKeptBy(env: { DB: D1Database }, accountId: string, invoiceId: string, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM invoices i JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id
      WHERE i.id = ? AND i.account_id = ? AND c.user_id = ?`
  ).bind(invoiceId, accountId, userId).first();
  return Boolean(row);
}
