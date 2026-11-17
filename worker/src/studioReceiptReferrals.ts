import type { LogisticsShipment, StudioReceiptReferral } from '../../src/lib/logisticsTypes';

type Env = { DB: D1Database };
type Scope = { accountId: string; userId: string; name: string };
type StoredReferral = StudioReceiptReferral & { idempotency_key: string };
type Input = Record<string, unknown>;

export const STUDIO_REFERRAL_OPEN = 'studio_referral_open';
export const STUDIO_REFERRAL_MESSAGE = 'Resolve the studio referral for this line before receiving it.';

export class StudioReferralError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new StudioReferralError(`${label} is required and must be at most ${max} characters`);
  }
  return value.trim();
}

function publicReferral({ idempotency_key: _key, ...referral }: StoredReferral): StudioReceiptReferral {
  return referral;
}

const referralSelect = `SELECT r.id, l.shipment_id, r.shipment_line_id AS line_id, r.reason,
    r.source_reference, r.observed_quantity, r.recorded_by, r.recorded_by_name, r.recorded_at,
    r.resolved_by, r.resolved_by_name, r.resolved_at, r.resolution, r.idempotency_key
  FROM logistics_studio_referrals r
  JOIN logistics_shipment_lines l ON l.account_id=r.account_id AND l.id=r.shipment_line_id`;

export async function attachStudioReferrals(env: Env, accountId: string, shipments: LogisticsShipment[]) {
  if (!shipments.length) return shipments;
  const { results } = await env.DB.prepare(`${referralSelect} WHERE r.account_id=?
    ORDER BY r.recorded_at DESC, r.id DESC`).bind(accountId).all<StoredReferral>();
  const byShipment = new Map<string, StudioReceiptReferral[]>();
  for (const row of results ?? []) {
    const group = byShipment.get(row.shipment_id) ?? [];
    group.push(publicReferral(row));
    byShipment.set(row.shipment_id, group);
  }
  return shipments.map(shipment => {
    const referrals = byShipment.get(shipment.id);
    return referrals ? { ...shipment, studio_referrals: referrals } : shipment;
  });
}

export async function hasOpenStudioReferral(env: Env, accountId: string, lineId: string) {
  return Boolean(await env.DB.prepare(`SELECT id FROM logistics_studio_referrals
    WHERE account_id=? AND shipment_line_id=? AND resolved_at IS NULL`).bind(accountId, lineId).first());
}

export async function referStudioLine(env: Env, scope: Scope, shipmentId: string, lineId: string, input: Input) {
  const reason = requiredText(input.reason, 'Reason', 1000);
  const reference = requiredText(input.source_reference, 'Source reference', 1000);
  const key = requiredText(input.idempotency_key, 'Request key', 80);
  const quantity = input.observed_quantity ?? null;
  const line = await env.DB.prepare(`SELECT r.unit FROM logistics_shipment_lines l
    JOIN inventory_receipt_lines r ON r.account_id=l.account_id AND r.id=l.receipt_line_id
    WHERE l.id=? AND l.shipment_id=? AND l.account_id=?`)
    .bind(lineId, shipmentId, scope.accountId).first<{ unit: string }>();
  if (!line) throw new StudioReferralError('Shipment line not found', 404);
  if (quantity !== null && (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0
      || (line.unit === 'unit' && !Number.isInteger(quantity)))) {
    throw new StudioReferralError('Enter a valid observed quantity in the line’s stock unit');
  }

  const id = crypto.randomUUID();
  // Both the outstanding balance and uniqueness are checked in the write.
  await env.DB.prepare(`INSERT INTO logistics_studio_referrals
    (id, account_id, shipment_line_id, reason, source_reference, observed_quantity,
     recorded_by, recorded_by_name, recorded_at, idempotency_key)
    SELECT ?, l.account_id, l.id, ?, ?, ?, ?, ?, ?, ?
    FROM logistics_shipment_lines l
    JOIN logistics_shipments s ON s.account_id=l.account_id AND s.id=l.shipment_id
    WHERE l.id=? AND l.shipment_id=? AND l.account_id=?
      AND s.state IN ('in_transit','partially_received') AND l.received_quantity<l.quantity
    ON CONFLICT DO NOTHING`)
    .bind(id, reason, reference, quantity, scope.userId, scope.name || scope.userId, new Date().toISOString(), key,
      lineId, shipmentId, scope.accountId).run();

  const saved = await env.DB.prepare(`${referralSelect} WHERE r.account_id=? AND r.idempotency_key=?`)
    .bind(scope.accountId, key).first<StoredReferral>();
  if (!saved) {
    const message = await hasOpenStudioReferral(env, scope.accountId, lineId)
      ? 'This line already has an open studio referral.'
      : 'Only an outstanding line on a dispatched shipment can be referred.';
    throw new StudioReferralError(message, 409);
  }
  if (saved.line_id !== lineId || saved.reason !== reason || saved.source_reference !== reference
      || saved.observed_quantity !== quantity || saved.recorded_by !== scope.userId) {
    throw new StudioReferralError('This request key was already used for a different referral.', 409);
  }
  return { referral: publicReferral(saved), replayed: saved.id !== id };
}

export async function resolveStudioReferral(env: Env, scope: Scope, id: string, input: Input) {
  const resolution = requiredText(input.resolution, 'Resolution', 1000);
  const { meta } = await env.DB.prepare(`UPDATE logistics_studio_referrals
    SET resolution=?, resolved_by=?, resolved_by_name=?, resolved_at=?
    WHERE id=? AND account_id=? AND resolved_at IS NULL`)
    .bind(resolution, scope.userId, scope.name || scope.userId, new Date().toISOString(), id, scope.accountId).run();
  const saved = await env.DB.prepare(`${referralSelect} WHERE r.account_id=? AND r.id=?`)
    .bind(scope.accountId, id).first<StoredReferral>();
  if (!saved) throw new StudioReferralError('Studio referral not found', 404);
  if (saved.resolution !== resolution || saved.resolved_by !== scope.userId) {
    throw new StudioReferralError('This referral was already resolved.', 409);
  }
  return { referral: publicReferral(saved), replayed: !meta.changes };
}
