// Launch 1, the first table: where an order request began.
//
// A thank-you's tea links carry `?via=<thanks_ref>`, a short random reference
// for the session (never a guest's secret). The site keeps the newest one on
// this device and sends it as `via` with the next order request, then forgets
// it. A reference older than 14 days is ignored. The server decides whether it
// counts; the order never depends on it. See worker/src/orderSessionSource.ts.
import { firstTableOpen } from './firstTable';

const KEY = 'teajia-order-via';
const LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
const FORMAT = /^[a-f0-9]{18}$/;

/** Remember the session a guest came from, when Launch 1 is open. */
export function rememberOrderVia(ref: string | null | undefined, now = Date.now()) {
  if (!firstTableOpen() || !ref || !FORMAT.test(ref)) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ref, at: now })); } catch { /* storage off: nothing kept */ }
}

/** Pick up `?via=` from the address the site was opened on. */
export function captureOrderViaFromLocation(search = typeof location === 'undefined' ? '' : location.search) {
  rememberOrderVia(new URLSearchParams(search).get('via'));
}

/** The reference to send with an order request, or undefined. */
export function currentOrderVia(now = Date.now()): string | undefined {
  if (!firstTableOpen()) return undefined;
  try {
    const held = JSON.parse(localStorage.getItem(KEY) || 'null') as { ref?: unknown; at?: unknown } | null;
    if (!held || typeof held.ref !== 'string' || !FORMAT.test(held.ref) || typeof held.at !== 'number') return undefined;
    if (now - held.at > LIFETIME_MS) { forgetOrderVia(); return undefined; }
    return held.ref;
  } catch {
    return undefined;
  }
}

/** Forget it once an order request has been sent. */
export function forgetOrderVia() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}

/** A tea page address with the session reference added, for the thank-you's links. */
export function withOrderVia(path: string, ref: string | null | undefined) {
  if (!firstTableOpen() || !ref || !FORMAT.test(ref)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}via=${ref}`;
}
