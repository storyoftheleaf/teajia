/** Deliberately separate from the ordinary signed-in account and its JWT. */
export const LIBRARY_PREVIEW_ORIGIN = 'http://127.0.0.1:7789';
export const LIBRARY_PREVIEW_PATH = '/dev/library-preview';
const LIVE_AUTHORIZE = 'https://www.teajia.com/dev/library-preview/authorize';
const SESSION_KEY = 'teajia.library-preview.session.v1';
const PENDING_KEY = 'teajia.library-preview.pending.v1';
const BASE = 'https://www.teajia.com/api/dev/library-preview';
const PROOF = /^[A-Za-z0-9_-]{43}$/;
const CODE = /^[A-Za-z0-9_-]{32,160}$/;

export interface LibraryPreviewSession { token: string; expiresAt: number; accountId: string; grantId: string }
export function validLibraryPreviewRequest(origin: string | null, challenge: string | null): boolean {
  return origin === LIBRARY_PREVIEW_ORIGIN && PROOF.test(challenge || '');
}
function requireLocalOrigin() {
  if (window.location.origin !== LIBRARY_PREVIEW_ORIGIN) throw new Error('Library preview is restricted to the approved local address.');
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function clearLibraryPreviewSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PENDING_KEY);
}
export function readLibraryPreviewSession(): LibraryPreviewSession | null {
  if (window.location.origin !== LIBRARY_PREVIEW_ORIGIN) return null;
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as LibraryPreviewSession | null;
    if (!session || !/^tjlp_[A-Za-z0-9_-]{32,160}$/.test(session.token) || !session.accountId || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch { sessionStorage.removeItem(SESSION_KEY); return null; }
}
/** Same-tab round trip preserves the verifier without sharing it with the live page. */
export async function beginLibraryPreviewAuthorization(): Promise<void> {
  requireLocalOrigin();
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, createdAt: Date.now() }));
  const url = new URL(LIVE_AUTHORIZE);
  url.searchParams.set('origin', LIBRARY_PREVIEW_ORIGIN);
  url.searchParams.set('challenge', challenge);
  window.location.assign(url.href);
}
let redemption: Promise<LibraryPreviewSession | null> | null = null;
/** A remount must not race redemption of the same one-use code. */
export function redeemLibraryPreviewCode(): Promise<LibraryPreviewSession | null> {
  if (!redemption) redemption = redeemCode().finally(() => { redemption = null; });
  return redemption;
}
/** Remove the one-use code from the address bar before any network work. */
async function redeemCode(): Promise<LibraryPreviewSession | null> {
  requireLocalOrigin();
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has('code')) return readLibraryPreviewSession();
  const code = fragment.get('code') || '';
  window.history.replaceState(null, '', LIBRARY_PREVIEW_PATH);
  let pending: { verifier: string; createdAt: number } | null = null;
  try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { /* invalid pending state */ }
  sessionStorage.removeItem(PENDING_KEY);
  if (!CODE.test(code) || !pending || !PROOF.test(pending.verifier) || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt > 10 * 60_000 || pending.createdAt > Date.now()) {
    throw new Error('This preview link expired or was opened in another tab. Connect again from the preview.');
  }
  const response = await fetch(`${BASE}/redeem`, {
    method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier: pending.verifier, origin: LIBRARY_PREVIEW_ORIGIN }),
  });
  if (!response.ok) throw new Error('The preview connection could not be verified. Connect again.');
  const session: LibraryPreviewSession = await response.json();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const valid = readLibraryPreviewSession();
  if (!valid) throw new Error('The preview connection returned an invalid session.');
  return valid;
}
/** No arbitrary route or method: this capability can only read the Library snapshot. */
export async function libraryPreviewFetchSnapshot<T>(): Promise<T> {
  requireLocalOrigin();
  const session = readLibraryPreviewSession();
  if (!session) throw new Error('Connect your Library to preview its real records.');
  const response = await fetch(`${BASE}/snapshot`, {
    method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (response.status === 401 || response.status === 403) {
    clearLibraryPreviewSession();
    throw new Error('Preview access expired or was revoked. Connect again.');
  }
  if (!response.ok) throw new Error('The Library could not be loaded. Please retry.');
  return response.json() as Promise<T>;
}
