import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { InventoryReceipt } from '../../admin/types';
import { IncomingReceiptsPanel } from '../../admin/components/inventory/IncomingReceiptsPanel';
import { LIBRARY_RECEIPTS_KEY } from '../../lib/libraryPurchaseState';
import { BottomSheet } from '../shared/BottomSheet';

/** Route existing purchases to their original receipt, never into a new order. */
export function LibraryReceiptActions({ productId, receipts, readOnly = false }: {
  productId?: string; receipts: readonly InventoryReceipt[]; readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);
  const matching = receipts.filter(receipt => !receipt.legacy && receipt.state !== 'planned'
    && receipt.lines.some(line => line.product_id === productId));
  if (!productId || readOnly || matching.length === 0) return null;
  const close = () => {
    setOpenReceiptId(null);
    void queryClient.invalidateQueries({ queryKey: LIBRARY_RECEIPTS_KEY });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  };
  return <div className="flex flex-wrap items-center gap-2">
    {matching.map((receipt, index) => <button type="button" key={receipt.id}
      onClick={() => setOpenReceiptId(receipt.id)}
      className="tap-target min-h-11 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-12 text-tea-text"
      aria-label={`Manage delivery ${index + 1}${receipt.vendor_name ? ` from ${receipt.vendor_name}` : ''}`}>
      {matching.length > 1 ? `Delivery ${index + 1}` : 'Manage delivery'} · {receipt.state.replace(/_/g, ' ')}
    </button>)}
    <BottomSheet open={!!openReceiptId} onOpenChange={open => { if (!open) close(); }} title="Received & incoming" large>
      {openReceiptId && <IncomingReceiptsPanel key={openReceiptId} receiptId={openReceiptId} onClose={close} />}
    </BottomSheet>
  </div>;
}
