/**
 * A discount on an invoice, offered by the shop that sent it (Adrian,
 * 2026-11-27: "I also want to give her a 10% discount... I should have a place
 * where I can offer a discount on this sheet").
 *
 * The discount is one line of its own, "Discount 10%", with no tea and a
 * negative amount, so every total that adds up an invoice's lines (the pay
 * link, orders, the ledger) already counts it, stock is untouched and taking
 * it off again leaves the teas' own lines as they were. It is worked out from
 * the teas' lines and written again whenever it changes.
 *
 * Only an unpaid Draft or Pending invoice whose stock has not been taken and
 * on which no money has been received, the same invoices the line editor
 * accepts.
 */
type Db = { DB: D1Database };

const DISCOUNT_NAME = /^Discount \d+(?:\.\d+)?%$/;

export function isDiscountLine(row: { product_id?: unknown; custom_name?: unknown; price_at_sale?: unknown }): boolean {
  return !row.product_id && typeof row.custom_name === 'string' && DISCOUNT_NAME.test(row.custom_name) && Number(row.price_at_sale) < 0;
}

/** The percent asked for: a number above 0 and below 100, at most one decimal; 0 takes it off. */
export function discountPercent(raw: unknown): number | null {
  const value = typeof raw === 'string' && raw.trim() ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 100) return null;
  const rounded = Math.round(value * 10) / 10;
  return rounded === value ? value : null;
}

export type InvoiceDiscountState = {
  editable: boolean;
  /** The teas' lines added up, before any discount. */
  subtotal_usd: number;
  percent: number | null;
  discount_usd: number;
  status: string;
};

export async function readInvoiceDiscount(env: Db, accountId: string, invoiceId: string): Promise<InvoiceDiscountState | null> {
  const invoice = await env.DB.prepare(
    `SELECT status, payment_status, inventory_deducted, fulfillment_claim_token FROM invoices WHERE id = ? AND account_id = ? AND deleted_at IS NULL`
  ).bind(invoiceId, accountId).first<Record<string, any>>();
  if (!invoice) return null;
  const [lines, paid] = await Promise.all([
    env.DB.prepare(
      `SELECT product_id, custom_name, quantity, price_at_sale FROM invoice_line_items
        WHERE invoice_id = ? AND (account_id = ? OR account_id IS NULL)`
    ).bind(invoiceId, accountId).all<Record<string, any>>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount_usd), 0) AS paid FROM invoice_payments WHERE invoice_id = ? AND account_id = ? AND status = 'confirmed'`
    ).bind(invoiceId, accountId).first<{ paid: number }>(),
  ]);
  let subtotal = 0;
  let discount: Record<string, any> | null = null;
  for (const line of lines.results ?? []) {
    if (isDiscountLine(line)) discount = line;
    else subtotal += Number(line.quantity) * Number(line.price_at_sale);
  }
  const percent = discount ? Number(String(discount.custom_name).match(/[\d.]+/)?.[0]) : null;
  return {
    editable: ['Draft', 'Pending'].includes(String(invoice.status)) && !Number(invoice.inventory_deducted)
      && invoice.payment_status !== 'paid' && !invoice.fulfillment_claim_token && !(Number(paid?.paid) > 0),
    subtotal_usd: Math.round(subtotal * 100) / 100,
    percent,
    discount_usd: discount ? Math.round(-Number(discount.quantity) * Number(discount.price_at_sale) * 100) / 100 : 0,
    status: String(invoice.status),
  };
}

/** What a percent comes to on this subtotal, to the cent. */
export function discountAmount(subtotalUsd: number, percent: number): number {
  return Math.round(subtotalUsd * percent) / 100;
}

/**
 * Write the discount line again for this percent (0 takes it off), guarded on
 * the invoice still being unpaid, unfulfilled and not being edited elsewhere.
 */
export async function writeInvoiceDiscount(
  env: Db, accountId: string, invoiceId: string, percent: number, expectedStatus: string,
): Promise<{ ok: true; discount_usd: number; total_usd: number } | { ok: false; error: string }> {
  const state = await readInvoiceDiscount(env, accountId, invoiceId);
  if (!state) return { ok: false, error: 'invoice_not_found' };
  if (!state.editable || state.status !== expectedStatus) return { ok: false, error: 'invoice_not_editable' };
  const amount = percent > 0 ? discountAmount(state.subtotal_usd, percent) : 0;
  const guard = `EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND status = ?
    AND inventory_deducted = 0 AND fulfillment_claim_token IS NULL AND COALESCE(payment_status, '') != 'paid')`;
  const guardValues = [invoiceId, accountId, expectedStatus];
  const statements = [
    env.DB.prepare(
      `DELETE FROM invoice_line_items WHERE invoice_id = ? AND (account_id = ? OR account_id IS NULL)
         AND product_id IS NULL AND custom_name LIKE 'Discount %' AND price_at_sale < 0 AND ${guard}`
    ).bind(invoiceId, accountId, ...guardValues),
  ];
  if (amount > 0) {
    statements.push(env.DB.prepare(
      `INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale)
       SELECT ?, ?, ?, NULL, ?, 1, ? WHERE ${guard}`
    ).bind(crypto.randomUUID(), accountId, invoiceId, `Discount ${percent}%`, -amount, ...guardValues));
  }
  const results = await env.DB.batch(statements);
  if (amount > 0 && !Number(results[results.length - 1]?.meta?.changes || 0)) return { ok: false, error: 'invoice_changed' };
  return { ok: true, discount_usd: amount, total_usd: Math.round((state.subtotal_usd - amount) * 100) / 100 };
}
