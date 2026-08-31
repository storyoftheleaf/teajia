/**
 * How a customer's private tracking token travels from their own order page to
 * the public payment page, without ever entering a URL.
 *
 * The payment page is a sharing surface: it renders its own address as a QR
 * code and hands it out under a heading inviting the visitor to share it. A
 * token in the address bar would therefore be printed as a machine-readable
 * image and copied to a clipboard by a button, which is the customer's private
 * order key given away by a share control. Session storage is per tab and per
 * origin, so the token stays in neither the address bar, the history entry, the
 * copied link, the QR payload, nor the edge access log.
 *
 * Everything here fails to an absence. A new tab, a pasted link or a browser
 * restart loses the handoff, and in every one of those cases the payment page
 * must be exactly what it is today.
 */

const HANDOFF_PREFIX = 'teajia:pay-order:';

/**
 * Keyed on the reference rather than on a single slot, because a customer with
 * two open orders is the entire reason this feature exists: a shared slot would
 * hand the second order's token to the first order's payment page.
 */
function handoffKey(reference: string | null | undefined): string | null {
  const ref = (reference || '').trim();
  return ref ? `${HANDOFF_PREFIX}${ref}` : null;
}

export function rememberPayOrderToken(reference: string | null | undefined, token: string | null | undefined): void {
  const key = handoffKey(reference);
  const value = (token || '').trim();
  if (!key || !value) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private browsing modes and storage-blocked contexts throw here. The
    // payment page is complete without the summary, so a refusal to store is
    // not something to report or retry.
  }
}

export function recallPayOrderToken(reference: string | null | undefined): string | null {
  const key = handoffKey(reference);
  if (!key) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The pay link, pointed back at the origin the customer is already on.
 *
 * The worker builds pay_url against its own APP_URL, which defaults to
 * www.teajia.com, while the app also answers on teajia.com. Session storage is
 * per origin, so a navigation that crosses those two hosts would arrive with an
 * empty store and no error to explain it. Path and query are preserved exactly:
 * only the host is ours to correct.
 */
export function sameOriginPayUrl(payUrl: string | null | undefined): string | null {
  const raw = (payUrl || '').trim();
  if (!raw) return null;
  if (typeof window === 'undefined') return raw;
  try {
    const url = new URL(raw, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}
