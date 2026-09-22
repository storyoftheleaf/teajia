import { describe, expect, it } from 'vitest';
import {
  deriveConfirmedInvoiceLine,
  invoiceLineTotal,
  repairCandidate,
  validateRetailInvoiceInput,
  validateShippingCostUsd,
  validatePaymentStatusValue,
} from '../src/invoiceDomain';

describe('invoice line invariant', () => {
  it('stores a per-gram rate for a scaled tea pick', () => {
    expect(deriveConfirmedInvoiceLine({
      quantity: 100,
      recommendedQuantity: 50,
      recommendedPriceUsd: 12,
      catalogUnitPriceUsd: 0.3,
    })).toEqual({ quantity: 100, unitPriceUsd: 0.24, lineTotalUsd: 24 });
  });

  it('stores a per-unit rate for teaware', () => {
    expect(deriveConfirmedInvoiceLine({
      quantity: 2,
      recommendedQuantity: 1,
      recommendedPriceUsd: 18,
      catalogUnitPriceUsd: 20,
    })).toEqual({ quantity: 2, unitPriceUsd: 18, lineTotalUsd: 36 });
  });

  it('treats a recommendation without a quantity as a flat line quote', () => {
    expect(deriveConfirmedInvoiceLine({
      quantity: 50,
      recommendedQuantity: null,
      recommendedPriceUsd: 15,
      catalogUnitPriceUsd: 0.4,
    })).toEqual({ quantity: 50, unitPriceUsd: 0.3, lineTotalUsd: 15 });
  });

  it('falls back to the catalog unit price', () => {
    expect(deriveConfirmedInvoiceLine({
      quantity: 3,
      recommendedQuantity: null,
      recommendedPriceUsd: null,
      catalogUnitPriceUsd: 2.25,
    })).toEqual({ quantity: 3, unitPriceUsd: 2.25, lineTotalUsd: 6.75 });
  });

  it('uses zero when no price is available', () => {
    expect(deriveConfirmedInvoiceLine({
      quantity: 3,
      recommendedQuantity: null,
      recommendedPriceUsd: null,
      catalogUnitPriceUsd: null,
    })).toEqual({ quantity: 3, unitPriceUsd: 0, lineTotalUsd: 0 });
  });

  it('computes persisted totals with currency rounding', () => {
    expect(invoiceLineTotal(75, 0.32)).toBe(24);
    expect(invoiceLineTotal(3, 10 / 3)).toBe(10);
  });

  it('recognizes only collection lines containing the reproducible historical line-total bug', () => {
    expect(repairCandidate({
      sourceCollectionId: 'c1',
      quantity: 50,
      storedPriceAtSale: 12,
      recommendedQuantity: 50,
      recommendedPriceUsd: 12,
      catalogUnitPriceUsd: 0.3,
    })).toEqual({
      correctedUnitPriceUsd: 0.24,
      currentLineTotalUsd: 600,
      correctedLineTotalUsd: 12,
    });

    expect(repairCandidate({
      sourceCollectionId: null,
      quantity: 50,
      storedPriceAtSale: 12,
      recommendedQuantity: 50,
      recommendedPriceUsd: 12,
      catalogUnitPriceUsd: 0.3,
    })).toBeNull();

    expect(repairCandidate({
      sourceCollectionId: 'c1',
      quantity: 50,
      storedPriceAtSale: 0.24,
      recommendedQuantity: 50,
      recommendedPriceUsd: 12,
      catalogUnitPriceUsd: 0.3,
    })).toBeNull();
  });

  it('uses normalized quantities when deciding and totaling repairs', () => {
    expect(repairCandidate({
      sourceCollectionId: 'c1',
      quantity: 1.4,
      storedPriceAtSale: 4,
      recommendedQuantity: 2,
      recommendedPriceUsd: 4,
      catalogUnitPriceUsd: null,
    })).toBeNull();

    expect(repairCandidate({
      sourceCollectionId: 'c1',
      quantity: 1.6,
      storedPriceAtSale: 4,
      recommendedQuantity: 2,
      recommendedPriceUsd: 4,
      catalogUnitPriceUsd: null,
    })).toEqual({
      correctedUnitPriceUsd: 2,
      currentLineTotalUsd: 8,
      correctedLineTotalUsd: 4,
    });
  });

  it.each([
    ['quantity', { quantity: Number.NaN, recommendedQuantity: null, recommendedPriceUsd: null, catalogUnitPriceUsd: null }],
    ['recommended quantity', { quantity: 1, recommendedQuantity: Number.POSITIVE_INFINITY, recommendedPriceUsd: 1, catalogUnitPriceUsd: null }],
    ['negative recommended quantity', { quantity: 1, recommendedQuantity: -1, recommendedPriceUsd: 1, catalogUnitPriceUsd: null }],
    ['recommended price', { quantity: 1, recommendedQuantity: 1, recommendedPriceUsd: Number.NaN, catalogUnitPriceUsd: null }],
    ['negative recommended price', { quantity: 1, recommendedQuantity: 1, recommendedPriceUsd: -1, catalogUnitPriceUsd: null }],
    ['catalog price', { quantity: 1, recommendedQuantity: null, recommendedPriceUsd: null, catalogUnitPriceUsd: Number.POSITIVE_INFINITY }],
    ['negative catalog price', { quantity: 1, recommendedQuantity: null, recommendedPriceUsd: null, catalogUnitPriceUsd: -1 }],
  ])('rejects invalid %s input', (_label, input) => {
    expect(() => deriveConfirmedInvoiceLine(input)).toThrow(RangeError);
  });

  it.each([
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
    [-1, 1],
    [1, -1],
  ])('rejects invalid persisted total inputs (%s, %s)', (quantity, unitPriceUsd) => {
    expect(() => invoiceLineTotal(quantity, unitPriceUsd)).toThrow(RangeError);
  });

  it('rejects finite inputs whose arithmetic would overflow', () => {
    expect(() => deriveConfirmedInvoiceLine({
      quantity: 2,
      recommendedQuantity: null,
      recommendedPriceUsd: null,
      catalogUnitPriceUsd: Number.MAX_VALUE,
    })).toThrow(RangeError);
    expect(() => invoiceLineTotal(2, Number.MAX_VALUE)).toThrow(RangeError);
  });

  it.each([Number.NaN, -1])('rejects an invalid stored repair price (%s)', (storedPriceAtSale) => {
    expect(() => repairCandidate({
      sourceCollectionId: 'c1',
      quantity: 50,
      storedPriceAtSale,
      recommendedQuantity: 50,
      recommendedPriceUsd: 12,
      catalogUnitPriceUsd: 0.3,
    })).toThrow(RangeError);
  });
});

describe('retail invoice write validation', () => {
  const baseLine = { product_id: 'tea-1', custom_name: null, quantity: 50, price_at_sale: 10 };

  it('accepts a well-formed create payload', () => {
    expect(validateRetailInvoiceInput({
      customer_name: 'Buyer',
      display_currency: 'USD',
      lineItems: [baseLine],
    })).toMatchObject({
      customer_name: 'Buyer',
      shipping_cost_usd: 0,
      payment_status: 'unpaid',
      lineItems: [baseLine],
    });
  });

  it('rejects a custom line with no name', () => {
    expect(() => validateRetailInvoiceInput({
      customer_name: 'Buyer',
      display_currency: 'USD',
      lineItems: [{ product_id: null, custom_name: null, quantity: 1, price_at_sale: 5 }],
    })).toThrow(/requires product_id or custom_name/);
  });

  it('rejects non-numeric shipping cost', () => {
    expect(() => validateShippingCostUsd('free')).toThrow(/must be a number/);
  });

  it('rejects negative shipping cost', () => {
    expect(() => validateShippingCostUsd(-1)).toThrow(/must be non-negative/);
  });

  it('accepts only the three payment statuses the ledger derives', () => {
    expect(validatePaymentStatusValue('partial')).toBe('partial');
    expect(() => validatePaymentStatusValue('settled')).toThrow(/must be unpaid, partial, or paid/);
  });
});
