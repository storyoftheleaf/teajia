export interface RecentOrderRequest {
  trackingToken: string;
  reference: string;
  storeSlug: string;
  createdAt: string;
}

type RequestStorage = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'teajia_recent_order_requests_v1';
const PER_STORE_LIMIT = 3;
const TOTAL_LIMIT = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const STORE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function browserStorage(): RequestStorage | null {
  try { return window.localStorage; } catch { return null; }
}

function normalizeRequest(raw: unknown): RecentOrderRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.trackingToken !== 'string' || !TOKEN_PATTERN.test(value.trackingToken)) return null;
  if (typeof value.reference !== 'string' || !/^TJ-[A-Za-z0-9-]{1,64}$/.test(value.reference)) return null;
  if (typeof value.storeSlug !== 'string' || value.storeSlug.length > 100 || !STORE_PATTERN.test(value.storeSlug)) return null;
  if (typeof value.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.createdAt)) return null;
  const time = Date.parse(value.createdAt);
  if (!Number.isFinite(time)) return null;
  // Explicit fields keep contacts and cart contents out even if a caller sends more.
  return {
    trackingToken: value.trackingToken,
    reference: value.reference,
    storeSlug: value.storeSlug,
    createdAt: new Date(time).toISOString(),
  };
}

function readAll(storage: RequestStorage | null): RecentOrderRequest[] {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeRequest).filter((row): row is RecentOrderRequest => row !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}

/** Private links stay on this browser, separately from the persisted query cache. */
export function readRecentOrderRequests(storeSlug: string, storage = browserStorage()): RecentOrderRequest[] {
  return readAll(storage).filter(row => row.storeSlug === storeSlug).slice(0, PER_STORE_LIMIT);
}

/** Storage failure must never turn a successfully saved request into a failed checkout. */
export function rememberRecentOrderRequest(request: RecentOrderRequest, storage = browserStorage()): boolean {
  const next = normalizeRequest(request);
  if (!next || !storage) return false;
  const counts = new Map<string, number>();
  const rows = [next, ...readAll(storage).filter(row => row.trackingToken !== next.trackingToken)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(row => {
      const count = counts.get(row.storeSlug) || 0;
      counts.set(row.storeSlug, count + 1);
      return count < PER_STORE_LIMIT;
    }).slice(0, TOTAL_LIMIT);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(rows));
    return true;
  } catch { return false; }
}

export function recentOrderRequestPath(request: RecentOrderRequest): string {
  return `/order/${encodeURIComponent(request.trackingToken)}`;
}
