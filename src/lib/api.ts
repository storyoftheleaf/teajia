import type { Account, AccountMember, AccountMembership, AccountRole, PlatformRole } from '../types';

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: string; // JSON string
  created_at: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  platform_role: PlatformRole;
  created_at: string;
  memberships: { account_id: string; role: string }[];
}

export interface PlatformAccount {
  id: string;
  slug: string;
  name: string;
  location_city?: string;
  location_country?: string;
  is_platform_owner: boolean;
  public_enabled: boolean;
  status: 'active' | 'suspended';
  trust_tier: 'basic' | 'verified' | 'partner';
  member_count: number;
  features: Record<string, boolean>;
}

export interface PurchaseOrder {
  id: string;
  account_id: string;
  vendor_name: string;
  vendor_id?: string | null;
  vendor_contact?: string | null;
  items_json: string; // JSON string of line items
  total_usd: number;
  display_currency: string;
  status: string;
  notes?: string | null;
  message_text?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  product_id: string;
  product_name: string;
  quantity_grams: number;
  unit_price_usd?: number;
}

import { useAppStore } from './store';

const API_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 30_000;

// Once the token has less than this many seconds left, nudge a background
// refresh on the next authenticated call. Matches the server-side threshold
// (14 days) so slide refreshes land while there's still plenty of headroom.
const PROACTIVE_REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * 14;

function getToken(): string | null {
  return localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token');
}

export function setToken(token: string) {
  // Persist to localStorage so sessions survive browser restarts and deploys.
  // iOS Safari private mode / strict ITP can throw on localStorage.setItem —
  // fall back to sessionStorage so the session at least survives the tab.
  try {
    localStorage.setItem('teajia_token', token);
    sessionStorage.removeItem('teajia_token');
  } catch {
    try {
      sessionStorage.setItem('teajia_token', token);
    } catch { /* storage fully blocked — session cannot be persisted */ }
  }
}

export function clearToken() {
  try { localStorage.removeItem('teajia_token'); } catch { /* ignore */ }
  try { sessionStorage.removeItem('teajia_token'); } catch { /* ignore */ }
}

export function hasToken(): boolean {
  return !!getToken();
}

export const isConfigured = !!API_URL;

/** Check whether the stored JWT is expired (with 60s buffer). */
export function isTokenExpired(): boolean {
  const claims = getTokenClaims();
  if (!claims?.exp) return false; // No expiry claim — let server decide
  return Date.now() >= claims.exp * 1000 - 60_000;
}

/** True when the stored token is valid but within 14 days of expiry. */
export function shouldProactivelyRefreshToken(): boolean {
  const claims = getTokenClaims();
  if (!claims?.exp) return false;
  const secondsLeft = claims.exp - Math.floor(Date.now() / 1000);
  return secondsLeft > 0 && secondsLeft < PROACTIVE_REFRESH_THRESHOLD_SECONDS;
}

function authHeaders(): Record<string, string> {
  // NOTE: we intentionally do NOT clear the token preemptively here. Clearing
  // before we've actually tried the server means a brief clock skew or a
  // near-expiry call immediately logs the user out. Instead the request is
  // sent; if the server says 401 we attempt a refresh (handleResponse). If
  // the refresh also fails, only then do we clear. Background refreshes are
  // scheduled by `maybeScheduleBackgroundRefresh` when we're inside the
  // threshold.
  maybeScheduleBackgroundRefresh();
  const currentToken = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    // Inject active account header for every authenticated request
    try {
      const activeAccountId = useAppStore.getState().activeAccountId;
      if (activeAccountId) headers['X-Teajia-Account'] = activeAccountId;
    } catch {
      /* store not ready yet — ignore */
    }
  }
  return headers;
}

// ── Silent refresh machinery ──────────────────────────────────────────────
// Coordinates ongoing refresh calls so many concurrent requests don't each
// fire their own refresh when a page first loads a stale token.
//
// 'refreshed'     — new token issued and stored; retry the original call
// 'rejected'      — server explicitly rejected the token (non-2xx); log out
// 'network_error' — couldn't reach the refresh endpoint; keep existing token
type RefreshResult = 'refreshed' | 'rejected' | 'network_error';

let inFlightRefresh: Promise<RefreshResult> | null = null;
let lastRefreshAttemptAt = 0;

async function refreshTokenNow(): Promise<RefreshResult> {
  const token = getToken();
  if (!token) return 'rejected';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    // 5xx = server temporarily unavailable (cold start, DB blip, deployment).
    // Do NOT log the user out for a transient infrastructure error — keep the
    // existing token and let the next API call retry.
    if (res.status >= 500) return 'network_error';
    if (!res.ok) return 'rejected'; // 4xx = token genuinely invalid/expired
    const data = await res.json().catch(() => null);
    if (data?.token && typeof data.token === 'string') {
      setToken(data.token);
      // Refresh the Zustand store so memberships stay aligned with the JWT.
      try { hydrateAccountStateFromToken(); } catch { /* ignore */ }
      return 'refreshed';
    }
    return 'rejected';
  } catch {
    // Network error or timeout — keep the old token; next success will retry.
    return 'network_error';
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Shared silent refresh; concurrent callers see the same promise. */
export function ensureTokenRefreshed(): Promise<RefreshResult> {
  if (!inFlightRefresh) {
    lastRefreshAttemptAt = Date.now();
    inFlightRefresh = refreshTokenNow().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

function maybeScheduleBackgroundRefresh() {
  if (!shouldProactivelyRefreshToken()) return;
  // Throttle — don't retry more than once per minute on failure, since the
  // refresh helper is best-effort and we don't want to hammer the API while
  // a Worker deploy is cycling.
  if (Date.now() - lastRefreshAttemptAt < 60_000) return;
  // Fire and forget; errors are tolerated.
  void ensureTokenRefreshed();
}

/** Fetch with an AbortController timeout. */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Custom event name dispatched when a 401 response indicates session expiry. */
export const SESSION_EXPIRED_EVENT = 'teajia:session-expired';

/** Dispatched when the server rejects the active account (e.g., membership revoked). */
export const ACCOUNT_MISMATCH_EVENT = 'teajia:account-mismatch';

async function handleResponse(res: Response) {
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (!res.ok) {
    // Detect expired/invalid session.
    //
    // A 401 no longer clears the token on its own — we attempt one silent
    // refresh first. If the refresh succeeds, the *caller* of this API has
    // still failed (the original request was made with the old token and
    // the body has been consumed), but the next call will use the new
    // token and succeed. Only if the refresh itself fails do we give up
    // and fire SESSION_EXPIRED so the UI can prompt a re-login.
    if (res.status === 401 && hasToken()) {
      const reason = data?.reason as string | undefined;

      // 'no_token' means the server received no Authorization header — the
      // frontend forgot to send auth headers for that call. This is a client-side
      // bug, not an expired session: the user's token is still valid. Attempting
      // a refresh would be pointless and could falsely fire SESSION_EXPIRED.
      if (reason !== 'no_token') {
        const refreshResult = await ensureTokenRefreshed();
        if (refreshResult === 'rejected') {
          clearToken();
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
        }
        // 'network_error': keep the token — transient issue, next call may succeed.
        // 'refreshed': new token stored; the *original* request already failed but
        //              the caller's next attempt will use the new token.
      }
    }
    // Detect account access denial — clear active account and prompt UI reload
    if (res.status === 403 && data?.error === 'Account access denied') {
      try {
        useAppStore.getState().setActiveAccountId(null);
        useAppStore.getState().setActiveAccount(null);
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent(ACCOUNT_MISMATCH_EVENT));
    }
    const message = typeof data?.error === 'string' && data.error.length < 200
      ? data.error
      : `Request failed (${res.status})`;
    throw new Error(message);
  }
  // Adopt any sliding-refresh token the server stapled onto the response
  // (currently /api/auth/me does this). Keeps the client JWT fresh without
  // an extra round-trip.
  if (data && typeof data === 'object' && typeof data.refreshed_token === 'string') {
    try {
      setToken(data.refreshed_token);
      hydrateAccountStateFromToken();
    } catch { /* ignore */ }
  }
  return data;
}

export interface TokenClaims {
  sub: string;
  email: string;
  role: string;
  platform_role?: import('../types').PlatformRole;
  name: string;
  username?: string | null;
  exp?: number;
  memberships?: AccountMembership[];
  active_account_id?: string;
}

/**
 * UTF-8 safe base64 decode. Plain `atob` returns a binary string whose code
 * units are the raw bytes — feeding that to JSON.parse corrupts any
 * non-ASCII character (e.g. a Chinese `name` claim). TextDecoder gives us
 * the original UTF-8 string back.
 */
function b64decodeUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function getTokenClaims(): TokenClaims | null {
  const token = getToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(b64decodeUtf8(payload));
  } catch {
    return null;
  }
}

/**
 * Hydrate the Zustand store from the current JWT's memberships + active_account_id.
 * Safe to call multiple times. Returns the parsed claims (or null).
 */
export function hydrateAccountStateFromToken(): TokenClaims | null {
  const claims = getTokenClaims();
  if (!claims) return null;
  try {
    const store = useAppStore.getState();
    const rawMemberships = Array.isArray(claims.memberships) ? claims.memberships : [];
    // Normalize: older JWTs may contain 'name' instead of 'account_name'
    const memberships = rawMemberships.map((m: any) => ({
      ...m,
      account_name: m.account_name || m.name || '',
    }));
    store.setMemberships(memberships);
    store.setPlatformRole(claims.platform_role ?? null);
    if (claims.active_account_id) {
      store.setActiveAccountId(claims.active_account_id);
    } else if (memberships.length === 1) {
      store.setActiveAccountId(memberships[0].account_id);
    } else if (memberships.length === 0) {
      store.setActiveAccountId(null);
    }
  } catch { /* ignore */ }
  return claims;
}

export const api = {
  auth: {
    login: async (identifier: string, password: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      return handleResponse(res);
    },
    signup: async (email: string, password: string, name: string, username?: string | null) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, username: username || undefined }),
      });
      return handleResponse(res);
    },
    /** Explicit refresh — rarely needed directly; prefer `ensureTokenRefreshed`. */
    refresh: async (): Promise<boolean> => ensureTokenRefreshed().then(r => r === 'refreshed'),
    me: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/me`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return handleResponse(res);
    },
    updateProfile: async (data: { name?: string; email?: string; username?: string | null; phone?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    requestAdmin: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/request-admin`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    forgotPassword: async (email: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return handleResponse(res);
    },
    resetPassword: async (token: string, newPassword: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      return handleResponse(res);
    },
    verifyPassword: async (password: string): Promise<{ verified: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/verify-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password }),
      });
      return handleResponse(res);
    },
  },

  users: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/users`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    updateRole: async (userId: string, data: { role?: string; admin_request_status?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (userId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createResetToken: async (userId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/reset-token`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId }),
      });
      return handleResponse(res);
    },
  },

  products: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/products`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/public`);
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    bulkCreate: async (products: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ products }),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getEvents: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}/events`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  rates: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rates`);
      return handleResponse(res);
    },
  },

  invoices: {
    list: async (limit = 50, offset = 0, includeDeleted = false) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (includeDeleted) params.set('include_deleted', '1');
      const res = await fetchWithTimeout(`${API_URL}/api/invoices?${params}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (invoice: Record<string, any>, lineItems: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice, lineItems }),
      });
      return handleResponse(res);
    },
    getItems: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}/items`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    updateItems: async (id: string, data: { lineItems?: { product_id?: string | null; custom_name?: string | null; quantity: number; price_at_sale: number }[]; shipping_cost_usd?: number; customer_name?: string; notes?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}/items`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/invoices/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  customers: {
    list: async (type?: 'customer' | 'supplier') => {
      const url = type ? `${API_URL}/api/customers?type=${type}` : `${API_URL}/api/customers`;
      const res = await fetchWithTimeout(url, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    get: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getOrders: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/orders`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getTeas: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/teas`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getEvents: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/events`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getSuppliedProducts: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${id}/products`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    linkProduct: async (vendorId: string, productId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${vendorId}/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ product_id: productId }),
      });
      return handleResponse(res);
    },
    unlinkProduct: async (vendorId: string, productId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${vendorId}/products/${productId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Fetch customers tagged as 'vendor' — used for compass vendor auto-suggest */
    fetchVendors: async (): Promise<Array<{ id: string; name: string; country?: string; tags?: string }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers`, {
        headers: authHeaders(),
      });
      const data = await handleResponse(res);
      const list = Array.isArray(data) ? data : (data?.customers ?? []);
      return list.filter((c: { tags?: string | string[] }) => {
        const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : []);
        return tags.includes('vendor') || tags.includes('Vendor');
      });
    },
  },

  rpc: {
    fulfillInvoice: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/fulfill-invoice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    voidInvoice: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/void-invoice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    splitInvoice: async (invoiceId: string, lineItemIds: string[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/split-invoice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId, line_item_ids: lineItemIds }),
      });
      return handleResponse(res);
    },
    incrementStock: async (productId: string, amount: number) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/increment-stock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ product_id: productId, amount }),
      });
      return handleResponse(res);
    },
    truncateAll: async () => {
      if (!window.confirm('DANGER: This will permanently delete ALL data. This action cannot be undone. Are you sure?')) {
        throw new Error('Operation cancelled by user');
      }
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/truncate-all`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    backfillCustomerLinks: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/backfill-customer-links`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    autoLinkVendors: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/auto-link-vendors`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    resetStockVerification: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/reset-stock-verification`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    linkLineItem: async (invoiceId: string, lineItemId: string, productId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/link-line-item`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId, line_item_id: lineItemId, product_id: productId }),
      });
      return handleResponse(res);
    },
    reserveStock: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/reserve-stock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    releaseStock: async (invoiceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/release-stock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      return handleResponse(res);
    },
    giftSample: async (data: { customer_user_id: string; entry_ids: string[]; note?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rpc/gift-sample`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  stockHolds: {
    available: async (productId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/stock/available?product_id=${productId}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  purchaseOrders: {
    list: async (): Promise<PurchaseOrder[]> => {
      const res = await fetchWithTimeout(`${API_URL}/api/purchase-orders`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    create: async (data: {
      vendor_name: string;
      vendor_id?: string;
      vendor_contact?: string;
      po_number?: string;
      items_json: string;
      total_usd?: number;
      display_currency?: string;
      status?: string;
      notes?: string;
      message_text?: string;
    }): Promise<{ id: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },

    updateStatus: async (id: string, status: string): Promise<{ success: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      return handleResponse(res);
    },
  },

  activityLogs: {
    list: async (params?: { limit?: number; offset?: number; action?: string; search?: string; entity_id?: string }) => {
      const qp = new URLSearchParams();
      if (params?.limit) qp.set('limit', String(params.limit));
      if (params?.offset) qp.set('offset', String(params.offset));
      if (params?.action) qp.set('action', params.action);
      if (params?.search) qp.set('search', params.search);
      if (params?.entity_id) qp.set('entity_id', params.entity_id);
      const res = await fetchWithTimeout(`${API_URL}/api/activity-logs?${qp}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  stockLedger: {
    list: async (productId?: string, limit = 50, offset = 0) => {
      const qp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (productId) qp.set('product_id', productId);
      const res = await fetchWithTimeout(`${API_URL}/api/stock-ledger?${qp}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  generateWisdom: async (prompt: string) => {
    const res = await fetchWithTimeout(`${API_URL}/api/generate-wisdom`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt }),
    });
    return handleResponse(res);
  },

  extractFromImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('teajia_token');
    const res = await fetchWithTimeout(`${API_URL}/api/extract-from-image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse(res);
  },

  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string }> => {
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
    formData.append('file', audioBlob, `recording.${ext}`);
    // Note: we don't preemptively clear the token here — handleResponse
    // silently refreshes on 401 and only clears on refresh failure.
    const token = getToken();
    const res = await fetchWithTimeout(`${API_URL}/api/transcribe`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse(res);
  },

  uploadImage: async (file: File | Blob) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithTimeout(`${API_URL}/api/upload-image`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await handleResponse(res);
    return data.url;
  },

  events: {
    // Admin endpoints
    listAdmin: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getAdmin: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getAttendees: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/attendees`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    updateAttendee: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    getNotifications: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/notifications`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createNotifications: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/notifications`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    upsertPostSession: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/post-session`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    duplicate: async (id: string, newSlug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/duplicate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ slug: newSlug }),
      });
      return handleResponse(res);
    },
    batchAttendance: async (id: string, attendeeIds: string[], attended: boolean) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/attendance`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ attendee_ids: attendeeIds, attended }),
      });
      return handleResponse(res);
    },
    getTeaMenu: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tea-menu`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    upsertTeaMenu: async (id: string, items: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tea-menu`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ items }),
      });
      return handleResponse(res);
    },
    deleteTeaMenuItem: async (id: string, itemId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tea-menu/${itemId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getTastingNotes: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/tasting-notes`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // V2: Attendee approval actions
    approveAttendee: async (id: string, data?: { approved_guests?: number; message?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}/approve`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data || {}),
      });
      return handleResponse(res);
    },
    denyAttendee: async (id: string, data?: { message?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}/deny`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data || {}),
      });
      return handleResponse(res);
    },
    getPendingAttendees: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/pending-attendees`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    waitlistAttendee: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/attendees/${id}/waitlist`, {
        method: 'PUT',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    approveBatch: async (eventId: string, attendeeIds: string[], approvedGuestsMap?: Record<string, number>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/approve-batch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ attendee_ids: attendeeIds, approved_guests_map: approvedGuestsMap }),
      });
      return handleResponse(res);
    },
    getShareMessages: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/share`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    sendEmailInvites: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${id}/send-emails`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    /** Send WhatsApp/email invites to approved attendees for an event. */
    sendInvites: async (eventId: string): Promise<{ sent: number; failed: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/send-emails`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type: 'invite' }),
      });
      return handleResponse(res);
    },
    /** Fetch the public tea menu for an event (no auth required). */
    getPublicTeaMenu: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/tea-menu`);
      if (!res.ok) return [];
      return res.json();
    },
    /** Standalone helper — send invites to all approved attendees. */
    sendEventInvites: async (eventId: string): Promise<{ sent: number; failed: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/send-emails`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type: 'invite' }),
      });
      return handleResponse(res);
    },
    getCustomerJourney: async (customerId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/customers/${customerId}/journey`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // V2: Interest capture
    registerInterest: async (slug: string, data: { name?: string; phone?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    // F12: List interest signups for an event
    getInterestSignups: async (eventId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/interest`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // F12: Convert interest signups to RSVPs
    convertInterestToRsvp: async (eventId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/convert-interest`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // F40: Create next recurring event occurrence
    createNextEventOccurrence: async (eventId: string, nextDate: string, slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/create-next`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ next_date: nextDate, slug }),
      });
      return handleResponse(res);
    },
    // F7: Mark event as complete and auto-draft invoices
    completeEvent: async (eventId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/events/${eventId}/complete`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // Public endpoints
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/events`);
      return handleResponse(res);
    },
    getPublic: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/public`);
      return handleResponse(res);
    },
    /** Fetch the public post-session recap for a completed event (no auth required). */
    getPublicRecap: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/recap`);
      return handleResponse(res);
    },
    getAvailability: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/availability`);
      return handleResponse(res);
    },
    uploadFlyer: async (file: File | Blob) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('teajia_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/upload-flyer`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return handleResponse(res);
    },
  },

  venues: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues`, { headers: authHeaders() });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      return handleResponse(res);
    },
    uploadPhoto: async (venueId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('teajia_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${venueId}/photos`, {
        method: 'POST', headers, body: formData,
      });
      return handleResponse(res);
    },
    createSpace: async (venueId: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${venueId}/spaces`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    updateSpace: async (venueId: string, spaceId: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${venueId}/spaces/${spaceId}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    deleteSpace: async (venueId: string, spaceId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${venueId}/spaces/${spaceId}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getEvents: async (venueId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/venues/${venueId}/events`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/venues/public`);
      return handleResponse(res);
    },
  },

  savedLocations: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/locations/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  newsletter: {
    subscribe: async (email: string, source = 'website') => {
      const res = await fetchWithTimeout(`${API_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      return handleResponse(res);
    },
    subscribers: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/newsletter/subscribers`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  rsvp: {
    submit: async (slug: string, data: Record<string, any>) => {
      const body = {
        full_name: data.fullName,
        phone_number: data.phoneNumber || undefined,
        email: data.email || undefined,
        contact_method: data.contactMethod,
        guest_requests: data.guests?.map((g: any) => ({
          nameHint: g.nameHint,
          contact: g.contact || undefined,
        })),
        notes: data.notes || undefined,
      };
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/rsvp`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(body),
      });
      return handleResponse(res);
    },
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    update: async (token: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    claim: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    getPostSession: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/post-session`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    submitTastingNotes: async (token: string, notes: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}/tasting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return handleResponse(res);
    },
    findByPhone: async (slug: string, phoneNumber: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      return handleResponse(res);
    },
    findByEmail: async (slug: string, email: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return handleResponse(res);
    },
    findByAccount: async (slug: string) => {
      const token = localStorage.getItem('teajia_token') || sessionStorage.getItem('teajia_token');
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/find-rsvp`, {
        method: 'POST',
        headers: {
          'Content-Length': '0',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      return handleResponse(res);
    },
    // V2: Cancel with optional note
    cancel: async (token: string, note?: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancellation_note: note }),
      });
      return handleResponse(res);
    },
    // V2: Mark first-visit briefing seen
    markBriefed: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/rsvp/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_visit_briefed: 1 }),
      });
      return handleResponse(res);
    },
  },

  // V2: Guest invite single-use links
  guestInvites: {
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/guest-invite/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
    claim: async (token: string, data: { name: string; phone?: string; email?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/guest-invite/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  // V2: Verification (quiet account — phone or email, no passwords)
  verify: {
    requestCode: async (contact: string, method: 'whatsapp' | 'email') => {
      const res = await fetchWithTimeout(`${API_URL}/api/verify/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, method }),
      });
      return handleResponse(res);
    },
    confirmCode: async (contact: string, code: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/verify/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, code }),
      });
      return handleResponse(res);
    },
  },

  // V2: Guest journey (tea history, seals, impressions)
  journey: {
    get: async (phone: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/journey/${encodeURIComponent(phone)}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return handleResponse(res);
    },
  },

  compass: {
    list: async (params?: { status?: string; vendor_id?: string }) => {
      const qp = new URLSearchParams();
      if (params?.status) qp.set('status', params.status);
      if (params?.vendor_id) qp.set('vendor_id', params.vendor_id);
      const qs = qp.toString();
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (entry: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(entry),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    sync: async (entries: Record<string, any>[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ entries }),
      });
      return handleResponse(res);
    },
    /** Share a capture card to known accounts and/or generate an invite link for external tasters */
    share: async (params: {
      entryId: string;
      targetAccountIds?: string[];
      generateInviteLink?: boolean;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/share`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          entry_id: params.entryId,
          target_account_ids: params.targetAccountIds,
          generate_invite_link: params.generateInviteLink,
        }),
      });
      return handleResponse(res);
    },
    /** List pending incoming shares for the current account */
    getIncoming: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/incoming`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Accept a direct-push share — creates a compass entry in caller's account */
    acceptShare: async (shareId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/shares/${shareId}/accept`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Decline a direct-push share */
    declineShare: async (shareId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/shares/${shareId}/decline`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Public — fetch share metadata from an invite token (no auth required) */
    getInvite: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/invite/${token}`, {
        headers: authHeaders(), // send token if present, stripped metadata if not
      });
      return handleResponse(res);
    },
    /** Authenticated — claim an invite link into the caller's compass */
    claimInvite: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/invite/${token}/claim`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    entryFeedback: async (entryId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${entryId}/feedback`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createTableShare: async (entryId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${entryId}/table-share`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
  },

  inquiries: {
    create: async (data: {
      ref_number: string;
      customer_name: string;
      customer_contact: string;
      customer_location?: string;
      notes?: string;
      items_json: string;
      total_estimate_usd: number;
      source: 'whatsapp' | 'email' | 'copy';
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    },

    getByRef: async (ref: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries/${encodeURIComponent(ref)}`);
      if (!res.ok) return null;
      return res.json();
    },

    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/inquiries`, {
        headers: authHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
    },
  },

  favorites: {
    get: async (): Promise<{ favorites: string[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/user/favorites`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    put: async (favorites: string[]): Promise<{ ok: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/user/favorites`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ favorites }),
      });
      return handleResponse(res);
    },
  },

  // ── Samples ──
  samples: {
    // Public: get a single sample (source info stripped for non-admin)
    get: async (id: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/${id}`, { headers });
      return handleResponse(res);
    },
    // Public: get all samples in a set
    getSet: async (setId: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/set/${setId}`, { headers });
      return handleResponse(res);
    },
    // Public/guest: add a tasting to a sample
    addTasting: async (sampleId: string, data: { tasting: Record<string, any>; rating?: number; verdict: string; wouldBuy: boolean; personalNote?: string; tasterName?: string }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = typeof localStorage !== 'undefined' && localStorage.getItem('teajia_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetchWithTimeout(`${API_URL}/api/samples/${sampleId}/tastings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    // Customer: request a sample
    request: async (data: { product_id: string; quantity_grams: number; note?: string; account_id?: string }): Promise<{ id: string; status: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/samples/request`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    // Admin: list all samples
    list: async (params?: { setId?: string; status?: string }) => {
      const qp = new URLSearchParams();
      if (params?.setId) qp.set('setId', params.setId);
      if (params?.status) qp.set('status', params.status);
      const qs = qp.toString();
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (sample: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(sample),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/samples/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  tastingJournal: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/tasting-journal`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    add: async (entry: any) => {
      const res = await fetchWithTimeout(`${API_URL}/api/tasting-journal`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(entry),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/tasting-journal/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    sync: async (entries: any[]) => {
      const res = await fetchWithTimeout(`${API_URL}/api/tasting-journal/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ entries }),
      });
      return handleResponse(res);
    },
  },

  xref: {
    articles: {
      list: async (articleId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/articles/${articleId}/products`, { headers: authHeaders() });
        return handleResponse(res);
      },
      link: async (articleId: string, productId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/articles/${articleId}/products`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify({ product_id: productId }),
        });
        return handleResponse(res);
      },
      unlink: async (articleId: string, productId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/articles/${articleId}/products/${productId}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        return handleResponse(res);
      },
    },
    modules: {
      list: async (moduleId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/modules/${moduleId}/products`, { headers: authHeaders() });
        return handleResponse(res);
      },
      link: async (moduleId: string, productId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/modules/${moduleId}/products`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify({ product_id: productId }),
        });
        return handleResponse(res);
      },
      unlink: async (moduleId: string, productId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/modules/${moduleId}/products/${productId}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        return handleResponse(res);
      },
    },
    projects: {
      list: async (projectId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/projects/${projectId}/products`, { headers: authHeaders() });
        return handleResponse(res);
      },
      link: async (projectId: string, productId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/projects/${projectId}/products`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify({ product_id: productId }),
        });
        return handleResponse(res);
      },
      unlink: async (projectId: string, productId: string) => {
        const res = await fetchWithTimeout(`${API_URL}/api/xref/projects/${projectId}/products/${productId}`, {
          method: 'DELETE', headers: authHeaders(),
        });
        return handleResponse(res);
      },
    },
  },

  // Public (no-auth) xref reads for Magazine / Learn / Consult colophons.
  // Returns PUBLIC_FIELDS products from the platform-owner account. Used by
  // the colophon components on public content pages.
  publicXref: {
    articles: async (articleId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/articles/${encodeURIComponent(articleId)}/products`);
      if (!res.ok) return [];
      return handleResponse(res);
    },
    modules: async (moduleId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/modules/${encodeURIComponent(moduleId)}/products`);
      if (!res.ok) return [];
      return handleResponse(res);
    },
    projects: async (projectId: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/xref/projects/${encodeURIComponent(projectId)}/products`);
      if (!res.ok) return [];
      return handleResponse(res);
    },
  },

  accounts: {
    getMine: async (): Promise<{ memberships: AccountMembership[]; active_account_id: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/me`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    switch: async (accountId: string): Promise<{ token: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/switch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await handleResponse(res);
      if (data?.token) setToken(data.token);
      return data;
    },
    get: async (id: string): Promise<Account> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${id}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Partial<Account>): Promise<Account> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    listMembers: async (id: string): Promise<AccountMember[]> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${id}/members`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    addMember: async (id: string, email: string, role: AccountRole): Promise<AccountMember> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${id}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email, role }),
      });
      return handleResponse(res);
    },
    updateMember: async (accountId: string, userId: string, role: AccountRole): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/members/${userId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ role }),
      });
      await handleResponse(res);
    },
    removeMember: async (accountId: string, userId: string): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/members/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await handleResponse(res);
    },
    updateMemberPermissions: async (accountId: string, userId: string, permissions: Record<string, boolean>): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/members/${userId}/permissions`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(permissions),
      });
      await handleResponse(res);
    },
    transferOwnership: async (accountId: string, newOwnerUserId: string): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/transfer-ownership`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
      });
      await handleResponse(res);
    },
    getFeatures: async (accountId: string): Promise<Record<string, boolean>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/features`, {
        headers: authHeaders(),
      });
      const data = await handleResponse(res);
      return (data?.features ?? data) as Record<string, boolean>;
    },
  },

  catalog: {
    list: async (): Promise<{ products: any[]; trust_tier: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/catalog`, { headers: authHeaders() });
      return handleResponse(res);
    },
    seed: async (targetAccountId: string, productIds: string[]): Promise<{ seeded: string[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/catalog/seed`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ target_account_id: targetAccountId, product_ids: productIds }),
      });
      return handleResponse(res);
    },
  },

  network: {
    /** Public list of accounts with public_enabled = true */
    getStores: async (): Promise<Array<{ id: string; slug: string; name: string; tagline?: string; logo_url?: string; location_city?: string; location_country?: string }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/network/stores`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  platform: {
    listUsers: async (): Promise<{ users: PlatformUser[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/users`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    setUserPlatformRole: async (userId: string, platform_role: import('../types').PlatformRole): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/users/${userId}/platform-role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ platform_role }),
      });
      await handleResponse(res);
    },
    listAccounts: async (): Promise<{ accounts: PlatformAccount[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    toggleFeature: async (accountId: string, feature: string, enabled: boolean): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts/${accountId}/features/${feature}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ enabled }),
      });
      await handleResponse(res);
    },
    setAccountStatus: async (accountId: string, status: 'active' | 'suspended'): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts/${accountId}/status`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }),
      });
      await handleResponse(res);
    },
    setTrustTier: async (accountId: string, trust_tier: 'basic' | 'verified' | 'partner'): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts/${accountId}/trust-tier`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ trust_tier }),
      });
      await handleResponse(res);
    },
    resendInvite: async (userId: string, account_name?: string): Promise<{ invite_link: string; email_sent: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/users/${userId}/resend-invite`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ account_name }),
      });
      return handleResponse(res);
    },
    getAuditLog: async (limit = 50, offset = 0): Promise<{ entries: AuditLogEntry[]; limit: number; offset: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/audit-log?limit=${limit}&offset=${offset}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createAccount: async (data: {
      slug: string;
      name: string;
      invoice_prefix: string;
      location_city?: string;
      location_country?: string;
      currency_default?: string;
      timezone?: string;
      whatsapp_number?: string;
      contact_email?: string;
      public_enabled?: boolean;
      owner_email?: string;
    }): Promise<{ account_id: string; slug: string; invite_link: string | null }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  sampleSets: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (set: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(set),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/sample-sets/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  notes: {
    /** Push unsynced notes (upsert + soft-deletes) */
    sync: async (notes: Record<string, unknown>[]): Promise<void> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes }),
      });
      return handleResponse(res);
    },

    /** Push unsynced sessions */
    syncSessions: async (sessions: Record<string, unknown>[]): Promise<void> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/note-sessions/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessions }),
      });
      return handleResponse(res);
    },

    /** Fetch all notes for the current account */
    getAll: async (): Promise<{ notes: Record<string, unknown>[] }> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },

    /** Fetch notes for a specific tea_key */
    forTea: async (teaKey: string): Promise<{ notes: Record<string, unknown>[] }> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes?tea_key=${encodeURIComponent(teaKey)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },

    /** Fetch notes for a compass entry (draft) */
    forCompassEntry: async (compassEntryId: string): Promise<{ notes: Record<string, unknown>[] }> => {
      const token = getToken();
      const res = await fetchWithTimeout(`${API_URL}/api/notes?compass_entry_id=${encodeURIComponent(compassEntryId)}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      return handleResponse(res);
    },
  },

  teaReviews: {
    list: async (params: {
      tea_key?: string;
      product_id?: string;
      source_sample_id?: string;
      visibility?: string;
    }) => {
      const qp = new URLSearchParams();
      if (params.tea_key) qp.set('tea_key', params.tea_key);
      if (params.product_id) qp.set('product_id', params.product_id);
      if (params.source_sample_id) qp.set('source_sample_id', params.source_sample_id);
      if (params.visibility) qp.set('visibility', params.visibility);
      const res = await fetchWithTimeout(`${API_URL}/api/tea-reviews?${qp.toString()}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (review: {
      tea_key: string;
      product_id?: string;
      source_sample_id?: string;
      visibility?: string;
      session_date?: string;
      rating?: number;
      notes?: string;
      voice_notes?: string[];
      tasting?: Record<string, unknown>;
      brew_params?: Record<string, unknown>;
      status?: 'draft' | 'submitted';
      verdict?: string;
      would_buy?: boolean;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/tea-reviews`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(review),
      });
      return handleResponse(res);
    },
    update: async (id: string, updates: {
      visibility?: string;
      session_date?: string;
      rating?: number;
      notes?: string;
      voice_notes?: string[];
      tasting?: Record<string, unknown>;
      brew_params?: Record<string, unknown>;
      status?: 'draft' | 'submitted';
      verdict?: string;
      would_buy?: boolean;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/tea-reviews/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res);
    },
    remove: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/tea-reviews/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  me: {
    profile: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/profile`, { headers: authHeaders() });
      return handleResponse(res);
    },
    queue: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/queue`, { headers: authHeaders() });
      return handleResponse(res);
    },
    wishlist: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/wishlist`, { headers: authHeaders() });
      return handleResponse(res);
    },
    journey: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/journey`, { headers: authHeaders() });
      return handleResponse(res);
    },
  },

  members: {
    search: async (q: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/members/search?q=${encodeURIComponent(q)}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  sessions: {
    create: async (data: { title?: string; entry_ids?: string[]; member_ids?: string[] }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    get: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/${id}`, { headers: authHeaders() });
      return handleResponse(res);
    },
    getByToken: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/join/${token}`);
      return handleResponse(res);
    },
    join: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/${id}/join`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
    submitVerdict: async (sessionId: string, teaId: string, data: {
      verdict?: string;
      tasting_data?: Record<string, any>;
      notes?: string;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/${sessionId}/teas/${teaId}/verdict`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    verdicts: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/${id}/verdicts`, { headers: authHeaders() });
      return handleResponse(res);
    },
    complete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/${id}/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
  },

  connections: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/connections`, { headers: authHeaders() });
      return handleResponse(res);
    },
    invite: async (data: { to_user_id: string; pending_share_id?: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/connections/invite`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    acceptInvite: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/connections/invites/${id}/accept`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
  },

  tableCard: {
    get: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/t/${token}`);
      return handleResponse(res);
    },
    submitVerdict: async (token: string, data: {
      browser_token: string;
      verdict: string;
      notes?: string;
      tasting_data?: Record<string, any>;
    }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/t/${token}/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
  },

  articles: {
    // Admin
    list: async (status?: string) => {
      const res = await fetchWithTimeout(
        `${API_URL}/api/admin/articles${status ? `?status=${status}` : ''}`,
        { headers: authHeaders() }
      );
      return handleResponse(res);
    },
    get: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/articles/${id}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/articles`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, data: Record<string, any>) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/articles/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    publish: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/articles/${id}/publish`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    unpublish: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/articles/${id}/unpublish`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    delete: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/articles/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // Public
    listPublished: async (limit = 20, offset = 0) => {
      const res = await fetchWithTimeout(
        `${API_URL}/api/articles?limit=${limit}&offset=${offset}`
      );
      return handleResponse(res);
    },
    getBySlug: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/articles/${slug}`);
      return handleResponse(res);
    },
  },

};
