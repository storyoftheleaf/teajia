import { API_URL, authedFetch } from './api';

/** Correct the name, date (YYYY-MM-DD) or notes on any invoice that is not void; the edit goes on its timeline. */
export function updateInvoiceDetails(id: string, data: { customer_name?: string; notes?: string | null; invoice_date?: string }): Promise<{ success: true; changed: string[] }> {
  return authedFetch(`${API_URL}/api/invoices/${encodeURIComponent(id)}/details`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
