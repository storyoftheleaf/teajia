import { describe, expect, it, vi } from 'vitest';
import { purchaseOrderPayload, persistPurchaseConfirmation } from './ledgerPurchase';
import type { LedgerTransaction } from '../../lib/ledgerStore';
const tx = { id: 'tx-123', direction: 'purchase', counterpartyName: 'Lin', currency: 'Yuan', status: 'draft', photos: [],
  items: [{ id: 'line', name: 'Tea', pricePerUnit: 1, priceIsPerGram: true, quantityGrams: 250, currency: 'Yuan', compassEntryId: 'entry', addedAt: '' }], createdAt: '', updatedAt: '' } as LedgerTransaction;

describe('purchase confirmation is durable and denominated in dollars', () => {
  it('converts display money exactly once and carries stable retry identity', () => {
    expect(purchaseOrderPayload(tx, [{ currency: 'Yuan', rateToUSD: 5 }])).toMatchObject({ total_usd: 50, display_currency: 'Yuan', request_id: 'ledger:tx-123' });
    expect(() => purchaseOrderPayload(tx, [])).toThrow(/rate/i);
  });
  it('does not acknowledge a failed remote write and retries the same request', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'po-1' });
    const ack = vi.fn();
    await expect(persistPurchaseConfirmation(tx, [{ currency: 'Yuan', rateToUSD: 5 }], create, ack)).rejects.toThrow('offline');
    expect(ack).not.toHaveBeenCalled();
    await persistPurchaseConfirmation(tx, [{ currency: 'Yuan', rateToUSD: 5 }], create, ack);
    expect(create.mock.calls[0][0].request_id).toBe(create.mock.calls[1][0].request_id);
    expect(ack).toHaveBeenCalledWith('po-1');
  });
});
