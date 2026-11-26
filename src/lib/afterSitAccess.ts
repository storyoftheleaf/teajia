import { API_URL, fetchWithTimeout } from './api';

type AfterSitWindow = Window & { __teajiaAfterSit?: string };

let captured = { credential: '', revision: 0 };
const listeners = new Set<() => void>();

export function captureAfterSitCredential() {
  const browser = window as AfterSitWindow;
  captured = { credential: browser.__teajiaAfterSit ?? '', revision: 0 };
  delete browser.__teajiaAfterSit;
  window.addEventListener('hashchange', () => {
    if (!/^\/after-sit\/?$/.test(location.pathname) || !/^#[a-f0-9]{64}$/.test(location.hash)) return;
    captured = { credential: location.hash.slice(1), revision: captured.revision + 1 };
    history.replaceState(history.state, '', location.pathname + location.search);
    listeners.forEach(listener => listener());
  });
}

export function getAfterSitCredential() {
  return captured;
}

export function subscribeAfterSitCredential(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export type AfterSitRecap = {
  event: { id: string; title: string; event_date: string };
  host_note: string | null;
  /**
   * `path` is the tea's own page when it has a public one; `kept` is filled
   * only when the caller is signed in (Launch 1, src/lib/firstTable.ts).
   */
  teas: Array<{ id: string; name: string; path?: string | null; kept?: boolean }>;
  playlist_url?: string | null;
  reading?: { slug: string; title: string } | null;
  /** Carried as `via` on the thank-you's tea links; never the seat's secret. */
  thanks_ref?: string | null;
};

/**
 * `signInToken` is passed only when Launch 1 is open and the guest is signed
 * in, so the recap can say which teas are already in their Tea Chest.
 */
export async function lookupAfterSitRecap(credential: string, signInToken?: string | null) {
  const response = await fetchWithTimeout(`${API_URL}/api/after-sit/recap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(signInToken ? { Authorization: `Bearer ${signInToken}` } : {}) },
    body: JSON.stringify({ credential }),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    reportIncident: false,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The recap could not be loaded.');
  return response.json() as Promise<AfterSitRecap>;
}

export async function afterSitDeviceKey(credential: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`device:${credential}`));
  return `teajia-after-sit-${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Launch 1: keep one poured tea in the signed-in guest's Tea Chest. Null when the link no longer allows it. */
export async function keepAfterSitTea(credential: string, teaId: string, signInToken: string) {
  const response = await fetchWithTimeout(`${API_URL}/api/after-sit/keep-tea`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signInToken}` },
    body: JSON.stringify({ credential, teaId }),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    reportIncident: false,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The tea could not be kept.');
  return (await response.json() as { item: import('./teaChestTypes').CellarItem }).item;
}
