import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';
import type { ExchangeRate } from './types';

/**
 * A rate keeps the precision it is quoted at, and rounds up into it.
 *
 * Two rules meet here and were briefly read as one. The shop never rounds a
 * price down, and Rupiah is never a fraction of a rupiah. The decimal in
 * "IDR 10.4k" is not that fraction: it is 10,400 whole rupiah. Rounding the
 * whole figure up to the thousand to honour the second rule cost the first
 * column its job, because every pack on the ladder then read the same "10k"
 * and the discount for buying more became invisible.
 */

const rates: ExchangeRate[] = [{ currency: 'IDR', rateToUSD: 16000 } as ExchangeRate];

describe('a per-unit rate in Rupiah', () => {
  it('keeps the hundreds, which are whole rupiah and not a fraction of one', () => {
    // 0.65 USD a gram at 16,000 is 10,400 rupiah a gram.
    expect(formatCurrency(0.65, 'IDR', rates, { rate: true })).toContain('10.4k');
  });

  it('rounds up whatever is finer than that', () => {
    // 10,401.6 rupiah. The shop does not round a price down, ever.
    expect(formatCurrency(0.65010, 'IDR', rates, { rate: true })).toContain('10.5k');
  });

  it('does not climb a step when the figure is already exact', () => {
    expect(formatCurrency(0.65, 'IDR', rates, { rate: true })).not.toContain('10.5k');
  });

  it('drops an empty decimal rather than printing it', () => {
    // 0.625 x 16,000 is exactly 10,000.
    expect(formatCurrency(0.625, 'IDR', rates, { rate: true })).toContain('10k');
  });

  it('still rounds a TOTAL up to the whole thousand', () => {
    // Totals are quoted in whole thousands; only rates carry the hundreds.
    expect(formatCurrency(0.65, 'IDR', rates)).toBe('IDR 11k');
  });
});
