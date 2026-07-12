import { describe, expect, it } from 'vitest';
import { decodeReceiptProposal, receiptInventoryValues } from '../src/inventoryDomain';
import { readFileSync } from 'node:fs';

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

  it('pins account scope, idempotency, provenance, atomic review, and no auto-publication in the Worker contract', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    const migration = readFileSync(new URL('../migrations/103_inventory_purpose_receipts.sql', import.meta.url), 'utf8');
    expect(migration).toContain('UNIQUE(account_id, idempotency_key)');
    expect(migration).toContain('UNIQUE INDEX idx_stock_ledger_receipt_proposal');
    expect(migration).toContain('proposed_by_user_id TEXT NOT NULL');
    expect(migration).toContain('reviewed_by_user_id TEXT');
    expect(source).toContain("WHERE id = ? AND account_id = ? AND status = 'pending'");
    expect(source).toContain('await env.DB.batch(statements)');
    expect(source).toContain("'Draft', ?, ?, ?, ?, ?, ?, 0, 0");
    expect(source).toContain("if (proposal.status === 'accepted')");
  });
});
