/**
 * What people ask the shop for, for agents.
 *
 * - `set_order_request_status`: mark a request from the shop (an order, or an
 *   "find me a tea" ask) seen, replied or closed. list_order_requests and
 *   convert_order_request already read and convert them; nothing could answer
 *   one without turning it into an invoice. Same UPDATE as PATCH
 *   /api/admin/inquiries/:id/status.
 * - Wholesale orders between shops: list, read and move one step. The step goes
 *   through `transitionWholesaleOrder` in index.ts, the same function the route
 *   calls, handed in as `env.wholesale`, so an agent's "shipped" checks the same
 *   party and moves the same stock as Adrian's.
 */
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

const REQUEST_STATUSES = ['new', 'seen', 'replied', 'closed'] as const;
const WHOLESALE_STEPS = ['submitted', 'replied', 'confirmed', 'shipped', 'received', 'cancelled'] as const;

interface RequestStatusTicket extends TicketPayload {
  kind: 'set_order_request_status';
  inquiryId: string;
  fromStatus: string;
  status: string;
}

interface WholesaleTicket extends TicketPayload {
  kind: 'move_wholesale_order';
  orderId: string;
  fromStatus: string;
  body: Record<string, unknown>;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function setOrderRequestStatus(env: ToolEnv, auth: ToolAuth, args: any) {
  const confirm = str(args?.confirm);
  if (confirm) {
    const t = await consumeTicket<RequestStatusTicket, 'set_order_request_status'>(env, confirm, 'set_order_request_status', auth);
    if (!t) return INVALID_TICKET;
    const res = await env.DB.prepare(
      "UPDATE inquiries SET status = ? WHERE id = ? AND account_id = ? AND COALESCE(status, 'new') = ?",
    ).bind(t.status, t.inquiryId, auth.accountId, t.fromStatus).run();
    if (!res.meta?.changes) return { error: 'request_changed', message: 'The request changed since the preview. Read it again with list_order_requests.' };
    return { committed: true, request_id: t.inquiryId, status: t.status };
  }
  const id = str(args?.request_id, 80);
  const status = str(args?.status, 20);
  if (!id) return { error: 'request_id_required', message: 'request_id is required. Find it with list_order_requests.' };
  if (!(REQUEST_STATUSES as readonly string[]).includes(status)) return { error: 'invalid_status', message: `status must be one of ${REQUEST_STATUSES.join(', ')}.` };
  const row = await env.DB.prepare(
    "SELECT id, name, ref_number, COALESCE(status, 'new') AS status, converted_invoice_id FROM inquiries WHERE (id = ? OR ref_number = ?) AND account_id = ?",
  ).bind(id, id, auth.accountId).first<Record<string, any>>();
  if (!row) return { error: 'not_found', message: 'No request with that id in this shop.' };
  const token = await issueTicket<RequestStatusTicket>(env, {
    kind: 'set_order_request_status', accountId: auth.accountId, inquiryId: row.id, fromStatus: row.status, status,
  }, auth.tokenId);
  return previewEnvelope({
    action: 'set_order_request_status',
    read_back: `Mark the request from ${row.name || 'someone'}${row.ref_number ? ` (${row.ref_number})` : ''} as ${status}.`,
    from_status: row.status,
    to_status: status,
    already_an_order: Boolean(row.converted_invoice_id),
  }, token);
}

async function listWholesaleOrders(env: ToolEnv, auth: ToolAuth, args: any) {
  const role = str(args?.role, 20);
  const status = str(args?.status, 20);
  let where = '(o.buyer_account_id = ? OR o.supplier_account_id = ?)';
  const binds: unknown[] = [auth.accountId, auth.accountId];
  if (role === 'buyer') { where = 'o.buyer_account_id = ?'; binds.splice(0, 2, auth.accountId); }
  else if (role === 'supplier') { where = 'o.supplier_account_id = ?'; binds.splice(0, 2, auth.accountId); }
  if (status) { where += ' AND o.status = ?'; binds.push(status); }
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.status, o.buyer_account_id, o.supplier_account_id, o.subtotal_amount, o.shipping_amount, o.total_amount,
            o.currency, o.created_at, o.updated_at, o.submitted_at,
            sa.name AS supplier_name, ba.name AS buyer_name,
            (SELECT COUNT(*) FROM wholesale_order_items WHERE order_id = o.id) AS item_count
       FROM wholesale_orders o
       LEFT JOIN accounts sa ON sa.id = o.supplier_account_id
       LEFT JOIN accounts ba ON ba.id = o.buyer_account_id
      WHERE ${where}
      ORDER BY o.updated_at DESC
      LIMIT 50`,
  ).bind(...binds).all<Record<string, any>>();
  const orders = (results ?? []).map(o => ({ ...o, you_are: o.supplier_account_id === auth.accountId ? 'supplier' : 'buyer' }));
  return { orders, count: orders.length };
}

async function readWholesaleOrder(env: ToolEnv, auth: ToolAuth, orderId: string) {
  const order = await env.DB.prepare('SELECT * FROM wholesale_orders WHERE id = ?').bind(orderId).first<Record<string, any>>();
  if (!order || (order.buyer_account_id !== auth.accountId && order.supplier_account_id !== auth.accountId)) return null;
  return order;
}

async function getWholesaleOrder(env: ToolEnv, auth: ToolAuth, args: any) {
  const orderId = str(args?.order_id, 80);
  if (!orderId) return { error: 'order_id_required' };
  const order = await readWholesaleOrder(env, auth, orderId);
  if (!order) return { error: 'not_found', message: 'No wholesale order with that id that this shop is part of.' };
  const { results } = await env.DB.prepare(
    `SELECT i.*, tp.name AS tea_name FROM wholesale_order_items i
       LEFT JOIN tea_profiles tp ON tp.id = i.profile_id
      WHERE i.order_id = ?`,
  ).bind(orderId).all<Record<string, any>>();
  const { receive_claim_token: _claim, ...rest } = order;
  return { order: { ...rest, you_are: order.supplier_account_id === auth.accountId ? 'supplier' : 'buyer' }, items: results ?? [] };
}

async function moveWholesaleOrder(env: ToolEnv, auth: ToolAuth, args: any) {
  if (!env.wholesale) return { error: 'not_available' };
  const confirm = str(args?.confirm);
  if (confirm) {
    const t = await consumeTicket<WholesaleTicket, 'move_wholesale_order'>(env, confirm, 'move_wholesale_order', auth);
    if (!t) return INVALID_TICKET;
    const now = await readWholesaleOrder(env, auth, t.orderId);
    if (!now || now.status !== t.fromStatus) return { error: 'order_changed', message: 'The order moved since the preview. Read it again with get_wholesale_order.' };
    const res = await env.wholesale.transition({ accountId: auth.accountId, userId: auth.userId, email: auth.userEmail }, t.orderId, t.body);
    const value = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) return { error: 'refused', status: res.status, ...value };
    return { committed: true, order_id: t.orderId, ...value };
  }
  const orderId = str(args?.order_id, 80);
  const to = str(args?.to, 20).toLowerCase();
  if (!orderId) return { error: 'order_id_required' };
  if (!(WHOLESALE_STEPS as readonly string[]).includes(to)) return { error: 'invalid_step', message: `to must be one of ${WHOLESALE_STEPS.join(', ')}.` };
  const order = await readWholesaleOrder(env, auth, orderId);
  if (!order) return { error: 'not_found', message: 'No wholesale order with that id that this shop is part of.' };
  const body: Record<string, unknown> = { to };
  if (typeof args?.supplier_notes === 'string') body.supplier_notes = args.supplier_notes.slice(0, 2000);
  if (typeof args?.cancel_reason === 'string') body.cancel_reason = args.cancel_reason.slice(0, 500);
  if (args?.shipping_amount !== undefined) body.shipping_amount = args.shipping_amount;
  if (typeof args?.tracking_number === 'string') body.tracking_number = args.tracking_number.slice(0, 200);
  if (typeof args?.carrier === 'string') body.carrier = args.carrier.slice(0, 120);
  const token = await issueTicket<WholesaleTicket>(env, {
    kind: 'move_wholesale_order', accountId: auth.accountId, orderId, fromStatus: String(order.status), body,
  }, auth.tokenId);
  const youAre = order.supplier_account_id === auth.accountId ? 'supplier' : 'buyer';
  return previewEnvelope({
    action: 'move_wholesale_order',
    read_back: `Move wholesale order ${orderId} from ${order.status} to ${to}, as the ${youAre}.${to === 'shipped' || to === 'received' ? ' This moves stock.' : ''}`,
    from_status: order.status,
    to_status: to,
    you_are: youAre,
    sent: body,
  }, token);
}

const defs: ToolDefinition[] = [
  {
    name: 'set_order_request_status',
    scope: 'sales:write',
    description: 'Mark a request that came in through the shop (an order or a "find me a tea" ask) as seen, replied or closed, after it has been answered in person. To turn it into an invoice use convert_order_request. Two-step: preview, then confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'request_id or reference from list_order_requests.' },
        status: { type: 'string', enum: [...REQUEST_STATUSES] },
        confirm: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_wholesale_orders',
    scope: 'sales:read',
    description: 'Wholesale orders between this shop and another Teajia shop, newest first, saying whether this shop is the buyer or the supplier.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['buyer', 'supplier'], description: 'Only orders where this shop is this side.' },
        status: { type: 'string', description: 'draft, submitted, replied, confirmed, shipped, received or cancelled.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_wholesale_order',
    scope: 'sales:read',
    description: 'One wholesale order with its lines.',
    inputSchema: { type: 'object', properties: { order_id: { type: 'string' } }, required: ['order_id'], additionalProperties: false },
  },
  {
    name: 'move_wholesale_order',
    scope: 'sales:write',
    description: 'Move a wholesale order one step: the buyer submits or marks received; the supplier replies, confirms (with shipping_amount) or ships; either side may cancel. Shipped and received move stock. Uses the same checks as the Manage screen. Two-step: preview, then confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        to: { type: 'string', enum: [...WHOLESALE_STEPS] },
        supplier_notes: { type: 'string' },
        shipping_amount: { type: 'number', minimum: 0 },
        tracking_number: { type: 'string' },
        carrier: { type: 'string' },
        cancel_reason: { type: 'string' },
        confirm: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
];

export const peopleRequestTools: ToolModule = {
  area: 'people-requests',
  defs,
  handlers: {
    set_order_request_status: setOrderRequestStatus,
    list_wholesale_orders: listWholesaleOrders,
    get_wholesale_order: getWholesaleOrder,
    move_wholesale_order: moveWholesaleOrder,
  },
};
