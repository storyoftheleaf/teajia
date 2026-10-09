import type { InventoryReceipt, ReceiptTransportMode } from '../../types';

// Incoming, grouped by who it is coming from (stage 3 of
// todo/plans/stock-phone-by-supplier.md). Pure so the grouping, the totals and
// the due wording can be asked directly.

export const TRANSPORT_LABELS: Record<ReceiptTransportMode, string> = {
  air: 'Air',
  sea: 'Sea cargo',
  land: 'Land or carried',
  courier: 'Courier',
};

export type IncomingGroup = {
  key: string;
  label: string;
  receipts: InventoryReceipt[];
  /** What is still to arrive, in grams and in pieces. */
  remainingGrams: number;
  remainingUnits: number;
};

const OLDER = 'Earlier incoming stock';
const NO_SUPPLIER = 'No supplier recorded';

export function remainingOf(receipt: InventoryReceipt): { grams: number; units: number } {
  let grams = 0; let units = 0;
  for (const line of receipt.lines) {
    const left = Math.max(0, Number(line.expected_quantity) - Number(line.received_quantity) - Number(line.cancelled_quantity));
    if (line.unit === 'unit') units += left; else grams += left;
  }
  return { grams, units };
}

export function groupIncoming(receipts: readonly InventoryReceipt[]): IncomingGroup[] {
  const map = new Map<string, IncomingGroup>();
  for (const receipt of receipts) {
    const label = receipt.legacy ? OLDER : (receipt.vendor_name || '').trim().replace(/\s+/g, ' ') || NO_SUPPLIER;
    const key = label.toLowerCase();
    const group = map.get(key) ?? { key, label, receipts: [], remainingGrams: 0, remainingUnits: 0 };
    // Two spellings of one supplier: show the capitalised one.
    if (group.label !== label && group.label === group.label.toLowerCase()) group.label = label;
    const left = remainingOf(receipt);
    group.receipts.push(receipt);
    group.remainingGrams += left.grams;
    group.remainingUnits += left.units;
    map.set(key, group);
  }
  const last = new Set([OLDER.toLowerCase(), NO_SUPPLIER.toLowerCase()]);
  return [...map.values()].sort((a, b) => {
    if (last.has(a.key) !== last.has(b.key)) return last.has(a.key) ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
}

/** "due in 6 days", "due today", "3 days late"; null when nobody gave a date. */
export function dueLabel(eta: string | null | undefined, today: Date = new Date()): { text: string; late: boolean } | null {
  if (!eta) return null;
  const due = new Date(`${eta.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return { text: 'due today', late: false };
  if (days > 0) return { text: `due in ${days} ${days === 1 ? 'day' : 'days'}`, late: false };
  return { text: `${-days} ${days === -1 ? 'day' : 'days'} late`, late: true };
}
