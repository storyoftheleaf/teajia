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

  it('keeps Capture acquisition separate from possession and exposes reviewed receipt actions', () => {
    const source = readFileSync(new URL('../../src/components/TeaCompass/CaptureCard.tsx', import.meta.url), 'utf8');
    const acquisition = source.slice(source.indexOf('const handleAddToLedger'), source.indexOf('// ── Tea card layout'));
    expect(acquisition).toContain('addLineItem');
    expect(acquisition).toContain('api.compass.proposeReceipt');
    expect(acquisition).not.toContain("update({ status: 'in_stock' })");
    expect(source).toContain("reviewReceipt('reject')");
    expect(source).toContain("reviewReceipt('accept')");
    expect(source).toContain('Accept into Inventory');
  });
});
