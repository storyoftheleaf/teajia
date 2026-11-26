// Launch 5, M1: tea credit for hosts, as a ledger.
// (todo/plans/guests-and-tea-masters-launch-5-run.md, hard question 1 and
// "Credit is held securely", and the M1 audit of order history.)
//
// The rule, Adrian's (2026-11-26): a host earns credit in tea worth a share of
// the tea lines of an order (10 percent by default), on all teas, only for an
// order that began from that host's thank-you or page. No time window and no
// expiry: it is an ongoing balance. Credit is spent only on tea from the shop,
// is never paid out and is never shown to a guest. The share and the per-order
// ceiling are account settings read here, at use time.
//
// Held securely:
// - Nothing about credit is read from a request. The host, the lines, the
//   amounts and the share are all worked out here from stored rows.
// - When an order that began from a thank-you comes in, each eligible tea line
//   gets a 'pending' row. Pending is not part of any balance.
// - A line becomes 'earned' only once the order is Filled (by hand, in Sales)
//   and fully paid, worked out again from the stored line. An order whose
//   credit is over the shop's ceiling stays pending until the owner approves
//   it in Manage.
// - Void writes one 'reversed' row per earned line. Rows are only ever added;
//   a reversal that exceeds unspent credit leaves debt that future earnings repay.
// - Spending is a held request that leaves the balance only on the owner's
//   approval, in one guarded statement that cannot go below zero or spend the
//   same request twice. Nothing else writes 'spent'.
// - Oddities go to the builder's ledger (recordHealthProblem), never a page.
// - order_session_sources (Launch 1) is read, never changed.
//
// settleHostCredit is called after every write that can bring an order in,
// make it Filled, fully paid or Void, so whichever of Filled and paid comes
// second is the one that earns. It is safe to call any number of times, and it
// never throws: credit is never worth failing an order over.

import { TEA_TYPES } from '../../src/wisdom/vocabulary';
import {
  HOST_CREDIT_DEFAULT_ORDER_CEILING_USD,
  HOST_CREDIT_DEFAULT_PERCENT,
  hostCreditOpen,
} from '../../src/lib/hostCredit';
import { PAYMENT_EPSILON, invoiceMoney, loadInvoiceLedgerTotals, loadLedgerInvoice, roundUsd } from './invoiceDomain';
import { clearHealthProblem, recordHealthProblem } from './incidents';

/** Invoice lines are priced in US dollars (see invoiceMoney), so credit is too. */
export const HOST_CREDIT_CURRENCY = 'USD';

/** Who wrote a ledger row when no person did: the worker, from stored rows. */
const SYSTEM = 'system';

type CreditEnv = { DB: D1Database; HOST_CREDIT_OPEN?: string };

/** ceilingUsd null: no ceiling. */
export type HostCreditTerms = { percent: number; ceilingUsd: number | null };

/**
 * The shop's two terms. NULL follows the default; any number, zero included,
 * is obeyed. A stored value that is not usable (negative, over 100 percent)
 * earns nothing rather than guessing.
 */
export async function hostCreditTerms(db: D1Database, accountId: string): Promise<HostCreditTerms | null> {
  const row = await db.prepare(
    'SELECT host_credit_percent, host_credit_order_ceiling_usd FROM accounts WHERE id = ?',
  ).bind(accountId).first<{ host_credit_percent: number | null; host_credit_order_ceiling_usd: number | null }>();
  if (!row) return null;
  const percent = row.host_credit_percent == null ? HOST_CREDIT_DEFAULT_PERCENT : row.host_credit_percent;
  const ceilingUsd = row.host_credit_order_ceiling_usd == null
    ? HOST_CREDIT_DEFAULT_ORDER_CEILING_USD : row.host_credit_order_ceiling_usd;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100
    || (ceilingUsd !== null && (!Number.isFinite(ceilingUsd) || ceilingUsd < 0))) {
    await fileOddity(db, 'invalid_terms', 'The shop has unusable host credit settings.', accountId);
    return null;
  }
  await clearOddity(db, 'invalid_terms', 'host credit settings are usable', accountId);
  return { percent, ceilingUsd };
}

export const HOST_CREDIT_SETTING_KEYS = ['host_credit_percent', 'host_credit_order_ceiling_usd'] as const;
export type HostCreditSettingKey = typeof HOST_CREDIT_SETTING_KEYS[number];

/** Validates the two settings as the account update route receives them. */
export function readHostCreditSetting(
  key: HostCreditSettingKey,
  value: unknown,
): { value: number | null } | { error: string } {
  if (value === null) return { value: null };
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (key === 'host_credit_percent') {
    return Number.isFinite(n) && n >= 0 && n <= 100
      ? { value: n } : { error: 'Host credit percent must be a number from 0 to 100, or empty to follow the default' };
  }
  return Number.isFinite(n) && n >= 0
    ? { value: roundUsd(n) } : { error: 'Host credit ceiling must be a number of US dollars, 0 or more, or empty to follow the default' };
}

type InvoiceRow = {
  id: string; account_id: string; status: string | null; deleted_at: string | null;
  cancelled_at: string | null; refund_required: number | null;
  source_inquiry_id: string | null; buyer_user_id: string | null;
};

export type HostCreditSettlement = {
  pending: number;
  earned: number;
  reversed: number;
  /** The order is Filled and paid, but its credit is over the ceiling: it waits for the owner. */
  awaiting_approval: boolean;
};

const NOTHING: HostCreditSettlement = { pending: 0, earned: 0, reversed: 0, awaiting_approval: false };

async function fileOddity(db: D1Database, name: string, message: string, accountId?: string): Promise<void> {
  try {
    await recordHealthProblem(db, {
      signature: `host_credit_${name}`,
      accountId,
      severity: 'medium',
      errorCode: `host_credit_${name}`,
      message,
    });
  } catch {
    console.error(`host credit could not file ${name}`);
  }
}

async function clearOddity(db: D1Database, name: string, ref: string, accountId: string): Promise<void> {
  try {
    await clearHealthProblem(db, `host_credit_${name}`, ref, accountId);
  } catch {
    console.error(`host credit could not clear ${name}`);
  }
}

/**
 * Bring one invoice's credit up to date with its state now. `approvedBy` is
 * the owner approving an order over the ceiling in Manage; nothing else
 * passes it. Returns how many rows this call wrote.
 */
export async function settleHostCredit(
  env: CreditEnv,
  invoiceId: string,
  opts: { approvedBy?: string } = {},
): Promise<HostCreditSettlement> {
  if (typeof invoiceId !== 'string' || !invoiceId) return { ...NOTHING };
  try {
    const invoice = await env.DB.prepare(
      `SELECT i.id, i.account_id, i.status, i.deleted_at, i.cancelled_at, i.refund_required,
              i.source_inquiry_id, c.user_id AS buyer_user_id
         FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id
        WHERE i.id = ?`,
    ).bind(invoiceId).first<InvoiceRow>();
    if (!invoice) return { ...NOTHING };
    // Undo a posted award even when earning is closed, whether the invoice
    // became Void or the buyer is later identified as the host.
    if (invoice.status === 'Void') {
      const reversed = await reverseInvoiceCredit(env.DB, invoice, 'void');
      if (reversed) await checkHostCreditIntegrity(env.DB, invoice.account_id);
      return { ...NOTHING, reversed };
    }
    if (!hostCreditOpen(env) && !invoice.buyer_user_id) return { ...NOTHING };
    const result = await earnInvoiceCredit(env, invoice, opts.approvedBy ?? null);
    if (result.pending || result.earned || result.reversed) await checkHostCreditIntegrity(env.DB, invoice.account_id);
    return result;
  } catch (error) {
    await fileOddity(env.DB, 'settle_failed',
      `Host credit could not be settled for an order: ${error instanceof Error ? error.message : String(error)}`);
    return { ...NOTHING };
  }
}

async function reverseInvoiceCredit(db: D1Database, invoice: InvoiceRow, reason: 'void' | 'self_purchase'): Promise<number> {
  const result = await db.prepare(
    `INSERT INTO host_credit_entries
       (id, account_id, host_user_id, kind, amount, currency, source_inquiry_id, event_id,
        invoice_id, invoice_line_id, product_id, reverses_entry_id, reason, created_by)
     SELECT 'hcr_' || lower(hex(randomblob(12))), e.account_id, e.host_user_id, 'reversed', e.amount, e.currency,
            e.source_inquiry_id, e.event_id, e.invoice_id, e.invoice_line_id, e.product_id, e.id, ?1, ?2
       FROM host_credit_entries e
      WHERE e.invoice_id = ?3 AND e.account_id = ?4 AND e.kind = 'earned'
        AND (?1 = 'void' OR e.host_user_id = ?5)
        AND NOT EXISTS (SELECT 1 FROM host_credit_entries r WHERE r.kind = 'reversed' AND r.reverses_entry_id = e.id)
     ON CONFLICT DO NOTHING`,
  ).bind(reason, SYSTEM, invoice.id, invoice.account_id, invoice.buyer_user_id).run();
  return Number(result.meta?.changes || 0);
}

type EligibleLine = { id: string; product_id: string; quantity: number; unitPrice: number; basis: number; credit: number };

async function earnInvoiceCredit(env: CreditEnv, invoice: InvoiceRow, approvedBy: string | null): Promise<HostCreditSettlement> {
  // Where the order began. A converted bag request reaches its invoice through
  // inquiries.converted_invoice_id; a website checkout, and each invoice split
  // from it, through invoices.source_inquiry_id. Either matches, and a request
  // matched both ways is one row. Should two requests ever reach one invoice,
  // the earliest is where it began.
  const source = await env.DB.prepare(
    `SELECT s.inquiry_id, s.event_id, s.host_user_id
       FROM order_session_sources s
       JOIN inquiries q ON q.id = s.inquiry_id AND q.account_id = s.account_id
      WHERE s.account_id = ?1 AND (q.converted_invoice_id = ?2 OR q.id = ?3)
      ORDER BY s.created_at ASC, s.inquiry_id ASC
      LIMIT 1`,
  ).bind(invoice.account_id, invoice.id, invoice.source_inquiry_id ?? null)
    .first<{ inquiry_id: string; event_id: string; host_user_id: string | null }>();
  if (!source || !source.host_user_id) return { ...NOTHING };

  // A host never earns on their own order. Only a customer row linked to a
  // user can say who bought; an anonymous checkout cannot be told apart.
  if (invoice.buyer_user_id === source.host_user_id) {
    const reversed = await reverseInvoiceCredit(env.DB, invoice, 'self_purchase');
    if (reversed || hostCreditOpen(env)) {
      await fileOddity(env.DB, 'self_purchase',
        `A host bought through their own thank-you (order ${invoice.id}); it earns nothing.`, invoice.account_id);
    }
    return { ...NOTHING, reversed };
  }
  if (!hostCreditOpen(env) || invoice.deleted_at || invoice.cancelled_at) return { ...NOTHING };
  const terms = await hostCreditTerms(env.DB, invoice.account_id);
  if (!terms || !(terms.percent > 0)) return { ...NOTHING };

  // Eligible lines: positive, linked to a tea of this shop. Teaware, custom
  // lines and shipping (which is not a line) earn nothing.
  const types = TEA_TYPES as readonly string[];
  const { results } = await env.DB.prepare(
    `SELECT li.id, li.product_id, li.quantity, li.price_at_sale
       FROM invoice_line_items li
       JOIN products p ON p.id = li.product_id AND p.account_id = ?
      WHERE li.invoice_id = ? AND li.quantity > 0 AND li.price_at_sale > 0
        AND p.type IN (${types.map(() => '?').join(', ')})
      ORDER BY li.id`,
  ).bind(invoice.account_id, invoice.id, ...types)
    .all<{ id: string; product_id: string; quantity: number; price_at_sale: number }>();
  const lines: EligibleLine[] = [];
  for (const row of results) {
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.price_at_sale);
    const basis = roundUsd(quantity * unitPrice);
    const credit = roundUsd(basis * terms.percent / 100);
    if (basis > 0 && credit > 0) lines.push({ id: row.id, product_id: row.product_id, quantity, unitPrice, basis, credit });
  }
  if (lines.length === 0) return { ...NOTHING };

  // Check current invoice status and buyer in the write itself. A Void or
  // claim can land after we have read the invoice and before the batch runs.
  const insert = (line: EligibleLine, kind: 'pending' | 'earned', createdBy: string) => env.DB.prepare(
    `INSERT INTO host_credit_entries
       (id, account_id, host_user_id, kind, amount, currency, source_inquiry_id, event_id,
        invoice_id, invoice_line_id, product_id, basis_quantity, basis_unit_price, basis_amount, basis_currency, created_by)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16
      WHERE EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.id = ?9 AND i.account_id = ?2 AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
          AND i.status IS NOT 'Void'
          AND (?4 = 'pending' OR (i.status = 'Filled' AND COALESCE(i.refund_required, 0) != 1))
          AND NOT EXISTS (SELECT 1 FROM customers c
            WHERE c.id = i.customer_id AND c.account_id = i.account_id AND c.user_id = ?3)
      )
     ON CONFLICT DO NOTHING`,
  ).bind(
    `${kind === 'pending' ? 'hcp' : 'hce'}_${crypto.randomUUID().replace(/-/g, '')}`, invoice.account_id,
    source.host_user_id, kind, line.credit, HOST_CREDIT_CURRENCY, source.inquiry_id, source.event_id,
    invoice.id, line.id, line.product_id, line.quantity, line.unitPrice, line.basis, HOST_CREDIT_CURRENCY, createdBy,
  );
  const changes = (rows: D1Result[]) => rows.reduce((sum, row) => sum + Number(row.meta?.changes || 0), 0);

  // The order has come in: each line is held as pending.
  const pending = changes(await env.DB.batch(lines.map(line => insert(line, 'pending', SYSTEM))));

  // Earning waits for the order to be Filled by hand and fully paid, read the
  // way resolveInvoicePayment reads it: the lines plus shipping against
  // confirmed ledger money, a legacy 'paid' column counting as paid.
  if (invoice.status !== 'Filled' || Number(invoice.refund_required) === 1) return { ...NOTHING, pending };
  const priced = await loadLedgerInvoice(env, invoice.id, invoice.account_id);
  if (!priced) return { ...NOTHING, pending };
  const ledger = await loadInvoiceLedgerTotals(env, [invoice.id]);
  const money = invoiceMoney(priced.total_usd, priced.payment_status, ledger.get(invoice.id));
  if (!(money.total_usd > 0) || money.outstanding_usd > 0 || money.paid_usd < money.total_usd - PAYMENT_EPSILON) {
    return { ...NOTHING, pending };
  }

  // Above the ceiling, the whole order waits for the owner's approval.
  const orderCredit = roundUsd(lines.reduce((sum, line) => sum + line.credit, 0));
  if (!approvedBy && terms.ceilingUsd !== null && orderCredit > terms.ceilingUsd + PAYMENT_EPSILON / 2) {
    return { ...NOTHING, pending, awaiting_approval: true };
  }

  // A pending row worked out to a different amount than the line now earns
  // means the order changed after it came in. The stored order as Filled by
  // hand is what earns; the difference goes to the builder.
  const { results: held } = await env.DB.prepare(
    `SELECT invoice_line_id, amount FROM host_credit_entries WHERE invoice_id = ? AND account_id = ? AND kind = 'pending'`,
  ).bind(invoice.id, invoice.account_id).all<{ invoice_line_id: string; amount: number }>();
  const heldAmount = new Map(held.map(row => [row.invoice_line_id, Number(row.amount)]));
  if (lines.some(line => heldAmount.has(line.id) && Math.abs(heldAmount.get(line.id)! - line.credit) > 0.004)) {
    await fileOddity(env.DB, 'pending_changed',
      `An order's tea lines changed between coming in and being Filled (order ${invoice.id}); the Filled lines earned.`, invoice.account_id);
  }

  const earned = changes(await env.DB.batch(lines.map(line => insert(line, 'earned', approvedBy ?? SYSTEM))));
  return { pending, earned, reversed: 0, awaiting_approval: false };
}

// ── Integrity ────────────────────────────────────────────────────────────────

const MATCHING_AWARD_SQL = `EXISTS (
  SELECT 1 FROM host_credit_entries e
   WHERE e.id = r.reverses_entry_id AND e.kind = 'earned'
     AND e.account_id = r.account_id AND e.host_user_id = r.host_user_id
     AND e.currency = r.currency AND e.amount = r.amount
     AND e.invoice_id = r.invoice_id AND e.invoice_line_id = r.invoice_line_id)`;

/**
 * Looks for rows that should not exist and files each kind once, clearing it
 * again when it is gone: an award with no source naming that host, a reversal
 * with no award behind it, an award with no pending row before it, and a
 * shortfall that cannot be explained by legitimate reversals.
 */
export async function checkHostCreditIntegrity(db: D1Database, accountId: string): Promise<string[]> {
  const checks: Array<{ name: string; sql: string; say: (n: number) => string }> = [
    {
      name: 'award_without_source',
      sql: `SELECT COUNT(*) AS n FROM host_credit_entries e
             WHERE e.account_id = ?1 AND e.kind IN ('pending','earned')
               AND NOT EXISTS (SELECT 1 FROM order_session_sources s
                 WHERE s.inquiry_id = e.source_inquiry_id AND s.account_id = e.account_id AND s.host_user_id = e.host_user_id)`,
      say: n => `${n} host credit rows name no order source for their host.`,
    },
    {
      name: 'reversal_without_award',
      sql: `SELECT COUNT(*) AS n FROM host_credit_entries r
             WHERE r.account_id = ?1 AND r.kind = 'reversed'
               AND NOT ${MATCHING_AWARD_SQL}`,
      say: n => `${n} host credit reversals have no matching award.`,
    },
    {
      name: 'award_without_pending',
      sql: `SELECT COUNT(*) AS n FROM host_credit_entries e
             WHERE e.account_id = ?1 AND e.kind = 'earned'
               AND NOT EXISTS (SELECT 1 FROM host_credit_entries p WHERE p.kind = 'pending' AND p.invoice_line_id = e.invoice_line_id)`,
      say: n => `${n} host credit awards were earned without being held as pending first.`,
    },
    {
      name: 'balance_below_zero',
      sql: `SELECT COUNT(*) AS n FROM (
              SELECT SUM(CASE
                       WHEN r.kind = 'earned' THEN r.amount
                       WHEN r.kind = 'spent' OR (r.kind = 'reversed' AND NOT ${MATCHING_AWARD_SQL}) THEN -r.amount
                       ELSE 0 END)
                     - COALESCE((SELECT SUM(h.amount) FROM host_credit_spend_requests h WHERE h.account_id = ?1
                         AND h.host_user_id = r.host_user_id AND h.currency = r.currency AND h.status = 'held'), 0) AS unexplained_balance
                FROM host_credit_entries r WHERE r.account_id = ?1
               GROUP BY r.host_user_id, r.currency) WHERE unexplained_balance < -0.004`,
      say: n => `${n} hosts have a credit shortfall not explained by reversals.`,
    },
  ];
  const found: string[] = [];
  for (const check of checks) {
    const row = await db.prepare(check.sql).bind(accountId).first<{ n: number }>();
    const n = Number(row?.n || 0);
    if (n > 0) {
      found.push(check.name);
      await fileOddity(db, check.name, `${check.say(n)} Shop ${accountId}.`, accountId);
    } else {
      await clearOddity(db, check.name, 'host credit integrity check found none', accountId);
    }
  }
  return found;
}

// ── Balances ─────────────────────────────────────────────────────────────────

/** Signed credit after reversals, spending and holds. Keep debt in the spend guard. ?1 shop, ?2 host, ?3 currency. */
const NET_AFTER_HOLDS_SQL = `(
  COALESCE((SELECT SUM(CASE l.kind WHEN 'earned' THEN l.amount WHEN 'reversed' THEN -l.amount WHEN 'spent' THEN -l.amount ELSE 0 END)
              FROM host_credit_entries l WHERE l.account_id = ?1 AND l.host_user_id = ?2 AND l.currency = ?3), 0)
  - COALESCE((SELECT SUM(h.amount) FROM host_credit_spend_requests h
              WHERE h.account_id = ?1 AND h.host_user_id = ?2 AND h.currency = ?3 AND h.status = 'held'), 0))`;

export type HostCreditBalance = {
  account_id: string;
  shop_name: string | null;
  host_user_id: string;
  currency: string;
  pending: number;
  earned: number;
  reversed: number;
  spent: number;
  held: number;
  /** The outstanding shortfall after posted reversals, before open holds. */
  debt: number;
  available: number;
};

async function readBalances(db: D1Database, where: string, bindings: unknown[]): Promise<HostCreditBalance[]> {
  const { results } = await db.prepare(
    `SELECT k.account_id, a.name AS shop_name, k.host_user_id, k.currency,
            COALESCE((SELECT SUM(e.amount) FROM host_credit_entries e WHERE e.account_id = k.account_id AND e.host_user_id = k.host_user_id
              AND e.currency = k.currency AND e.kind = 'pending'
              AND NOT EXISTS (SELECT 1 FROM host_credit_entries x WHERE x.kind = 'earned' AND x.invoice_line_id = e.invoice_line_id)
              AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = e.invoice_id AND i.status = 'Void')), 0) AS pending,
            COALESCE((SELECT SUM(e.amount) FROM host_credit_entries e WHERE e.account_id = k.account_id AND e.host_user_id = k.host_user_id
              AND e.currency = k.currency AND e.kind = 'earned'), 0) AS earned,
            COALESCE((SELECT SUM(e.amount) FROM host_credit_entries e WHERE e.account_id = k.account_id AND e.host_user_id = k.host_user_id
              AND e.currency = k.currency AND e.kind = 'reversed'), 0) AS reversed,
            COALESCE((SELECT SUM(e.amount) FROM host_credit_entries e WHERE e.account_id = k.account_id AND e.host_user_id = k.host_user_id
              AND e.currency = k.currency AND e.kind = 'spent'), 0) AS spent,
            COALESCE((SELECT SUM(r.amount) FROM host_credit_spend_requests r WHERE r.account_id = k.account_id AND r.host_user_id = k.host_user_id
              AND r.currency = k.currency AND r.status = 'held'), 0) AS held
       FROM (SELECT DISTINCT account_id, host_user_id, currency FROM host_credit_entries WHERE ${where}) k
       LEFT JOIN accounts a ON a.id = k.account_id
      ORDER BY a.name, k.account_id, k.host_user_id`,
  ).bind(...bindings).all<Record<string, any>>();
  return results.map(row => {
    const [pending, earned, reversed, spent, held] = ['pending', 'earned', 'reversed', 'spent', 'held'].map(key => roundUsd(Number(row[key] || 0)));
    const net = roundUsd(earned - reversed - spent);
    return {
      account_id: row.account_id, shop_name: row.shop_name ?? null, host_user_id: row.host_user_id, currency: row.currency,
      pending, earned, reversed, spent, held,
      debt: Math.max(0, -net),
      available: Math.max(0, roundUsd(net - held)),
    };
  });
}

export type HostCreditLineView = {
  id: string;
  account_id: string;
  shop_name: string | null;
  event_id: string;
  event_title: string | null;
  tea_name: string | null;
  basis_amount: number;
  basis_currency: string;
  credit_amount: number;
  credit_currency: string;
  status: 'pending' | 'earned' | 'reversed' | 'void';
  earned_at: string | null;
  reversed_at: string | null;
  created_at: string;
};

/** One row per credited line: its pending row, with what became of it. */
const LINE_SELECT = `
  SELECT p.id, p.account_id, a.name AS shop_name, p.event_id, ev.title AS event_title,
         COALESCE(pr.given_name, pr.product_name) AS tea_name,
         COALESCE(e.basis_amount, p.basis_amount) AS basis_amount, p.basis_currency,
         COALESCE(e.amount, p.amount) AS credit_amount, p.currency AS credit_currency,
         e.created_at AS earned_at, r.created_at AS reversed_at, p.created_at,
         i.status AS invoice_status, i.invoice_number, p.invoice_id, p.host_user_id, p.source_inquiry_id
    FROM host_credit_entries p
    LEFT JOIN host_credit_entries e ON e.kind = 'earned' AND e.invoice_line_id = p.invoice_line_id
    LEFT JOIN host_credit_entries r ON r.kind = 'reversed' AND r.reverses_entry_id = e.id
    LEFT JOIN accounts a ON a.id = p.account_id
    LEFT JOIN events ev ON ev.id = p.event_id AND ev.account_id = p.account_id
    LEFT JOIN products pr ON pr.id = p.product_id AND pr.account_id = p.account_id
    LEFT JOIN invoices i ON i.id = p.invoice_id AND i.account_id = p.account_id`;

function lineView(row: Record<string, any>): HostCreditLineView {
  const status = row.reversed_at ? 'reversed' : row.earned_at ? 'earned' : row.invoice_status === 'Void' ? 'void' : 'pending';
  return {
    id: row.id, account_id: row.account_id, shop_name: row.shop_name ?? null,
    event_id: row.event_id, event_title: row.event_title ?? null, tea_name: row.tea_name ?? null,
    basis_amount: Number(row.basis_amount), basis_currency: row.basis_currency,
    credit_amount: Number(row.credit_amount), credit_currency: row.credit_currency,
    status, earned_at: row.earned_at ?? null, reversed_at: row.reversed_at ?? null, created_at: row.created_at,
  };
}

/**
 * A host's own credit, in every shop: balances per shop and currency, and each
 * credited line. Reads only rows whose host is this user. No buyer is named.
 */
export async function readOwnHostCredit(db: D1Database, userId: string): Promise<{
  balances: Array<Omit<HostCreditBalance, 'host_user_id'>>; lines: HostCreditLineView[];
  requests: HostCreditOwnRequest[]; orders: HostCreditOwnOrder[];
}> {
  const { results } = await db.prepare(
    `${LINE_SELECT}
      WHERE p.kind = 'pending' AND p.host_user_id = ?
      ORDER BY p.created_at DESC, p.id DESC LIMIT 500`,
  ).bind(userId).all<Record<string, any>>();
  const balances = (await readBalances(db, 'host_user_id = ?', [userId]))
    .map(({ host_user_id: _host, ...rest }) => rest);
  const { results: requests } = await db.prepare(
    `SELECT r.id, r.account_id, a.name AS shop_name, r.invoice_id, i.invoice_number, r.amount, r.currency, r.status,
            r.requested_at, r.decided_at
       FROM host_credit_spend_requests r
       LEFT JOIN accounts a ON a.id = r.account_id
       LEFT JOIN invoices i ON i.id = r.invoice_id AND i.account_id = r.account_id
      WHERE r.host_user_id = ?
      ORDER BY r.requested_at DESC, r.id DESC LIMIT 200`,
  ).bind(userId).all<Record<string, any>>();
  return {
    balances,
    lines: results.map(lineView),
    requests: requests.map(row => ({
      id: row.id, account_id: row.account_id, shop_name: row.shop_name ?? null, invoice_id: row.invoice_id,
      invoice_number: row.invoice_number ?? null, amount: Number(row.amount), currency: row.currency,
      status: row.status, requested_at: row.requested_at, decided_at: row.decided_at ?? null,
    })),
    orders: await ownOrdersForCredit(db, userId, balances),
  };
}

/** What this host may use in one shop now, after every open hold (checkout's offer). */
export async function readOwnAvailableInShop(db: D1Database, userId: string, accountId: string): Promise<number> {
  const [balance] = await readBalances(db, 'host_user_id = ? AND account_id = ? AND currency = ?',
    [userId, accountId, HOST_CREDIT_CURRENCY]);
  return balance?.available ?? 0;
}

export type HostCreditOwnRequest = {
  id: string; account_id: string; shop_name: string | null; invoice_id: string; invoice_number: string | null;
  amount: number; currency: string; status: 'held' | 'approved' | 'declined'; requested_at: string; decided_at: string | null;
};

/** One of the host's own open orders in a shop where they hold credit, and what credit it could take now. */
export type HostCreditOwnOrder = {
  invoice_id: string; invoice_number: string | null; account_id: string; shop_name: string | null;
  tea_total: number; already: number; may_use: number; currency: string;
};

const TEA_TOTAL_SQL = (types: readonly string[]) => `COALESCE((SELECT SUM(li.quantity * li.price_at_sale) FROM invoice_line_items li
    JOIN products p ON p.id = li.product_id AND p.account_id = i.account_id
   WHERE li.invoice_id = i.id AND li.quantity > 0 AND li.price_at_sale > 0
     AND p.type IN (${types.map(() => '?').join(', ')})), 0)`;

async function ownOrdersForCredit(
  db: D1Database, userId: string, balances: Array<Omit<HostCreditBalance, 'host_user_id'>>,
): Promise<HostCreditOwnOrder[]> {
  const shops = balances.filter(balance => balance.currency === HOST_CREDIT_CURRENCY).map(balance => balance.account_id);
  if (!shops.length) return [];
  const types = TEA_TYPES as readonly string[];
  const { results } = await db.prepare(
    `SELECT i.id, i.invoice_number, i.account_id, a.name AS shop_name, ${TEA_TOTAL_SQL(types)} AS tea_total,
            COALESCE((SELECT SUM(o.amount) FROM host_credit_spend_requests o
               WHERE o.invoice_id = i.id AND o.account_id = i.account_id AND o.status IN ('held','approved')), 0) AS already
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id AND c.user_id = ?
       LEFT JOIN accounts a ON a.id = i.account_id
      WHERE i.account_id IN (${shops.map(() => '?').join(', ')})
        AND i.status IN ('Draft','Pending') AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC, i.id DESC LIMIT 50`,
  ).bind(...types, userId, ...shops).all<Record<string, any>>();
  const available = new Map(balances.map(balance => [balance.account_id, balance.available]));
  return results
    .map(row => {
      const teaTotal = roundUsd(Number(row.tea_total || 0));
      const already = roundUsd(Number(row.already || 0));
      const mayUse = roundUsd(Math.max(0, Math.min(available.get(row.account_id) ?? 0, teaTotal - already)));
      return {
        invoice_id: row.id, invoice_number: row.invoice_number ?? null, account_id: row.account_id,
        shop_name: row.shop_name ?? null, tea_total: teaTotal, already, may_use: mayUse, currency: HOST_CREDIT_CURRENCY,
      };
    })
    .filter(order => order.tea_total > 0);
}

/**
 * The host asks to use their credit on one of their own open orders. The
 * amount is worked out here, never taken from the request: as much of the
 * order's tea lines as their credit in that shop covers, less what is already
 * held or spent on that order. It is held until the owner decides in Manage.
 */
export async function useHostCreditOnOrder(
  env: CreditEnv, input: { hostUserId: string; invoiceId: string },
): Promise<{ id: string; amount: number; currency: string } | { error: 'closed' | 'not_found' | 'not_covered' }> {
  if (!hostCreditOpen(env)) return { error: 'closed' };
  const invoice = await env.DB.prepare(
    `SELECT i.id, i.account_id FROM invoices i
       JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id AND c.user_id = ?
      WHERE i.id = ? AND i.status IN ('Draft','Pending') AND i.deleted_at IS NULL`,
  ).bind(input.hostUserId, input.invoiceId).first<{ id: string; account_id: string }>();
  if (!invoice) return { error: 'not_found' };
  const balances = (await readBalances(env.DB, 'host_user_id = ? AND account_id = ?', [input.hostUserId, invoice.account_id]))
    .map(({ host_user_id: _host, ...rest }) => rest);
  const order = (await ownOrdersForCredit(env.DB, input.hostUserId, balances)).find(row => row.invoice_id === invoice.id);
  if (!order || !(order.may_use > 0)) return { error: 'not_covered' };
  const held = await holdHostCreditSpend(env, {
    accountId: invoice.account_id, hostUserId: input.hostUserId, invoiceId: invoice.id, amount: order.may_use,
  });
  if ('error' in held) return { error: held.error === 'closed' ? 'closed' : 'not_covered' };
  return { id: held.id, amount: order.may_use, currency: HOST_CREDIT_CURRENCY };
}

/** Everything in one shop, for its owner in Manage: hosts, every line, every spend request. */
export async function readShopHostCredit(db: D1Database, accountId: string) {
  const terms = await hostCreditTerms(db, accountId);
  const { results } = await db.prepare(
    `${LINE_SELECT}
      WHERE p.kind = 'pending' AND p.account_id = ?
      ORDER BY p.created_at DESC, p.id DESC LIMIT 1000`,
  ).bind(accountId).all<Record<string, any>>();
  const names = new Map<string, string | null>();
  const { results: users } = await db.prepare(
    `SELECT DISTINCT u.id, u.name FROM host_credit_entries e JOIN users u ON u.id = e.host_user_id WHERE e.account_id = ?`,
  ).bind(accountId).all<{ id: string; name: string | null }>();
  for (const user of users) names.set(user.id, user.name ?? null);
  const { results: requests } = await db.prepare(
    `SELECT r.id, r.host_user_id, r.invoice_id, i.invoice_number, r.amount, r.currency, r.status,
            r.requested_at, r.decided_by_user_id, r.decided_at, r.over_ceiling
       FROM host_credit_spend_requests r
       LEFT JOIN invoices i ON i.id = r.invoice_id AND i.account_id = r.account_id
      WHERE r.account_id = ?
      ORDER BY r.requested_at DESC LIMIT 500`,
  ).bind(accountId).all<Record<string, any>>();
  return {
    terms,
    hosts: (await readBalances(db, 'account_id = ?', [accountId]))
      .map(balance => ({ ...balance, host_name: names.get(balance.host_user_id) ?? null })),
    lines: results.map(row => ({
      ...lineView(row),
      host_user_id: row.host_user_id, host_name: names.get(row.host_user_id) ?? null,
      invoice_id: row.invoice_id, invoice_number: row.invoice_number ?? null, source_inquiry_id: row.source_inquiry_id,
      invoice_status: row.invoice_status ?? null,
    })),
    second_look: await readOrdersAwaitingApproval(db, accountId, terms, names),
    spend_requests: requests.map(row => ({
      ...row, amount: Number(row.amount), over_ceiling: Number(row.over_ceiling) === 1,
      host_name: names.get(row.host_user_id) ?? null,
    })),
  };
}

/**
 * Orders Filled by hand whose credit is still pending because it is over the
 * shop's ceiling: they wait for the owner's second look. Payment is checked
 * again when the owner approves (POST /api/host-credit/invoices/:id/approve).
 */
async function readOrdersAwaitingApproval(
  db: D1Database, accountId: string, terms: HostCreditTerms | null, names: Map<string, string | null>,
) {
  if (!terms || terms.ceilingUsd === null) return [];
  const { results } = await db.prepare(
    `SELECT p.invoice_id, i.invoice_number, p.host_user_id, ev.title AS event_title, SUM(p.amount) AS credit_amount
       FROM host_credit_entries p
       JOIN invoices i ON i.id = p.invoice_id AND i.account_id = p.account_id
       LEFT JOIN events ev ON ev.id = p.event_id AND ev.account_id = p.account_id
      WHERE p.account_id = ? AND p.kind = 'pending' AND p.currency = ?
        AND i.status = 'Filled' AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM host_credit_entries e WHERE e.kind = 'earned' AND e.invoice_id = p.invoice_id)
      GROUP BY p.invoice_id, i.invoice_number, p.host_user_id, ev.title
      HAVING SUM(p.amount) > ? + 0.004
      ORDER BY p.invoice_id LIMIT 200`,
  ).bind(accountId, HOST_CREDIT_CURRENCY, terms.ceilingUsd).all<Record<string, any>>();
  return results.map(row => ({
    invoice_id: String(row.invoice_id), invoice_number: row.invoice_number ?? null,
    host_user_id: String(row.host_user_id), host_name: names.get(String(row.host_user_id)) ?? null,
    event_title: row.event_title ?? null, credit_amount: roundUsd(Number(row.credit_amount)),
    currency: HOST_CREDIT_CURRENCY, ceiling_usd: terms.ceilingUsd,
  }));
}

// ── Spending: a held request, approved by hand ───────────────────────────────

/**
 * Hold credit against an order to the shop. Reached only through
 * useHostCreditOnOrder, which works out `amount` on the server from the
 * order, never from the browser. The hold is one guarded statement: it is
 * written only while the host's available credit covers it, only on an order
 * of the host's own (its customer is linked to them), and only up to the tea
 * lines of that order less what other requests already hold or spent on it.
 */
export async function holdHostCreditSpend(
  env: CreditEnv,
  input: { accountId: string; hostUserId: string; invoiceId: string; amount: number },
): Promise<{ id: string } | { error: string }> {
  if (!hostCreditOpen(env)) return { error: 'closed' };
  const amount = roundUsd(Number(input.amount));
  if (!(amount > 0)) return { error: 'invalid_amount' };
  const id = `hcs_${crypto.randomUUID().replace(/-/g, '')}`;
  const types = TEA_TYPES as readonly string[];
  const result = await env.DB.prepare(
    `INSERT INTO host_credit_spend_requests (id, account_id, host_user_id, invoice_id, amount, currency, status)
     SELECT ?4, ?1, ?2, ?5, ?6, ?3, 'held'
      WHERE EXISTS (SELECT 1 FROM invoices i
              JOIN customers c ON c.id = i.customer_id AND c.account_id = i.account_id AND c.user_id = ?2
             WHERE i.id = ?5 AND i.account_id = ?1 AND i.status IN ('Draft','Pending') AND i.deleted_at IS NULL)
        AND ?6 + COALESCE((SELECT SUM(o.amount) FROM host_credit_spend_requests o
              WHERE o.invoice_id = ?5 AND o.account_id = ?1 AND o.status IN ('held','approved')), 0)
            <= COALESCE((SELECT SUM(li.quantity * li.price_at_sale) FROM invoice_line_items li
              JOIN products p ON p.id = li.product_id AND p.account_id = ?1
             WHERE li.invoice_id = ?5 AND li.quantity > 0 AND li.price_at_sale > 0
               AND p.type IN (${types.map(() => '?').join(', ')})), 0) + 0.004
        AND ${NET_AFTER_HOLDS_SQL} >= ?6 - 0.004`,
  ).bind(input.accountId, input.hostUserId, HOST_CREDIT_CURRENCY, id, input.invoiceId, amount, ...types).run();
  if (!Number(result.meta?.changes || 0)) return { error: 'not_covered' };
  const sameDay = await env.DB.prepare(
    `SELECT 1 FROM host_credit_entries WHERE account_id = ? AND host_user_id = ? AND kind = 'earned'
       AND date(created_at) = date('now') LIMIT 1`,
  ).bind(input.accountId, input.hostUserId).first();
  if (sameDay) {
    await fileOddity(env.DB, 'earned_and_requested_same_day',
      `A host asked to use credit on the day it was earned (request ${id}).`, input.accountId);
  }
  return { id };
}

export type SpendDecision =
  | { ok: true; status: 'approved' | 'declined'; idempotent?: boolean }
  | { ok: false; error: 'not_found' | 'already_decided' | 'over_ceiling' | 'not_covered' | 'order_unavailable'; message: string };

/**
 * The owner's approval of one held request. The 'spent' row is written by one
 * guarded statement that fails when the host's credit (earned, less reversed,
 * less spent, less every other open hold) is less than the amount, and that
 * can be written once per request. Above the shop's ceiling the owner must
 * say so: `confirmOverCeiling`.
 */
export async function approveHostCreditSpend(
  env: CreditEnv,
  input: { accountId: string; requestId: string; approverUserId: string; confirmOverCeiling: boolean },
): Promise<SpendDecision> {
  const request = await env.DB.prepare(
    'SELECT * FROM host_credit_spend_requests WHERE id = ? AND account_id = ?',
  ).bind(input.requestId, input.accountId).first<Record<string, any>>();
  if (!request) return { ok: false, error: 'not_found', message: 'No such request in this shop.' };
  if (request.status === 'approved') return { ok: true, status: 'approved', idempotent: true };
  if (request.status !== 'held') return { ok: false, error: 'already_decided', message: 'This request was already declined.' };
  const terms = await hostCreditTerms(env.DB, input.accountId);
  const amount = Number(request.amount);
  const overCeiling = !terms || (terms.ceilingUsd !== null && amount > terms.ceilingUsd + 0.004);
  if (overCeiling && !input.confirmOverCeiling) {
    return {
      ok: false, error: 'over_ceiling',
      message: `This uses ${amount.toFixed(2)} ${request.currency} of credit on one order, more than the shop's ceiling of ${(terms?.ceilingUsd ?? 0).toFixed(2)} ${HOST_CREDIT_CURRENCY}. Approve again to confirm it.`,
    };
  }
  const order = await env.DB.prepare(
    `SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND status != 'Void' AND deleted_at IS NULL`,
  ).bind(request.invoice_id, input.accountId).first();
  if (!order) return { ok: false, error: 'order_unavailable', message: 'The order this credit was for is no longer open.' };

  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO host_credit_entries (id, account_id, host_user_id, kind, amount, currency, invoice_id, spend_request_id, reason, created_by)
       SELECT ?4, r.account_id, r.host_user_id, 'spent', r.amount, r.currency, r.invoice_id, r.id, ?5, ?6
         FROM host_credit_spend_requests r
        WHERE r.id = ?7 AND r.account_id = ?1 AND r.host_user_id = ?2 AND r.currency = ?3 AND r.status = 'held'
          -- The request's own hold is included in the net.
          AND ${NET_AFTER_HOLDS_SQL} >= -0.004
       ON CONFLICT DO NOTHING`,
    ).bind(request.account_id, request.host_user_id, request.currency, `hcx_${crypto.randomUUID().replace(/-/g, '')}`,
      overCeiling ? 'approved over the ceiling' : 'approved', input.approverUserId, request.id),
    env.DB.prepare(
      `UPDATE host_credit_spend_requests SET status = 'approved', decided_by_user_id = ?, decided_at = datetime('now'), over_ceiling = ?
        WHERE id = ? AND status = 'held'
          AND EXISTS (SELECT 1 FROM host_credit_entries WHERE kind = 'spent' AND spend_request_id = ?)`,
    ).bind(input.approverUserId, overCeiling ? 1 : 0, request.id, request.id),
  ]);
  if (!Number(results[1]?.meta?.changes || 0)) {
    const now = await env.DB.prepare('SELECT status FROM host_credit_spend_requests WHERE id = ?').bind(request.id).first<{ status: string }>();
    if (now?.status === 'approved') return { ok: true, status: 'approved', idempotent: true };
    return { ok: false, error: 'not_covered', message: 'The host\'s credit no longer covers this request.' };
  }
  await checkHostCreditIntegrity(env.DB, input.accountId);
  return { ok: true, status: 'approved' };
}

/** The owner declines a held request: the hold ends and nothing is spent. */
export async function declineHostCreditSpend(
  env: CreditEnv,
  input: { accountId: string; requestId: string; approverUserId: string },
): Promise<SpendDecision> {
  const result = await env.DB.prepare(
    `UPDATE host_credit_spend_requests SET status = 'declined', decided_by_user_id = ?, decided_at = datetime('now')
      WHERE id = ? AND account_id = ? AND status = 'held'`,
  ).bind(input.approverUserId, input.requestId, input.accountId).run();
  if (Number(result.meta?.changes || 0)) return { ok: true, status: 'declined' };
  const row = await env.DB.prepare('SELECT status FROM host_credit_spend_requests WHERE id = ? AND account_id = ?')
    .bind(input.requestId, input.accountId).first<{ status: string }>();
  if (!row) return { ok: false, error: 'not_found', message: 'No such request in this shop.' };
  if (row.status === 'declined') return { ok: true, status: 'declined', idempotent: true };
  return { ok: false, error: 'already_decided', message: 'This request was already approved.' };
}
