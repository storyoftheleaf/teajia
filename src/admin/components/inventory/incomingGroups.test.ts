import { describe, expect, it } from 'vitest';
import type { InventoryReceipt } from '../../types';
import { dueLabel, groupIncoming } from './incomingGroups';

function receipt(over: Partial<InventoryReceipt>, lines: Array<[number, number, number, 'g' | 'unit']> = [[500, 0, 0, 'g']]): InventoryReceipt {
  return {
    id: over.id ?? 'r', state: 'in_transit', source_kind: 'invoice', vendor_name: 'Lidia',
    lines: lines.map(([e, r, c, unit], i) => ({ id: `l${i}`, product_id: 'p', product_name: 'Tea', expected_quantity: e, received_quantity: r, cancelled_quantity: c, unit, intended_purpose: 'working' })) as InventoryReceipt['lines'],
    ...over,
  } as InventoryReceipt;
}

describe('incoming grouped by supplier', () => {
  it('groups by supplier ignoring capitals, older entries and unnamed last', () => {
    const groups = groupIncoming([
      receipt({ id: 'a', vendor_name: 'Master Bo' }),
      receipt({ id: 'b', vendor_name: 'lidia' }),
      receipt({ id: 'c', legacy: true, vendor_name: null }),
      receipt({ id: 'd', vendor_name: 'Lidia' }),
      receipt({ id: 'e', vendor_name: '' }),
    ]);
    expect(groups.map(g => [g.label, g.receipts.length])).toEqual([
      ['Lidia', 2], ['Master Bo', 1], ['Earlier incoming stock', 1], ['No supplier recorded', 1],
    ]);
  });

  it('counts only what is still to arrive, grams and pieces apart', () => {
    const [g] = groupIncoming([receipt({}, [[500, 200, 0, 'g'], [300, 0, 300, 'g'], [4, 1, 0, 'unit']])]);
    expect(g.remainingGrams).toBe(300);
    expect(g.remainingUnits).toBe(3);
  });

  it('says when it is due, today, or how late', () => {
    const today = new Date(2026, 9, 8);
    expect(dueLabel('2026-10-14', today)).toEqual({ text: 'due in 6 days', late: false });
    expect(dueLabel('2026-10-08', today)).toEqual({ text: 'due today', late: false });
    expect(dueLabel('2026-10-05', today)).toEqual({ text: '3 days late', late: true });
    expect(dueLabel(null, today)).toBeNull();
  });
});
