import type { Account, AccountApplication, AccountKind, AccountMember, AccountMembership, AccountRole, Bundle, DbArticle, PlatformRole } from '../types';
import type { CompassDecision, CurateJourney, CurateVisit } from '../components/TeaCompass/types';

type CompassWrite = Record<string, unknown> & { decision?: CompassDecision | null };
export interface CompassSyncResult {
  synced: number;
  syncedIds: string[];
  conflicts: string[];
}

export type CurateImportSourceKind = 'wechat' | 'invoice' | 'vendor_list' | 'photo' | 'file' | 'paste';
export interface CurateImportSource {
  id: string; batch_id: string; kind: CurateImportSourceKind;
  pasted_text: string | null; r2_object_key: string | null; metadata: Record<string, unknown>;
}
export interface CurateImportItem {
  id: string; batch_id: string; position: number; category: 'tea' | 'teaware';
  name: string | null; raw_text: string | null; parsed_data: Record<string, unknown>;
  confidence: number | null; uncertainty: Record<string, unknown>;
  review_state: 'pending' | 'reviewing' | 'accepted' | 'merged' | 'abandoned';
  compass_entry_id: string | null;
}
export interface CurateImportBatch {
  id: string; title: string; review_state: 'pending' | 'reviewing' | 'completed' | 'abandoned';
  journey_id: string | null; visit_id: string | null;
}
export interface CurateImportDetail { batch: CurateImportBatch; sources: CurateImportSource[]; items: CurateImportItem[] }

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
  shelf_enabled?: boolean;   // stock spine step 5 — public shelf granted
  shelf_slug?: string | null;
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

// Stock spine step 3 — one row of the all-locations master view (the movement).
export interface PlatformStockRow {
  id: string;
  type: string;
  given_name: string | null;
  product_name: string | null;
  chinese_name: string | null;
  year: number | null;
  origin_country: string | null;
  origin_region: string | null;
  stock_grams: number | null;
  quantity_units: number | null;
  status: string;
  is_public: number;
  shown_in_shop: number;
  image_url: string | null;
  fixed_retail_price_usd: number | null;
  created_at: string;
  account_id: string;
  account_name: string;
  account_slug: string;
  location_city: string | null;
  location_country: string | null;
  is_platform_owner: number;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
}

// Stock spine step 4 — one item in a user's personal cellar.
export interface CellarItem {
  id: string;
  name: string;
  type?: string | null;
  year?: number | null;
  origin?: string | null;
  notes?: string | null;
  grams: number;
  imageUrl?: string | null;
  placementStatus: 'private' | 'requested' | 'placed';
  placementAccountId?: string | null;
  linkedProductId?: string | null;
  shelfPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CellarPlacementRequest extends CellarItem {
  ownerName?: string | null;
  ownerEmail?: string | null;
}

// Stock spine step 5 — the seller's own shelf settings (grant state + identity).
export interface ShelfSettings {
  enabled: boolean;
  slug: string | null;
  title: string | null;
  whatsapp: string | null;
}

// One item on a public shelf — public-safe fields only.
export interface PublicShelfItem {
  id: string;
  name: string;
  type: string | null;
  year: number | null;
  origin: string | null;
  grams: number;
  image_url: string | null;
}

export interface PublicShelf {
  slug: string;
  title: string | null;
  seller_name: string | null;
  whatsapp: string | null;
  items: PublicShelfItem[];
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

// Production talks to the API on the app's OWN origin (teajia.com /
// www.teajia.com), NOT a dedicated api.* host. The custom domain api.teajia.com
// — like *.workers.dev — is blocked/reset by the Great Firewall, so anything
// pointed at it silently fails in mainland China (sign-in, photo upload,
// transcription, compass sync) even though the site itself loads fine. The
// `teajia.com/api/*` path is served by a Cloudflare Pages Function
// (functions/api/[[path]].ts) that forwards to the Worker edge-side, so calls
// ride the one hostname that stays reachable in China. Using the live origin
// (rather than a bare '') keeps API_URL truthy so the "Continue with Google"
// surfaces still render. Dev honors VITE_API_URL to target a local/workers.dev API.
export const API_URL = import.meta.env.PROD
  ? (typeof window !== 'undefined' ? window.location.origin : 'https://www.teajia.com')
  : (import.meta.env.VITE_API_URL || '');
const REQUEST_TIMEOUT_MS = 30_000;

// Public base URL for share links (collection links sent to recipients). These
// must point at the deployed customer site, NOT wherever the admin happens to be
// browsing — a `localhost` link is useless (and breaks over https in dev). In
// production window.location.origin is already correct; in local dev we fall
// back to the live site so a copied link actually works when sent.
const PUBLIC_SITE_URL: string = (() => {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '');
  if (configured) return configured;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (/localhost|127\.0\.0\.1/.test(origin)) return 'https://teajia.com';
  return origin;
})();

/** Build a public collection share link from a publication slug. */
export function collectionShareUrl(slug: string): string {
  return `${PUBLIC_SITE_URL}/c/${slug}`;
}

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
  _invalidateClaimsCache();
}

export function clearToken() {
  try { localStorage.removeItem('teajia_token'); } catch { /* ignore */ }
  try { sessionStorage.removeItem('teajia_token'); } catch { /* ignore */ }
  _invalidateClaimsCache();
}

export function hasToken(): boolean {
  return !!getToken();
}

// ── Decoded-claims cache ──────────────────────────────────────────────────
// Decoding the JWT payload on every request (authHeaders is called for every
// authenticated fetch) is wasteful. We cache the decoded object in module
// scope and invalidate it whenever the token changes (setToken / clearToken /
// after a successful refresh). The cache is keyed implicitly — any token
// change calls _invalidateClaimsCache() so the next getDecodedClaims() call
// re-decodes from the new token.
let _cachedClaims: Record<string, unknown> | null = null;

function _invalidateClaimsCache() {
  _cachedClaims = null;
}

/** Return decoded JWT claims from the module-level cache (or decode on first call). */
function getDecodedClaims(): Record<string, unknown> | null {
  if (_cachedClaims !== null) return _cachedClaims;
  const token = getToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    _cachedClaims = decoded;
    return decoded;
  } catch {
    return null;
  }
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
  // sent; if the server says 401 we attempt a refresh (authedFetch). If
  // the refresh also fails, only then do we clear. Background refreshes are
  // scheduled by `maybeScheduleBackgroundRefresh` when we're inside the
  // threshold.
  maybeScheduleBackgroundRefresh();
  const currentToken = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    // Inject active account header from the JWT's active_account_id claim.
    // Reading directly from the decoded JWT avoids a Zustand hydration race:
    // if the store hasn't initialised yet the header would silently be absent,
    // causing every early API call to hit the wrong account context.
    const claims = getDecodedClaims();
    const activeAccountId = typeof claims?.active_account_id === 'string' ? claims.active_account_id : null;
    if (activeAccountId) {
      headers['X-Teajia-Account'] = activeAccountId;
    } else {
      // JWT doesn't carry active_account_id (e.g. very old token shape) —
      // fall back to Zustand state. Log so we know it happened.
      try {
        const storeAccountId = useAppStore.getState().activeAccountId;
        if (storeAccountId) {
          console.warn('[api] X-Teajia-Account: JWT claim absent, falling back to Zustand state');
          headers['X-Teajia-Account'] = storeAccountId;
        }
      } catch { /* store not ready — header omitted */ }
    }
  }
  return headers;
}

const PRODUCT_CATALOG_UPDATE_FIELDS = new Set([
  'product_name', 'given_name', 'chinese_name', 'type', 'form', 'origin', 'origin_country',
  'origin_region', 'year', 'harvest', 'altitude', 'cultivar', 'processing', 'format',
  'material', 'capacity_ml', 'teaware_category', 'description', 'notes', 'tags', 'moods',
  'tasting_notes', 'brewing_notes', 'tasting', 'tasting_source', 'lore', 'processing_notes',
  'terroir', 'mood', 'experience', 'image_url', 'additional_images', 'bag_photo_url', 'quantity_units',
  'tea_key', 'source_compass_entry_id',
]);

const PRODUCT_STOCK_UPDATE_FIELDS = new Set([
  'stock', 'stock_unit', 'stock_grams', 'low_stock_threshold', 'recheck_stock',
  'stock_verified_at', 'in_transit', 'in_transit_grams', 'in_transit_eta',
  'session_reserve_grams',
]);

const PRODUCT_COMMERCIAL_UPDATE_FIELDS = new Set([
  'price', 'cost', 'cost_amount', 'cost_currency', 'shipping_rate_per_kg',
  'quantity_purchased', 'markup_multiplier', 'fixed_retail_price_usd',
  'price_per_gram_usd', 'wholesale_price', 'vendor', 'vendor_id', 'vendor_url',
  'can_reorder',
]);

const PRODUCT_PUBLICATION_UPDATE_FIELDS = new Set([
  'status', 'is_public', 'catalog_visible', 'is_featured', 'is_curated',
  'show_wisdom', 'is_custom_wisdom', 'is_personal', 'is_sample', 'sold_out_at',
]);

function splitProductUpdateByDomain(data: Record<string, any>): {
  catalog: Record<string, any>;
  stock: Record<string, any>;
  commercial: Record<string, any>;
  publication: Record<string, any>;
  legacy: Record<string, any>;
} {
  const groups = {
    catalog: {} as Record<string, any>,
    stock: {} as Record<string, any>,
    commercial: {} as Record<string, any>,
    publication: {} as Record<string, any>,
    legacy: {} as Record<string, any>,
  };

  for (const [key, value] of Object.entries(data)) {
    if (PRODUCT_CATALOG_UPDATE_FIELDS.has(key)) groups.catalog[key] = value;
    else if (PRODUCT_STOCK_UPDATE_FIELDS.has(key)) groups.stock[key] = value;
    else if (PRODUCT_COMMERCIAL_UPDATE_FIELDS.has(key)) groups.commercial[key] = value;
    else if (PRODUCT_PUBLICATION_UPDATE_FIELDS.has(key)) groups.publication[key] = value;
    else groups.legacy[key] = value;
  }

  return groups;
}

async function putProductUpdate(id: string, suffix: string, data: Record<string, any>) {
  return authedFetch(`${API_URL}/api/products/${id}${suffix}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function updateProductByDomain(id: string, data: Record<string, any>) {
  const groups = splitProductUpdateByDomain(data);
  let result: any = { success: true };
  if (Object.keys(groups.catalog).length > 0) result = await putProductUpdate(id, '/catalog', groups.catalog);
  if (Object.keys(groups.stock).length > 0) result = await putProductUpdate(id, '/stock', groups.stock);
  if (Object.keys(groups.commercial).length > 0) result = await putProductUpdate(id, '/commercial', groups.commercial);
  if (Object.keys(groups.publication).length > 0) result = await putProductUpdate(id, '/publication', groups.publication);
  // Preserve compatibility for fields that the broad legacy endpoint already
  // accepts or safely ignores while callers are migrated field by field.
  if (Object.keys(groups.legacy).length > 0) result = await putProductUpdate(id, '', groups.legacy);
  return result;
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
// Transient network failures surface as a `fetch` TypeError (DNS hiccup, TLS
// reset, momentary offline). In mainland China the most common cause is the
// GFW resetting a Cloudflare connection mid-handshake — the API is reachable
// only in short, jumpy windows. A single-shot request (or one fast retry) lands
// in a block window and turns into a hard "couldn't reach the server" even
// though the server is up. So we retry network errors several times with
// exponential backoff + jitter, and — when the browser reports itself offline —
// wait for the `online` event so the request fires the instant the connection
// returns instead of burning the attempt on a guaranteed failure.
// HTTP errors (4xx/5xx) are NOT retried — they come back as a resolved Response,
// never a thrown TypeError, so they skip this path entirely.
const NETWORK_RETRY_BACKOFF_MS = [600, 1800, 4000, 7000];

// The GFW's other failure mode is a BLACKHOLED connection: no reset, the
// request just hangs until our own abort fires. Those aborts used to surface
// immediately as "Request timed out" with no second chance — the dominant
// failure Adrian hit in China. Idempotent calls (GET/HEAD automatically, plus
// writes that opt in via `retryTimeouts`, e.g. compass sync/delete which are
// INSERT OR REPLACE / DELETE-by-id on the worker) now get a shorter
// per-attempt budget and up to two fresh connections instead of one 30s hang.
// Non-idempotent writes keep the old single-shot behavior — a timed-out
// request may still have reached the server, and e.g. invoice creation must
// not double-fire.
const TIMEOUT_RETRY_MAX = 2;
const TIMEOUT_RETRY_ATTEMPT_MS = 15_000;

/** RequestInit + our retry opt-in. The extra key is ignored by fetch(). */
export interface ApiRequestInit extends RequestInit { retryTimeouts?: boolean }

/** Resolve once the browser reports it's back online, or after `maxMs` elapses. */
function waitForReconnect(maxMs: number): Promise<void> {
  if (typeof window === 'undefined' || navigator.onLine !== false) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('online', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, maxMs);
    window.addEventListener('online', finish);
  });
}

async function fetchWithTimeout(url: string, options: ApiRequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const retryTimeouts = options.retryTimeouts ?? (method === 'GET' || method === 'HEAD');
  // When timeouts are retryable, fail each attempt fast and try a fresh
  // connection; a blackholed socket never recovers by waiting longer.
  const attemptTimeoutMs = retryTimeouts ? TIMEOUT_RETRY_ATTEMPT_MS : REQUEST_TIMEOUT_MS;
  let timeoutRetries = 0;
  let lastErr: any;
  for (let attempt = 0; attempt <= NETWORK_RETRY_BACKOFF_MS.length; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      lastErr = err;
      // Our own timeout aborts share the AbortError name.
      const isTimeout = err?.name === 'AbortError';
      if (isTimeout && (!retryTimeouts || timeoutRetries >= TIMEOUT_RETRY_MAX)) {
        dispatchNetworkError();
        throw new Error('Request timed out. Please try again.');
      }
      const isNetworkError = err?.name === 'TypeError';
      if ((isNetworkError || isTimeout) && attempt < NETWORK_RETRY_BACKOFF_MS.length) {
        clearTimeout(timeoutId);
        if (isTimeout) {
          // The old connection already burned 15s — retry near-immediately on
          // a fresh one rather than adding backoff on top.
          timeoutRetries++;
          await new Promise(resolve => setTimeout(resolve, 300));
          continue;
        }
        const base = NETWORK_RETRY_BACKOFF_MS[attempt];
        const delay = Math.round(base * (0.7 + Math.random() * 0.6)); // ±30% jitter
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          // Flat offline: wait (capped) for the connection to return, then
          // retry immediately rather than sleeping through a dead window.
          await waitForReconnect(Math.max(delay, 10_000));
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        continue;
      }
      dispatchNetworkError();
      if (isTimeout) {
        throw new Error('Request timed out. Please try again.');
      }
      if (isNetworkError) {
        throw new Error("Couldn't reach the server. Check your connection and try again.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  // Loop only exits via return/throw above; this satisfies the type checker.
  throw lastErr;
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
    // Detect account access denial — clear active account and prompt UI reload.
    // (401 refresh + retry is handled in authedFetch before this is called.)
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

/**
 * Authenticated fetch wrapper — the standard path for all API calls that
 * require a JWT. Injects auth headers automatically (including
 * X-Teajia-Account derived from the JWT claim), and implements one-shot
 * retry on 401 so callers never see a "refresh succeeded but this call
 * failed" error.
 *
 * Retry flow:
 *   1. Send request with current token.
 *   2. On 401 (+ token present + not a 'no_token' bug): trigger
 *      ensureTokenRefreshed().
 *      - 'refreshed' → retry once with the new token. If the retry also
 *        401s, give up and surface SESSION_EXPIRED.
 *      - 'rejected'  → token is dead; clear it, fire SESSION_EXPIRED, throw.
 *      - 'network_error' → transient; keep token, throw the original error.
 *   3. On retry success → return result transparently.
 *
 * The retry is not recursive — on 401 the second attempt goes straight to
 * handleResponse, which throws if the fresh token is also rejected.
 */
/** Auth headers adjusted for the request body. FormData bodies MUST NOT carry
 *  our default `Content-Type: application/json` — with an explicit header the
 *  browser can't append the multipart boundary, and the worker hard-rejects
 *  non-multipart uploads with 400. This single header bug broke every
 *  `api.uploadImage` call (photo capture, vendor photos, teaware, ledger). */
function authHeadersFor(body: BodyInit | null | undefined): Record<string, string> {
  const headers = authHeaders();
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    delete headers['Content-Type'];
  }
  return headers;
}

async function authedFetch(url: string, init: ApiRequestInit = {}): Promise<any> {
  const opts: ApiRequestInit = { ...init, headers: authHeadersFor(init.body) };
  const res = await fetchWithTimeout(url, opts);

  if (res.status === 401 && hasToken()) {
    // Read the body once here — the Response body stream can only be consumed
    // once, so we capture it before branching on the refresh result.
    let bodyData: any;
    try { bodyData = JSON.parse(await res.text()); } catch { /* ignore */ }
    const reason = bodyData?.reason as string | undefined;

    // 'no_token' means the server got no Authorization header — a client-side
    // bug, not an expired session. Refreshing would be pointless and could
    // falsely fire SESSION_EXPIRED.
    if (reason !== 'no_token') {
      const refreshResult = await ensureTokenRefreshed();
      if (refreshResult === 'refreshed') {
        // New token stored — retry ONCE with fresh auth headers.
        // The second call goes straight to handleResponse; there is no further
        // retry (the retry itself throws on 401, which surfaces SESSION_EXPIRED
        // correctly if the fresh token is also rejected).
        const retryRes = await fetchWithTimeout(url, { ...init, headers: authHeadersFor(init.body) });
        return handleResponse(retryRes);
      }
      if (refreshResult === 'rejected') {
        clearToken();
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
      // 'network_error': fall through and surface the original 401 error.
    }

    // Reconstruct a typed error from the already-consumed body so
    // handleResponse does not try to re-read the drained response stream.
    const message = typeof bodyData?.error === 'string' && bodyData.error.length < 200
      ? bodyData.error
      : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return handleResponse(res);
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
    store.setActiveUserId(claims.sub);
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
  // Working Feature Guide — admin-only internal build tracker.
  featureStatus: {
    /** Map of feature_id → { stage, works, tested, visual, notes, updated_at }. */
    list: async (): Promise<Record<string, {
      stage: string; works: string; tested: boolean; visual: string; notes: string; updated_at: string;
    }>> => authedFetch(`${API_URL}/api/admin/feature-status`),
    /** Partial upsert — only the fields you pass change. */
    save: async (feature_id: string, patch: {
      stage?: string; works?: string; tested?: boolean; visual?: string; notes?: string;
    }) => authedFetch(`${API_URL}/api/admin/feature-status`, {
      method: 'POST',
      body: JSON.stringify({ feature_id, ...patch }),
    }),
  },
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
      return authedFetch(`${API_URL}/api/auth/me`)
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      return authedFetch(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    updateProfile: async (data: { name?: string; email?: string; username?: string | null; phone?: string }) => {
      return authedFetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    requestAdmin: async () => {
      return authedFetch(`${API_URL}/api/auth/request-admin`, {
        method: 'POST',
      });
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
      return authedFetch(`${API_URL}/api/auth/verify-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
    deleteAccount: async (password: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/auth/account`, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
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
      return authedFetch(`${API_URL}/api/admin/users`)
    },
    updateRole: async (userId: string, data: { role?: string; admin_request_status?: string }) => {
      return authedFetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (userId: string) => {
      return authedFetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },
    createResetToken: async (userId: string) => {
      return authedFetch(`${API_URL}/api/admin/reset-token`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    },
  },

  products: {
    list: async () => {
      return authedFetch(`${API_URL}/api/products`)
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/products/public`);
      return handleResponse(res);
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/products`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    bulkCreate: async (products: Record<string, any>[], batchId?: string) => {
      return authedFetch(`${API_URL}/api/products/bulk`, {
        method: 'POST',
        body: JSON.stringify({ products, batch_id: batchId }),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    updateByDomain: updateProductByDomain,
    updateCatalog: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/catalog', data);
    },
    updateStock: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/stock', data);
    },
    updateCommercial: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/commercial', data);
    },
    updatePublication: async (id: string, data: Record<string, any>) => {
      return putProductUpdate(id, '/publication', data);
    },
    // Stock spine step 2 — flip the location-owner curation gate. Owner-tier only
    // (server enforces requireOwnerTier); a staff seller cannot show their own tea.
    updateShown: async (id: string, shown: boolean) => {
      return putProductUpdate(id, '/shown', { shown_in_shop: shown });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
      });
    },
    getEvents: async (id: string) => {
      return authedFetch(`${API_URL}/api/products/${id}/events`)
    },
    setFeatured: async (id: string, featured: boolean) => {
      return authedFetch(`${API_URL}/api/products/${id}/featured`, {
        method: 'POST',
        body: JSON.stringify({ featured }),
      });
    },
    enhanceImage: async (
      id: string,
      slot: 'main' | '1' | '2' | 'bag',
      prompt?: string,
    ): Promise<{ url: string }> => {
      return authedFetch(`${API_URL}/api/products/${id}/enhance-image`, {
        method: 'POST',
        body: JSON.stringify({ slot, prompt }),
      });
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
      return authedFetch(`${API_URL}/api/invoices?${params}`)
    },
    create: async (invoice: Record<string, any>, lineItems: Record<string, any>[]) => {
      return authedFetch(`${API_URL}/api/invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice, lineItems }),
      });
    },
    getItems: async (id: string) => {
      return authedFetch(`${API_URL}/api/invoices/${id}/items`)
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    updateItems: async (id: string, data: { lineItems?: { product_id?: string | null; custom_name?: string | null; quantity: number; price_at_sale: number }[]; shipping_cost_usd?: number; customer_name?: string; notes?: string }) => {
      return authedFetch(`${API_URL}/api/invoices/${id}/items`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/invoices/${id}`, {
        method: 'DELETE',
      });
    },
  },

  analytics: {
    revenue: async () => {
      return authedFetch(`${API_URL}/api/analytics/revenue`);
    },
    rfm: async () => {
      return authedFetch(`${API_URL}/api/customers/rfm`);
    },
  },

  customers: {
    list: async (type?: 'customer' | 'supplier', relationship?: string) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (relationship) params.set('relationship', relationship);
      const query = params.toString();
      const url = query ? `${API_URL}/api/customers?${query}` : `${API_URL}/api/customers`;
      return authedFetch(url)
    },
    get: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}`)
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/customers`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      // PUT by id — idempotent, safe to retry through a GFW timeout (vendor
      // photo/location saves from the Compass ride this).
      return authedFetch(`${API_URL}/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        retryTimeouts: true,
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}`, {
        method: 'DELETE',
      });
    },
    getOrders: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/orders`)
    },
    getTeas: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/teas`)
    },
    getEvents: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/events`)
    },
    getSuppliedProducts: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/products`)
    },
    getRelationships: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/relationships`)
    },
    updateRelationships: async (id: string, relationshipKinds: string[]) => {
      return authedFetch(`${API_URL}/api/customers/${id}/relationships`, {
        method: 'PUT',
        body: JSON.stringify({ relationship_kinds: relationshipKinds }),
      });
    },
    getPrivateNotes: async (id: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/private-notes`)
    },
    updatePrivateNotes: async (id: string, body: string) => {
      return authedFetch(`${API_URL}/api/customers/${id}/private-notes`, {
        method: 'PUT',
        body: JSON.stringify({ body }),
      });
    },
    linkProduct: async (vendorId: string, productId: string) => {
      return authedFetch(`${API_URL}/api/customers/${vendorId}/products`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
      });
    },
    unlinkProduct: async (vendorId: string, productId: string) => {
      return authedFetch(`${API_URL}/api/customers/${vendorId}/products/${productId}`, {
        method: 'DELETE',
      });
    },
    /** Contact tags (admin-only freeform). Storage is lowercase. */
    listTags: async (customerId: string): Promise<string[]> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags`)
    },
    addTag: async (customerId: string, tag: string): Promise<{ success: boolean; tags: string[] }> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag }),
      });
    },
    addTags: async (customerId: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tags }),
      });
    },
    removeTag: async (customerId: string, tag: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/customers/${customerId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      });
    },
    /** Fetch customers tagged as 'vendor' (legacy field on customers.tags, distinct from contact-tags). */
    fetchVendors: async (): Promise<Array<{ id: string; name: string; country?: string; tags?: string }>> => {
      const data = await authedFetch(`${API_URL}/api/customers`)
      const list = Array.isArray(data) ? data : (data?.customers ?? []);
      return list.filter((c: { tags?: string | string[] }) => {
        const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : []);
        return tags.includes('vendor') || tags.includes('Vendor');
      });
    },
  },

  rpc: {
    fulfillInvoice: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/fulfill-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    voidInvoice: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/void-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    splitInvoice: async (invoiceId: string, lineItemIds: string[]) => {
      return authedFetch(`${API_URL}/api/rpc/split-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId, line_item_ids: lineItemIds }),
      });
    },
    incrementStock: async (productId: string, amount: number, batchId?: string) => {
      return authedFetch(`${API_URL}/api/rpc/increment-stock`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, amount, batch_id: batchId }),
      });
    },
    truncateAll: async () => {
      if (!window.confirm('DANGER: This will permanently delete ALL data. This action cannot be undone. Are you sure?')) {
        throw new Error('Operation cancelled by user');
      }
      return authedFetch(`${API_URL}/api/rpc/truncate-all`, {
        method: 'POST',
      });
    },
    backfillCustomerLinks: async () => {
      return authedFetch(`${API_URL}/api/rpc/backfill-customer-links`, {
        method: 'POST',
      });
    },
    autoLinkVendors: async () => {
      return authedFetch(`${API_URL}/api/rpc/auto-link-vendors`, {
        method: 'POST',
      });
    },
    resetStockVerification: async () => {
      return authedFetch(`${API_URL}/api/rpc/reset-stock-verification`, {
        method: 'POST',
      });
    },
    linkLineItem: async (invoiceId: string, lineItemId: string, productId: string) => {
      return authedFetch(`${API_URL}/api/rpc/link-line-item`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId, line_item_id: lineItemId, product_id: productId }),
      });
    },
    reserveStock: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/reserve-stock`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    releaseStock: async (invoiceId: string) => {
      return authedFetch(`${API_URL}/api/rpc/release-stock`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    giftSample: async (data: { customer_user_id: string; entry_ids: string[]; note?: string }) => {
      return authedFetch(`${API_URL}/api/rpc/gift-sample`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  stockHolds: {
    available: async (productId: string) => {
      return authedFetch(`${API_URL}/api/stock/available?product_id=${productId}`)
    },
  },

  purchaseOrders: {
    list: async (): Promise<PurchaseOrder[]> => {
      return authedFetch(`${API_URL}/api/purchase-orders`)
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
      return authedFetch(`${API_URL}/api/purchase-orders`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    updateStatus: async (id: string, status: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/purchase-orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
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
      return authedFetch(`${API_URL}/api/activity-logs?${qp}`)
    },
  },

  stockLedger: {
    list: async (productId?: string, limit = 50, offset = 0) => {
      const qp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (productId) qp.set('product_id', productId);
      return authedFetch(`${API_URL}/api/stock-ledger?${qp}`)
    },
  },

  batches: {
    list: async () => authedFetch(`${API_URL}/api/batches`),
    create: async (batch: { label: string; intake_date?: string | null; vendor?: string | null; note?: string | null }) => {
      return authedFetch(`${API_URL}/api/batches`, {
        method: 'POST',
        body: JSON.stringify(batch),
      });
    },
    products: async (batchId: string) => authedFetch(`${API_URL}/api/batches/${batchId}/products`),
  },

  generateWisdom: async (prompt: string) => {
    return authedFetch(`${API_URL}/api/generate-wisdom`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  extractFromImage: async (file: File, opts?: { skipUpload?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    // Callers that already uploaded the photo themselves set skipUpload so
    // the extract endpoint doesn't write a duplicate R2 object.
    if (opts?.skipUpload) formData.append('skip_upload', '1');
    // authedFetch: full header set (Authorization + X-Teajia-Account, no
    // Content-Type on FormData) + 401-refresh retry. The old hand-rolled
    // version read localStorage directly (missed sessionStorage tokens) and
    // sent no account header, so the R2 write could land without account scope.
    return authedFetch(`${API_URL}/api/extract-from-image`, {
      method: 'POST',
      body: formData,
    });
  },

  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string }> => {
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
    formData.append('file', audioBlob, `recording.${ext}`);
    return authedFetch(`${API_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });
  },

  uploadImage: async (
    file: File | Blob,
    options?: { productId?: string; slot?: 'main' | '1' | '2' | 'bag'; filename?: string },
  ) => {
    const formData = new FormData();
    // Browsers default a Blob filename to "blob"; pass a real .jpg filename so
    // the worker can derive an extension for stable-key uploads.
    const filename = options?.filename ?? (file instanceof File ? file.name : 'photo.jpg');
    formData.append('file', file, filename);
    if (options?.productId) formData.append('product_id', options.productId);
    if (options?.slot) formData.append('slot', options.slot);
    const data = await authedFetch(`${API_URL}/api/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return data.url as string;
  },

  // Same upload, but reports real progress (0..1) via XHR so a phone on cell
  // data shows a live bar instead of a silent wait. Falls back to uploadImage
  // semantics on error.
  uploadImageProgress: async (
    file: File | Blob,
    onProgress: (p: number) => void,
    options?: { filename?: string },
  ): Promise<string> => {
    const formData = new FormData();
    const filename = options?.filename ?? (file instanceof File ? file.name : 'photo.jpg');
    formData.append('file', file, filename);
    // Use the same headers authedFetch sends (Authorization + X-Teajia-Account),
    // but NOT Content-Type — the browser sets the multipart boundary itself.
    // Network-level failures (timeout / connection reset) retry on a fresh
    // connection up to 2 extra times — on GFW-style jumpy links the first
    // attempt often dies mid-stream while an immediate retry lands. HTTP
    // errors (4xx/5xx) are real answers from the server and do NOT retry.
    // Each attempt creates at most one R2 object, so a duplicate is harmless.
    const attemptUpload = () => new Promise<string>((resolve, reject) => {
      const headers = authHeaders();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/upload-image`);
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        xhr.setRequestHeader(k, v);
      }
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText).url as string); }
          catch { reject(new Error('bad upload response')); }
        } else reject(Object.assign(new Error(`upload failed: ${xhr.status}`), { permanent: true }));
      };
      xhr.onerror = () => reject(new Error('network error'));
      xhr.ontimeout = () => reject(new Error('upload timed out'));
      xhr.timeout = 60000; // never hang forever on a flaky phone connection
      xhr.send(formData);
    });
    let lastErr: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await attemptUpload();
      } catch (err: any) {
        lastErr = err;
        if (err?.permanent) throw err;
        onProgress(0); // reset the bar so the retry doesn't look stuck at 90%
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    throw lastErr;
  },

  events: {
    // Admin endpoints
    listAdmin: async () => {
      return authedFetch(`${API_URL}/api/admin/events`)
    },
    getAdmin: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}`)
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}`, {
        method: 'DELETE',
      });
    },
    getAttendees: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/attendees`)
    },
    updateAttendee: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    getNotifications: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/notifications`)
    },
    createNotifications: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/notifications`, {
        method: 'POST',
      });
    },
    upsertPostSession: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/post-session`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    duplicate: async (id: string, newSlug: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ slug: newSlug }),
      });
    },
    batchAttendance: async (id: string, attendeeIds: string[], attended: boolean) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ attendee_ids: attendeeIds, attended }),
      });
    },
    getTeaMenu: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tea-menu`)
    },
    upsertTeaMenu: async (id: string, items: Record<string, any>[]) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tea-menu`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    },
    deleteTeaMenuItem: async (id: string, itemId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tea-menu/${itemId}`, {
        method: 'DELETE',
      });
    },
    getTastingNotes: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/tasting-notes`)
    },
    // V2: Attendee approval actions
    approveAttendee: async (id: string, data?: { approved_guests?: number; message?: string }) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify(data || {}),
      });
    },
    denyAttendee: async (id: string, data?: { message?: string }) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}/deny`, {
        method: 'PUT',
        body: JSON.stringify(data || {}),
      });
    },
    getPendingAttendees: async () => {
      return authedFetch(`${API_URL}/api/admin/pending-attendees`)
    },
    waitlistAttendee: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/attendees/${id}/waitlist`, {
        method: 'PUT',
      });
    },
    approveBatch: async (eventId: string, attendeeIds: string[], approvedGuestsMap?: Record<string, number>) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/approve-batch`, {
        method: 'POST',
        body: JSON.stringify({ attendee_ids: attendeeIds, approved_guests_map: approvedGuestsMap }),
      });
    },
    getShareMessages: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/share`)
    },
    sendEmailInvites: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/events/${id}/send-emails`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    /** Send WhatsApp/email invites to approved attendees for an event. */
    sendInvites: async (eventId: string): Promise<{ sent: number; failed: number }> => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/send-emails`, {
        method: 'POST',
        body: JSON.stringify({ type: 'invite' }),
      });
    },
    /** Fetch the public tea menu for an event (no auth required). */
    getPublicTeaMenu: async (slug: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/events/${slug}/tea-menu`);
      if (!res.ok) return [];
      return res.json();
    },
    /** Standalone helper — send invites to all approved attendees. */
    sendEventInvites: async (eventId: string): Promise<{ sent: number; failed: number }> => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/send-emails`, {
        method: 'POST',
        body: JSON.stringify({ type: 'invite' }),
      });
    },
    getCustomerJourney: async (customerId: string) => {
      return authedFetch(`${API_URL}/api/admin/customers/${customerId}/journey`)
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
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/interest`)
    },
    // F12: Convert interest signups to RSVPs
    convertInterestToRsvp: async (eventId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/convert-interest`, {
        method: 'POST',
      });
    },
    // F40: Create next recurring event occurrence
    createNextEventOccurrence: async (eventId: string, nextDate: string, slug: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/create-next`, {
        method: 'POST',
        body: JSON.stringify({ next_date: nextDate, slug }),
      });
    },
    // F7: Mark event as complete and auto-draft invoices
    completeEvent: async (eventId: string) => {
      return authedFetch(`${API_URL}/api/admin/events/${eventId}/complete`, {
        method: 'POST',
      });
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
      return authedFetch(`${API_URL}/api/admin/venues`);
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues/${id}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/venues/${id}`, {
        method: 'DELETE',
      });
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
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/spaces`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    updateSpace: async (venueId: string, spaceId: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/spaces/${spaceId}`, {
        method: 'PUT', body: JSON.stringify(data),
      });
    },
    deleteSpace: async (venueId: string, spaceId: string) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/spaces/${spaceId}`, {
        method: 'DELETE',
      });
    },
    getEvents: async (venueId: string) => {
      return authedFetch(`${API_URL}/api/admin/venues/${venueId}/events`)
    },
    listPublic: async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/venues/public`);
      return handleResponse(res);
    },
  },

  savedLocations: {
    list: async () => {
      return authedFetch(`${API_URL}/api/admin/locations`)
    },
    create: async (data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/locations/${id}`, {
        method: 'DELETE',
      });
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
      return authedFetch(`${API_URL}/api/newsletter/subscribers`)
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
      return authedFetch(`${API_URL}/api/events/${slug}/rsvp`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
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
      return authedFetch(`${API_URL}/api/compass/entries${qs ? `?${qs}` : ''}`)
    },
    create: async (entry: CompassWrite) => {
      return authedFetch(`${API_URL}/api/compass/entries`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    update: async (id: string, updates: CompassWrite) => {
      // PUT by id — idempotent, safe to retry through a GFW timeout.
      return authedFetch(`${API_URL}/api/compass/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
        retryTimeouts: true,
      });
    },
    remove: async (id: string) => {
      // DELETE by id — idempotent, safe to retry through a GFW timeout.
      return authedFetch(`${API_URL}/api/compass/entries/${id}`, {
        method: 'DELETE',
        retryTimeouts: true,
      });
    },
    sync: async (entries: CompassWrite[]): Promise<CompassSyncResult> => {
      // Worker uses an ownership-scoped upsert keyed by entry id — idempotent
      // without replacing server-owned or omitted fields.
      return authedFetch(`${API_URL}/api/compass/sync`, {
        method: 'POST',
        body: JSON.stringify({ entries }),
        retryTimeouts: true,
      });
    },
    /** Promote a compass entry to a Draft product in the active account.
     *  Idempotent — returns the existing product if already promoted. */
    promote: async (entryId: string): Promise<{ id: string; product: Record<string, any>; alreadyPromoted: boolean }> => {
      return authedFetch(`${API_URL}/api/compass/entries/${entryId}/promote`, {
        method: 'POST',
        retryTimeouts: true,
      });
    },
    /** Share a capture card to known accounts and/or generate an invite link for external tasters */
    share: async (params: {
      entryId: string;
      targetAccountIds?: string[];
      generateInviteLink?: boolean;
    }) => {
      return authedFetch(`${API_URL}/api/compass/share`, {
        method: 'POST',
        body: JSON.stringify({
          entry_id: params.entryId,
          target_account_ids: params.targetAccountIds,
          generate_invite_link: params.generateInviteLink,
        }),
      });
    },
    /** List pending incoming shares for the current account */
    getIncoming: async () => {
      return authedFetch(`${API_URL}/api/compass/incoming`)
    },
    /** Accept a direct-push share — creates a compass entry in caller's account */
    acceptShare: async (shareId: string) => {
      return authedFetch(`${API_URL}/api/compass/shares/${shareId}/accept`, {
        method: 'POST',
      });
    },
    /** Decline a direct-push share */
    declineShare: async (shareId: string) => {
      return authedFetch(`${API_URL}/api/compass/shares/${shareId}/decline`, {
        method: 'POST',
      });
    },
    /** Public — fetch share metadata from an invite token (no auth required) */
    getInvite: async (token: string) => {
      // Token is injected by authedFetch (if present) — no extra headers needed.
      return authedFetch(`${API_URL}/api/compass/invite/${token}`);
    },
    /** Authenticated — claim an invite link into the caller's compass */
    claimInvite: async (token: string) => {
      return authedFetch(`${API_URL}/api/compass/invite/${token}/claim`, {
        method: 'POST',
      });
    },
    entryFeedback: async (entryId: string) => {
      return authedFetch(`${API_URL}/api/compass/entries/${entryId}/feedback`)
    },
    createTableShare: async (entryId: string) => {
      return authedFetch(`${API_URL}/api/compass/entries/${entryId}/table-share`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  },

  curateContext: {
    listJourneys: (): Promise<{ journeys: CurateJourney[] }> => authedFetch(`${API_URL}/api/curate/journeys`),
    createJourney: (journey: Partial<CurateJourney>): Promise<CurateJourney> => authedFetch(`${API_URL}/api/curate/journeys`, { method: 'POST', body: JSON.stringify(journey) }),
    updateJourney: (id: string, updates: Partial<CurateJourney>): Promise<CurateJourney> => authedFetch(`${API_URL}/api/curate/journeys/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteJourney: (id: string): Promise<{ success: true }> => authedFetch(`${API_URL}/api/curate/journeys/${id}`, { method: 'DELETE' }),
    listVisits: (journeyId?: string): Promise<{ visits: CurateVisit[] }> => authedFetch(`${API_URL}/api/curate/visits${journeyId ? `?journey_id=${encodeURIComponent(journeyId)}` : ''}`),
    createVisit: (visit: Partial<CurateVisit>): Promise<CurateVisit> => authedFetch(`${API_URL}/api/curate/visits`, { method: 'POST', body: JSON.stringify(visit) }),
    updateVisit: (id: string, updates: Partial<CurateVisit>): Promise<CurateVisit> => authedFetch(`${API_URL}/api/curate/visits/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteVisit: (id: string): Promise<{ success: true }> => authedFetch(`${API_URL}/api/curate/visits/${id}`, { method: 'DELETE' }),
  },

  curateImports: {
    create: (payload: {
      title: string; journey_id?: string; visit_id?: string;
      source_kind?: CurateImportSourceKind; pasted_text?: string;
      items?: Array<Partial<CurateImportItem>>;
    }): Promise<CurateImportDetail> => authedFetch(`${API_URL}/api/curate/imports`, { method: 'POST', body: JSON.stringify(payload), retryTimeouts: true }),
    get: (id: string): Promise<CurateImportDetail> => authedFetch(`${API_URL}/api/curate/imports/${id}`),
    addSource: (id: string, source: { kind: CurateImportSourceKind; pasted_text?: string; r2_object_key?: string; metadata?: Record<string, unknown> }): Promise<CurateImportSource> =>
      authedFetch(`${API_URL}/api/curate/imports/${id}/sources`, { method: 'POST', body: JSON.stringify(source), retryTimeouts: true }),
    updateItem: (batchId: string, itemId: string, updates: Partial<CurateImportItem>): Promise<CurateImportItem> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(updates), retryTimeouts: true }),
    acceptItem: (batchId: string, itemId: string): Promise<CurateImportItem & { already_accepted?: boolean }> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/items/${itemId}/accept`, { method: 'POST', retryTimeouts: true }),
    mergeItem: (batchId: string, itemId: string, compassEntryId: string): Promise<CurateImportItem> =>
      authedFetch(`${API_URL}/api/curate/imports/${batchId}/items/${itemId}/merge`, { method: 'POST', body: JSON.stringify({ compass_entry_id: compassEntryId }), retryTimeouts: true }),
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
      });
      if (!res.ok) return { inquiries: [] };
      return res.json();
    },

    updateStatus: async (id: string, status: 'new' | 'seen' | 'replied' | 'closed') => {
      const res = await fetchWithTimeout(`${API_URL}/api/admin/inquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return null;
      return res.json();
    },
  },

  favorites: {
    get: async (): Promise<{ favorites: string[] }> => {
      return authedFetch(`${API_URL}/api/user/favorites`)
    },
    put: async (favorites: string[]): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/user/favorites`, {
        method: 'PUT',
        body: JSON.stringify({ favorites }),
      });
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
      return authedFetch(`${API_URL}/api/samples/request`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    // Admin: list all samples
    list: async (params?: { setId?: string; status?: string }) => {
      const qp = new URLSearchParams();
      if (params?.setId) qp.set('setId', params.setId);
      if (params?.status) qp.set('status', params.status);
      const qs = qp.toString();
      return authedFetch(`${API_URL}/api/admin/samples${qs ? `?${qs}` : ''}`)
    },
    create: async (sample: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/samples`, {
        method: 'POST',
        body: JSON.stringify(sample),
      });
    },
    update: async (id: string, updates: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/samples/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    remove: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/samples/${id}`, {
        method: 'DELETE',
      });
    },
  },

  tastingJournal: {
    list: async () => {
      return authedFetch(`${API_URL}/api/tasting-journal`)
    },
    add: async (entry: any) => {
      return authedFetch(`${API_URL}/api/tasting-journal`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    remove: async (id: string) => {
      return authedFetch(`${API_URL}/api/tasting-journal/${id}`, {
        method: 'DELETE',
      });
    },
    sync: async (entries: any[]) => {
      return authedFetch(`${API_URL}/api/tasting-journal/sync`, {
        method: 'POST',
        body: JSON.stringify({ entries }),
      });
    },
  },

  // Tea Discovery — the onboarding disposition profile (one per member, server-
  // persisted so it follows them across devices and the tea master can read it).
  teaDiscovery: {
    get: async () => {
      return authedFetch(`${API_URL}/api/tea-discovery`);
    },
    save: async (payload: {
      answers: Record<string, string | string[]>;
      level: string;
      dispositionId: string;
      dispositionName: string;
      completedAt: string;
    }) => {
      return authedFetch(`${API_URL}/api/tea-discovery`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
  },

  xref: {
    articles: {
      list: async (articleId: string) => {
        return authedFetch(`${API_URL}/api/xref/articles/${articleId}/products`);
      },
      link: async (articleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/articles/${articleId}/products`, {
          method: 'POST', body: JSON.stringify({ product_id: productId }),
        });
      },
      unlink: async (articleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/articles/${articleId}/products/${productId}`, {
          method: 'DELETE',
        });
      },
    },
    modules: {
      list: async (moduleId: string) => {
        return authedFetch(`${API_URL}/api/xref/modules/${moduleId}/products`);
      },
      link: async (moduleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/modules/${moduleId}/products`, {
          method: 'POST', body: JSON.stringify({ product_id: productId }),
        });
      },
      unlink: async (moduleId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/modules/${moduleId}/products/${productId}`, {
          method: 'DELETE',
        });
      },
    },
    projects: {
      list: async (projectId: string) => {
        return authedFetch(`${API_URL}/api/xref/projects/${projectId}/products`);
      },
      link: async (projectId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/projects/${projectId}/products`, {
          method: 'POST', body: JSON.stringify({ product_id: productId }),
        });
      },
      unlink: async (projectId: string, productId: string) => {
        return authedFetch(`${API_URL}/api/xref/projects/${projectId}/products/${productId}`, {
          method: 'DELETE',
        });
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
      return authedFetch(`${API_URL}/api/accounts/me`)
    },
    switch: async (accountId: string): Promise<{ token: string }> => {
      const data = await authedFetch(`${API_URL}/api/accounts/switch`, {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId }),
      });
      if (data?.token) setToken(data.token);
      return data;
    },
    get: async (id: string): Promise<Account> => {
      return authedFetch(`${API_URL}/api/accounts/${id}`)
    },
    update: async (id: string, updates: Partial<Account>): Promise<Account> => {
      return authedFetch(`${API_URL}/api/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    listMembers: async (id: string): Promise<AccountMember[]> => {
      return authedFetch(`${API_URL}/api/accounts/${id}/members`)
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
      return authedFetch(url);
    },
    addMember: async (
      id: string,
      email: string,
      role: AccountRole
    ): Promise<AccountMember & { success?: boolean; created_user?: boolean; invite_link?: string | null }> => {
      return authedFetch(`${API_URL}/api/accounts/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    },
    updateMember: async (accountId: string, userId: string, role: AccountRole): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },
    removeMember: async (accountId: string, userId: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}`, {
        method: 'DELETE',
      });
    },
    updateMemberPermissions: async (accountId: string, userId: string, permissions: Record<string, boolean>): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}/permissions`, {
        method: 'PUT', body: JSON.stringify(permissions),
      });
    },
    setCuratorFlag: async (accountId: string, userId: string, can_create_collections: boolean): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}/curator`, {
        method: 'PUT', body: JSON.stringify({ can_create_collections }),
      });
    },
    transferOwnership: async (accountId: string, newOwnerUserId: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/transfer-ownership`, {
        method: 'POST', body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
      });
    },
    // Members & Access — roster with bundle resolution per member
    getAccess: async (accountId: string): Promise<{ members: AccountMember[] }> => {
      return authedFetch(`${API_URL}/api/accounts/${accountId}/access`)
    },
    // Members & Access — replace a member's bundles wholesale
    setMemberBundles: async (accountId: string, userId: string, bundles: Bundle[]): Promise<void> => {
      await authedFetch(`${API_URL}/api/accounts/${accountId}/members/${userId}/bundles`, {
        method: 'PUT', body: JSON.stringify({ bundles }),
      });
    },
    getFeatures: async (accountId: string): Promise<Record<string, boolean>> => {
      const data = await authedFetch(`${API_URL}/api/accounts/${accountId}/features`)
      return (data?.features ?? data) as Record<string, boolean>;
    },
    // BYOK: per-account OpenAI API key. Plaintext is sent over HTTPS once,
    // encrypted server-side, and never returned again.
    setOpenAIKey: async (
      accountId: string,
      apiKey: string,
    ): Promise<{ has_openai_key: boolean; openai_key_last4: string | null }> => {
      return authedFetch(`${API_URL}/api/accounts/${accountId}/integrations/openai-key`, {
        method: 'PUT',
        body: JSON.stringify({ api_key: apiKey }),
      });
    },
    clearOpenAIKey: async (
      accountId: string,
    ): Promise<{ has_openai_key: boolean; openai_key_last4: string | null }> => {
      return authedFetch(`${API_URL}/api/accounts/${accountId}/integrations/openai-key`, {
        method: 'DELETE',
      });
    },
  },

  catalog: {
    list: async (): Promise<{ products: any[]; trust_tier: string }> => {
      return authedFetch(`${API_URL}/api/catalog`);
    },
  },

  network: {
    /** Public list of accounts with public_enabled = true */
    getStores: async (): Promise<Array<{ id: string; slug: string; name: string; tagline?: string; logo_url?: string; location_city?: string; location_country?: string }>> => {
      return authedFetch(`${API_URL}/api/network/stores`)
    },

    /**
     * GET /api/network/catalog
     * Returns profiles the caller does not yet carry, with computed wholesale price.
     * Requires Catalog bundle on caller account.
     */
    catalog: async (): Promise<{ profiles: import('../types').NetworkCatalogProfile[] }> => {
      return authedFetch(`${API_URL}/api/network/catalog`)
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
      return authedFetch(`${API_URL}/api/listings/${listingId}`)
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
      return authedFetch(`${API_URL}/api/listings/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
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
      return authedFetch(`${API_URL}/api/listings/carry`, {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profileId,
          initial_price_amount: opts.initial_price_amount,
          initial_price_currency: opts.initial_price_currency,
          initial_stock_grams: opts.initial_stock_grams,
        }),
      });
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
      return authedFetch(`${API_URL}/api/profiles/${profileId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({ fields }),
      });
    },

    /**
     * GET /api/profiles/:id/suggestions
     * Curator-only on the profile. All bundles for one profile.
     */
    listProfileSuggestions: async (
      profileId: string,
    ): Promise<{ suggestions: import('../types').ProfileSuggestion[] }> => {
      return authedFetch(`${API_URL}/api/profiles/${profileId}/suggestions`)
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
      return authedFetch(url.toString());
    },

    /**
     * POST /api/suggestions/:id/decide
     * Per-field accept/reject. Accepted fields write to canonical immediately.
     */
    decideSuggestion: async (
      suggestionId: string,
      decisions: import('../types').ProfileSuggestionDecision[],
    ): Promise<{ suggestion_id: string; bundle_status: string; decisions_recorded: number }> => {
      return authedFetch(`${API_URL}/api/suggestions/${suggestionId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decisions }),
      });
    },

    /** POST /api/network/profiles/:id/suggest-for-network — partner flags own profile */
    suggestForNetwork: async (profileId: string, note?: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/network/profiles/${profileId}/suggest-for-network`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },

    /** GET /api/network/adoption-queue?status=pending|adopted|declined — Platform tier */
    adoptionQueue: async (
      status: 'pending' | 'adopted' | 'declined' = 'pending',
    ): Promise<{ profiles: import('../types').AdoptionQueueEntry[] }> => {
      const url = new URL(`${API_URL}/api/network/adoption-queue`);
      url.searchParams.set('status', status);
      return authedFetch(url.toString());
    },

    /** POST /api/network/profiles/:id/adopt — Platform tier decides */
    decideAdoption: async (
      profileId: string,
      decision: 'adopted' | 'declined',
      decline_note?: string,
    ): Promise<{ ok: true; decision: string }> => {
      return authedFetch(`${API_URL}/api/network/profiles/${profileId}/adopt`, {
        method: 'POST',
        body: JSON.stringify({ decision, decline_note }),
      });
    },
  },

  /** Wholesale orders (Step 4) — cross-account transactional layer. */
  wholesale: {
    /** POST /api/wholesale/orders — buyer creates a draft. */
    createOrder: async (
      body: import('../types').WholesaleOrderCreateBody,
    ): Promise<{ order_id: string }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /** GET /api/wholesale/orders — list with optional role + status filters. */
    listOrders: async (
      opts: { role?: 'buyer' | 'supplier'; status?: import('../types').WholesaleOrderStatus } = {},
    ): Promise<{ orders: import('../types').WholesaleOrderSummary[] }> => {
      const url = new URL(`${API_URL}/api/wholesale/orders`);
      if (opts.role) url.searchParams.set('role', opts.role);
      if (opts.status) url.searchParams.set('status', opts.status);
      return authedFetch(url.toString());
    },

    /** GET /api/wholesale/orders/:id — detail + items + party accounts. */
    getOrder: async (orderId: string): Promise<import('../types').WholesaleOrderDetail> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}`)
    },

    /** PUT /api/wholesale/orders/:id — buyer edits draft (or replied). */
    updateOrder: async (
      orderId: string,
      patch: import('../types').WholesaleOrderUpdateBody,
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },

    /** POST /api/wholesale/orders/:id/transition — single dispatch for status changes. */
    transition: async (
      orderId: string,
      transition: import('../types').WholesaleTransitionBody,
    ): Promise<{ ok: true; status: string }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}/transition`, {
        method: 'POST',
        body: JSON.stringify(transition),
      });
    },

    /** POST /api/wholesale/orders/:id/nudge — buyer reminds supplier. 24h throttle. */
    nudge: async (orderId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/wholesale/orders/${orderId}/nudge`, {
        method: 'POST',
      });
    },
  },

  /** Account-wide contact tag queries (autocomplete + tag-aware picker). */
  customerTags: {
    listAll: async (): Promise<Array<{ tag: string; count: number }>> => {
      return authedFetch(`${API_URL}/api/customer-tags`)
    },
    customersByTag: async (tag: string): Promise<Array<{ id: string; name: string; phone?: string; whatsapp?: string }>> => {
      return authedFetch(`${API_URL}/api/customer-tags/${encodeURIComponent(tag)}/customers`)
    },
    /** Rename or merge a tag account-wide. Pass renameTo='' to delete everywhere. */
    rename: async (tag: string, renameTo: string): Promise<{ success: boolean }> => {
      return authedFetch(`${API_URL}/api/customer-tags/${encodeURIComponent(tag)}`, {
        method: 'PUT',
        body: JSON.stringify({ rename_to: renameTo }),
      });
    },
  },

  collections: {
    list: async (opts?: { status?: 'draft' | 'active' | 'archived'; productId?: string }): Promise<{ collections: import('../types').CollectionListRow[] }> => {
      const qs = new URLSearchParams();
      if (opts?.status) qs.set('status', opts.status);
      if (opts?.productId) qs.set('product_id', opts.productId);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return authedFetch(`${API_URL}/api/collections${suffix}`)
    },
    get: async (id: string): Promise<import('../types').CollectionDetail> => {
      return authedFetch(`${API_URL}/api/collections/${id}`)
    },
    create: async (data: { title: string; note?: string; hero_image_url?: string; initial_product_ids?: string[] }): Promise<{ id: string }> => {
      return authedFetch(`${API_URL}/api/collections`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, patch: Partial<{ title: string; note: string | null; hero_image_url: string | null; status: 'draft' | 'active' | 'archived' }>): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },
    addItems: async (id: string, productIds: string[]): Promise<{ added: number; skipped: number }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: productIds }),
      });
    },
    removeItem: async (id: string, itemId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'DELETE',
      });
    },
    reorderItem: async (id: string, itemId: string, direction: 'up' | 'down'): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ direction }),
      });
    },
    /** Drag-and-drop reorder: commit a full ordered list of item ids in one call. */
    reorderItems: async (id: string, itemIds: string[]): Promise<{ ok: true }> => {
      // itemId in the path is unused by the array branch; send the first as a placeholder.
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemIds[0] ?? 'none'}`, {
        method: 'PUT',
        body: JSON.stringify({ item_ids: itemIds }),
      });
    },
    /** Update a single item's curator note and/or recommendation (quantity, price). */
    patchItem: async (
      id: string,
      itemId: string,
      patch: Partial<{ item_note: string | null; recommended_quantity: string | null; recommended_price_usd: number | null }>,
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },
    publish: async (id: string, recipients: import('../types').CollectionRecipient[]): Promise<{ id: string; slug: string }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        body: JSON.stringify({ target_type: 'person', recipients }),
      });
    },
    publishToStore: async (id: string, targetAccountId: string): Promise<{ id: string; slug: string }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        body: JSON.stringify({ target_type: 'store', target_id: targetAccountId }),
      });
    },
    publishToTag: async (id: string, tag: string): Promise<{ id: string; slug: string }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications`, {
        method: 'POST',
        body: JSON.stringify({ target_type: 'tag', target_id: tag }),
      });
    },
    recentRecipients: async (days = 90, limit = 6): Promise<Array<{ customer_id: string; name: string; phone?: string; last_published_at: string }>> => {
      return authedFetch(`${API_URL}/api/collection-publications/recent-recipients?days=${days}&limit=${limit}`)
    },
    listInbound: async (): Promise<{ inbound: import('../types').InboundCollectionRow[]; unread_count: number }> => {
      return authedFetch(`${API_URL}/api/collections/inbound`)
    },
    getInbound: async (pubId: string): Promise<import('../types').InboundCollectionDetail> => {
      return authedFetch(`${API_URL}/api/collections/inbound/${pubId}`)
    },
    importInbound: async (pubId: string, productIds: string[]): Promise<{ imported: Array<{ source_id: string; new_id: string }>; skipped: number }> => {
      return authedFetch(`${API_URL}/api/collections/inbound/${pubId}/import`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: productIds }),
      });
    },
    unpublish: async (id: string, pubId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${id}/publications/${pubId}`, {
        method: 'DELETE',
      });
    },
    needsAttention: async (): Promise<{ items: import('../types').NeedsAttentionItem[] }> => {
      return authedFetch(`${API_URL}/api/collections/needs-attention`)
    },
    /** Public — no auth. Used by /c/:slug page. */
    getPublic: async (slug: string): Promise<import('../types').PublicCollectionResponse> => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/c/${slug}`, {});
      return handleResponse(res);
    },
    trackPublicView: async (slug: string): Promise<void> => {
      await fetchWithTimeout(`${API_URL}/api/public/c/${slug}/view`, { method: 'POST' });
    },
    /** Public — no auth. Recipient confirms their picks; creates a Draft invoice for the curator to review. */
    confirmPicks: async (
      slug: string,
      payload: { picks: Array<{ item_id: string; quantity: number; note?: string }>; contact_name?: string; contact_phone?: string },
    ): Promise<{ ok: true; invoice_number: string; item_count: number }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/public/c/${slug}/confirm`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    /** The logged-in user's saved/received collection shelf (cross-account). */
    listMine: async (): Promise<{ collections: import('../types').SavedCollectionRow[] }> => {
      return authedFetch(`${API_URL}/api/me/collections`)
    },
    /** Explicitly save a shared collection (by its publication slug) to my shelf. */
    saveMine: async (slug: string): Promise<{ ok: true; collection_id: string }> => {
      return authedFetch(`${API_URL}/api/me/collections/save`, {
        method: 'POST',
        body: JSON.stringify({ slug }),
      });
    },
    /** Best-effort: record that I (a logged-in user) opened a shared link, so it
     *  lands on my shelf as 'received'. Swallows errors — never blocks the view. */
    markReceived: async (slug: string): Promise<void> => {
      try {
        await authedFetch(`${API_URL}/api/me/collections/received`, {
          method: 'POST',
          body: JSON.stringify({ slug }),
        });
      } catch { /* not logged in or dead link — fine, this is opportunistic */ }
    },
    /** Remove a collection from my shelf. */
    unsaveMine: async (collectionId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/me/collections/${collectionId}`, {
        method: 'DELETE',
      });
    },
    /** Publish a collection to the shop audience. Idempotent. */
    publishToShop: async (collectionId: string): Promise<{ publication: import('../types').CollectionPublication; created: boolean }> => {
      return authedFetch(`${API_URL}/api/collections/${collectionId}/publish-shop`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    /** Remove a collection from the shop audience. */
    unpublishFromShop: async (collectionId: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/collections/${collectionId}/unpublish-shop`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    /** Public — no auth. Returns the 20 most recently shop-published collections. */
    publicShop: async (): Promise<import('../types').PublicShopCollectionsResponse> => {
      const res = await fetchWithTimeout(`${API_URL}/api/collections/shop`, {});
      return handleResponse(res);
    },
  },

  platform: {
    listUsers: async (): Promise<{ users: PlatformUser[] }> => {
      return authedFetch(`${API_URL}/api/platform/users`)
    },
    setUserPlatformRole: async (userId: string, platform_role: import('../types').PlatformRole): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/users/${userId}/platform-role`, {
        method: 'PUT',
        body: JSON.stringify({ platform_role }),
      });
    },
    // Stock spine step 5 — grant/revoke a user's public shelf and set its slug.
    grantShelf: async (userId: string, data: { enabled: boolean; slug?: string }): Promise<{ ok: boolean; enabled: boolean; slug: string | null }> => {
      return authedFetch(`${API_URL}/api/platform/users/${userId}/shelf`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    listAccounts: async (): Promise<{ accounts: PlatformAccount[] }> => {
      return authedFetch(`${API_URL}/api/platform/accounts`)
    },
    // Stock spine step 3 — read-only stock across every location.
    allStock: async (): Promise<{ stock: PlatformStockRow[] }> => {
      return authedFetch(`${API_URL}/api/platform/all-stock`)
    },
    toggleFeature: async (accountId: string, feature: string, enabled: boolean): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/features/${feature}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
    },
    setAccountStatus: async (accountId: string, status: 'active' | 'suspended'): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/status`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
    },
    setTrustTier: async (accountId: string, trust_tier: 'basic' | 'verified' | 'partner'): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/trust-tier`, {
        method: 'PUT', body: JSON.stringify({ trust_tier }),
      });
    },
    resendInvite: async (userId: string, account_name?: string): Promise<{ invite_link: string; email_sent: boolean }> => {
      return authedFetch(`${API_URL}/api/platform/users/${userId}/resend-invite`, {
        method: 'POST', body: JSON.stringify({ account_name }),
      });
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
      return authedFetch(`${API_URL}/api/platform/audit-log?${params.toString()}`)
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
      return authedFetch(`${API_URL}/api/platform/accounts`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    // ── Members & Access (Platform tier) ────────────────────────────────────
    listApplications: async (
      filters: { status?: AccountApplication['status']; kind?: 'location' | 'master' } = {}
    ): Promise<{ applications: AccountApplication[] }> => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.kind) params.set('kind', filters.kind);
      const qs = params.toString();
      return authedFetch(`${API_URL}/api/platform/applications${qs ? `?${qs}` : ''}`)
    },
    decideApplication: async (
      applicationId: string,
      decision: 'approve' | 'decline',
      opts: { decision_note?: string; trust_tier?: 'basic' | 'verified' | 'partner' } = {}
    ): Promise<{ success: true; account_id?: string; user_id?: string; claim_link?: string | null }> => {
      return authedFetch(`${API_URL}/api/platform/applications/${applicationId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, ...opts }),
      });
    },
    inviteTeaMaster: async (
      data: { email: string; name?: string; note?: string }
    ): Promise<{ success: true; account_id: string; user_id: string; claim_link: string | null; email_sent: boolean }> => {
      return authedFetch(`${API_URL}/api/platform/tea-masters/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    upgradeToLocation: async (
      accountId: string,
      data: { location_name?: string; location_city?: string; location_country?: string; timezone?: string } = {}
    ): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/upgrade-to-location`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    suspendAccount: async (accountId: string, reason?: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    reactivateAccount: async (accountId: string, note?: string): Promise<void> => {
      await authedFetch(`${API_URL}/api/platform/accounts/${accountId}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },

    // Exchange-rate admin (Platform tier only).
    listExchangeRates: async (): Promise<{
      rates: Array<{ currency: string; rate_to_usd: number; last_updated: string | null; usage_count: number }>;
    }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates`)
    },
    createExchangeRate: async (data: { currency: string; rate_to_usd: number }): Promise<{
      success: true; currency: string; rate_to_usd: number;
    }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateExchangeRate: async (currency: string, rate_to_usd: number): Promise<{
      success: true; currency: string; rate_to_usd: number;
    }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates/${encodeURIComponent(currency)}`, {
        method: 'PUT',
        body: JSON.stringify({ rate_to_usd }),
      });
    },
    deleteExchangeRate: async (currency: string): Promise<{ success: true }> => {
      return authedFetch(`${API_URL}/api/platform/exchange-rates/${encodeURIComponent(currency)}`, {
        method: 'DELETE',
      });
    },
  },

  sampleSets: {
    list: async () => {
      return authedFetch(`${API_URL}/api/admin/sample-sets`)
    },
    create: async (set: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/sample-sets`, {
        method: 'POST',
        body: JSON.stringify(set),
      });
    },
    update: async (id: string, updates: Record<string, any>) => {
      return authedFetch(`${API_URL}/api/admin/sample-sets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    remove: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/sample-sets/${id}`, {
        method: 'DELETE',
      });
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
      return authedFetch(`${API_URL}/api/tea-reviews?${qp.toString()}`)
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
      return authedFetch(`${API_URL}/api/tea-reviews`, {
        method: 'POST',
        body: JSON.stringify(review),
      });
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
      return authedFetch(`${API_URL}/api/tea-reviews/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    remove: async (id: string) => {
      return authedFetch(`${API_URL}/api/tea-reviews/${id}`, {
        method: 'DELETE',
      });
    },
  },

  me: {
    profile: async () => {
      return authedFetch(`${API_URL}/api/me/profile`);
    },
    queue: async () => {
      return authedFetch(`${API_URL}/api/me/queue`);
    },
    wishlist: async () => {
      return authedFetch(`${API_URL}/api/me/wishlist`);
    },
    journey: async () => {
      return authedFetch(`${API_URL}/api/me/journey`);
    },
    orders: async (): Promise<{
      orders: Array<{
        id: string;
        invoice_number: string;
        status: string;
        total_amount_usd: number;
        currency: string;
        created_at: string;
        line_items_count: number;
      }>;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/orders`, { headers: authHeaders() });
      return handleResponse(res);
    },
    samples: async (): Promise<{
      samples: Array<{
        id: string;
        status: string;
        sent_at: string;
        tea_name: string;
        notes: string | null;
      }>;
    }> => {
      const res = await fetchWithTimeout(`${API_URL}/api/me/samples`, { headers: authHeaders() });
      return handleResponse(res);
    },
  },

  // Stock spine step 4 — the personal cellar: location-less, person-owned stock.
  cellar: {
    list: async (): Promise<{ items: CellarItem[] }> => {
      return authedFetch(`${API_URL}/api/me/cellar`);
    },
    create: async (data: Partial<CellarItem> & { name: string }): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar`, { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: string, data: Partial<CellarItem>): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    remove: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}`, { method: 'DELETE' });
    },
    requestPlacement: async (id: string, accountId: string): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/request-placement`, {
        method: 'POST', body: JSON.stringify({ account_id: accountId }),
      });
    },
    cancelPlacement: async (id: string): Promise<{ item: CellarItem }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/cancel-placement`, { method: 'POST' });
    },
    // Location-owner side — review and decide placement requests.
    listPlacements: async (): Promise<{ requests: CellarPlacementRequest[] }> => {
      return authedFetch(`${API_URL}/api/cellar-placements`);
    },
    approvePlacement: async (id: string): Promise<{ ok: boolean; product_id: string }> => {
      return authedFetch(`${API_URL}/api/cellar-placements/${id}/approve`, { method: 'POST' });
    },
    declinePlacement: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/cellar-placements/${id}/decline`, { method: 'POST' });
    },
    // Stock spine step 5 — the standalone public shelf.
    getShelf: async (): Promise<ShelfSettings> => {
      return authedFetch(`${API_URL}/api/me/shelf`);
    },
    updateShelf: async (data: { title?: string; whatsapp?: string }): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/shelf`, { method: 'PUT', body: JSON.stringify(data) });
    },
    publishToShelf: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/publish-shelf`, { method: 'POST' });
    },
    unpublishFromShelf: async (id: string): Promise<{ ok: boolean }> => {
      return authedFetch(`${API_URL}/api/me/cellar/${id}/unpublish-shelf`, { method: 'POST' });
    },
  },

  // Stock spine step 5 — PUBLIC standalone shelf (no auth).
  shelf: {
    getPublic: async (slug: string): Promise<PublicShelf> => {
      const res = await fetchWithTimeout(`${API_URL}/api/shelf/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
  },

  members: {
    search: async (q: string) => {
      return authedFetch(`${API_URL}/api/members/search?q=${encodeURIComponent(q)}`)
    },
  },

  sessions: {
    list: async (params?: { status?: 'active' | 'completed'; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.limit) qs.set('limit', String(params.limit));
      const url = `${API_URL}/api/sessions${qs.toString() ? `?${qs.toString()}` : ''}`;
      return authedFetch(url);
    },
    create: async (data: { title?: string; entry_ids?: string[]; product_ids?: string[]; member_ids?: string[] }) => {
      return authedFetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    issueJoinCode: async (sessionId: string): Promise<{ code: string; expires_at: string; reused?: boolean }> => {
      return authedFetch(`${API_URL}/api/auth/join-code/issue`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
    },
    revokeJoinCode: async (code: string) => {
      return authedFetch(`${API_URL}/api/auth/join-code/${code}/revoke`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    hostLive: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/host-live`);
    },
    get: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}`);
    },
    getByToken: async (token: string) => {
      const res = await fetchWithTimeout(`${API_URL}/api/sessions/join/${token}`);
      return handleResponse(res);
    },
    join: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    submitVerdict: async (sessionId: string, teaId: string, data: {
      verdict?: string;
      tasting_data?: Record<string, any>;
      notes?: string;
      would_buy?: boolean;
    }) => {
      return authedFetch(`${API_URL}/api/sessions/${sessionId}/teas/${teaId}/verdict`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    verdicts: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/verdicts`);
    },
    complete: async (id: string) => {
      return authedFetch(`${API_URL}/api/sessions/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  },

  connections: {
    list: async () => {
      return authedFetch(`${API_URL}/api/connections`);
    },
    invite: async (data: { to_user_id: string; pending_share_id?: string }) => {
      return authedFetch(`${API_URL}/api/connections/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    acceptInvite: async (id: string) => {
      return authedFetch(`${API_URL}/api/connections/invites/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
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
    list: async (status?: string): Promise<DbArticle[]> => {
      return authedFetch(`${API_URL}/api/admin/articles${status ? `?status=${status}` : ''}`);
    },
    get: async (id: string): Promise<DbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`)
    },
    create: async (data: Partial<DbArticle>): Promise<DbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: Partial<DbArticle>): Promise<DbArticle> => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    publish: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}/publish`, {
        method: 'POST',
      });
    },
    unpublish: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}/unpublish`, {
        method: 'POST',
      });
    },
    delete: async (id: string) => {
      return authedFetch(`${API_URL}/api/admin/articles/${id}`, {
        method: 'DELETE',
      });
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

  // Photos for hand-built Read story pages: a real image + pan/zoom crop per
  // named frame. Public read; admin-gated write (uses the same upload pipeline).
  storyPhotos: {
    get: async (slug: string): Promise<Record<string, { url: string; crop: { scale: number; x: number; y: number } }>> => {
      const res = await fetchWithTimeout(`${API_URL}/api/story-photos/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
    put: async (
      slug: string,
      slot: string,
      image_url: string,
      crop: { scale: number; x: number; y: number },
    ): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-photos/${encodeURIComponent(slug)}/${encodeURIComponent(slot)}`, {
        method: 'PUT',
        body: JSON.stringify({ image_url, crop }),
      });
    },
    remove: async (slug: string, slot: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-photos/${encodeURIComponent(slug)}/${encodeURIComponent(slot)}`, {
        method: 'DELETE',
      });
    },
  },

  // Inline-editable story content for hand-built Read pages: per-field text +
  // photo overrides, a draft the owner edits freely, publish to go live, and a
  // version history for one-click undo. Public read returns published content.
  storyContent: {
    get: async (slug: string, state: 'published' | 'draft' = 'published'): Promise<any> => {
      if (state === 'draft') {
        return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}?state=draft`);
      }
      const res = await fetchWithTimeout(`${API_URL}/api/story-content/${encodeURIComponent(slug)}`);
      return handleResponse(res);
    },
    saveDraft: async (slug: string, content: any): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    },
    publish: async (slug: string): Promise<{ ok: true }> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/publish`, {
        method: 'POST',
      });
    },
    versions: async (slug: string): Promise<{ id: string; label: string | null; created_at: string }[]> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/versions`);
    },
    restore: async (slug: string, versionId: string): Promise<{ ok: true; content: any }> => {
      return authedFetch(`${API_URL}/api/story-content/${encodeURIComponent(slug)}/restore/${encodeURIComponent(versionId)}`, {
        method: 'POST',
      });
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
    getRelationshipAudit: async () => {
      return authedFetch(`${API_URL}/api/admin/people/relationship-audit`)
    },
    applyRelationshipAudit: async () => {
      return authedFetch(`${API_URL}/api/admin/people/relationship-audit/apply`, {
        method: 'POST',
      });
    },
    listAdminContributors: async () => {
      return authedFetch(`${API_URL}/api/admin/contributors`)
    },
    updateContributorContact: async (contributorId: string, customerId: string | null) => {
      return authedFetch(`${API_URL}/api/admin/contributors/${encodeURIComponent(contributorId)}/contact`, {
        method: 'PUT',
        body: JSON.stringify({ customer_id: customerId }),
      });
    },
  },

};
