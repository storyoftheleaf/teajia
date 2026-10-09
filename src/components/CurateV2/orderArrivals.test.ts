import { describe, expect, it } from 'vitest';
import type { LedgerLineItem } from '../../lib/ledgerStore';
import { arrivalFields, arrivalKey, lineGrams, orderArrivalLines } from './orderArrivals';

const line = (over: Partial<LedgerLineItem>): LedgerLineItem => ({
  id: 'l', name: 'Tea', pricePerUnit: 450, priceIsPerGram: false, currency: 'Yuan', addedAt: '', compassEntryId: 'e1',
  quantityUnits: 1, unitWeightGrams: 357, ...over,
});

describe('what a confirmed order tells the shop about each tea', () => {
  it('a cake is its pieces times its weight, priced as the line adds up, in the order\'s own money', () => {
    const lines = orderArrivalLines({ items: [line({ quantityUnits: 2, pricePerUnit: 450 })] });
    expect(lines).toEqual([{ entryId: 'e1', name: 'Tea', type: undefined, grams: 714, total: 900, currency: 'Yuan' }]);
  });

  it('a price per gram is the grams that were quoted, and the line total is the price for them', () => {
    const lines = orderArrivalLines({ items: [line({ priceIsPerGram: true, quantityGrams: 150, quantityUnits: undefined, unitWeightGrams: undefined, pricePerUnit: 12, currency: 'NT' })] });
    expect(lines[0]).toMatchObject({ grams: 150, total: 1800, currency: 'NT' });
  });

  it('a line with no price, no weight, no tea behind it or that is teaware arrives as it always did, with no invented cost', () => {
    expect(orderArrivalLines({ items: [line({ unpriced: true })] })).toEqual([]);
    expect(orderArrivalLines({ items: [line({ unitWeightGrams: undefined })] })).toEqual([]);
    expect(orderArrivalLines({ items: [line({ compassEntryId: undefined })] })).toEqual([]);
    expect(orderArrivalLines({ items: [line({ type: 'Teaware' })] })).toEqual([]);
  });

  it('the purchase order line names the tea; it gains grams and a total only when the shop can use them', () => {
    expect(arrivalFields(line({}))).toEqual({ compass_entry_id: 'e1', quantity_grams: 357, line_total: 450 });
    expect(arrivalFields(line({ unitWeightGrams: undefined }))).toEqual({ compass_entry_id: 'e1' });
    expect(arrivalFields(line({ compassEntryId: undefined }))).toEqual({});
    expect(lineGrams(line({ quantityUnits: 0 }))).toBeNull();
  });

  it('the receipt key is the one the shop reads the order and the tea back out of', () => {
    expect(arrivalKey('po-1', 'tea-9')).toBe('order:po-1:tea-9');
  });
});
