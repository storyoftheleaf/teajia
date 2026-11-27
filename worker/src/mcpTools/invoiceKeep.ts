/**
 * Give a saved invoice back, for agents (Adrian, 2026-11-27: "I clicked save,
 * but it was on my own account... anyone with the link can save it and then
 * they can't save it").
 *
 * An invoice saved through its pay link by the wrong person goes back to how
 * it was before the save, so the person it is for can press Save themselves.
 * Only a save made through the link is undone, and only while the same person
 * still holds it.
 */
import { agentName, str } from './curateIntake';
import type { ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';
import { findInvoiceKeep, releaseInvoiceKeep } from '../payInvoiceKeep';

type ReleaseTicket = {
  kind: 'invoice:release_keep';
  accountId: string;
  userId: string;
  invoiceId: string;
  keptBy: string;
  agent: string;
};

const releaseInvoiceKeepTool: ToolHandler = async (env, auth, args) => {
  const id = str(args?.invoice_id, 100);
  const number = str(args?.invoice_number, 100);
  if (!id && !number) return { error: 'invoice_not_found', note: 'Give invoice_id or invoice_number.' };
  const invoice = await env.DB.prepare(
    `SELECT id, invoice_number, customer_name FROM invoices WHERE account_id = ? AND ${id ? 'id = ?' : 'invoice_number = ?'}`,
  ).bind(auth.accountId, id ?? number).first<{ id: string; invoice_number: string | null; customer_name: string | null }>();
  if (!invoice) return { error: 'invoice_not_found' };
  const keep = await findInvoiceKeep(env, auth.accountId, invoice.id);
  if (!keep) return { error: 'not_saved_through_link', note: 'Nobody has saved this invoice from its pay link.' };

  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: ReleaseTicket = {
      kind: 'invoice:release_keep', accountId: auth.accountId, userId: auth.userId,
      invoiceId: invoice.id, keptBy: keep.keptBy.userId, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'release_invoice_keep',
      invoice: { id: invoice.id, invoice_number: invoice.invoice_number, made_out_to: invoice.customer_name },
      saved_by: { name: keep.keptBy.name, email: keep.keptBy.email },
      note: keep.linked === 'customer'
        ? 'The customer on this invoice stops being linked to this account, so its orders leave that account.'
        : 'The invoice goes back to naming no customer, so the person it is for can save it from the link.',
    }, token);
  }

  const ticket = await consumeTicket<ReleaseTicket, 'invoice:release_keep'>(env, confirm, 'invoice:release_keep', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.invoiceId !== invoice.id || ticket.keptBy !== keep.keptBy.userId) {
    return INVALID_TICKET;
  }
  if (!await releaseInvoiceKeep(env, auth.accountId, keep)) {
    return { error: 'invoice_changed_since_preview', note: 'Preview again before confirming.' };
  }
  await env.DB.prepare(
    `INSERT INTO platform_audit_log (action, actor_id, target_type, target_id, details, account_id, actor_account_id)
     VALUES ('pay_invoice.released', ?, 'invoice', ?, ?, ?, ?)`,
  ).bind(auth.userId, invoice.id, JSON.stringify({ released_user_id: keep.keptBy.userId, linked: keep.linked, agent: ticket.agent }),
    auth.accountId, auth.accountId).run();
  return { committed: true, invoice_number: invoice.invoice_number, released_from: keep.keptBy.name ?? keep.keptBy.email };
};

export const invoiceKeepTools: ToolModule = {
  area: 'invoice-keep',
  defs: [
    {
      name: 'release_invoice_keep', scope: 'sales:write',
      description: 'Give back an invoice that someone saved to their account from its pay link, e.g. the wrong person pressed Save. The invoice returns to how it was before, so the person it is for can save it. Two steps: read the preview, confirm only after the owner agrees.',
      inputSchema: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
          invoice_number: { type: 'string', description: 'Used if invoice_id is omitted.' },
          agent: { type: 'string' },
          confirm: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  ],
  handlers: { release_invoice_keep: releaseInvoiceKeepTool },
};
