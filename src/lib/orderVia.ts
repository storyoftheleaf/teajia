// Launch 1, the first table: where an order request began.
//
// A thank-you's tea links carry `?via=<thanks_ref>`, a short random reference
// for the session (never a guest's secret). The site keeps the newest one on
// this device and sends it as `via` with the next order request, then forgets
// it. A reference older than 14 days is ignored. Opening the same address again
// (a reload, a saved link) neither brings back a reference already used for an
// order nor restarts its 14 days; only a new tap on a thank-you does. The server decides whether it
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

type Held = { ref: string; at: number; spent?: boolean };

function readHeld(): Held | null {
  try {
    const held = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Held> | null;
    if (!held || typeof held.ref !== 'string' || !FORMAT.test(held.ref) || typeof held.at !== 'number') return null;
    return { ref: held.ref, at: held.at, spent: held.spent === true };
  } catch {
    return null;
  }
}

/** Pick up `?via=` from the address the site was opened on. */
export function captureOrderViaFromLocation(search = typeof location === 'undefined' ? '' : location.search, now = Date.now()) {
  const ref = new URLSearchParams(search).get('via');
  const held = readHeld();
  if (held && held.ref === ref && now - held.at <= LIFETIME_MS) return;
  rememberOrderVia(ref, now);
}

/** The reference to send with an order request, or undefined. */
export function currentOrderVia(now = Date.now()): string | undefined {
  if (!firstTableOpen()) return undefined;
  const held = readHeld();
  if (!held || held.spent) return undefined;
  if (now - held.at > LIFETIME_MS) { clearHeld(); return undefined; }
  return held.ref;
}

function clearHeld() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}

/** Forget it once an order request has been sent. The used reference is kept,
 *  marked spent, until its 14 days end, so reopening its address cannot revive it. */
export function forgetOrderVia() {
  const held = readHeld();
  if (!held) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...held, spent: true })); } catch { clearHeld(); }
}

/** A tea page address with the session reference added, for the thank-you's links. */
export function withOrderVia(path: string, ref: string | null | undefined) {
  if (!firstTableOpen() || !ref || !FORMAT.test(ref)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}via=${ref}`;
}
