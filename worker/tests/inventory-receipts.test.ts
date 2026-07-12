import { describe, expect, it } from 'vitest';
import { deriveReceiptState, decodeInventoryReceipt, remainingReceiptQuantity } from '../src/inventoryDomain';
import { ReceiptDb, receiptRequest } from './helpers/receiptHarness';

describe('inventory receipts', () => {
  it('validates grams and units and preserves provenance', () => {
    expect(decodeInventoryReceipt({ product_id: 'p1', quantity: 100, unit: 'g', intended_purpose: 'working', source_kind: 'invoice', source_ref: 'INV-4' })).toMatchObject({ quantity: 100, unit: 'g', source_ref: 'INV-4' });
    expect(() => decodeInventoryReceipt({ product_id: 'p1', quantity: 1.5, unit: 'unit', intended_purpose: 'sample', source_kind: 'vendor' })).toThrow(/whole/);
  });

  it('derives planned through cancelled without treating expected as on hand', () => {
    expect(deriveReceiptState('planned', 10, 0, 0)).toBe('planned');
    expect(deriveReceiptState('ordered', 10, 0, 0)).toBe('ordered');
    expect(deriveReceiptState('in_transit', 10, 0, 0)).toBe('in_transit');
    expect(deriveReceiptState('in_transit', 10, 4, 0)).toBe('partially_received');
    expect(remainingReceiptQuantity(10, 4, 2)).toBe(4);
    expect(deriveReceiptState('in_transit', 10, 10, 0)).toBe('received');
    expect(deriveReceiptState('ordered', 10, 0, 10)).toBe('cancelled');
  });
});

describe('inventory receipt endpoints', () => {
  it('persists normalized receipt lines and keeps accounts isolated', async () => {
    const db = ReceiptDb.seeded();
    db.products.set('product-a', { id: 'product-a', account_id: 'account-a', stock_grams: 5, quantity_units: 0 });
    const created = await receiptRequest(db, '/api/inventory/receipts', { method: 'POST', body: JSON.stringify({ state: 'planned', vendor_name: 'Lin', source_kind: 'invoice', source_ref: 'INV-4', lines: [{ product_id: 'product-a', quantity: 100, unit: 'g', intended_purpose: 'working' }] }) });
    expect(created.status).toBe(201);
    expect([...db.receiptLines.values()][0]).toMatchObject({ expected_quantity: 100, received_quantity: 0, intended_purpose: 'working', source_kind: 'invoice', source_ref: 'INV-4' });
    const listed = await (await receiptRequest(db, '/api/inventory/receipts?include_closed=1')).json() as any[];
    expect(listed).toHaveLength(1);
    expect(listed[0].lines[0]).toMatchObject({ expected_quantity: 100, current_on_hand: 5 });
    expect((await (await receiptRequest(db, '/api/inventory/receipts?include_closed=1', { accountId: 'account-b' })).json())).toHaveLength(0);
  });

  it('normalizes receipt provenance from consistent lines and rejects missing or mixed sources', async () => {
    const db = ReceiptDb.seeded(); db.products.set('product-a', { id: 'product-a', account_id: 'account-a' });
    const inferred = await receiptRequest(db, '/api/inventory/receipts', { method: 'POST', body: JSON.stringify({ lines: [{ product_id: 'product-a', quantity: 10, unit: 'g', intended_purpose: 'sample', source_kind: 'vendor-note' }] }) });
    expect(inferred.status).toBe(201);
    expect([...db.receipts.values()][0].source_kind).toBe('vendor-note');
    const missing = await receiptRequest(db, '/api/inventory/receipts', { method: 'POST', body: JSON.stringify({ lines: [{ product_id: 'product-a', quantity: 10, unit: 'g', intended_purpose: 'sample' }] }) });
    expect(missing.status).toBe(400);
    const mixed = await receiptRequest(db, '/api/inventory/receipts', { method: 'POST', body: JSON.stringify({ lines: [{ product_id: 'product-a', quantity: 5, unit: 'g', intended_purpose: 'sample', source_kind: 'invoice' }, { product_id: 'product-a', quantity: 5, unit: 'g', intended_purpose: 'sample', source_kind: 'message' }] }) });
    expect(mixed.status).toBe(400);
  });

  it('moves through the manual lifecycle and rejects invalid transitions', async () => {
    const db = ReceiptDb.seededWithReceipt();
    expect((await receiptRequest(db, '/api/inventory/receipts/receipt-a/state', { method: 'PUT', body: JSON.stringify({ state: 'ordered' }) })).status).toBe(200);
    expect((await receiptRequest(db, '/api/inventory/receipts/receipt-a/state', { method: 'PUT', body: JSON.stringify({ state: 'in_transit' }) })).status).toBe(200);
    expect((await receiptRequest(db, '/api/inventory/receipts/receipt-a/state', { method: 'PUT', body: JSON.stringify({ state: 'planned' }) })).status).toBe(409);
  });

  it('receives atomically, reuses its intake batch, returns aggregate state, and never creates TeaSample rows', async () => {
    const db = ReceiptDb.seededWithReceipt(true);
    const first = await receiptRequest(db, '/api/inventory/receipt-lines/line-a/receive', { method: 'POST', body: JSON.stringify({ quantity: 40 }) });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ received_quantity: 40, remaining_quantity: 60, state: 'partially_received' });
    const batchId = db.receiptLines.get('line-a')!.intake_batch_id;
    await receiptRequest(db, '/api/inventory/receipt-lines/line-a/receive', { method: 'POST', body: JSON.stringify({ quantity: 10 }) });
    expect(db.receiptLines.get('line-a')!.intake_batch_id).toBe(batchId);
    expect(db.batches.size).toBe(3); // two seeded ownership fixtures plus one intake batch
    expect(db.products.get('product-a')).toMatchObject({ stock_grams: 55, inventory_purpose: 'working' });
    expect(db.ledger).toHaveLength(2);
    expect(db.teaSamples).toHaveLength(0);
    // A second open line means the persisted receipt remains partially received.
    expect(db.receipts.get('receipt-a')!.state).toBe('partially_received');
  });

  it('reuses one intake batch across separate lines of the same receipt', async () => {
    const db = ReceiptDb.seededWithReceipt(true);
    await receiptRequest(db, '/api/inventory/receipt-lines/line-a/receive', { method: 'POST', body: JSON.stringify({ quantity: 10 }) });
    await receiptRequest(db, '/api/inventory/receipt-lines/line-b/receive', { method: 'POST', body: JSON.stringify({ quantity: 5 }) });
    expect(db.receiptLines.get('line-b')!.intake_batch_id).toBe(db.receiptLines.get('line-a')!.intake_batch_id);
    expect(db.batches.size).toBe(3);
  });

  it('isolates multiple receipts for one product and rejects all cross-account mutations', async () => {
    const db = ReceiptDb.seededWithReceipt();
    db.receipts.set('receipt-second', { ...db.receipts.get('receipt-a'), id: 'receipt-second', state: 'in_transit' });
    db.receiptLines.set('line-second', { ...db.receiptLines.get('line-a'), id: 'line-second', receipt_id: 'receipt-second' });
    db.products.set('foreign-product', { id: 'foreign-product', account_id: 'account-b', stock_grams: 0 });
    const foreignCreate = await receiptRequest(db, '/api/inventory/receipts', { method: 'POST', body: JSON.stringify({ source_kind: 'invoice', lines: [{ product_id: 'foreign-product', quantity: 10, unit: 'g', intended_purpose: 'working' }] }) });
    expect(foreignCreate.status).toBe(404);
    expect((await receiptRequest(db, '/api/inventory/receipt-lines/line-a/receive', { method: 'POST', accountId: 'account-b', body: JSON.stringify({ quantity: 1 }) })).status).toBe(404);
    expect((await receiptRequest(db, '/api/inventory/receipt-lines/line-a/cancel-remaining', { method: 'POST', accountId: 'account-b' })).status).toBe(404);
    expect((await receiptRequest(db, '/api/inventory/receipts/receipt-a/state', { method: 'PUT', accountId: 'account-b', body: JSON.stringify({ state: 'ordered' }) })).status).toBe(404);
    await receiptRequest(db, '/api/inventory/receipt-lines/line-a/receive', { method: 'POST', body: JSON.stringify({ quantity: 10 }) });
    expect(db.receipts.get('receipt-second')!.state).toBe('in_transit');
    expect(db.receiptLines.get('line-second')!.received_quantity).toBe(0);
  });

  it('rolls stock, ledger, batch, line, and receipt back together on failure', async () => {
    const db = ReceiptDb.seededWithReceipt(); db.failBatchAt = 3;
    const response = await receiptRequest(db, '/api/inventory/receipt-lines/line-a/receive', { method: 'POST', body: JSON.stringify({ quantity: 20 }) });
    expect(response.status).toBe(500);
    expect(db.products.get('product-a')!.stock_grams).toBe(5);
    expect(db.ledger).toHaveLength(0);
    expect(db.batches.size).toBe(2); // no intake batch survived beside the seeded fixtures
    expect(db.receiptLines.get('line-a')!.received_quantity).toBe(0);
  });

  it('cancels only the remaining amount and synthesizes legacy incoming without changing stock', async () => {
    const db = ReceiptDb.seededWithReceipt();
    db.receiptLines.get('line-a')!.received_quantity = 30;
    const response = await receiptRequest(db, '/api/inventory/receipt-lines/line-a/cancel-remaining', { method: 'POST' });
    expect(await response.json()).toMatchObject({ cancelled_quantity: 70, state: 'received' });
    db.products.set('legacy-a', { id: 'legacy-a', account_id: 'account-a', given_name: 'Old tea', in_transit: 1, in_transit_grams: 25, in_transit_eta: '2026-08-01', inventory_purpose: 'sample' });
    const listed = await (await receiptRequest(db, '/api/inventory/receipts')).json() as any[];
    expect(listed.find(item => item.legacy)).toMatchObject({ state: 'in_transit', lines: [{ expected_quantity: 25, intended_purpose: 'sample' }] });
    expect(db.products.get('legacy-a')!.stock_grams).toBeUndefined();
  });
});
