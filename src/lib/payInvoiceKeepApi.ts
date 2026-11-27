import { API_URL, authedFetch } from './api';

/** "Save to my account" on an invoice's pay page: the invoice joins my orders. */
export function keepPayInvoice(slug: string, token: string): Promise<{ ok: true; invoice_id: string; already: boolean }> {
  return authedFetch(`${API_URL}/api/public/people/${encodeURIComponent(slug)}/pay-access/keep`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
