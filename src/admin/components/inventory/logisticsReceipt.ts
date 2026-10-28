import { api } from '../../../lib/api';
import type { LogisticsReceiveInput, LogisticsShipmentLine } from '../../../lib/logisticsTypes';
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

/** Select only the balance that has not already reached the studio. */
export function remainingReceiptQuantities(lines: readonly LogisticsShipmentLine[]): Record<string, string> {
  return Object.fromEntries(lines.filter(line => line.quantity > line.received_quantity).map(line => [line.id, String(line.quantity - line.received_quantity)]));
}
export function selectedReceiptLines(lines: readonly LogisticsShipmentLine[], quantities: Record<string, string>): LogisticsReceiveInput['lines'] {
  const selected: LogisticsReceiveInput['lines'] = [];
  for (const [id, raw] of Object.entries(quantities)) {
    if (!raw.trim() || Number(raw) === 0) continue;
    const line = lines.find(item => item.id === id);
    const quantity = Number(raw);
    if (!line || !Number.isFinite(quantity) || quantity <= 0 || quantity > line.quantity - line.received_quantity || (line.unit === 'unit' && !Number.isInteger(quantity))) {
      throw new Error('Check the selected quantities against what is still coming.');
    }
    selected.push({ line_id: id, quantity });
  }
  return selected;
}
