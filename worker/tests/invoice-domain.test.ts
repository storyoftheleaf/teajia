import { describe, expect, it } from 'vitest';
import {
  deriveConfirmedInvoiceLine,
  invoiceLineTotal,
  repairCandidate,
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
});
