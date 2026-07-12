import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('purchase-order confirmation boundary', () => {
  it('records acquisition without creating inventory or declaring stock received', () => {
    const source = readFileSync(new URL('../../src/components/TeaCompass/LedgerView.tsx', import.meta.url), 'utf8');
    const confirmation = source.slice(source.indexOf('const handleConfirm'), source.indexOf('// Persist sale as invoice'));
    expect(confirmation).toContain('api.purchaseOrders.create');
    expect(confirmation).not.toContain('api.products.create');
    expect(confirmation).not.toContain("status: 'in_stock'");
  });
});
