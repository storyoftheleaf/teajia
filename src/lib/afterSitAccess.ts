import { API_URL, authedBlobFetch, authedFetch, fetchWithTimeout } from './api';

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
  /** Launch 3 (J8): the session was a tasting; `journal_teas` are the poured teas that have a record. */
  is_tasting?: boolean;
  journal_teas?: Array<{ id: string; name: string; product_id: string }>;
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

/** One photograph from the table. `taker_first_name` is present only when the taker chose to show it. */
export type SessionGalleryPhoto = { id: string; alt_text: string; taker_first_name: string | null; own: boolean };
export type SessionGallery = { photos: SessionGalleryPhoto[]; can_add: boolean; waiting: boolean };
type GalleryIdentity = { accountId: string | null; userId: string };

const galleryEndpoint = `${API_URL}/api/after-sit/gallery`;
const galleryOptions = (credential: string, body: object, expectedAuth: GalleryIdentity, signal?: AbortSignal) => ({
  expectedAuth, cache: 'no-store', referrerPolicy: 'no-referrer', reportIncident: false, background: true,
  method: 'POST', body: JSON.stringify({ credential, ...body }), signal,
} as const);

/**
 * Launch 3 (J7): the session gallery on the after-sit page. Read by a signed-in
 * person holding a seat link for this session (the booking's own or a personal
 * party link). Photographs are offered and withdrawn through the Guest Book.
 */
export const sessionGalleryApi = {
  list: async (credential: string, identity: GalleryIdentity, signal?: AbortSignal): Promise<SessionGallery> => {
    const gallery = await authedFetch(galleryEndpoint, galleryOptions(credential, { action: 'read' }, identity, signal)) as Partial<SessionGallery> | null;
    return {
      photos: Array.isArray(gallery?.photos) ? gallery.photos : [],
      can_add: gallery?.can_add === true,
      waiting: gallery?.waiting === true,
    };
  },
  bytes: (credential: string, grantId: string, identity: GalleryIdentity, signal?: AbortSignal) =>
    authedBlobFetch(galleryEndpoint, galleryOptions(credential, { action: 'bytes', grantId }, identity, signal)),
  /** Keeps this sit's setup privately (a no-op when already kept): a photograph is saved there before it is offered. */
  keepSetup: (credential: string, identity: GalleryIdentity) =>
    authedFetch(`${API_URL}/api/after-sit/setup`, {
      expectedAuth: identity, cache: 'no-store', referrerPolicy: 'no-referrer', reportIncident: false,
      method: 'POST', body: JSON.stringify({ credential, action: 'save' }), retryTimeouts: true,
    }),
};
