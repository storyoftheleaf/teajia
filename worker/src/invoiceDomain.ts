export interface ConfirmedInvoiceLineInput {
  quantity: number;
  recommendedQuantity: number | null;
  recommendedPriceUsd: number | null;
  catalogUnitPriceUsd: number | null;
}

export interface RepairCandidateInput extends ConfirmedInvoiceLineInput {
  sourceCollectionId: string | null;
  storedPriceAtSale: number;
}

function requireFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

function money(value: number): number {
  requireNonNegative('money value', value);
  const cents = value * 100;
  requireFinite('money cents', cents);
  return Math.round(cents) / 100;
}

function requireNonNegative(name: string, value: number): void {
  requireFinite(name, value);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
}

export function deriveConfirmedInvoiceLine(input: ConfirmedInvoiceLineInput) {
  requireFinite('quantity', input.quantity);
  if (input.recommendedQuantity !== null) {
    requireNonNegative('recommendedQuantity', input.recommendedQuantity);
  }
  if (input.recommendedPriceUsd !== null) {
    requireNonNegative('recommendedPriceUsd', input.recommendedPriceUsd);
  }
  if (input.catalogUnitPriceUsd !== null) {
    requireNonNegative('catalogUnitPriceUsd', input.catalogUnitPriceUsd);
  }

  const quantity = Math.max(1, Math.round(input.quantity));
  const recommendedQuantity = input.recommendedQuantity ?? 0;
  let lineTotalUsd = 0;

  if (input.recommendedPriceUsd !== null && Number.isFinite(recommendedQuantity) && recommendedQuantity > 0) {
    lineTotalUsd = money((input.recommendedPriceUsd / recommendedQuantity) * quantity);
  } else if (input.recommendedPriceUsd !== null) {
    lineTotalUsd = money(input.recommendedPriceUsd);
  } else if (input.catalogUnitPriceUsd !== null) {
    lineTotalUsd = money(input.catalogUnitPriceUsd * quantity);
  }

  return {
    quantity,
    unitPriceUsd: lineTotalUsd / quantity,
    lineTotalUsd,
  };
}

export function invoiceLineTotal(quantity: number, unitPriceUsd: number): number {
  requireNonNegative('quantity', quantity);
  requireNonNegative('unitPriceUsd', unitPriceUsd);
  return money(quantity * unitPriceUsd);
}

export function repairCandidate(input: RepairCandidateInput) {
  const corrected = deriveConfirmedInvoiceLine(input);
  requireNonNegative('storedPriceAtSale', input.storedPriceAtSale);
  if (!input.sourceCollectionId || corrected.quantity <= 1) return null;

  const historicalLineTotal = corrected.lineTotalUsd;
  if (money(input.storedPriceAtSale) !== historicalLineTotal) return null;

  const currentLineTotalUsd = invoiceLineTotal(corrected.quantity, input.storedPriceAtSale);
  if (currentLineTotalUsd === historicalLineTotal) return null;

  return {
    correctedUnitPriceUsd: corrected.unitPriceUsd,
    currentLineTotalUsd,
    correctedLineTotalUsd: historicalLineTotal,
  };
}

/**
 * The account's invoice number as it is printed: prefix, dash, five digits.
 *
 * Every path that allocates a number from accounts.invoice_seq formats it here.
 * Before this it lived in index.ts and mcp.ts wrote the format out by hand
 * twice, because index.ts imports mcp.ts and the reverse would close a cycle.
 */
export function formatInvoiceNumber(accountPrefix: string | null, seq: number): string {
  const padded = String(seq).padStart(5, '0');
  return accountPrefix ? `${accountPrefix}-${padded}` : padded;
}

// ── Payment ledger ───────────────────────────────────────────────────────────
// These rules used to live in index.ts and were copied into mcp.ts, because
// index.ts imports mcp.ts and importing back would close a module cycle. Two
// copies of "what counts as paid" meant the screen and the spoken answer could
// quietly disagree about money. This module depends on neither, so both import
// from here and there is one answer again.
//
// invoice_payments is the record of money against an order. Two kinds of row
// land in it, and keeping them apart is the whole point of the feature:
//
//   ('customer','claimed')    a customer says they sent a transfer. A REPORT.
//                             It moves no money, changes no status, touches no
//                             stock. A customer can never move an invoice
//                             toward paid.
//   ('operator','confirmed')  the operator saw the money arrive. Only these
//                             count toward paid_usd.
//
// invoices.payment_status stays, and stays authoritative for every existing
// reader in the codebase. It is DERIVED: rewritten from the confirmed rows
// after every ledger write, alongside payment_date and payment_method, so the
// admin lists, the invoices list and the MCP tools all keep reading something
// true without being repointed at this table.

/** Money is compared and stored to the cent. Anything under this is settled. */
export const PAYMENT_EPSILON = 0.01;

/** The most a single payment may be. A fat finger, not a real transfer. */
export const PAYMENT_AMOUNT_CEILING = 1_000_000;

/** How far above the balance a claim may sit: rounding, not a second payment. */
export const CLAIM_TOLERANCE_USD = 0.01;

// Everything a payment row can carry from a request body, length-capped. These
// strings reach an email and a pay-page reference, so control characters are
// stripped rather than escaped away later.
export const PAYMENT_TEXT_LIMITS = { currency: 8, method: 80, reference: 140, note: 600 } as const;

export function roundUsd(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function paymentTextField(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}

export interface InvoiceLedgerTotals {
  paid_usd: number;
  claims_pending: number;
}

export interface InvoiceMoney {
  total_usd: number;
  paid_usd: number;
  outstanding_usd: number;
  claims_pending: number;
}

export interface LedgerInvoice {
  id: string;
  account_id: string;
  invoice_number: string | null;
  status: string | null;
  payment_status: string | null;
  payment_date: string | null;
  payment_method: string | null;
  customer_name: string | null;
  customer_id: string | null;
  total_usd: number;
}

export interface LedgerRecompute extends InvoiceMoney {
  payment_status: 'unpaid' | 'partial' | 'paid';
}

/**
 * What the payment ledger holds for a set of invoices: money actually confirmed,
 * and how many customer reports are still waiting.
 *
 * One query per chunk, never one per invoice. D1 caps bound parameters at 100,
 * so a page of 200 orders is read in three queries rather than 200.
 */
export async function loadInvoiceLedgerTotals(
  env: { DB: D1Database },
  invoiceIds: string[],
): Promise<Map<string, InvoiceLedgerTotals>> {
  const totals = new Map<string, InvoiceLedgerTotals>();
  const unique = [...new Set(invoiceIds.filter(Boolean))];
  for (let start = 0; start < unique.length; start += 90) {
    const chunk = unique.slice(start, start + 90);
    const result = await env.DB.prepare(
      `SELECT invoice_id,
              SUM(CASE WHEN status = 'confirmed' THEN amount_usd ELSE 0 END) AS paid_usd,
              SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) AS claims_pending
         FROM invoice_payments
        WHERE invoice_id IN (${chunk.map(() => '?').join(', ')})
        GROUP BY invoice_id`
    ).bind(...chunk).all();
    for (const row of (result.results ?? []) as Array<Record<string, any>>) {
      totals.set(row.invoice_id as string, {
        paid_usd: roundUsd(Number(row.paid_usd || 0)),
        claims_pending: Number(row.claims_pending || 0),
      });
    }
  }
  return totals;
}

/**
 * The three numbers plus the pending count, for one invoice.
 *
 * The ledger is the record of what has been received. `invoices.payment_status`
 * is the operator's word, and two paths still write it without leaving a ledger
 * row: the generic invoice update, and the MCP `mark_invoice_paid` tool. A
 * column that says paid with nothing behind it is read here as fully paid, so a
 * customer is never shown a live pay link for money that has already arrived.
 * This only ever RAISES paid to meet the column; it never lowers it, so a
 * confirmed payment can never be hidden by a stale status word. The reverse
 * direction is handled on the write side by reconcileLedgerWithColumn.
 */
export function invoiceMoney(
  totalUsd: number,
  paymentStatus: string | null | undefined,
  ledger: InvoiceLedgerTotals | undefined,
): InvoiceMoney {
  const total = roundUsd(totalUsd);
  let paid = roundUsd(ledger?.paid_usd ?? 0);
  if (String(paymentStatus || '').toLowerCase() === 'paid' && paid < total - PAYMENT_EPSILON) {
    paid = total;
  }
  return {
    total_usd: total,
    paid_usd: paid,
    outstanding_usd: Math.max(0, roundUsd(total - paid)),
    claims_pending: ledger?.claims_pending ?? 0,
  };
}

/**
 * The invoice as the ledger needs it, priced. There is no total column.
 *
 * `accountId` is optional because one admin path resolves an invoice it has
 * already authorised by id; every caller reaching this from a token or a public
 * request passes it, and the scope is then enforced inside the query.
 */
export async function loadLedgerInvoice(
  env: { DB: D1Database },
  invoiceId: string,
  accountId?: string | null,
): Promise<LedgerInvoice | null> {
  const bindings = accountId ? [invoiceId, accountId] : [invoiceId];
  const row = await env.DB.prepare(
    `SELECT i.id, i.account_id, i.invoice_number, i.status, i.payment_status,
            i.payment_date, i.payment_method, i.customer_name, i.customer_id,
            i.shipping_cost_usd,
            COALESCE((SELECT SUM(quantity * price_at_sale)
                        FROM invoice_line_items WHERE invoice_id = i.id), 0) AS line_total
       FROM invoices i
      WHERE i.id = ? AND i.deleted_at IS NULL${accountId ? ' AND i.account_id = ?' : ''}
      LIMIT 1`
  ).bind(...bindings).first() as Record<string, any> | null;
  if (!row) return null;
  return {
    id: row.id as string,
    account_id: row.account_id as string,
    invoice_number: (row.invoice_number as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    payment_status: (row.payment_status as string | null) ?? null,
    payment_date: (row.payment_date as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    customer_id: (row.customer_id as string | null) ?? null,
    total_usd: roundUsd(Number(row.line_total || 0) + Number(row.shipping_cost_usd || 0)),
  };
}

/**
 * Absorb a settlement that was recorded on the column and nowhere else.
 *
 * Two paths still write invoices.payment_status without leaving a ledger row:
 * the generic invoice update (PUT /api/invoices/:id, how the admin marks an
 * order paid by hand) and the MCP `mark_invoice_paid` tool. Left alone, the
 * first ledger write on such an invoice would recompute from an empty ledger
 * and drag a paid order back to unpaid, silently losing money the operator had
 * already accounted for. That is the desynchronisation this function prevents.
 *
 * So before any ledger mutation, a 'paid' column with nothing behind it becomes
 * what it always meant: a confirmed operator payment for the shortfall, keeping
 * whatever date and method the invoice carried. After this the ledger is the
 * record, and the recompute is safe.
 *
 * It runs BEFORE the mutation on purpose. Running it after would make a
 * rejection impossible to land: the reject empties the ledger, the column still
 * says paid, and the reconciliation would put the money straight back.
 */
export async function reconcileLedgerWithColumn(
  env: { DB: D1Database },
  invoice: LedgerInvoice,
): Promise<void> {
  if (String(invoice.payment_status || '').toLowerCase() !== 'paid') return;
  if (!(invoice.total_usd > 0)) return;
  const ledger = await loadInvoiceLedgerTotals(env, [invoice.id]);
  const shortfall = roundUsd(invoice.total_usd - (ledger.get(invoice.id)?.paid_usd ?? 0));
  if (shortfall <= PAYMENT_EPSILON) return;
  const when = invoice.payment_date || new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO invoice_payments
       (id, invoice_id, account_id, amount_usd, currency, method_label, note,
        status, claimed_by, claimed_at, confirmed_at)
     VALUES (?, ?, ?, ?, 'USD', ?, ?, 'confirmed', 'operator', ?, ?)`
  ).bind(
    crypto.randomUUID(), invoice.id, invoice.account_id, shortfall,
    invoice.payment_method || null,
    'Settled on the order before this was recorded as a payment.',
    when, when,
  ).run();
}

/**
 * Rewrite payment_status, payment_date and payment_method from the confirmed
 * rows. Called after every ledger mutation and never on a read: a read that
 * writes would fire once per row of every orders page.
 */
export async function recomputeInvoicePaymentStatus(
  env: { DB: D1Database },
  invoice: LedgerInvoice,
): Promise<LedgerRecompute> {
  const [ledger, latest] = await Promise.all([
    loadInvoiceLedgerTotals(env, [invoice.id]),
    env.DB.prepare(
      `SELECT method_label, confirmed_at, claimed_at
         FROM invoice_payments
        WHERE invoice_id = ? AND status = 'confirmed'
        ORDER BY COALESCE(confirmed_at, claimed_at) DESC, created_at DESC
        LIMIT 1`
    ).bind(invoice.id).first() as Promise<Record<string, any> | null>,
  ]);
  const totals = ledger.get(invoice.id) ?? { paid_usd: 0, claims_pending: 0 };
  const paid = roundUsd(totals.paid_usd);
  const total = invoice.total_usd;
  const paymentStatus: 'unpaid' | 'partial' | 'paid' =
    total > 0 && paid >= total - PAYMENT_EPSILON ? 'paid'
      : paid > 0 ? 'partial'
        : 'unpaid';
  const paymentDate = latest
    ? ((latest.confirmed_at as string | null) || (latest.claimed_at as string | null))
    : null;
  const paymentMethod = latest ? ((latest.method_label as string | null) || null) : null;
  await env.DB.prepare(
    `UPDATE invoices SET payment_status = ?, payment_date = ?, payment_method = ?
      WHERE id = ? AND account_id = ?`
  ).bind(paymentStatus, paymentDate, paymentMethod, invoice.id, invoice.account_id).run();
  return {
    payment_status: paymentStatus,
    total_usd: total,
    paid_usd: paid,
    outstanding_usd: Math.max(0, roundUsd(total - paid)),
    claims_pending: totals.claims_pending,
  };
}
