/**
 * What agents changed, and the way back.
 *
 * Curate has its own history and undo (curate_history, curate_undo). Stock,
 * prices and a tea's own words had neither: every confirmed agent write left an
 * `MCP_TOOL_CALL` line in `activity_logs` naming only the tool. mcp.ts now
 * reads the tea a confirm is about from its ticket before it runs, and writes
 * the columns that changed (before and after) onto that same line. From that:
 *
 * - `list_agent_changes` reads the lines back, newest first.
 * - `undo_agent_change` puts a tea back. Stock goes back through the one stock
 *   path as a recount to the old balance, pinned to the balance the agent left,
 *   so a sale since then refuses rather than being undone with it. Prices,
 *   words, the threshold and the archive answer with the call that puts the old
 *   values back through the tool that changed them, which then previews and
 *   confirms as it always does. An invoice is undone with void_invoice.
 */
import { decodeStockMovement } from '../inventoryDomain';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

/** Tools whose confirmed change is kept with the tea's before and after. */
export const UNDO_TRACKED_TOOLS: ReadonlySet<string> = new Set([
  'add_stock', 'remove_stock', 'count_stock',
  'update_tea_pricing', 'set_low_stock_threshold', 'set_archive_status', 'update_tea_catalog',
]);

/** The tea's columns kept on the audit line when one of those tools changes them. */
export const UNDO_COLUMNS = [
  'stock_grams', 'quantity_units',
  'cost_amount', 'cost_currency', 'fixed_retail_price_usd', 'quantity_purchased', 'shipping_rate_per_kg',
  'status', 'low_stock_threshold',
  'description', 'lore', 'terroir', 'processing_notes', 'origin_country', 'origin_region', 'year',
  'product_name', 'given_name', 'chinese_name', 'type', 'form', 'cultivar', 'altitude',
] as const;

const STOCK = new Set(['stock_grams', 'quantity_units']);
/** update_tea_pricing argument for each column it can set. */
const PRICING_ARG: Record<string, string> = {
  cost_amount: 'cost_amount', cost_currency: 'cost_currency', fixed_retail_price_usd: 'retail_price_usd',
  quantity_purchased: 'quantity_purchased', shipping_rate_per_kg: 'shipping_rate_per_kg', status: 'status', year: 'year',
  description: 'description', lore: 'lore', terroir: 'terroir', processing_notes: 'processing_notes',
  origin_country: 'origin_country', origin_region: 'origin_region',
};
/** What update_tea_pricing can blank (its clear_fields). */
const PRICING_CLEARABLE = new Set(['lore', 'terroir', 'processing_notes', 'shipping_rate_per_kg']);
const CATALOG = new Set(['product_name', 'given_name', 'chinese_name', 'type', 'form', 'cultivar', 'altitude', 'origin_country', 'origin_region', 'year']);

interface Change {
  change_id: string;
  tool: string;
  at: string;
  by: string | null;
  failed: boolean;
  product_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface UndoStockTicket extends TicketPayload {
  kind: 'undo_agent_change';
  changeId: string;
  productId: string;
  unit: 'g' | 'unit';
  from: number;
  to: number;
}

function readChange(row: Record<string, any>): Change {
  let d: Record<string, any> = {};
  try { d = JSON.parse(String(row.details || '{}')); } catch { d = {}; }
  return {
    change_id: String(row.id), tool: String(d.tool || ''), at: String(row.created_at || ''), by: row.user_email ?? null,
    failed: Boolean(d.failed), product_id: d.product_id ?? null, before: d.before ?? null, after: d.after ?? null,
  };
}

async function listAgentChanges(env: ToolEnv, auth: ToolAuth, args: any) {
  const limit = Math.min(Math.max(Number(args?.limit) || 25, 1), 100);
  const since = typeof args?.since === 'string' && args.since.trim() ? args.since.trim() : null;
  const productId = typeof args?.product_id === 'string' && args.product_id.trim() ? args.product_id.trim() : null;
  const where = ["account_id = ?", "action = 'MCP_TOOL_CALL'"];
  const binds: unknown[] = [auth.accountId];
  if (since) { where.push('created_at >= ?'); binds.push(since.replace('T', ' ').replace(/Z$/, '')); }
  if (productId) { where.push("json_extract(details, '$.product_id') = ?"); binds.push(productId); }
  const { results } = await env.DB.prepare(
    `SELECT id, details, user_email, created_at FROM activity_logs WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
  ).bind(...binds, limit).all<Record<string, any>>();
  const changes = (results ?? []).map(readChange).map(c => ({ ...c, undoable: Boolean(c.after && c.product_id) }));
  return {
    changes,
    count: changes.length,
    note: 'Every confirmed agent write in this shop. before and after are kept for stock, prices, a tea\'s words, its threshold and archive; undo_agent_change puts those back. A sale or invoice is undone with void_invoice; Curate changes with curate_undo.',
  };
}

async function undoAgentChange(env: ToolEnv, auth: ToolAuth, args: any) {
  const confirm = typeof args?.confirm === 'string' ? args.confirm.trim() : '';
  if (confirm) {
    const t = await consumeTicket<UndoStockTicket, 'undo_agent_change'>(env, confirm, 'undo_agent_change', auth);
    if (!t) return INVALID_TICKET;
    if (!env.stockMovements) return { error: 'stock_unavailable', message: 'The shop could not reach its stock ledger. Nothing was changed.' };
    const input = decodeStockMovement({
      movement_type: 'recount', unit: t.unit, balance: t.to, expected_balance: t.from,
      idempotency_key: `undo:${t.changeId}`, note: `Undo of agent change ${t.changeId}`,
    });
    const res = await env.stockMovements.apply({ accountId: auth.accountId, userId: auth.userId, email: auth.userEmail }, t.productId, input);
    const value = (res.value ?? {}) as Record<string, any>;
    if (res.status === 409) return { error: 'stock_changed_since_preview', message: 'The stock moved after the preview. Nothing was changed.', current_balance: value.current_balance ?? null };
    if (res.status >= 400) return { error: 'refused', status: res.status, ...value };
    return { committed: true, product_id: t.productId, balance: t.to, unit: t.unit };
  }

  const changeId = typeof args?.change_id === 'string' ? args.change_id.trim() : '';
  if (!changeId) return { error: 'change_id_required', message: 'change_id is required. Find it with list_agent_changes.' };
  const row = await env.DB.prepare(
    "SELECT id, details, user_email, created_at FROM activity_logs WHERE id = ? AND account_id = ? AND action = 'MCP_TOOL_CALL'",
  ).bind(changeId, auth.accountId).first<Record<string, any>>();
  if (!row) return { error: 'not_found', message: 'No agent change with that id in this shop.' };
  const change = readChange(row);
  if (!change.product_id || !change.after || !change.before) {
    return { error: 'not_undoable', message: change.tool === 'record_sale' || change.tool.includes('invoice')
      ? 'An invoice is undone with void_invoice, which also puts its stock back.'
      : 'This change kept no before and after, so it cannot be put back from here. Curate changes are undone with curate_undo.' };
  }
  const cols = Object.keys(change.after);
  const current = await env.DB.prepare(`SELECT ${cols.join(', ')} FROM products WHERE id = ? AND account_id = ?`)
    .bind(change.product_id, auth.accountId).first<Record<string, unknown>>();
  if (!current) return { error: 'not_found', message: 'The tea is no longer in this shop.' };
  const moved = cols.filter(c => (current[c] ?? null) !== (change.after![c] ?? null));
  if (moved.length) {
    return { error: 'changed_since', message: `The tea changed again after this (${moved.join(', ')}). Put it back by hand, or undo the later change first.`, now: current };
  }

  const stockCols = cols.filter(c => STOCK.has(c));
  if (stockCols.length) {
    const col = stockCols[0];
    const unit: 'g' | 'unit' = col === 'stock_grams' ? 'g' : 'unit';
    const from = Number(change.after[col]);
    const to = Number(change.before[col] ?? 0);
    const token = await issueTicket<UndoStockTicket>(env, {
      kind: 'undo_agent_change', accountId: auth.accountId, changeId, productId: change.product_id, unit, from, to,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'undo_agent_change',
      read_back: `Put the stock of ${change.product_id} back from ${from} to ${to} ${unit === 'g' ? 'g' : 'pieces'}, undoing ${change.tool} of ${change.at}.`,
      change,
    }, token);
  }

  // Not stock: answer with the call that puts the old values back through the tool that changed them.
  const before = change.before;
  if (change.tool === 'set_low_stock_threshold') {
    return { next_call: { tool: 'set_low_stock_threshold', arguments: { product_id: change.product_id, threshold_grams: before.low_stock_threshold } }, change, note: 'Call this; it previews, then confirm as usual.' };
  }
  if (change.tool === 'set_archive_status') {
    return { next_call: { tool: 'set_archive_status', arguments: { product_id: change.product_id, archived: before.status === 'Archived', reason: `Undo of agent change ${changeId}` } }, change, note: 'Call this; it previews, then confirm as usual.' };
  }
  const tool = change.tool === 'update_tea_catalog' ? 'update_tea_catalog' : 'update_tea_pricing';
  const callArgs: Record<string, unknown> = { product_id: change.product_id };
  const clear: string[] = [];
  const cannot: string[] = [];
  for (const col of cols) {
    const old = before[col] ?? null;
    if (tool === 'update_tea_catalog' && CATALOG.has(col)) { callArgs[col] = old; continue; }
    const arg = PRICING_ARG[col];
    if (!arg) { cannot.push(col); continue; }
    if (old === null) { if (PRICING_CLEARABLE.has(col)) clear.push(col); else cannot.push(col); continue; }
    callArgs[arg] = old;
  }
  if (clear.length) callArgs.clear_fields = clear;
  if (Object.keys(callArgs).length === 1) return { error: 'not_undoable', message: `Nothing here can be put back by a tool (${cannot.join(', ')}).`, change };
  return {
    next_call: { tool, arguments: callArgs },
    change,
    ...(cannot.length ? { cannot_put_back: cannot, cannot_note: 'These were empty before and the tool has no way to empty them; change them in Manage.' } : {}),
    note: 'Call this; it previews the old values, then confirm as usual.',
  };
}

const defs: ToolDefinition[] = [
  {
    name: 'list_agent_changes',
    scope: 'inventory:read',
    description: 'What agents changed in this shop, newest first: every confirmed write, which tool, when and by whom. For stock, prices, a tea\'s words, its threshold and archive it also gives the values before and after, and whether undo_agent_change can put them back. Filter by since (ISO time) or product_id.',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'ISO date or time, e.g. 2026-11-27.' },
        product_id: { type: 'string' },
        limit: { type: 'number', description: 'Default 25, max 100.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'undo_agent_change',
    scope: 'stock:write',
    description: 'Put back one change an agent made, by change_id from list_agent_changes. Stock is put back here (preview, then confirm), and refuses if the stock moved since. For prices, words, the threshold or archive it returns next_call: the tool and arguments that restore the old values, which preview and confirm as usual. Refuses when the tea changed again afterwards. Invoices are undone with void_invoice; Curate with curate_undo.',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: { type: 'string' },
        confirm: { type: 'string', description: 'For a stock undo: the confirmation_token from the preview.' },
      },
      additionalProperties: false,
    },
  },
];

export const agentChangeTools: ToolModule = {
  area: 'agent-changes',
  defs,
  handlers: { list_agent_changes: listAgentChanges, undo_agent_change: undoAgentChange },
};
