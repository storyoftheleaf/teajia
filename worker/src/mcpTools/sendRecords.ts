/**
 * Every invoice and collection link the shop has sent, and what happened to
 * each, for agents (Adrian, 2026-11-28: "Make sure all these invoices and
 * sample sending things are getting saved, monitored and recorded"). Reads
 * only: the record is kept by worker/src/sendRecords.ts.
 */
import { str } from './curateIntake';
import type { ToolHandler, ToolModule } from './registry';
import { collectionSendRecord, invoiceSendRecord, listSends } from '../sendRecords';

const listSendsTool: ToolHandler = async (env, auth, args) => {
  const kind = args?.kind === 'invoice' || args?.kind === 'collection' ? args.kind : undefined;
  const limit = typeof args?.limit === 'number' ? args.limit : 30;
  const sends = await listSends(env, auth.accountId, { kind, limit, customer: str(args?.customer, 200) });
  return {
    sends,
    note: 'opened_times, first/last_opened_at and teas_opened count only the person it was sent to, from 2026-11-28. counted_before is the older counter, which included your own looks. get_send gives the teas, saves, tastings, orders and payments.',
  };
};

const getSendTool: ToolHandler = async (env, auth, args) => {
  const invoiceId = str(args?.invoice_id, 100);
  const invoiceNumber = str(args?.invoice_number, 100);
  const publicationId = str(args?.publication_id, 100);
  const slug = str(args?.slug, 200);
  if (invoiceId || invoiceNumber) {
    const row = await env.DB.prepare(
      `SELECT id FROM invoices WHERE account_id = ? AND ${invoiceId ? 'id = ?' : 'invoice_number = ?'}`,
    ).bind(auth.accountId, invoiceId ?? invoiceNumber).first<{ id: string }>();
    if (!row) return { error: 'invoice_not_found' };
    const payUrl = env.invoicePayLinks ? await env.invoicePayLinks.payUrl(auth.accountId, row.id).catch(() => null) : null;
    return await invoiceSendRecord(env, auth.accountId, row.id, { payUrl }) ?? { error: 'invoice_not_found' };
  }
  if (publicationId || slug) {
    const row = await env.DB.prepare(
      `SELECT cp.id FROM collection_publications cp JOIN collections c ON c.id = cp.collection_id
        WHERE c.account_id = ? AND ${publicationId ? 'cp.id = ?' : 'cp.slug = ?'}`,
    ).bind(auth.accountId, publicationId ?? slug).first<{ id: string }>();
    if (!row) return { error: 'link_not_found' };
    return await collectionSendRecord(env, auth.accountId, row.id) ?? { error: 'link_not_found' };
  }
  return { error: 'send_not_named', note: 'Give invoice_id, invoice_number, publication_id or slug.' };
};

export const sendRecordTools: ToolModule = {
  area: 'send-records',
  defs: [
    {
      name: 'list_sends', scope: 'sales:read',
      description: 'Every invoice and collection (sample) link the shop has sent, newest first: who it went to, when, the total, payment, and whether and when the person opened it and how many of its teas they looked at. Use get_send for one in full.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['invoice', 'collection'], description: 'Only invoices or only collection links. Leave out for both.' },
          customer: { type: 'string', description: 'Part of the name it was sent to, or of the collection title.' },
          limit: { type: 'number', description: 'Up to 200, default 30.' },
        },
      },
    },
    {
      name: 'get_send', scope: 'sales:read',
      description: 'One sent invoice or collection link in full: who and when, each tea with its amount and price, the discount, when it was opened and by whom, which teas were opened, saved, tasted and ordered, orders made from it, and payments claimed and confirmed.',
      inputSchema: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
          invoice_number: { type: 'string', description: 'e.g. TJB-00007, used if invoice_id is omitted.' },
          publication_id: { type: 'string', description: 'A collection link, from list_sends.' },
          slug: { type: 'string', description: 'The part after /c/ in a collection link.' },
        },
      },
    },
  ],
  handlers: { list_sends: listSendsTool, get_send: getSendTool },
};
