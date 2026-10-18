/** Agent approvals call the same acceptance service as the reviewed arrivals UI. */
import { prepareCurateRecordedWrite, requireCurateManager } from '../curateMutations';
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
/** Rejection pins the WHOLE proposal row rather than the approval fingerprint.
   The fingerprint reads the linked order and tea so an approval cannot bank a
   cost that moved, and that read can itself fail on exactly the broken row a
   rejection exists to clear. The row is what is being written, so the row is
   what the preview is bound to, and the recorded write re-checks it in SQL. */
type RejectArrivalTicket = {
  kind: 'curate:reject_arrival';
  accountId: string;
  userId: string;
  proposalId: string;
  before: Row;
  agent: string;
};
const FIELDS = [
  'id', 'compass_entry_id', 'product_id', 'batch_id', 'import_id', 'import_item_id',
  'product_name', 'product_type', 'purpose', 'quantity', 'unit', 'acquisition_kind',
  'acquisition_state', 'idempotency_key', 'status',
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
    /* Ordered, on the way, or already here (migration 0044). NULL on the order
       rows written before the column existed, so it reads as not said rather
       than as a state nobody chose. */
    acquisition_state: row.acquisition_state ?? null,
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

/** The arrival as the list shows it, with a details read that may fail.
   A proposal whose tea or order cannot be read is still a real row on the
   incoming shelf, and it is the one most likely to need removing. */
async function readingOrReview(env: ToolEnv, auth: ToolAuth, row: Row) {
  try {
    return reading(row, await receiptProductDetails(env.DB, auth.accountId, row));
  } catch (error) {
    return {
      arrival_id: row.id, name: row.product_name, quantity: row.quantity,
      unit: row.unit, purpose: row.purpose, status: row.status,
      needs_review: (error as Error).message,
    };
  }
}

const list: ToolHandler = async (env, auth, args) => {
  const limit = Math.min(100, Math.max(1, Math.floor(Number(args?.limit) || 50)));
  const rows = await env.DB.prepare(
    "SELECT * FROM curate_receipt_proposals WHERE account_id = ? AND status = 'pending' ORDER BY created_at DESC, id LIMIT ?"
  ).bind(auth.accountId, limit).all<Row>();
  const arrivals = [];
  for (const row of rows.results) arrivals.push(await readingOrReview(env, auth, row));
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

/**
 * Take a pending arrival off the incoming shelf without touching stock.
 *
 * Correcting a tea used to leave its duplicate arrival sitting on the list with
 * nothing able to remove it: `curate_correct` answers "Unsupported Curate
 * entity" for an arrival and `curate_undo` deliberately preserves them, so the
 * only door was the admin screen. This is that screen's reject, through the
 * agent door, under the same two steps every mutating tool uses.
 *
 * It is a soft reject, which is what the column already says: `status` moves to
 * 'rejected' (its third legal value since migration 0000) and the row stays, so
 * what was proposed, by whom and what became of it is still readable. A DELETE
 * would take the evidence with it, and `stock_ledger.receipt_proposal_id`
 * points back here.
 *
 * ONLY pending. An accepted arrival has grams in stock and a ledger row behind
 * it; flipping its status would say the shop never received a tea it is
 * selling, and nothing here is allowed to go near stock. An already rejected
 * one is refused for the same reason approval refuses it: the answer is in.
 */
const reject: ToolHandler = async (env, auth, args) => {
  await requireCurateManager(env.DB, auth);
  const id = str(args?.arrival_id, 100);
  if (!id) throw new Error('arrival_id is required');
  const row = await load(env, auth, id);
  if (!row) return { error: 'not_found' };
  if (row.status !== 'pending') {
    return {
      error: 'arrival_is_not_pending', status: row.status,
      note: row.status === 'accepted'
        ? 'This arrival is already in stock. Remove the stock with remove_stock; rejecting it would deny a receipt the shelf is holding.'
        : 'This arrival was already reviewed.',
    };
  }
  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: RejectArrivalTicket = {
      kind: 'curate:reject_arrival', accountId: auth.accountId, userId: auth.userId,
      proposalId: id, before: row, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'curate_reject_arrival', arrival: await readingOrReview(env, auth, row),
      stock_unchanged: true, record_retained: true,
      note: 'Takes this arrival off the list to review without adding any stock. The proposal row is kept as rejected, so curate_history shows who removed it and curate_undo can put it back; nothing physical moves either way.',
    }, token);
  }
  const ticket = await consumeTicket<RejectArrivalTicket, 'curate:reject_arrival'>(env, confirm, 'curate:reject_arrival', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.proposalId !== id) return INVALID_TICKET;
  if (JSON.stringify(ticket.before) !== JSON.stringify(row)) {
    return { error: 'arrival_changed_since_preview', note: 'Preview the arrival again before rejecting it.' };
  }
  const now = new Date().toISOString();
  const after: Row = {
    ...row, status: 'rejected', reviewed_by_user_id: auth.userId,
    reviewed_at: now, updated_at: now,
  };
  /* The recorded write is the gate, not bookkeeping around one: the history
     INSERT carries the membership check and the row snapshot, and the UPDATE
     only lands if that INSERT did. So a row that moved between preview and
     confirm is a no-op rather than a late overwrite. */
  const prepared = prepareCurateRecordedWrite(env.DB, auth, {
    commandType: 'arrival:reject', agent: ticket.agent,
    changes: [{ entityType: 'arrival', entityId: id, before: row, after }],
    idempotencyKey: await sha256Hex(confirm),
  });
  const result = await env.DB.batch(prepared.statements);
  if (!result[0]?.meta?.changes) {
    return { error: 'stale_preview', message: 'The arrival changed, or this account may not manage Curate. Preview the arrival again.' };
  }
  return {
    committed: true, mutation_id: prepared.mutationId, arrival_id: id,
    status: 'rejected', stock_unchanged: true,
  };
};

export const curateArrivalTools: ToolModule = {
  area: 'curate-arrivals',
  defs: [
    {
      name: 'curate_list_arrivals', scope: 'inventory:read',
      description: 'Read pending Curate arrivals to review: tea, quantity, purpose, whether it is ordered or on the way, and the paid batch cost when linked to an exact supplier order. Never changes stock.',
      inputSchema: {
        type: 'object', properties: { limit: { type: 'number' }, agent: { type: 'string' } },
        additionalProperties: false,
      },
    },
    {
      name: 'curate_reject_arrival', scope: 'stock:write', annotations: { destructiveHint: true },
      description: 'Take a pending Curate arrival off the list to review, for a duplicate or an order that is not coming. Two steps: read the preview and confirm only after Adrian agrees. It adds and removes no stock: the proposal is marked rejected and kept, so curate_history shows who removed it and curate_undo puts it back. An arrival already approved into stock is refused by name — remove that stock with remove_stock instead. Shop owner or staff with explicit curate_manage permission only.',
      inputSchema: {
        type: 'object',
        properties: { arrival_id: { type: 'string' }, agent: { type: 'string' }, confirm: { type: 'string', description: 'The five-minute confirmation token from the approved preview.' } },
        required: ['arrival_id'], additionalProperties: false,
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
  handlers: { curate_list_arrivals: list, curate_approve_arrival: approve, curate_reject_arrival: reject },
};
