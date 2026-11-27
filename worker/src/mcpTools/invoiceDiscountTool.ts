/**
 * Offer a discount on an invoice, for agents (Adrian, 2026-11-27: "I also
 * want to give her a 10% discount"). The same rule as the discount box on the
 * shop's own view of the pay sheet: see invoiceDiscount.ts.
 */
import { agentName, str } from './curateIntake';
import type { ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';
import { discountAmount, discountPercent, readInvoiceDiscount, writeInvoiceDiscount } from '../invoiceDiscount';

type DiscountTicket = {
  kind: 'invoice:discount';
  accountId: string;
  userId: string;
  invoiceId: string;
  percent: number;
  agent: string;
};

const setInvoiceDiscount: ToolHandler = async (env, auth, args) => {
  const id = str(args?.invoice_id, 100);
  const number = str(args?.invoice_number, 100);
  if (!id && !number) return { error: 'invoice_not_found', note: 'Give invoice_id or invoice_number.' };
  const invoice = await env.DB.prepare(
    `SELECT id, invoice_number, status FROM invoices WHERE account_id = ? AND deleted_at IS NULL AND ${id ? 'id = ?' : 'invoice_number = ?'}`,
  ).bind(auth.accountId, id ?? number).first<{ id: string; invoice_number: string | null; status: string }>();
  if (!invoice) return { error: 'invoice_not_found' };
  const percent = discountPercent(args?.percent);
  if (percent === null) return { error: 'percent_invalid', note: 'Give a percent from 0 to 99.9; 0 takes the discount off.' };
  const state = await readInvoiceDiscount(env, auth.accountId, invoice.id);
  if (!state?.editable) return { error: 'invoice_not_editable', note: 'Only an unpaid Draft or Pending invoice whose stock has not been taken and on which no money has been received.' };

  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const amount = percent > 0 ? discountAmount(state.subtotal_usd, percent) : 0;
    const ticket: DiscountTicket = {
      kind: 'invoice:discount', accountId: auth.accountId, userId: auth.userId,
      invoiceId: invoice.id, percent, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'set_invoice_discount',
      invoice: { id: invoice.id, invoice_number: invoice.invoice_number, status: invoice.status },
      teas_usd: state.subtotal_usd,
      discount_now: state.percent ? { percent: state.percent, usd: state.discount_usd } : null,
      discount_after: percent > 0 ? { percent, usd: amount } : null,
      total_after_usd: Math.round((state.subtotal_usd - amount) * 100) / 100,
      note: 'The pay link shows the new total. Stock does not change.',
    }, token);
  }
  const ticket = await consumeTicket<DiscountTicket, 'invoice:discount'>(env, confirm, 'invoice:discount', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.invoiceId !== invoice.id || ticket.percent !== percent) return INVALID_TICKET;
  const written = await writeInvoiceDiscount(env, auth.accountId, invoice.id, percent, invoice.status);
  if (!written.ok) return { error: written.error, note: 'Preview again before confirming.' };
  return { committed: true, invoice_number: invoice.invoice_number, discount_usd: written.discount_usd, total_usd: written.total_usd };
};

export const invoiceDiscountTools: ToolModule = {
  area: 'invoice-discount',
  defs: [
    {
      name: 'set_invoice_discount', scope: 'sales:write',
      description: 'Offer a percent off an unpaid Draft or Pending invoice, e.g. 10. It shows as one "Discount 10%" line and the pay link shows the new total; 0 takes it off. Stock does not change. Two steps: read the preview, confirm only after the owner agrees.',
      inputSchema: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
          invoice_number: { type: 'string', description: 'Used if invoice_id is omitted.' },
          percent: { type: 'number', description: 'Percent off, 0 to 99.9. 0 takes the discount off.' },
          agent: { type: 'string' },
          confirm: { type: 'string' },
        },
        required: ['percent'], additionalProperties: false,
      },
    },
  ],
  handlers: { set_invoice_discount: setInvoiceDiscount },
};
