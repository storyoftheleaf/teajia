import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useLedgerStore, type LedgerLineItem } from '../../lib/ledgerStore';
import { useAppStore } from '../../lib/store';
import { recordPurchase } from './placeOrder';

const item: Omit<LedgerLineItem, 'id' | 'addedAt'> = { name: 'Tea', compassEntryId: 'tea', productId: 'existing-product', quantityGrams: 200, pricePerUnit: 0, priceIsPerGram: true, currency: 'Yuan' };
describe('recording a purchase preserves linked arrival intent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useLedgerStore.setState({ transactions: [], activeTransactionId: null });
    useAppStore.setState({ activeAccountId: 'shop' });
  });
  it('retries the same recorded purchase without another order or stock mutation', async () => {
    const create = vi.spyOn(api.purchaseOrders, 'create').mockResolvedValue({ id: 'po' });
    const propose = vi.spyOn(api.compass, 'proposeReceipt').mockResolvedValue({ id: 'proposal' } as any);
    const accept = vi.spyOn(api.compass, 'acceptReceiptProposal');
    const ledger = useLedgerStore.getState();
    const id = ledger.createTransaction('purchase', 'Vendor', 'Yuan');
    ledger.addLineItem(id, item);
    ledger.confirmTransaction(id);
    await recordPurchase(ledger.getTransaction(id)!, [], new QueryClient());
    await recordPurchase(ledger.getTransaction(id)!, [], new QueryClient());
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].idempotency_key).toBe(`ledger:${id}`);
    expect(JSON.parse(create.mock.calls[0][0].items_json)[0]).toMatchObject({ product_id: 'existing-product', compass_entry_id: 'tea', quantity_grams: 200, line_total: 0 });
    expect(propose).toHaveBeenCalledTimes(2);
    expect(propose.mock.calls.map(call => call[1].idempotency_key)).toEqual(['order:po:tea', 'order:po:tea']);
    expect(accept).not.toHaveBeenCalled();
  });
  it('stops when the active account changes while the order is being recorded', async () => {
    vi.spyOn(api.purchaseOrders, 'create').mockImplementation(async () => {
      useAppStore.setState({ activeAccountId: 'other' });
      return { id: 'po' };
    });
    const propose = vi.spyOn(api.compass, 'proposeReceipt').mockResolvedValue({} as any);
    const ledger = useLedgerStore.getState();
    const id = ledger.createTransaction('purchase', 'Vendor', 'Yuan');
    ledger.addLineItem(id, item);
    await expect(recordPurchase(ledger.getTransaction(id)!, [], new QueryClient())).rejects.toThrow('active store changed');
    expect(propose).not.toHaveBeenCalled();
    expect(ledger.getTransaction(id)?.purchaseOrderId).toBeUndefined();
  });
  it('keeps teaware in pieces using the established uncosted receipt contract', async () => {
    vi.spyOn(api.purchaseOrders, 'create').mockResolvedValue({ id: 'po' });
    const propose = vi.spyOn(api.compass, 'proposeReceipt').mockResolvedValue({} as any);
    const ledger = useLedgerStore.getState();
    const id = ledger.createTransaction('purchase', 'Vendor', 'Yuan');
    ledger.addLineItem(id, { ...item, type: 'Teaware', priceIsPerGram: false, quantityUnits: 2, quantityGrams: undefined });
    await recordPurchase(ledger.getTransaction(id)!, [], new QueryClient());
    expect(propose).toHaveBeenCalledWith('tea', expect.objectContaining({ quantity: 2, unit: 'unit', idempotency_key: `ledger:${id}:tea` }));
  });
});
