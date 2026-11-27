/**
 * Split one invoice line into packs, for agents (Adrian, 2026-11-27: "there
 * were two one hundred gram batches, not two hundred grams").
 *
 * A line of 200g sold as two 100g packs becomes two lines of 100g at the same
 * price per gram, so the invoice, its pay page and the parcel all say what
 * was handed over. The total does not move and neither does stock: a Pending
 * invoice's hold is per tea, and the grams per tea are unchanged.
 *
 * Only an unpaid Draft or Pending invoice whose stock has not been taken, the
 * same invoices the app's own line editor accepts. The lines keep their order:
 * every line is written again in place and the old rows are removed in one
 * batch, guarded on the invoice still being where the preview saw it.
 */
import { agentName, str } from './curateIntake';
import type { ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Row = Record<string, any>;
type SplitTicket = {
  kind: 'invoice:split_line';
  accountId: string;
  userId: string;
  invoiceId: string;
  lineId: string;
  amounts: number[];
  agent: string;
};

const COPY_COLUMNS = ['account_id', 'invoice_id', 'product_id', 'custom_name', 'price_at_sale', 'stock_owner_user_id',
  'sales_grant_id', 'owner_share_type', 'owner_share_value', 'quantity_unit'] as const;

/** The amounts asked for: whole positive numbers that add up to the line. */
export function splitAmounts(quantity: number, raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 20) return null;
  const amounts = raw.map(Number);
  if (amounts.some(a => !Number.isInteger(a) || a <= 0)) return null;
  return amounts.reduce((sum, a) => sum + a, 0) === quantity ? amounts : null;
}

async function findInvoice(env: Parameters<ToolHandler>[0], accountId: string, args: any): Promise<Row | null> {
  const id = str(args?.invoice_id, 100);
  const number = str(args?.invoice_number, 100);
  if (!id && !number) return null;
  return env.DB.prepare(
    `SELECT id, invoice_number, status, payment_status, inventory_deducted, fulfillment_claim_token FROM invoices
      WHERE account_id = ? AND ${id ? 'id = ?' : 'invoice_number = ?'}`,
  ).bind(accountId, id ?? number).first<Row>();
}

async function linesOf(env: Parameters<ToolHandler>[0], accountId: string, invoiceId: string): Promise<Row[]> {
  const rows = await env.DB.prepare(
    `SELECT li.rowid AS position, li.*, COALESCE(p.given_name, p.product_name, li.custom_name) AS name
       FROM invoice_line_items li LEFT JOIN products p ON p.id = li.product_id
      WHERE li.invoice_id = ? AND (li.account_id = ? OR li.account_id IS NULL)
      ORDER BY li.rowid`,
  ).bind(invoiceId, accountId).all<Row>();
  return rows.results ?? [];
}

const splitInvoiceLine: ToolHandler = async (env, auth, args) => {
  const invoice = await findInvoice(env, auth.accountId, args);
  if (!invoice) return { error: 'invoice_not_found', note: 'Give invoice_id or invoice_number.' };
  if (!['Draft', 'Pending'].includes(String(invoice.status)) || Number(invoice.inventory_deducted) || invoice.payment_status === 'paid') {
    return { error: 'invoice_not_editable', note: 'Only an unpaid Draft or Pending invoice whose stock has not been taken.' };
  }
  const paid = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_usd), 0) AS paid FROM invoice_payments WHERE invoice_id = ? AND account_id = ? AND status = 'confirmed'`,
  ).bind(invoice.id, auth.accountId).first<Row>();
  if (Number(paid?.paid) > 0) return { error: 'invoice_not_editable', note: 'Money has been received on this invoice.' };

  const lines = await linesOf(env, auth.accountId, invoice.id);
  const productId = str(args?.product_id, 100);
  const lineId = str(args?.line_id, 100);
  const matches = lines.filter(line => lineId ? line.id === lineId : line.product_id === productId);
  if (!matches.length) {
    return { error: 'line_not_found', lines: lines.map(l => ({ line_id: l.id, product_id: l.product_id, name: l.name, quantity: Number(l.quantity) })) };
  }
  const line = matches[0];
  const amounts = splitAmounts(Number(line.quantity), args?.amounts);
  if (!amounts) return { error: 'amounts_must_add_up', note: `Give two or more whole amounts that add up to ${Number(line.quantity)}.`, quantity: Number(line.quantity) };

  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: SplitTicket = {
      kind: 'invoice:split_line', accountId: auth.accountId, userId: auth.userId,
      invoiceId: String(invoice.id), lineId: String(line.id), amounts, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'split_invoice_line',
      invoice: { id: invoice.id, invoice_number: invoice.invoice_number, status: invoice.status },
      line: { name: line.name, quantity: Number(line.quantity), price_per_unit_usd: Number(line.price_at_sale) },
      becomes: amounts.map(quantity => ({ quantity, line_total_usd: Math.round(quantity * Number(line.price_at_sale) * 100) / 100 })),
      note: 'The total and stock do not change.',
    }, token);
  }

  const ticket = await consumeTicket<SplitTicket, 'invoice:split_line'>(env, confirm, 'invoice:split_line', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.invoiceId !== invoice.id || ticket.lineId !== line.id
    || ticket.amounts.join(',') !== amounts.join(',')) return INVALID_TICKET;

  // Every line is written again in its place, then the old rows go, so the
  // split packs sit where the line was. All of it only while the invoice is
  // still unpaid, unfulfilled and not being edited elsewhere.
  const guard = `EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND status = ?
    AND inventory_deducted = 0 AND fulfillment_claim_token IS ?)`;
  const guardValues = [invoice.id, auth.accountId, invoice.status, invoice.fulfillment_claim_token ?? null];
  const columns = COPY_COLUMNS.join(', ');
  const statements: D1PreparedStatement[] = [];
  for (const existing of lines) {
    const quantities = existing.id === line.id ? amounts : [Number(existing.quantity)];
    for (const quantity of quantities) {
      statements.push(env.DB.prepare(
        `INSERT INTO invoice_line_items (id, quantity, ${columns})
         SELECT ?, ?, ${columns} FROM invoice_line_items WHERE id = ? AND ${guard}`,
      ).bind(crypto.randomUUID(), quantity, existing.id, ...guardValues));
    }
  }
  const oldIds = lines.map(l => l.id);
  statements.push(env.DB.prepare(
    `DELETE FROM invoice_line_items WHERE id IN (${oldIds.map(() => '?').join(', ')}) AND ${guard}`,
  ).bind(...oldIds, ...guardValues));
  const results = await env.DB.batch(statements);
  const removed = Number(results[results.length - 1]?.meta?.changes ?? 0);
  if (removed !== oldIds.length) {
    return { error: 'invoice_changed_since_preview', note: 'Preview again before confirming.' };
  }
  return {
    committed: true,
    invoice_number: invoice.invoice_number,
    line: line.name,
    now: amounts.map(quantity => ({ quantity })),
  };
};

export const invoiceLineTools: ToolModule = {
  area: 'invoice-lines',
  defs: [
    {
      name: 'split_invoice_line', scope: 'sales:write',
      description: 'Split one line of an unpaid Draft or Pending invoice into packs, e.g. 200g into two 100g lines, at the same price per gram. The total and stock do not change and the lines keep their order. Name the line by product_id (the first line of that tea) or line_id. Two steps: read the preview, confirm only after the owner agrees.',
      inputSchema: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
          invoice_number: { type: 'string', description: 'Used if invoice_id is omitted.' },
          product_id: { type: 'string' },
          line_id: { type: 'string' },
          amounts: { type: 'array', items: { type: 'integer' }, description: 'Whole amounts that add up to the line, e.g. [100, 100].' },
          agent: { type: 'string' },
          confirm: { type: 'string' },
        },
        required: ['amounts'], additionalProperties: false,
      },
    },
  ],
  handlers: { split_invoice_line: splitInvoiceLine },
};
