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
  teas: Array<{ id: string; name: string }>;
};

export async function lookupAfterSitRecap(credential: string) {
  const response = await fetchWithTimeout(`${API_URL}/api/after-sit/recap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
