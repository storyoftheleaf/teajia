/**
 * In process, for agents (plan todo/plans/samples-to-orders.md, build 4): read
 * the purchase orders on their way, and put a tracking number on one, from a
 * forwarder's email or a WeChat message. The app's In process screen reads and
 * writes the same two columns (migration 0043), so whichever hand fills the
 * number, Adrian sees it in one place.
 *
 * Setting a number moves a Placed or Sent order to Shipped, because a parcel
 * with a tracking number has left. It never marks an order Received: receiving
 * puts tea on the shelf with its cost, and that stays a reviewed step
 * (curate_approve_arrival, or Receive in the app).
 */
import { agentName, str } from './curateIntake';
import type { ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Row = Record<string, any>;
type TrackingTicket = {
  kind: 'orders:set_tracking';
  accountId: string;
  userId: string;
  orderId: string;
  tracking: string;
  fromStatus: string;
  agent: string;
};

/** Statuses an order is "in process" in: placed and not yet received or cancelled. */
export const IN_PROCESS = ['confirmed', 'sent', 'shipped'] as const;
const STEP_WORD: Record<string, string> = { confirmed: 'Placed', sent: 'Sent to supplier', shipped: 'Shipped' };

function teasOf(itemsJson: unknown): string[] {
  try {
    const items = JSON.parse(String(itemsJson || '[]'));
    return Array.isArray(items) ? items.map((i: Row) => String(i?.name ?? i?.product_name ?? 'Unnamed')).slice(0, 20) : [];
  } catch { return []; }
}

function reading(row: Row) {
  return {
    order_id: row.id,
    supplier: row.vendor_name,
    route: row.ship_mode === 'sea' ? 'boat' : row.ship_mode === 'air' ? 'air' : null,
    step: STEP_WORD[row.status] ?? row.status,
    tracking_number: row.tracking_number ?? null,
    teas: teasOf(row.items_json),
    placed_at: row.created_at,
  };
}

const list: ToolHandler = async (env, auth, args) => {
  const supplier = str(args?.supplier, 200);
  const rows = await env.DB.prepare(
    `SELECT id, vendor_name, ship_mode, status, tracking_number, items_json, created_at FROM purchase_orders
      WHERE account_id = ? AND status IN (${IN_PROCESS.map(() => '?').join(', ')})
        ${supplier ? 'AND vendor_name LIKE ?' : ''}
      ORDER BY created_at DESC LIMIT 50`,
  ).bind(auth.accountId, ...IN_PROCESS, ...(supplier ? [`%${supplier}%`] : [])).all<Row>();
  const orders = rows.results.map(reading);
  return { count: orders.length, orders };
};

const setTracking: ToolHandler = async (env, auth, args) => {
  const id = str(args?.order_id, 100);
  const tracking = str(args?.tracking_number, 120)?.trim();
  if (!id) throw new Error('order_id is required');
  if (!tracking) throw new Error('tracking_number is required');
  const row = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id = ? AND account_id = ?').bind(id, auth.accountId).first<Row>();
  if (!row) return { error: 'not_found' };
  if (!(IN_PROCESS as readonly string[]).includes(row.status)) return { error: 'order_is_not_in_process', step: row.status };
  const nextStatus = 'shipped';
  const confirm = str(args?.confirm, 100);
  if (!confirm) {
    const ticket: TrackingTicket = {
      kind: 'orders:set_tracking', accountId: auth.accountId, userId: auth.userId,
      orderId: id, tracking, fromStatus: row.status, agent: agentName(args),
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'set_order_tracking',
      order: reading(row),
      tracking_number: { from: row.tracking_number ?? null, to: tracking },
      step: { from: STEP_WORD[row.status] ?? row.status, to: STEP_WORD[nextStatus] },
      note: 'Puts the tracking number on this order and marks it Shipped. It does not receive the tea into stock.',
    }, token);
  }
  const ticket = await consumeTicket<TrackingTicket, 'orders:set_tracking'>(env, confirm, 'orders:set_tracking', auth);
  if (!ticket || ticket.userId !== auth.userId || ticket.orderId !== id || ticket.tracking !== tracking) return INVALID_TICKET;
  // The order must still be where the preview saw it: a Received order is not reopened.
  const result = await env.DB.prepare(
    `UPDATE purchase_orders SET tracking_number = ?, status = ?, updated_at = ? WHERE id = ? AND account_id = ? AND status = ?`,
  ).bind(tracking, nextStatus, new Date().toISOString(), id, auth.accountId, ticket.fromStatus).run();
  if (!(Number(result?.meta?.changes) > 0)) return { error: 'order_changed_since_preview', note: 'Preview again before confirming.' };
  return { committed: true, order_id: id, tracking_number: tracking, step: STEP_WORD[nextStatus] };
};

export const orderTrackingTools: ToolModule = {
  area: 'order-tracking',
  defs: [
    {
      name: 'list_orders_in_process', scope: 'inventory:read',
      description: 'Read purchase orders on their way (Placed, Sent to supplier, Shipped): supplier, route (air or boat), step, tracking number and teas. Filter by supplier name. Never changes anything.',
      inputSchema: {
        type: 'object', properties: { supplier: { type: 'string' }, agent: { type: 'string' } },
        additionalProperties: false,
      },
    },
    {
      name: 'set_order_tracking', scope: 'stock:write',
      description: 'Put a carrier or forwarder tracking number on a purchase order in process, for example from a forwarder email or a WeChat message; marks it Shipped. Two steps: read the preview, confirm only after Adrian agrees. Never receives tea into stock.',
      inputSchema: {
        type: 'object',
        properties: { order_id: { type: 'string' }, tracking_number: { type: 'string' }, agent: { type: 'string' }, confirm: { type: 'string' } },
        required: ['order_id', 'tracking_number'], additionalProperties: false,
      },
    },
  ],
  handlers: { list_orders_in_process: list, set_order_tracking: setTracking },
};
