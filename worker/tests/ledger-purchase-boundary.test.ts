import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('purchase-order confirmation boundary', () => {
  it('records acquisition without creating inventory or declaring stock received', () => {
    const source = readFileSync(new URL('../../src/components/TeaCompass/LedgerView.tsx', import.meta.url), 'utf8');
    const confirmation = source.slice(source.indexOf('const handleConfirm'), source.indexOf('// Persist sale as invoice'));
    expect(confirmation).toContain('recordPurchase(tx, rates, queryClient)');
    const recorder = readFileSync(new URL('../../src/components/CurateV2/placeOrder.ts', import.meta.url), 'utf8');
    expect(recorder).toContain('api.purchaseOrders.create');
    expect(recorder).not.toContain('api.products.create');
    expect(recorder).not.toContain('acceptReceiptProposal');
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
