import type { api } from '../../../lib/api';
export type PendingMovement = { productId: string; body: Parameters<typeof api.stockMovements.create>[1] };
export const movementStorageKey = (scope: string | null, productId: string) => `teajia:pending-movement:${scope || 'no-account'}:${productId}`;
export function readPendingMovement(serialized: string | null): PendingMovement | null {
  try {
    const value = JSON.parse(serialized || 'null') as PendingMovement;
    const body = value?.body;
    if (!value || typeof value.productId !== 'string' || !body || typeof body.idempotency_key !== 'string'
      || !['g','unit'].includes(body.unit) || !['receipt','sale','sample_use','gift','waste','return','recount','transfer'].includes(body.movement_type)
      || !Number.isFinite(body.expected_balance) || body.expected_balance < 0) return null;
    if (body.movement_type === 'recount' ? !Number.isFinite(body.balance) || body.balance! < 0 : !Number.isFinite(body.quantity) || body.quantity! <= 0) return null;
    return value;
  } catch { return null; }
}
