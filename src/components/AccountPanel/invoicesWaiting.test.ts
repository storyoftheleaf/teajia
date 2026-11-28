import { describe, expect, it } from 'vitest';
import { invoicesWaiting, waitingInvoicePath, waitingNote } from './invoicesWaiting';

const pay = (outstanding: number, paid = 0, claims = 0) => ({
  recipient_slug: null, recipient_name: null, pay_url: null, has_methods: true,
  total_usd: outstanding + paid, paid_usd: paid, outstanding_usd: outstanding, claims_pending: claims,
});

describe('invoices waiting in Your Table', () => {
  it('keeps what is owed, a claimed payment first, then the oldest', () => {
    const rows = invoicesWaiting([
      { id: 'a', invoice_number: 'TJB-1', customer_name: 'Ana', status: 'Pending', created_at: '2026-11-01', payment: pay(10) },
      { id: 'b', invoice_number: 'TJB-2', customer_name: 'Tiya', status: 'Draft', created_at: '2026-11-27', payment: pay(262.35, 0, 1) },
      { id: 'c', invoice_number: 'TJB-3', customer_name: 'Paid', status: 'Filled', created_at: '2026-10-01', payment: pay(0, 50) },
      { id: 'd', invoice_number: 'TJB-4', customer_name: 'Void', status: 'Void', created_at: '2026-10-01', payment: pay(5) },
      { id: 'e', invoice_number: 'TJB-5', customer_name: 'Half', status: 'Filled', created_at: '2026-10-15', payment: pay(5, 5) },
    ]);
    expect(rows.map(row => row.id)).toEqual(['b', 'e', 'a']);
    expect(rows.map(waitingNote)).toEqual(['says they have paid: confirm it', 'part paid', 'waiting for payment']);
    expect(waitingInvoicePath('b')).toBe('/admin/activity?invoice=b');
  });
});
