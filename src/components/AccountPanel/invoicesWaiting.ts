import type { InvoicePayment } from '../../lib/api';

/**
 * The invoices still waiting on money, for Your Table (Adrian, 2026-11-28:
 * "Inside of your table should be all of this... the invoice, editor and
 * everything else"). One read of the invoice list the panel already makes;
 * each row opens that invoice in Sales, where Edit, Record payment and what
 * was sent live.
 */
export interface WaitingInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  outstanding_usd: number;
  /** The buyer pressed "I've sent payment" and it is waiting for a yes. */
  claimed: boolean;
  part_paid: boolean;
  created_at: string;
}

type InvoiceRow = {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  status?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  payment?: InvoicePayment | null;
};

export function invoicesWaiting(invoices: InvoiceRow[]): WaitingInvoice[] {
  return invoices
    .filter(row => row.status !== 'Void' && !row.deleted_at && row.payment && row.payment.outstanding_usd > 0)
    .map(row => ({
      id: row.id,
      invoice_number: row.invoice_number || '',
      customer_name: (row.customer_name || '').trim(),
      outstanding_usd: row.payment!.outstanding_usd,
      claimed: row.payment!.claims_pending > 0,
      part_paid: row.payment!.paid_usd > 0,
      created_at: row.created_at || '',
    }))
    // A buyer who says they paid comes first, then the oldest.
    .sort((a, b) => Number(b.claimed) - Number(a.claimed) || a.created_at.localeCompare(b.created_at));
}

/** The plain words under a waiting invoice's name. */
export function waitingNote(invoice: WaitingInvoice): string {
  if (invoice.claimed) return 'says they have paid: confirm it';
  if (invoice.part_paid) return 'part paid';
  return 'waiting for payment';
}

/** Where a waiting invoice opens: Sales, with that invoice open. */
export const waitingInvoicePath = (id: string) => `/admin/activity?invoice=${encodeURIComponent(id)}`;
