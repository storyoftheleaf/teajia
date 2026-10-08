import { QUOTE_SCHEMA } from './curateSchemas';
import { getCurateQuote, listCurateQuotes, prepareCurateQuoteWrite } from '../curateQuotes';
import { agentName, str } from './curateIntake';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope } from './tickets';
import type { ToolHandler, ToolModule } from './registry';
type Ticket = { kind: 'curate:save_quote'; accountId: string; userId: string; quoteId: string; input: Record<string, unknown>; agent: string; expected: string | null };
const save: ToolHandler = async (env, auth, args) => {
  const allowed = new Set(['quote_id','quote','agent','confirm']);
  const unknown = Object.keys(args ?? {}).find(key => !allowed.has(key));
  if (unknown) throw new Error(`${unknown} has no structured quote field`);
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const ticket = await consumeTicket<Ticket, 'curate:save_quote'>(env, confirm, 'curate:save_quote', auth);
    if (!ticket || ticket.userId !== auth.userId) return INVALID_TICKET;
    const current = await getCurateQuote(env.DB, auth, ticket.quoteId);
    if ((current ? JSON.stringify(current) : null) !== ticket.expected) return { error: 'quote_changed_since_preview', message: 'Preview the current quote before confirming.' };
    const write = await prepareCurateQuoteWrite(env.DB, { ...auth, agent: ticket.agent }, ticket.input, ticket.quoteId);
    if (write.statements.length) await env.DB.batch(write.statements);
    return { committed: true, quote: await getCurateQuote(env.DB, auth, write.id) };
  }
  if (!args?.quote || typeof args.quote !== 'object' || Array.isArray(args.quote)) throw new Error('quote must contain a structured header and optional lines');
  const id = str(args.quote_id, 100) ?? undefined;
  if (id && !await getCurateQuote(env.DB, auth, id)) throw new Error('Quote not found in this account');
  const write = await prepareCurateQuoteWrite(env.DB, { ...auth, agent: agentName(args) }, args.quote, id);
  const ticket: Ticket = { kind: 'curate:save_quote', accountId: auth.accountId, userId: auth.userId, quoteId: write.id, input: args.quote, agent: agentName(args), expected: id ? JSON.stringify(await getCurateQuote(env.DB, auth, id)) : null };
  return previewEnvelope({ action: 'curate_save_quote', quote_id: write.id, will_file: args.quote, note: 'Private quoted evidence only; no discount, landed price or freight is applied to stock pricing.' }, await issueTicket(env, ticket, auth.tokenId));
};
const get: ToolHandler = async (env, auth, args) => {
  const id = str(args?.quote_id, 100); if (!id) throw new Error('quote_id is required');
  const quote = await getCurateQuote(env.DB, auth, id); return quote ? { quote } : { error: 'not_found' };
};
const list: ToolHandler = async (env, auth, args) => ({ quotes: await listCurateQuotes(env.DB, auth, str(args?.vendor_id,100) ?? undefined) });
export const curateQuoteTools: ToolModule = {
  area: 'curate-quotes',
  defs: [
    { name: 'curate_save_quote', scope: 'stock:write', description: 'Save or correct one private supplier quote document linked to its vendor and tea lines. Header contains reference, issued_to, quote_date, validity_days, valid_until, minimum_order_amount/currency and payment_terms. Lines carry explicit quoted prices and route alternatives. Preview then confirm; never changes stock pricing.', inputSchema: { type: 'object', properties: { quote_id: {type:'string'}, quote: QUOTE_SCHEMA, agent: {type:'string'}, confirm: {type:'string'} }, additionalProperties: false } },
    { name: 'curate_get_quote', scope: 'inventory:read', description: 'Read a private supplier quote header and linked quoted tea snapshots.', inputSchema: { type:'object',properties:{quote_id:{type:'string'},agent:{type:'string'}},required:['quote_id'],additionalProperties:false } },
    { name: 'curate_list_quotes', scope: 'inventory:read', description: 'List active supplier quote documents within this account, optionally for one vendor.', inputSchema: { type:'object',properties:{vendor_id:{type:'string'},agent:{type:'string'}},additionalProperties:false } },
  ], handlers: { curate_save_quote: save, curate_get_quote: get, curate_list_quotes: list },
};
