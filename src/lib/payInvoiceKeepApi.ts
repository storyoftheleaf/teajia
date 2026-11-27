import { API_URL, authedFetch } from './api';

/** "Save to my account" on an invoice's pay page: the invoice joins my orders. */
export function keepPayInvoice(slug: string, token: string): Promise<{ ok: true; invoice_id: string; already: boolean }> {
  return authedFetch(`${API_URL}/api/public/people/${encodeURIComponent(slug)}/pay-access/keep`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/** The shop's own view of an invoice's pay sheet offers a percent off; 0 takes it off. */
export function setPayInvoiceDiscount(slug: string, token: string, percent: number): Promise<{ ok: true; percent: number; discount_usd: number; total_usd: number }> {
  return authedFetch(`${API_URL}/api/public/people/${encodeURIComponent(slug)}/pay-access/discount`, {
    method: 'POST',
    body: JSON.stringify({ token, percent }),
  });
}
