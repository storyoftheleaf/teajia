import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api';
import { confirmStudioReceipt, readReceiveIntent, remainingReceiptQuantities, selectedReceiptLines } from './logisticsReceipt';
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: vi.fn(), location: { origin: 'https://test' } });
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());
describe('studio receive recovery', () => {
  it('retains the same persisted key and quantities after a partial HTTP 200, and clears only on committed retry', async () => {
    const input = { idempotency_key: 'original-key', lines: [{ line_id: 'first', quantity: 2 }, { line_id: 'second', quantity: 3 }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ committed: false, partial: true, recorded: [{ line_id: 'first' }], failed: { line_id: 'second' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ committed: true, recorded: [{ line_id: 'first' }, { line_id: 'second' }], shipment: { id: 'shipment' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    let failure: unknown;
    try { await confirmStudioReceipt('shipment', input, 'pending'); } catch (cause) { failure = cause; }
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ApiError);
    expect(readReceiveIntent('pending')).toEqual(input);
    const result = await confirmStudioReceipt('shipment', readReceiveIntent('pending')!, 'pending');
    expect(result.committed).toBe(true);
    expect(result.recorded).toHaveLength(2);
    expect(readReceiveIntent('pending')).toBeNull();
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))).toEqual([input, input]);
  });
});

describe('selecting a studio arrival', () => {
  const lines = [
    { id: 'tea', quantity: 1000, received_quantity: 250, unit: 'g' },
    { id: 'cups', quantity: 4, received_quantity: 1, unit: 'unit' },
    { id: 'done', quantity: 2, received_quantity: 2, unit: 'unit' },
  ] as import('../../../lib/logisticsTypes').LogisticsShipmentLine[];
  it('receive all selects only the unreceived balance, never cumulative ordered quantities', () => {
    const quantities = remainingReceiptQuantities(lines);
    expect(quantities).toEqual({ tea: '750', cups: '3' });
    expect(selectedReceiptLines(lines, quantities)).toEqual([{ line_id: 'tea', quantity: 750 }, { line_id: 'cups', quantity: 3 }]);
  });
  it('allows a checked subset and partial grams while rejecting stale or impossible quantities', () => {
    expect(selectedReceiptLines(lines, { tea: '125.5', cups: '' })).toEqual([{ line_id: 'tea', quantity: 125.5 }]);
    const invalid: Record<string, string>[] = [{ tea: '751' }, { cups: '0.5' }, { tea: '-1' }, { tea: 'NaN' }, { done: '1' }, { unknown: '1' }];
    for (const quantities of invalid) {
      expect(() => selectedReceiptLines(lines, quantities)).toThrow('Check the selected quantities');
    }
  });
});
