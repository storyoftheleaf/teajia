import { authorizeInvoiceLines, buildSettlementStatements, resolvePaymentRecipientUserId,
  type InvoiceSaleLineInput } from './teaMasterSales';
import { loadInvoiceLedgerTotals, loadLedgerInvoice, PAYMENT_EPSILON } from './invoiceDomain';

export type PaidStockResult = { state: 'not_due' | 'already_deducted' | 'deducted' | 'blocked'; reason?: string };

/** The confirmed ledger, never a customer claim or a stale status word, authorizes this transition. */
export async function deductStockForPaidInvoice(
  env: { DB: D1Database },
  input: { accountId: string; invoiceId: string; actorUserId: string; actorRole: string; actorEmail: string | null; allowZeroTotal?: boolean },
): Promise<PaidStockResult> {
  const { accountId, invoiceId } = input;
  const invoice = await env.DB.prepare(
    `SELECT * FROM invoices WHERE id=? AND account_id=? AND deleted_at IS NULL`
  ).bind(invoiceId, accountId).first() as Record<string, any> | null;
  if (!invoice || invoice.status === 'Void' || invoice.status === 'Filled') return { state: 'not_due' };
  if (Number(invoice.inventory_deducted) === 1) return { state: 'already_deducted' };
  const priced = await loadLedgerInvoice(env, invoiceId, accountId);
  if (!priced || (priced.total_usd <= 0 && !input.allowZeroTotal)) return { state: 'not_due' };
  const ledger = await loadInvoiceLedgerTotals(env, [invoiceId]);
  if ((ledger.get(invoiceId)?.paid_usd ?? 0) < priced.total_usd - PAYMENT_EPSILON) return { state: 'not_due' };

  const token = crypto.randomUUID();
  const claimed = await env.DB.prepare(
    `UPDATE invoices SET fulfillment_claim_token=?, fulfillment_claimed_at=datetime('now')
      WHERE id=? AND account_id=? AND inventory_deducted=0 AND status IN ('Draft','Pending')
        AND (fulfillment_claim_token IS NULL OR fulfillment_claimed_at IS NULL
          OR fulfillment_claimed_at < datetime('now','-5 minutes')) RETURNING id`
  ).bind(token, invoiceId, accountId).first();
  if (!claimed) return { state: 'blocked', reason: 'invoice_busy' };
  const release = async () => {
    try {
      await env.DB.prepare(
        `UPDATE invoices SET fulfillment_claim_token=NULL, fulfillment_claimed_at=NULL
         WHERE id=? AND account_id=? AND fulfillment_claim_token=?`
      ).bind(invoiceId, accountId, token).run();
    } catch { /* a failed cleanup will expire with the invoice lease */ }
  };

  try {
    // Recheck money after obtaining the invoice lease; shipping may have changed.
    const current = await loadLedgerInvoice(env, invoiceId, accountId);
    const currentLedger = await loadInvoiceLedgerTotals(env, [invoiceId]);
    if (!current || (current.total_usd <= 0 && !input.allowZeroTotal) ||
      (currentLedger.get(invoiceId)?.paid_usd ?? 0) < current.total_usd - PAYMENT_EPSILON) {
      await release();
      return { state: 'not_due' };
    }
    const lineResult = await env.DB.prepare(
      `SELECT id,product_id,custom_name,quantity,price_at_sale,stock_owner_user_id,
              sales_grant_id,owner_share_type,owner_share_value
       FROM invoice_line_items WHERE invoice_id=? AND account_id=?`
    ).bind(invoiceId, accountId).all();
    const lines = (lineResult.results ?? []) as Array<Record<string, any>>;
    if (lines.length === 0) { await release(); return { state: 'blocked', reason: 'invoice_has_no_lines' }; }

    const sellerUserId = String(invoice.sold_by_user_id || input.actorUserId);
    let sellerRole = input.actorRole;
    if (invoice.sold_by_user_id) {
      const seller = await env.DB.prepare(
        `SELECT u.platform_role,am.role,am.status AS membership_status FROM users u
         LEFT JOIN account_members am ON am.user_id=u.id AND am.account_id=?
         WHERE u.id=? LIMIT 1`
      ).bind(accountId, sellerUserId).first() as Record<string, any> | null;
      if (!seller) { await release(); return { state: 'blocked', reason: 'invoice_seller_not_authorized' }; }
      sellerRole = ['platform_owner','platform_admin'].includes(String(seller.platform_role || '')) ||
        (seller.role === 'owner' && seller.membership_status === 'active') ? 'owner' : 'staff';
      if (sellerRole === 'staff' && seller.membership_status !== 'active') {
        await release(); return { state: 'blocked', reason: 'invoice_seller_not_authorized' };
      }
    }
    const authorized = await authorizeInvoiceLines(env, {
      accountId, actorUserId: sellerUserId,
      actorRole: sellerRole,
      lines: lines as InvoiceSaleLineInput[],
    });
    const quantities = new Map<string, number>();
    for (const line of authorized) if (line.product_id) {
      quantities.set(line.product_id, (quantities.get(line.product_id) ?? 0) + Number(line.quantity));
    }
    const products = new Map<string, Record<string, any>>();
    for (const [productId, quantity] of quantities) {
      const product = await env.DB.prepare(
        `SELECT id,stock_grams,status,source_compass_entry_id FROM products WHERE id=? AND account_id=?`
      ).bind(productId, accountId).first() as Record<string, any> | null;
      const otherHolds = await env.DB.prepare(
        `SELECT COALESCE(SUM(held_grams),0) AS held FROM stock_holds
         WHERE account_id=? AND product_id=? AND invoice_id!=?
           AND (expires_at IS NULL OR expires_at>datetime('now'))`
      ).bind(accountId, productId, invoiceId).first() as { held: number } | null;
      if (!product || quantity > Number(product.stock_grams || 0) - Number(otherHolds?.held || 0)) {
        await release();
        return { state: 'blocked', reason: `insufficient_stock:${productId}` };
      }
      products.set(productId, product);
    }

    const stmts: D1PreparedStatement[] = [];
    for (const line of authorized) stmts.push(env.DB.prepare(
      `UPDATE invoice_line_items SET stock_owner_user_id=?,sales_grant_id=?,owner_share_type=?,owner_share_value=?
       WHERE id=? AND account_id=?`
    ).bind(line.stock_owner_user_id, line.sales_grant_id, line.owner_share_type, line.owner_share_value, line.id, accountId));
    for (const [productId, quantity] of quantities) {
      const product = products.get(productId)!;
      stmts.push(env.DB.prepare(
        `UPDATE products SET stock_grams=CASE WHEN stock_grams - COALESCE((SELECT SUM(held_grams)
          FROM stock_holds WHERE account_id=? AND product_id=? AND invoice_id!=?
          AND (expires_at IS NULL OR expires_at>datetime('now'))),0) >= ?
          THEN stock_grams-? ELSE -1 END
         WHERE id=? AND account_id=? AND EXISTS (SELECT 1 FROM invoices WHERE id=? AND account_id=? AND fulfillment_claim_token=?)`
      ).bind(accountId, productId, invoiceId, quantity, quantity, productId, accountId, invoiceId, accountId, token));
      stmts.push(env.DB.prepare(
        `UPDATE product_listings SET stock_grams=MAX(0,COALESCE(stock_grams,0)-?),updated_at=datetime('now')
         WHERE id=? AND EXISTS (SELECT 1 FROM invoices WHERE id=? AND account_id=? AND fulfillment_claim_token=?)`
      ).bind(quantity, `list_${productId}`, invoiceId, accountId, token));
      stmts.push(env.DB.prepare(
        `INSERT INTO stock_ledger (id,product_id,delta,balance_after,reason,source_invoice_id,source_invoice_number,user_email,note,account_id)
         SELECT ?,?,-?,p.stock_grams,'PAYMENT_CONFIRMED',?,?,?,'Reserved for paid order',?
         FROM products p WHERE p.id=? AND p.account_id=?
         AND EXISTS (SELECT 1 FROM invoices WHERE id=? AND account_id=? AND fulfillment_claim_token=?)`
      ).bind(crypto.randomUUID(), productId, quantity, invoiceId, invoice.invoice_number, input.actorEmail, accountId,
        productId, accountId, invoiceId, accountId, token));
      if (Number(product.stock_grams) - quantity <= 0 && product.status !== 'Sold Out') {
        stmts.push(env.DB.prepare("UPDATE products SET status='Sold Out',sold_out_at=datetime('now') WHERE id=? AND account_id=?")
          .bind(productId, accountId));
        stmts.push(env.DB.prepare("UPDATE product_listings SET status='Sold Out',updated_at=datetime('now') WHERE id=?")
          .bind(`list_${productId}`));
        if (product.source_compass_entry_id) stmts.push(env.DB.prepare(
          "UPDATE tea_compass_entries SET status='depleted',updated_at=datetime('now') WHERE id=? AND status='in_stock'"
        ).bind(product.source_compass_entry_id));
      }
    }
    stmts.push(env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id=? AND account_id=?').bind(invoiceId, accountId));
    stmts.push(...buildSettlementStatements(env, {
      accountId,
      invoice: { ...invoice, sold_by_user_id: sellerUserId },
      lines: authorized as unknown as Array<Record<string, unknown>>,
    }));
    stmts.push(env.DB.prepare(
      `UPDATE invoices SET sold_by_user_id=COALESCE(sold_by_user_id,?),
        payment_recipient_user_id=COALESCE(payment_recipient_user_id,?),
        status='Pending',inventory_deducted=1,stock_exception=NULL,
        fulfillment_claim_token=NULL,fulfillment_claimed_at=NULL
       WHERE id=? AND account_id=? AND fulfillment_claim_token=? AND inventory_deducted=0`
    ).bind(sellerUserId, resolvePaymentRecipientUserId(authorized), invoiceId, accountId, token));
    await env.DB.batch(stmts);
    return { state: 'deducted' };
  } catch (error) {
    await release();
    return { state: 'blocked', reason: /stock_grams cannot be negative/i.test(String(error))
      ? 'insufficient_stock' : (error instanceof Error ? error.message : 'stock_deduction_failed') };
  }
}
