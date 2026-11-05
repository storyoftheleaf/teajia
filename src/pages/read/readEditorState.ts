import { AUTH_TOKEN_CHANGED_EVENT, readEditorSessionRequest } from '../../lib/api';

let editor = false;
let settled = false;
let revision = 0;
let inFlight: Promise<void> | null = null;
// Set-Cookie is applied by the browser before the response reaches this code.
// Serialize checks so a delayed old login cannot restore its cookie after logout.
let cookieWrites: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const getReadEditor = () => editor;

// Reset synchronously on a new token or logout: a late answer from the old
// session must never reopen its drafts in the next person's browser.
export function resetReadEditor() {
  revision += 1;
  editor = false;
  settled = false;
  inFlight = null;
  emit();
}
export function loadReadEditor(): Promise<void> {
  if (settled) return Promise.resolve();
  if (inFlight) return inFlight;
  const started = revision;
  const check = cookieWrites.then(() => started === revision ? readEditorSessionRequest() : false);
  cookieWrites = check.catch(() => {});
  inFlight = check
    .then(allowed => { if (started === revision) editor = allowed; })
    .catch(() => { if (started === revision) editor = false; })
    .finally(() => {
      if (started !== revision) return;
      settled = true;
      inFlight = null;
      emit();
    });
  return inFlight;
}
const tokenChanged = () => { resetReadEditor(); void loadReadEditor(); };
// The module lives with App, so logout also clears the cookie while the
// reader is unmounted (for example after navigating back to Shop).
if (typeof window !== 'undefined') window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, tokenChanged);
export function subscribeReadEditor(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
