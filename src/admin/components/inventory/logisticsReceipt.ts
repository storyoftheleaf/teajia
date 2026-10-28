import { api } from '../../../lib/api';
import type { LogisticsReceiveInput } from '../../../lib/logisticsTypes';
export function readReceiveIntent(key: string): LogisticsReceiveInput | null {
  try {
    const input = JSON.parse(sessionStorage.getItem(key) || 'null');
    return input && typeof input.idempotency_key === 'string' && Array.isArray(input.lines) ? input : null;
  } catch { return null; }
}
/** A partial HTTP-200 write must retain exactly the same key and quantities for retry. */
export async function confirmStudioReceipt(shipmentId: string, input: LogisticsReceiveInput, storageKey: string) {
  try { sessionStorage.setItem(storageKey, JSON.stringify(input)); } catch { /* The mounted panel also retains this intent. */ }
  const result = await api.logistics.receiveShipment(shipmentId, input);
  try { sessionStorage.removeItem(storageKey); } catch { /* Retrying the retained key is safe after a confirmed write. */ }
  return result;
}
