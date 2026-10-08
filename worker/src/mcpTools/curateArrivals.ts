/** Agent approvals call the same acceptance service as the reviewed arrivals UI. */
import { receiptProductDetails } from '../curateReceiptProduct';
import { sha256Hex } from '../inquiryDomain';
import { agentName, str } from './curateIntake';
import type { ToolEnv, ToolAuth, ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Row = Record<string, any>;
type ArrivalTicket = {
  kind: 'curate:approve_arrival';
  accountId: string;
  userId: string;
  proposalId: string;
  fingerprint: string;
  agent: string;
};
const FIELDS = [
  'id', 'compass_entry_id', 'product_id', 'batch_id', 'import_id', 'import_item_id',
  'product_name', 'product_type', 'purpose', 'quantity', 'unit', 'acquisition_kind',
  'idempotency_key', 'status',
];

async function load(env: ToolEnv, auth: ToolAuth, id: string) {
  return env.DB.prepare('SELECT * FROM curate_receipt_proposals WHERE id = ? AND account_id = ?')
    .bind(id, auth.accountId).first<Row>();
}

async function fingerprint(row: Row, details: Row) {
  // Order totals and Curate metadata can change without editing the proposal.
  return sha256Hex(JSON.stringify([FIELDS.map(field => row[field] ?? null), details]));
}

function reading(row: Row, details: Row) {
  return {
    arrival_id: row.id,
    tea_id: row.compass_entry_id,
    product_id: row.product_id,
    name: row.product_name,
    type: row.product_type,
    purpose: row.purpose,
    quantity: row.quantity,
    unit: row.unit,
    acquisition_kind: row.acquisition_kind,
    cost: details.cost_amount == null ? null : {
      amount: details.cost_amount,
      currency: details.cost_currency,
      batch_quantity: details.quantity_purchased,
    },
    vendor_id: details.vendor_id,
    creates_private_draft: !row.product_id,
    status: row.status,
  };
}

const list: ToolHandler = async (env, auth, args) => {
  const limit = Math.min(100, Math.max(1, Math.floor(Number(args?.limit) || 50)));
  const rows = await env.DB.prepare(
    "SELECT * FROM curate_receipt_proposals WHERE account_id = ? AND status = 'pending' ORDER BY created_at DESC, id LIMIT ?"
  ).bind(auth.accountId, limit).all<Row>();
  const arrivals = [];
  for (const row of rows.results) {
    try {
      arrivals.push(reading(row, await receiptProductDetails(env.DB, auth.accountId, row)));
    } catch (error) {
      arrivals.push({
        arrival_id: row.id, name: row.product_name, quantity: row.quantity,
        unit: row.unit, purpose: row.purpose, status: row.status,
        needs_review: (error as Error).message,
      });
    }
  }
  return { count: arrivals.length, arrivals };
};

const approve: ToolHandler = async (env, auth, args) => {
  const id = str(args?.arrival_id, 100);
  if (!id) throw new Error('arrival_id is required');
  const row = await load(env, auth, id);
  if (!row) return { error: 'not_found' };
  if (row.status !== 'pending') return { error: 'arrival_is_not_pending', status: row.status };
  const details = await receiptProductDetails(env.DB, auth.accountId, row);
  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: ArrivalTicket = {
      kind: 'curate:approve_arrival', accountId: auth.accountId, userId: auth.userId,
      proposalId: id, fingerprint: await fingerprint(row, details), agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'curate_approve_arrival', arrival: reading(row, details),
      note: 'Accepts this reviewed arrival into stock. A new product stays private. Freight keeps the shop policy; no shipping cost allocation is applied.',
    }, token);
  }
  if (!env.curateReceipts) throw new Error('Arrival acceptance service is unavailable');
  const ticket = await consumeTicket<ArrivalTicket, 'curate:approve_arrival'>(env, confirm, 'curate:approve_arrival', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.proposalId !== id) return INVALID_TICKET;
  if (ticket.fingerprint !== await fingerprint(row, details)) {
    return { error: 'arrival_changed_since_preview', note: 'Preview the arrival again before approving.' };
  }
  const response = await env.curateReceipts.accept({
    accountId: auth.accountId, userId: auth.userId, email: auth.userEmail,
  }, id);
  const result = await response.json() as Row;
  return response.ok
    ? { committed: true, ...result }
    : { ...result, error: result.error ?? 'arrival_acceptance_failed', status: response.status };
};

export const curateArrivalTools: ToolModule = {
  area: 'curate-arrivals',
  defs: [
    {
      name: 'curate_list_arrivals', scope: 'inventory:read',
      description: 'Read pending Curate arrivals to review: tea, quantity, purpose and paid batch cost when linked to an exact supplier order. Never changes stock.',
      inputSchema: {
        type: 'object', properties: { limit: { type: 'number' }, agent: { type: 'string' } },
        additionalProperties: false,
      },
    },
    {
      name: 'curate_approve_arrival', scope: 'stock:write',
      description: 'Approve a reviewed Curate arrival into stock through the same service as the app. Two steps: read the preview and confirm only after Adrian agrees. Rejects changed quantity, cost or links since preview; new products stay private.',
      inputSchema: {
        type: 'object',
        properties: { arrival_id: { type: 'string' }, agent: { type: 'string' }, confirm: { type: 'string' } },
        required: ['arrival_id'], additionalProperties: false,
      },
    },
  ],
  handlers: { curate_list_arrivals: list, curate_approve_arrival: approve },
};
