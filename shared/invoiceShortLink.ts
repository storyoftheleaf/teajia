// The short invoice link: teajia.com/i/TJB-00007-c6c1e92016bf (Adrian, 2026-11-27).
//
// The long pay link carries the recipient, store, amount, currency, reference
// and share token in its query string. The short one carries only the invoice
// number and the first twelve characters of that same share token; the site
// looks the rest up from the invoice when it is opened, so the amount is what
// is owed at that moment, never what was owed when the link was copied.
//
// Twelve hex characters are 48 bits: with the invoice number in plain sight,
// a guesser still faces 2^48 tries per invoice. The full token never appears
// in the short link, and the long link keeps working exactly as before.

export const SHORT_LINK_TOKEN_CHARS = 12;
export const SHORT_LINK_PATH = '/i/';

const TOKEN_PREFIX = new RegExp(`^[0-9a-f]{${SHORT_LINK_TOKEN_CHARS}}$`);
const REFERENCE_LIMIT = 72;

function referenceIsSafe(reference: string): boolean {
  return reference.length > 0 && reference.length <= REFERENCE_LIMIT
    && ![...reference].some(char => char === '<' || char === '>' || char === '/' || char.charCodeAt(0) < 32);
}

/** The code after /i/, or null when the invoice has no usable number or token. */
export function invoiceShortCode(reference: string | null | undefined, token: string | null | undefined): string | null {
  const ref = (reference ?? '').trim();
  const prefix = (token ?? '').slice(0, SHORT_LINK_TOKEN_CHARS);
  if (!referenceIsSafe(ref) || !TOKEN_PREFIX.test(prefix)) return null;
  return `${ref}-${prefix}`;
}

export function invoiceShortPath(reference: string | null | undefined, token: string | null | undefined): string | null {
  const code = invoiceShortCode(reference, token);
  return code ? `${SHORT_LINK_PATH}${encodeURIComponent(code)}` : null;
}

/** Undo invoiceShortCode. The reference may itself hold dashes; the token part never does. */
export function parseInvoiceShortCode(code: string | null | undefined): { reference: string; tokenPrefix: string } | null {
  let raw = (code ?? '').trim();
  try { raw = decodeURIComponent(raw); } catch { return null; }
  const cut = raw.lastIndexOf('-');
  if (cut <= 0) return null;
  const reference = raw.slice(0, cut);
  const tokenPrefix = raw.slice(cut + 1).toLowerCase();
  if (!referenceIsSafe(reference) || !TOKEN_PREFIX.test(tokenPrefix)) return null;
  return { reference, tokenPrefix };
}

/** The origin a short link is printed on: the bare domain, which forwards to www. */
export function shortLinkOrigin(appOrigin: string): string {
  return appOrigin.replace(/\/$/, '').replace('://www.', '://');
}
