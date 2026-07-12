import { describe, expect, it } from 'vitest';
import { decodeReceiptProposal, receiptInventoryValues } from '../src/inventoryDomain';
import { receiptRequest, ReceiptDb } from './helpers/receiptHarness';

describe('reviewed Curate receipts', () => {
  it('decodes a free 10g sample without making it public', () => {
    const proposal = decodeReceiptProposal({ purpose: 'sample', quantity: 10, unit: 'g', acquisition_kind: 'free_sample' });
    expect(receiptInventoryValues(proposal)).toEqual({
      inventory_purpose: 'sample', is_sample: 1, is_personal: 0,
      stock_grams: 10, quantity_units: null, stock_known: true,
    });
    expect(proposal).not.toHaveProperty('is_public');
    expect(proposal).not.toHaveProperty('shown_in_shop');
  });

  it('supports working tea and teaware units', () => {
    expect(receiptInventoryValues(decodeReceiptProposal({ purpose: 'working', quantity: 80, unit: 'g', acquisition_kind: 'purchase' })))
      .toMatchObject({ inventory_purpose: 'working', stock_grams: 80 });
    expect(receiptInventoryValues(decodeReceiptProposal({ purpose: 'personal', quantity: 2, unit: 'unit', acquisition_kind: 'purchase' })))
      .toMatchObject({ inventory_purpose: 'personal', stock_grams: null, quantity_units: 2 });
  });

  it('rejects unsafe receipt inputs', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => decodeReceiptProposal({ purpose: 'sample', quantity: value, unit: 'g', acquisition_kind: 'purchase' })).toThrow();
    }
    expect(() => decodeReceiptProposal({ purpose: 'sample', quantity: 1.5, unit: 'unit', acquisition_kind: 'purchase' })).toThrow(/whole/);
    expect(() => decodeReceiptProposal({ purpose: 'sample', quantity: 10, unit: 'kg', acquisition_kind: 'purchase' })).toThrow(/unit/);
  });

  it('creates, edits, rejects, and account-scopes proposals through HTTP', async () => {
    const db = ReceiptDb.seeded();
    const created = await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ purpose: 'sample', quantity: 10, unit: 'g', acquisition_kind: 'free_sample', idempotency_key: 'free-10g' }) });
    expect(created.status).toBe(201);
    const proposal = await created.json() as any;
    expect(proposal).toMatchObject({ account_id: 'account-a', quantity: 10, purpose: 'sample' });
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}`, { method: 'PUT', body: JSON.stringify({ purpose: 'working', batch_id: 'batch-a' }) })).status).toBe(200);
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/reject`, { method: 'POST' })).status).toBe(200);
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' })).status).toBe(409);
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}`, { method: 'PUT', accountId: 'account-b', body: JSON.stringify({ purpose: 'personal' }) })).status).toBe(404);
  });

  it('requires operation idempotency and permits distinct acquisitions for one entry', async () => {
    const db = ReceiptDb.seeded();
    const body = { purpose: 'sample', quantity: 10, unit: 'g', acquisition_kind: 'free_sample' };
    expect((await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify(body) })).status).toBe(400);
    const first = await (await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ ...body, idempotency_key: 'acq-1' }) })).json() as any;
    const retry = await (await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ ...body, idempotency_key: 'acq-1' }) })).json() as any;
    const later = await (await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ ...body, idempotency_key: 'acq-2' }) })).json() as any;
    expect(retry.id).toBe(first.id); expect(later.id).not.toBe(first.id);
    expect((await receiptRequest(db, '/api/compass/entries/entry-work/receipt-proposals', { method: 'POST', body: JSON.stringify({ ...body, idempotency_key: 'acq-1' }) })).status).toBe(409);
    expect((await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ ...body, quantity: 20, idempotency_key: 'acq-1' }) })).status).toBe(409);
  });

  it('validates replacement product and batch ownership on PUT', async () => {
    const db = ReceiptDb.seeded();
    const proposal = await (await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ purpose: 'working', quantity: 20, unit: 'g', acquisition_kind: 'purchase', idempotency_key: 'links' }) })).json() as any;
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}`, { method: 'PUT', body: JSON.stringify({ product_id: 'product-b' }) })).status).toBe(404);
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}`, { method: 'PUT', body: JSON.stringify({ batch_id: 'batch-b' }) })).status).toBe(404);
  });

  it('accepts free samples, working tea, and teaware and retries without duplicates', async () => {
    for (const [entry, body] of [['entry-a', { purpose: 'sample', quantity: 10, unit: 'g', acquisition_kind: 'free_sample', idempotency_key: 'sample' }], ['entry-work', { purpose: 'working', quantity: 50, unit: 'g', acquisition_kind: 'purchase', idempotency_key: 'work' }], ['entry-pot', { purpose: 'personal', quantity: 2, unit: 'unit', acquisition_kind: 'purchase', idempotency_key: 'pot' }]] as const) {
      const db = ReceiptDb.seeded();
      const proposal = await (await receiptRequest(db, `/api/compass/entries/${entry}/receipt-proposals`, { method: 'POST', body: JSON.stringify(body) })).json() as any;
      const first = await (await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' })).json() as any;
      const retry = await (await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' })).json() as any;
      expect(retry).toMatchObject({ product_id: first.product_id, ledger_id: first.ledger_id, alreadyAccepted: true });
      expect(db.ledger).toHaveLength(1);
      expect(db.ledger[0]).toMatchObject({ movement_unit: body.unit === 'g' ? 'gram' : 'unit' });
      expect(db.products.get(first.product_id)).toMatchObject({ inventory_purpose: body.purpose, is_public: 0, shown_in_shop: 0 });
      if (body.unit === 'unit') {
        expect(db.products.get(first.product_id)?.quantity_units).toBe(2);
        expect(db.listings.has(`list_${first.product_id}`)).toBe(false);
        expect(db.profiles.has(`prof_${first.product_id}`)).toBe(false);
      } else {
        expect(db.products.get(first.product_id)?.stock_grams).toBe(body.quantity);
        expect(db.listings.get(`list_${first.product_id}`)).toMatchObject({ is_public: 0, shown_in_shop: 0, status: 'active' });
        expect(db.profiles.get(`prof_${first.product_id}`)).toMatchObject({ network_visible: 0, status: 'draft' });
      }
    }
  });

  it('rolls back every acceptance write when D1 batch fails', async () => {
    const db = ReceiptDb.seeded();
    const proposal = await (await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ purpose: 'sample', quantity: 10, unit: 'g', acquisition_kind: 'free_sample', idempotency_key: 'fail' }) })).json() as any;
    const productIds = [...db.products.keys()];
    db.failBatchAt = 2;
    expect((await receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' })).status).toBe(500);
    expect([...db.products.keys()]).toEqual(productIds); expect(db.listings).toHaveLength(0); expect(db.ledger).toHaveLength(0);
    expect(db.proposals.get(proposal.id)?.status).toBe('pending');
  });

  it('collapses concurrent acceptance retries to one product and ledger movement', async () => {
    const db = ReceiptDb.seeded();
    const proposal = await (await receiptRequest(db, '/api/compass/entries/entry-a/receipt-proposals', { method: 'POST', body: JSON.stringify({ purpose: 'working', quantity: 30, unit: 'g', acquisition_kind: 'purchase', idempotency_key: 'concurrent' }) })).json() as any;
    const [a, b] = await Promise.all([
      receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' }),
      receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' }),
    ]);
    const [one, two] = await Promise.all([a.json(), b.json()]) as any[];
    expect(one.product_id).toBe(two.product_id); expect(one.ledger_id).toBe(two.ledger_id);
    expect(db.ledger).toHaveLength(1);
    expect([...db.products.values()].filter(row => row.account_id === 'account-a')).toHaveLength(1);
  });

  it('preserves simultaneous distinct receipts into the same product', async () => {
    const db = ReceiptDb.seeded();
    db.products.set('shared', { id: 'shared', account_id: 'account-a', type: 'Oolong', stock_grams: 100, quantity_units: null, inventory_purpose: 'working' });
    for (const entry of db.entries.values()) if (entry.category === 'tea') entry.draft_product_id = 'shared';
    const proposals = await Promise.all(['entry-a', 'entry-work'].map(async (entry, index) =>
      (await receiptRequest(db, `/api/compass/entries/${entry}/receipt-proposals`, { method: 'POST', body: JSON.stringify({ purpose: 'working', quantity: 10 + index * 10, unit: 'g', acquisition_kind: 'purchase', idempotency_key: `shared-${index}` }) })).json() as Promise<any>));
    await Promise.all(proposals.map(proposal => receiptRequest(db, `/api/curate/receipt-proposals/${proposal.id}/accept`, { method: 'POST' })));
    expect(db.products.get('shared')?.stock_grams).toBe(130);
    const balances = db.ledger.map(row => row.balance_after).sort((a, b) => a - b);
    expect([110, 120]).toContain(balances[0]); expect(balances[1]).toBe(130);
  });
});
