import type { Account, AccountApplication, AccountKind, AccountMember, AccountMembership, AccountRole, Bundle, PlatformRole } from '../types';

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_id: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: string; // JSON string
  created_at: string;
  // account_id = the account the action targets (or NULL for platform-wide).
  // actor_account_id = the account context the actor was operating in when
  // the action fired. When these differ, the actor was acting cross-account.
  account_id?: string | null;
  actor_account_id?: string | null;
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

/** Fetch with an AbortController timeout.
 *
 *  Browsers throw a generic TypeError for any pre-response failure (DNS,
 *  CORS preflight rejection, offline, mixed-content). The .message is
 *  browser-specific and useless to surface in UI:
 *    - Safari (iOS / macOS): "Load failed"
 *    - Chrome:               "Failed to fetch"
 *    - Firefox:              "NetworkError when attempting to fetch resource"
 *  We rewrite all of those into a single clear message so the sign-in form
 *  (and every other call-site) shows something the user can act on.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    dispatchNetworkError();
    if (err?.name === 'TypeError') {
      throw new Error("Couldn't reach the server. Check your connection and try again.");
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

/** Dispatched on true network failure (offline / DNS / CORS) — not HTTP errors. Debounced to 5s. */
export const NETWORK_ERROR_EVENT = 'teajia:network-error';
let _lastNetworkErrorAt = 0;
function dispatchNetworkError() {
  const now = Date.now();
  if (now - _lastNetworkErrorAt < 5000) return;
  _lastNetworkErrorAt = now;
  window.dispatchEvent(new CustomEvent(NETWORK_ERROR_EVENT));
}

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
    deleteAccount: async (password: string): Promise<{ ok: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ password }),
      });
      return handleResponse(res);
    },
    redeemJoinCode: async (data: { code: string; first_name: string; email: string }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/join-code/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
    setFeatured: async (id: string, featured: boolean) => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}/featured`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ featured }),
      });
      return handleResponse(res);
    },
    enhanceImage: async (
      id: string,
      slot: 'main' | '1' | '2',
      prompt?: string,
    ): Promise<{ url: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/${id}/enhance-image`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ slot, prompt }),
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

  analytics: {
    revenue: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/analytics/revenue`, { headers: authHeaders() });
      return handleResponse(res);
    },
    rfm: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/rfm`, { headers: authHeaders() });
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
    /** Contact tags (admin-only freeform). Storage is lowercase. */
    listTags: async (customerId: string): Promise<string[]> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${customerId}/tags`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    addTag: async (customerId: string, tag: string): Promise<{ success: boolean; tags: string[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${customerId}/tags`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tag }),
      });
      return handleResponse(res);
    },
    addTags: async (customerId: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${customerId}/tags`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ tags }),
      });
      return handleResponse(res);
    },
    removeTag: async (customerId: string, tag: string): Promise<{ success: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customers/${customerId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Fetch customers tagged as 'vendor' (legacy field on customers.tags, distinct from contact-tags). */
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

  uploadImage: async (
    file: File | Blob,
    options?: { productId?: string; slot?: 'main' | '1' | '2'; filename?: string },
  ) => {
    const formData = new FormData();
    // Browsers default a Blob filename to "blob"; pass a real .jpg filename so
    // the worker can derive an extension for stable-key uploads.
    const filename = options?.filename ?? (file instanceof File ? file.name : 'photo.jpg');
    formData.append('file', file, filename);
    if (options?.productId) formData.append('product_id', options.productId);
    if (options?.slot) formData.append('slot', options.slot);
    const res = await fetchWithTimeout(`${API_URL}/api/upload-image`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await handleResponse(res);
    return data.url as string;
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
        show_in_guest_list: data.show_in_guest_list ? true : undefined,
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
    /** Promote a compass entry to a Draft product in the active account.
     *  Idempotent — returns the existing product if already promoted. */
    promote: async (entryId: string): Promise<{ id: string; product: Record<string, any>; alreadyPromoted: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/compass/entries/${entryId}/promote`, {
        method: 'POST',
        headers: authHeaders(),
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

    list: async (status?: string) => {
      const url = new URL(`${API_URL}/api/admin/inquiries`);
      if (status) url.searchParams.set('status', status);
      const res = await fetchWithTimeout(url.toString(), {
        headers: authHeaders(),
      });
      if (!res.ok) return { inquiries: [] };
      return res.json();
    },

    updateStatus: async (id: string, status: 'new' | 'seen' | 'replied' | 'closed') => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/inquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return null;
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

  // Public (no-auth) xref reads for Magazine / Learn / Advise colophons.
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
    getActivity: async (
      id: string,
      params: { limit?: number; offset?: number } = {}
    ): Promise<{
      entries: Array<{
        id: string;
        action: string;
        actor_id: string | null;
        actor_email: string | null;
        target_type: string | null;
        target_id: string | null;
        details: Record<string, any> | string;
        created_at: string;
      }>;
      limit: number;
      offset: number;
    }> => {
      const qs = new URLSearchParams();
      if (params.limit != null) qs.set('limit', String(params.limit));
      if (params.offset != null) qs.set('offset', String(params.offset));
      const url = `${API_URL}/api/accounts/${id}/activity${qs.toString() ? `?${qs.toString()}` : ''}`;
      const res = await fetchWithTimeout(url, { headers: authHeaders() });
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
    setCuratorFlag: async (accountId: string, userId: string, can_create_collections: boolean): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/members/${userId}/curator`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ can_create_collections }),
      });
      await handleResponse(res);
    },
    transferOwnership: async (accountId: string, newOwnerUserId: string): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/transfer-ownership`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
      });
      await handleResponse(res);
    },
    // Members & Access — roster with bundle resolution per member
    getAccess: async (accountId: string): Promise<{ members: AccountMember[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/access`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    // Members & Access — replace a member's bundles wholesale
    setMemberBundles: async (accountId: string, userId: string, bundles: Bundle[]): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/members/${userId}/bundles`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ bundles }),
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
    // BYOK: per-account OpenAI API key. Plaintext is sent over HTTPS once,
    // encrypted server-side, and never returned again.
    setOpenAIKey: async (
      accountId: string,
      apiKey: string,
    ): Promise<{ has_openai_key: boolean; openai_key_last4: string | null }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/integrations/openai-key`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ api_key: apiKey }),
      });
      return handleResponse(res);
    },
    clearOpenAIKey: async (
      accountId: string,
    ): Promise<{ has_openai_key: boolean; openai_key_last4: string | null }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/accounts/${accountId}/integrations/openai-key`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  catalog: {
    list: async (): Promise<{ products: any[]; trust_tier: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/catalog`, { headers: authHeaders() });
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

    /**
     * GET /api/network/catalog
     * Returns profiles the caller does not yet carry, with computed wholesale price.
     * Requires Catalog bundle on caller account.
     */
    catalog: async (): Promise<{ profiles: import('../types').NetworkCatalogProfile[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/network/catalog`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    /**
     * GET /api/listings/:id
     * Returns the listing row + joined tea_profile for the caller's account.
     * Requires Catalog bundle. Returns 404 if not found or not owned by caller.
     */
    getListing: async (listingId: string): Promise<{
      listing: {
        id: string; account_id: string; profile_id: string;
        stock_grams: number | null; fixed_retail_price_usd: number | null;
        store_note: string | null; listing_photos: string[];
        is_sample: boolean; status: string; created_at: string;
      };
      profile: {
        id: string; slug: string; name: string; chinese_name?: string | null;
        type?: string | null; form?: string | null;
        origin_country?: string | null; origin_region?: string | null;
        varietal?: string | null; harvest_year?: string | null;
        description?: string | null; lore?: string | null;
        processing_notes?: string | null; terroir?: string | null;
        mood?: string | null; experience?: string | null;
        image_url?: string | null; canonical_photos: string[];
        status: string; curated_by_account_id: string;
        originated_by_account_id: string; curated_by_name?: string | null;
      };
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/listings/${listingId}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    /**
     * PUT /api/listings/:id — update partner-owned listing fields
     * (stock_grams, fixed_retail_price_usd, store_note, is_sample).
     * No canonical fields. Catalog bundle required.
     */
    updateListing: async (
      listingId: string,
      patch: {
        stock_grams?: number;
        // Preferred: send price in the partner's display currency per 100g;
        // server converts to USD/gram via the exchange_rates table.
        price_amount?: number | null;
        price_currency?: string;
        // Legacy direct-USD shape; kept for backward compatibility.
        fixed_retail_price_usd?: number | null;
        store_note?: string | null;
        is_sample?: boolean;
      },
    ): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/listings/${listingId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      return handleResponse(res);
    },

    /**
     * POST /api/listings/carry
     * Creates a listing for the given profile on the caller's account.
     * Copies canonical_photos into listing_photos. Requires Catalog bundle.
     */
    carryProfile: async (
      profileId: string,
      opts: import('../types').CarryProfileOpts,
    ): Promise<import('../types').CarryProfileResult> => {
      const res = await fetchWithTimeout(`${API_URL}/api/listings/carry`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          profile_id: profileId,
          initial_price_amount: opts.initial_price_amount,
          initial_price_currency: opts.initial_price_currency,
          initial_stock_grams: opts.initial_stock_grams,
        }),
      });
      return handleResponse(res);
    },

    /**
     * POST /api/profiles/:id/suggestions
     * Partner submits a bundle of canonical edits against a tea profile.
     * fields: per-field changes the curator will review individually.
     */
    suggestEdits: async (
      profileId: string,
      fields: import('../types').ProfileSuggestionFieldDraft[],
    ): Promise<{ suggestion_id: string; field_count: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/profiles/${profileId}/suggestions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ fields }),
      });
      return handleResponse(res);
    },

    /**
     * GET /api/profiles/:id/suggestions
     * Curator-only on the profile. All bundles for one profile.
     */
    listProfileSuggestions: async (
      profileId: string,
    ): Promise<{ suggestions: import('../types').ProfileSuggestion[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/profiles/${profileId}/suggestions`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    /**
     * GET /api/suggestions/incoming
     * Curator's whole queue across all profiles they curate.
     * Default filter: pending + partial.
     */
    incomingSuggestions: async (
      status?: 'pending' | 'partial' | 'resolved' | 'withdrawn',
    ): Promise<{ suggestions: import('../types').ProfileSuggestion[] }> => {
      const url = new URL(`${API_URL}/api/suggestions/incoming`);
      if (status) url.searchParams.set('status', status);
      const res = await fetchWithTimeout(url.toString(), { headers: authHeaders() });
      return handleResponse(res);
    },

    /**
     * POST /api/suggestions/:id/decide
     * Per-field accept/reject. Accepted fields write to canonical immediately.
     */
    decideSuggestion: async (
      suggestionId: string,
      decisions: import('../types').ProfileSuggestionDecision[],
    ): Promise<{ suggestion_id: string; bundle_status: string; decisions_recorded: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/suggestions/${suggestionId}/decide`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ decisions }),
      });
      return handleResponse(res);
    },

    /** POST /api/network/profiles/:id/suggest-for-network — partner flags own profile */
    suggestForNetwork: async (profileId: string, note?: string): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/network/profiles/${profileId}/suggest-for-network`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ note }),
      });
      return handleResponse(res);
    },

    /** GET /api/network/adoption-queue?status=pending|adopted|declined — Platform tier */
    adoptionQueue: async (
      status: 'pending' | 'adopted' | 'declined' = 'pending',
    ): Promise<{ profiles: import('../types').AdoptionQueueEntry[] }> => {
      const url = new URL(`${API_URL}/api/network/adoption-queue`);
      url.searchParams.set('status', status);
      const res = await fetchWithTimeout(url.toString(), { headers: authHeaders() });
      return handleResponse(res);
    },

    /** POST /api/network/profiles/:id/adopt — Platform tier decides */
    decideAdoption: async (
      profileId: string,
      decision: 'adopted' | 'declined',
      decline_note?: string,
    ): Promise<{ ok: true; decision: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/network/profiles/${profileId}/adopt`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ decision, decline_note }),
      });
      return handleResponse(res);
    },
  },

  /** Wholesale orders (Step 4) — cross-account transactional layer. */
  wholesale: {
    /** POST /api/wholesale/orders — buyer creates a draft. */
    createOrder: async (
      body: import('../types').WholesaleOrderCreateBody,
    ): Promise<{ order_id: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/wholesale/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      return handleResponse(res);
    },

    /** GET /api/wholesale/orders — list with optional role + status filters. */
    listOrders: async (
      opts: { role?: 'buyer' | 'supplier'; status?: import('../types').WholesaleOrderStatus } = {},
    ): Promise<{ orders: import('../types').WholesaleOrderSummary[] }> => {
      const url = new URL(`${API_URL}/api/wholesale/orders`);
      if (opts.role) url.searchParams.set('role', opts.role);
      if (opts.status) url.searchParams.set('status', opts.status);
      const res = await fetchWithTimeout(url.toString(), { headers: authHeaders() });
      return handleResponse(res);
    },

    /** GET /api/wholesale/orders/:id — detail + items + party accounts. */
    getOrder: async (orderId: string): Promise<import('../types').WholesaleOrderDetail> => {
      const res = await fetchWithTimeout(`${API_URL}/api/wholesale/orders/${orderId}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },

    /** PUT /api/wholesale/orders/:id — buyer edits draft (or replied). */
    updateOrder: async (
      orderId: string,
      patch: import('../types').WholesaleOrderUpdateBody,
    ): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/wholesale/orders/${orderId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      return handleResponse(res);
    },

    /** POST /api/wholesale/orders/:id/transition — single dispatch for status changes. */
    transition: async (
      orderId: string,
      transition: import('../types').WholesaleTransitionBody,
    ): Promise<{ ok: true; status: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/wholesale/orders/${orderId}/transition`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(transition),
      });
      return handleResponse(res);
    },

    /** POST /api/wholesale/orders/:id/nudge — buyer reminds supplier. 24h throttle. */
    nudge: async (orderId: string): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/wholesale/orders/${orderId}/nudge`, {
        method: 'POST',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
  },

  /** Account-wide contact tag queries (autocomplete + tag-aware picker). */
  customerTags: {
    listAll: async (): Promise<Array<{ tag: string; count: number }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customer-tags`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    customersByTag: async (tag: string): Promise<Array<{ id: string; name: string; phone?: string; whatsapp?: string }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customer-tags/${encodeURIComponent(tag)}/customers`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Rename or merge a tag account-wide. Pass renameTo='' to delete everywhere. */
    rename: async (tag: string, renameTo: string): Promise<{ success: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/customer-tags/${encodeURIComponent(tag)}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ rename_to: renameTo }),
      });
      return handleResponse(res);
    },
  },

  collections: {
    list: async (opts?: { status?: 'draft' | 'active' | 'archived'; productId?: string }): Promise<{ collections: import('../types').CollectionListRow[] }> => {
      const qs = new URLSearchParams();
      if (opts?.status) qs.set('status', opts.status);
      if (opts?.productId) qs.set('product_id', opts.productId);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const res = await fetchWithTimeout(`${API_URL}/api/collections${suffix}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    get: async (id: string): Promise<import('../types').CollectionDetail> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    create: async (data: { title: string; note?: string; hero_image_url?: string; initial_product_ids?: string[] }): Promise<{ id: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    update: async (id: string, patch: Partial<{ title: string; note: string | null; hero_image_url: string | null; status: 'draft' | 'active' | 'archived' }>): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      return handleResponse(res);
    },
    addItems: async (id: string, productIds: string[]): Promise<{ added: number; skipped: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/items`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ product_ids: productIds }),
      });
      return handleResponse(res);
    },
    removeItem: async (id: string, itemId: string): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    reorderItem: async (id: string, itemId: string, direction: 'up' | 'down'): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ direction }),
      });
      return handleResponse(res);
    },
    publish: async (id: string, recipients: import('../types').CollectionRecipient[]): Promise<{ id: string; slug: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ target_type: 'person', recipients }),
      });
      return handleResponse(res);
    },
    publishToStore: async (id: string, targetAccountId: string): Promise<{ id: string; slug: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ target_type: 'store', target_id: targetAccountId }),
      });
      return handleResponse(res);
    },
    publishToTag: async (id: string, tag: string): Promise<{ id: string; slug: string }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ target_type: 'tag', target_id: tag }),
      });
      return handleResponse(res);
    },
    recentRecipients: async (days = 90, limit = 6): Promise<Array<{ customer_id: string; name: string; phone?: string; last_published_at: string }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collection-publications/recent-recipients?days=${days}&limit=${limit}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    listInbound: async (): Promise<{ inbound: import('../types').InboundCollectionRow[]; unread_count: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/inbound`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    getInbound: async (pubId: string): Promise<import('../types').InboundCollectionDetail> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/inbound/${pubId}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    importInbound: async (pubId: string, productIds: string[]): Promise<{ imported: Array<{ source_id: string; new_id: string }>; skipped: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/inbound/${pubId}/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ product_ids: productIds }),
      });
      return handleResponse(res);
    },
    unpublish: async (id: string, pubId: string): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${id}/publications/${pubId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    needsAttention: async (): Promise<{ items: import('../types').NeedsAttentionItem[] }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/needs-attention`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    /** Public — no auth. Used by /c/:slug page. */
    getPublic: async (slug: string): Promise<import('../types').PublicCollectionResponse> => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/c/${slug}`, {});
      return handleResponse(res);
    },
    trackPublicView: async (slug: string): Promise<void> => {
      await fetchWithTimeout(`${API_URL}/api/public/c/${slug}/view`, { method: 'POST' });
    },
    /** Publish a collection to the shop audience. Idempotent. */
    publishToShop: async (collectionId: string): Promise<{ publication: import('../types').CollectionPublication; created: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${collectionId}/publish-shop`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
    /** Remove a collection from the shop audience. */
    unpublishFromShop: async (collectionId: string): Promise<{ ok: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/${collectionId}/unpublish-shop`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
    /** Public — no auth. Returns the 20 most recently shop-published collections. */
    publicShop: async (): Promise<import('../types').PublicShopCollectionsResponse> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/shop`, {});
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
    getAuditLog: async (
      opts: { limit?: number; offset?: number; account_id?: string; actor_id?: string; action?: string } = {}
    ): Promise<{ entries: AuditLogEntry[]; limit: number; offset: number }> => {
      const params = new URLSearchParams();
      params.set('limit', String(opts.limit ?? 50));
      params.set('offset', String(opts.offset ?? 0));
      if (opts.account_id) params.set('account_id', opts.account_id);
      if (opts.actor_id) params.set('actor_id', opts.actor_id);
      if (opts.action) params.set('action', opts.action);
      const res = await fetchWithTimeout(`${API_URL}/api/platform/audit-log?${params.toString()}`, {
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
    // ── Members & Access (Platform tier) ────────────────────────────────────
    listApplications: async (
      filters: { status?: AccountApplication['status']; kind?: 'location' | 'master' } = {}
    ): Promise<{ applications: AccountApplication[] }> => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.kind) params.set('kind', filters.kind);
      const qs = params.toString();
      const res = await fetchWithTimeout(`${API_URL}/api/platform/applications${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    decideApplication: async (
      applicationId: string,
      decision: 'approve' | 'decline',
      opts: { decision_note?: string; trust_tier?: 'basic' | 'verified' | 'partner' } = {}
    ): Promise<{ success: true; account_id?: string; user_id?: string; claim_link?: string | null }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/applications/${applicationId}/decide`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ decision, ...opts }),
      });
      return handleResponse(res);
    },
    inviteTeaMaster: async (
      data: { email: string; name?: string; note?: string }
    ): Promise<{ success: true; account_id: string; user_id: string; claim_link: string | null; email_sent: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/tea-masters/invite`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    upgradeToLocation: async (
      accountId: string,
      data: { location_name?: string; location_city?: string; location_country?: string; timezone?: string } = {}
    ): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts/${accountId}/upgrade-to-location`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(data),
      });
      await handleResponse(res);
    },
    suspendAccount: async (accountId: string, reason?: string): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts/${accountId}/suspend`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ reason }),
      });
      await handleResponse(res);
    },
    reactivateAccount: async (accountId: string, note?: string): Promise<void> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/accounts/${accountId}/reactivate`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ note }),
      });
      await handleResponse(res);
    },

    // Exchange-rate admin (Platform tier only).
    listExchangeRates: async (): Promise<{
      rates: Array<{ currency: string; rate_to_usd: number; last_updated: string | null; usage_count: number }>;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/exchange-rates`, {
        headers: authHeaders(),
      });
      return handleResponse(res);
    },
    createExchangeRate: async (data: { currency: string; rate_to_usd: number }): Promise<{
      success: true; currency: string; rate_to_usd: number;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/exchange-rates`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    updateExchangeRate: async (currency: string, rate_to_usd: number): Promise<{
      success: true; currency: string; rate_to_usd: number;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/exchange-rates/${encodeURIComponent(currency)}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ rate_to_usd }),
      });
      return handleResponse(res);
    },
    deleteExchangeRate: async (currency: string): Promise<{ success: true }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/platform/exchange-rates/${encodeURIComponent(currency)}`, {
        method: 'DELETE', headers: authHeaders(),
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
    list: async (params?: { status?: 'active' | 'completed'; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.limit) qs.set('limit', String(params.limit));
      const url = `${API_URL}/api/sessions${qs.toString() ? `?${qs.toString()}` : ''}`;
      const res = await fetchWithTimeout(url, { headers: authHeaders() });
      return handleResponse(res);
    },
    create: async (data: { title?: string; entry_ids?: string[]; product_ids?: string[]; member_ids?: string[] }) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res);
    },
    issueJoinCode: async (sessionId: string): Promise<{ code: string; expires_at: string; reused?: boolean }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/join-code/issue`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      });
      return handleResponse(res);
    },
    revokeJoinCode: async (code: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/join-code/${code}/revoke`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      return handleResponse(res);
    },
    hostLive: async (id: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/${id}/host-live`, { headers: authHeaders() });
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
      would_buy?: boolean;
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

  people: {
    list: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/people`);
      return handleResponse(res);
    },
    getBySlug: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/people/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
  },

};
