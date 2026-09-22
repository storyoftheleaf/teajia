import { describe, expect, it } from 'vitest';
import {
  claimInvoiceEditLease,
  releaseInvoiceEditLease,
} from '../src/invoiceDomain';

type InvoiceRow = {
  id: string;
  account_id: string;
  status: string;
  inventory_deducted: number;
  fulfillment_claim_token: string | null;
  fulfillment_claimed_at: string | null;
};

class LeaseDb {
  invoices: InvoiceRow[] = [{
    id: 'invoice-a',
    account_id: 'account-a',
    status: 'Pending',
    inventory_deducted: 0,
    fulfillment_claim_token: null,
    fulfillment_claimed_at: null,
  }];

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const statement = {
      bind: (...input: unknown[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.includes('update invoices set fulfillment_claim_token = ?') && normalized.includes('returning id')) {
          const invoice = this.invoices.find(row => row.id === values[1] && row.account_id === values[2]);
          if (!invoice || invoice.status !== 'Pending' || invoice.inventory_deducted !== 0) return null;
          if (invoice.fulfillment_claim_token && invoice.fulfillment_claimed_at) return null;
          invoice.fulfillment_claim_token = String(values[0]);
          invoice.fulfillment_claimed_at = new Date().toISOString();
          return { id: invoice.id };
        }
        return null;
      },
      run: async () => {
        if (normalized.includes('fulfillment_claim_token = null')) {
          const invoice = this.invoices.find(row => row.id === values[0] && row.account_id === values[1]);
          if (!invoice || invoice.fulfillment_claim_token !== values[2]) {
            return { success: true, meta: { changes: 0 } };
          }
          invoice.fulfillment_claim_token = null;
          invoice.fulfillment_claimed_at = null;
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    };
    return statement;
  }
}

function env(db: LeaseDb) {
  return { DB: db as unknown as D1Database };
}

describe('invoice edit lease helpers', () => {
  it('claims and releases a pending invoice edit lease', async () => {
    const db = new LeaseDb();
    const claim = await claimInvoiceEditLease(env(db), 'account-a', 'invoice-a');
    expect(claim).toBeTruthy();
    expect(db.invoices[0].fulfillment_claim_token).toBe(claim);

    const released = await releaseInvoiceEditLease(env(db), 'account-a', 'invoice-a', claim!);
    expect(released).toBe(true);
    expect(db.invoices[0].fulfillment_claim_token).toBeNull();
  });

  it('refuses a second claim while the lease is held', async () => {
    const db = new LeaseDb();
    const first = await claimInvoiceEditLease(env(db), 'account-a', 'invoice-a');
    const second = await claimInvoiceEditLease(env(db), 'account-a', 'invoice-a');
    expect(first).toBeTruthy();
    expect(second).toBeNull();
  });
});
