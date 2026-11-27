// Launch 5, M1: the screens' reads and the owner's decisions for tea credit
// (worker/src/hostCreditLedger.ts). Every figure here was worked out by the
// worker from stored rows; the site only shows it. With HOST_CREDIT_OPEN off
// the worker answers 404 and these are never called.
import { API_URL, authedFetch } from './api';

export type CreditLineStatus = 'pending' | 'earned' | 'reversed' | 'void';

export interface HostCreditBalanceView {
  account_id: string;
  shop_name: string | null;
  currency: string;
  pending: number;
  earned: number;
  reversed: number;
  spent: number;
  held: number;
  debt: number;
  available: number;
}

export interface HostCreditLine {
  id: string;
  account_id: string;
  shop_name: string | null;
  event_id: string;
  event_title: string | null;
  tea_name: string | null;
  basis_amount: number;
  basis_currency: string;
  credit_amount: number;
  credit_currency: string;
  status: CreditLineStatus;
  earned_at: string | null;
  reversed_at: string | null;
  created_at: string;
}

export interface OwnSpendRequest {
  id: string;
  account_id: string;
  shop_name: string | null;
  invoice_id: string;
  invoice_number: string | null;
  amount: number;
  currency: string;
  status: 'held' | 'approved' | 'declined';
  requested_at: string;
  decided_at: string | null;
}

/** One of the host's own open orders, and the credit it could take now. */
export interface OwnCreditOrder {
  invoice_id: string;
  invoice_number: string | null;
  account_id: string;
  shop_name: string | null;
  tea_total: number;
  already: number;
  may_use: number;
  currency: string;
}

export interface MyTeaCredit {
  balances: HostCreditBalanceView[];
  lines: HostCreditLine[];
  requests: OwnSpendRequest[];
  orders: OwnCreditOrder[];
  /** Only with ?store: what checkout in that shop may offer. */
  store_available?: number;
}

export interface ShopHostRow extends HostCreditBalanceView {
  host_user_id: string;
  host_name: string | null;
}

export interface ShopCreditLine extends HostCreditLine {
  host_user_id: string;
  host_name: string | null;
  invoice_id: string;
  invoice_number: string | null;
  invoice_status: string | null;
}

export interface ShopSpendRequest {
  id: string;
  host_user_id: string;
  host_name: string | null;
  invoice_id: string;
  invoice_number: string | null;
  amount: number;
  currency: string;
  status: 'held' | 'approved' | 'declined';
  requested_at: string;
  decided_at: string | null;
  over_ceiling: boolean;
}

export interface SecondLookOrder {
  invoice_id: string;
  invoice_number: string | null;
  host_user_id: string;
  host_name: string | null;
  event_title: string | null;
  credit_amount: number;
  currency: string;
  ceiling_usd: number | null;
}

export interface ShopTeaCredit {
  terms: { percent: number; ceilingUsd: number | null } | null;
  hosts: ShopHostRow[];
  lines: ShopCreditLine[];
  spend_requests: ShopSpendRequest[];
  second_look: SecondLookOrder[];
}

/** The held request the worker wrote when the host asked to use credit. */
export interface TeaCreditUse { id: string; amount: number; currency: string }

export const hostCreditApi = {
  mine: (storeSlug?: string): Promise<MyTeaCredit> =>
    authedFetch(`${API_URL}/api/me/tea-credit${storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : ''}`),
  /** Ask to use credit on one of the host's own open orders. The worker works out the amount. */
  /**
   * Asks to use credit on an order. Pass one requestKey per press and reuse it
   * on a retry: the worker answers a repeat with the original request.
   */
  useOnOrder: (invoiceId: string, requestKey?: string): Promise<{ success: true; request: TeaCreditUse }> =>
    authedFetch(`${API_URL}/api/me/tea-credit/orders/${encodeURIComponent(invoiceId)}/use`, {
      method: 'POST', ...(requestKey ? { headers: { 'Idempotency-Key': requestKey } } : {}),
    }),
  shop: (): Promise<ShopTeaCredit> => authedFetch(`${API_URL}/api/host-credit`),
  approveSpend: (id: string, confirmOverCeiling = false): Promise<{ ok: true; status: 'approved' }> =>
    authedFetch(`${API_URL}/api/host-credit/spend-requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmOverCeiling ? { confirm_over_ceiling: true } : {}),
    }),
  declineSpend: (id: string): Promise<{ ok: true; status: 'declined' }> =>
    authedFetch(`${API_URL}/api/host-credit/spend-requests/${encodeURIComponent(id)}/decline`, { method: 'POST' }),
  approveOrder: (invoiceId: string): Promise<{ success: true; earned: number }> =>
    authedFetch(`${API_URL}/api/host-credit/invoices/${encodeURIComponent(invoiceId)}/approve`, { method: 'POST' }),
};

/** Credit is kept in US dollars, the currency the order lines are priced in. */
export function formatCredit(amount: number, currency = 'USD'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return currency === 'USD' ? `$${value.toFixed(2)}` : `${value.toFixed(2)} ${currency}`;
}
