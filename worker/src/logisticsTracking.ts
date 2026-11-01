import type { LogisticsTrackingEvent, LogisticsTrackingKind, LogisticsTrackingUpdate, RecordLogisticsTrackingInput } from '../../src/lib/logisticsTrackingUpdate';
type Env = { DB: D1Database };
type Scope = { accountId: string; userId: string };
type Row = Record<string, any>;
export class LogisticsTrackingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function text(value: unknown, name: string, max: number, required = false): string | null {
  if (value == null || value === '') { if (required) throw new LogisticsTrackingError(`${name} is required`); return null; }
  if (typeof value !== 'string' || value.length > max) throw new LogisticsTrackingError(`${name} must be text of at most ${max} characters`);
  const result = value.trim();
  if (!result && required) throw new LogisticsTrackingError(`${name} is required`);
  return result || null;
}
const normalized = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const identity = (number: string | null, courier: string | null) => JSON.stringify([number, courier]);
const entitySql = (kind: LogisticsTrackingKind) => kind === 'purchase'
  ? `SELECT p.id,CASE WHEN h.logistics_company_name IS NOT NULL THEN h.inbound_tracking_number ELSE p.tracking_number END tracking_number,h.inbound_courier courier
    FROM purchase_orders p LEFT JOIN purchase_logistics h ON h.purchase_id=p.id AND h.account_id=p.account_id WHERE p.account_id=? AND p.id=?`
  : 'SELECT id,tracking_number,outbound_courier courier FROM logistics_shipments WHERE account_id=? AND id=?';
async function entity(env: Env, account: string, kind: LogisticsTrackingKind, id: string): Promise<Row> {
  const row = await env.DB.prepare(entitySql(kind)).bind(account, id).first<Row>();
  if (!row) throw new LogisticsTrackingError('Purchase or shipment not found', 404);
  return { ...row, tracking_number: normalized(row.tracking_number), courier: normalized(row.courier) };
}
function event(row: Row): LogisticsTrackingEvent {
  return { id: Number(row.id), source: 'agent_update', tracking_number: row.tracking_number ?? null, status: row.status, location: row.location ?? null,
    description: row.description ?? null, reported_at: row.reported_at, recorded_at: row.recorded_at, recorded_by: row.recorded_by, source_text: row.source_text };
}
function latest(rows: Row[]): LogisticsTrackingUpdate | null {
  if (!rows.length) return null;
  return { ...event(rows[0]), history: rows.map(event) };
}
async function read(env: Env, account: string, kind: LogisticsTrackingKind, id: string, key: string) {
  const rows = (await env.DB.prepare(`SELECT * FROM logistics_tracking_updates WHERE account_id=? AND kind=? AND entity_id=? AND identity=? ORDER BY COALESCE(reported_at,recorded_at) DESC,id DESC`)
    .bind(account, kind, id, key).all<Row>()).results ?? [];
  return latest(rows);
}

/** Saves the message, its actual time and author. It does not move or receive goods. */
export async function recordLogisticsTrackingUpdate(env: Env, scope: Scope, input: RecordLogisticsTrackingInput, preview = false, options: { expectedIdentity?: string } = {}) {
  if (!input || !['purchase', 'shipment'].includes(input.kind)) throw new LogisticsTrackingError('Choose a purchase or shipment');
  const id = text(input.entity_id, 'Purchase or shipment', 200, true)!;
  if (!Object.prototype.hasOwnProperty.call(input, 'tracking_number')) throw new LogisticsTrackingError('Include the saved tracking number, or null when no number is saved');
  const number = text(input.tracking_number, 'Tracking number', 200);
  const item = await entity(env, scope.accountId, input.kind, id);
  if (item.tracking_number !== number) throw new LogisticsTrackingError('The tracking number changed or belongs to a different delivery. Read the purchase or shipment again.', 409);
  const key = identity(number, item.courier);
  if (options.expectedIdentity !== undefined && options.expectedIdentity !== key) throw new LogisticsTrackingError('The courier or tracking number changed after preview. Read the delivery and preview this update again.', 409);
  const reported = text(input.reported_at, 'Report time', 40);
  if (reported && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(reported) || !Number.isFinite(Date.parse(reported)))) throw new LogisticsTrackingError('Report time must include a date, time and timezone');
  if (reported && Date.parse(reported) > Date.now() + 5 * 60_000) throw new LogisticsTrackingError('Report time cannot be in the future. Put an expected arrival in the delivery date instead.');
  const update = { kind: input.kind, entity_id: id, tracking_number: number, identity: key, status: text(input.status, 'Status', 120, true)!,
    location: text(input.location, 'Location', 240), description: text(input.description, 'Update', 1000), reported_at: reported ? new Date(reported).toISOString() : null,
    source_text: text(input.source_text, 'Original message', 12000, true)! };
  const idempotency = text(input.idempotency_key, 'Message reference', 200, true)!;
  const fingerprint = JSON.stringify(update);
  const prior = await env.DB.prepare('SELECT * FROM logistics_tracking_updates WHERE account_id=? AND idempotency_key=?').bind(scope.accountId, idempotency).first<Row>();
  if (prior && prior.request_fingerprint !== fingerprint) throw new LogisticsTrackingError('This message reference was already used for a different update', 409);
  const current = await read(env, scope.accountId, input.kind, id, key);
  if (preview) return { preview: true as const, update: { ...update, source: 'agent_update' as const }, will_replace_current: !current || (update.reported_at ?? new Date().toISOString()) >= (current.reported_at ?? current.recorded_at), replayed: !!prior };
  if (prior) return { tracking: current, applied: current?.id === Number(prior.id), replayed: true };
  // The ownership and tracking identity check also occurs in the write itself.
  // A concurrent edit cannot attach this report to a different saved delivery.
  await env.DB.prepare(`INSERT INTO logistics_tracking_updates(account_id,kind,entity_id,tracking_number,identity,status,location,description,reported_at,recorded_at,recorded_by,source,source_text,idempotency_key,request_fingerprint)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,'agent_update',?,?,? WHERE EXISTS(SELECT 1 FROM (${entitySql(input.kind)}) e WHERE NULLIF(TRIM(e.tracking_number),'') IS ? AND NULLIF(TRIM(e.courier),'') IS ?)
    ON CONFLICT(account_id,idempotency_key) DO NOTHING`)
    .bind(scope.accountId, input.kind, id, number, key, update.status, update.location, update.description, update.reported_at, new Date().toISOString(), scope.userId,
      update.source_text, idempotency, fingerprint, scope.accountId, id, number, item.courier).run();
  const saved = await env.DB.prepare('SELECT * FROM logistics_tracking_updates WHERE account_id=? AND idempotency_key=?').bind(scope.accountId, idempotency).first<Row>();
  if (!saved) throw new LogisticsTrackingError('Delivery details changed while the update was being saved. Read the record again.', 409);
  if (saved.request_fingerprint !== fingerprint) throw new LogisticsTrackingError('This message reference was already used for a different update', 409);
  const tracking = await read(env, scope.accountId, input.kind, id, key);
  return { tracking, applied: tracking?.id === Number(saved.id), replayed: false };
}

/** Reading the tracking screen never contacts a logistics company. */
export async function attachLogisticsTracking<T extends {
  orders: { purchase_id: string; inbound_tracking_number?: string | null; inbound_courier?: string | null }[];
  shipments: { id: string; tracking_number?: string | null; outbound_courier?: string | null }[];
}>(env: Env, account: string, data: T) {
  const rows = (await env.DB.prepare('SELECT * FROM logistics_tracking_updates WHERE account_id=? ORDER BY COALESCE(reported_at,recorded_at) DESC,id DESC').bind(account).all<Row>()).results ?? [];
  return { ...data,
    orders: data.orders.map((order: T['orders'][number]) => ({ ...order, tracking_update: latest(rows.filter(r => r.kind === 'purchase' && r.entity_id === order.purchase_id && r.identity === identity(normalized(order.inbound_tracking_number), normalized(order.inbound_courier)))) })),
    shipments: data.shipments.map((shipment: T['shipments'][number]) => ({ ...shipment, tracking_update: latest(rows.filter(r => r.kind === 'shipment' && r.entity_id === shipment.id && r.identity === identity(normalized(shipment.tracking_number), normalized(shipment.outbound_courier)))) })),
  };
}
