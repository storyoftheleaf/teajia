import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryReceipt } from '../../admin/types';
const mocks = vi.hoisted(() => ({ open: null as string | null, setOpen: vi.fn(), invalidate: vi.fn(), panel: undefined as undefined | { receiptId: string; onClose: () => void } }));
vi.mock('react', async loadOriginal => ({ ...await loadOriginal<typeof import('react')>(), useState: () => [mocks.open, mocks.setOpen] }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('../../lib/libraryPurchaseState', () => ({ LIBRARY_RECEIPTS_KEY: ['library-purchase-receipts'] }));
vi.mock('../shared/BottomSheet', () => ({ BottomSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null }));
vi.mock('../../admin/components/inventory/IncomingReceiptsPanel', () => ({ IncomingReceiptsPanel: (props: { receiptId: string; onClose: () => void }) => { mocks.panel = props; return <div>Existing receipt workflow</div>; } }));
import { LibraryReceiptActions } from './LibraryReceiptActions';
const receipt = (id: string, productId = 'tea'): InventoryReceipt => ({ id, state: 'partially_received', source_kind: 'whatsapp', vendor_name: 'Wei', lines: [{ id: `${id}-line`, product_id: productId, product_name: 'Tea', expected_quantity: 500, received_quantity: 200, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working' }] });
beforeEach(() => { vi.clearAllMocks(); mocks.open = null; mocks.panel = undefined; });

describe('existing Library delivery access', () => {
  it('offers each linked delivery while excluding unrelated, planned and legacy records', () => {
    const markup = renderToStaticMarkup(<LibraryReceiptActions productId="tea" receipts={[receipt('one'), receipt('two'), receipt('other', 'other-tea'), { ...receipt('planned'), state: 'planned' }, { ...receipt('legacy'), legacy: true }]} />);
    expect(markup.match(/<button/g)).toHaveLength(2);
    expect(markup).toContain('Delivery 1');
    expect(markup).toContain('Delivery 2');
    expect(markup).not.toContain('Reorder');
  });
  it('opens the existing receipt panel using its durable id and refreshes quantities on return', () => {
    mocks.open = 'original-whatsapp-receipt';
    expect(renderToStaticMarkup(<LibraryReceiptActions productId="tea" receipts={[receipt(mocks.open)]} />)).toContain('Existing receipt workflow');
    expect(mocks.panel?.receiptId).toBe('original-whatsapp-receipt');
    mocks.panel!.onClose();
    expect(mocks.setOpen).toHaveBeenCalledWith(null);
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['library-purchase-receipts'] });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });
  it('does not offer receipt mutations without a linked product or in read-only mode', () => {
    expect(renderToStaticMarkup(<LibraryReceiptActions receipts={[receipt('one')]} />)).toBe('');
    expect(renderToStaticMarkup(<LibraryReceiptActions productId="tea" receipts={[receipt('one')]} readOnly />)).toBe('');
    expect(mocks.panel).toBeUndefined();
  });
});
