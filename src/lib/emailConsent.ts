// Email about tea: what a person agrees to at sign-up and keeps in their
// account (Adrian, 2026-11-28). Shared by the sign-up page, the account page
// and the worker, so the words a person saw are the words kept with their yes.
//
// Emails about a person's own orders are not part of this: they always come.
// This is the optional part, Teajia's own letters and the hosts they choose.
//
// The words are placeholders until Adrian confirms them. A change of words is
// a new version, so every kept choice still says what was shown.

export const EMAIL_CONSENT_WORDING_VERSION = 'email-1';

/** The one line beside the box on sign-up. */
export const SIGNUP_EMAIL_CONSENT_LABEL = 'Teajia and the hosts I choose may email me about teas and tables.';

/** The account page: Teajia's own letters. */
export const ACCOUNT_EMAIL_TEAJIA_LABEL = 'Teajia may email me about new teas and tables.';

/** The account page: what a host's box means. */
export const ACCOUNT_EMAIL_HOSTS_HEADING = 'Hosts who may email me';

/** Said once on the account page, where it matters. */
export const ORDER_EMAILS_LINE = 'Emails about orders and updates will always come to me.';

/**
 * Countries where a box ticked in advance is not consent (GDPR and UK GDPR,
 * with Switzerland's FADP read the same way): the EU, the rest of the EEA,
 * the United Kingdom and Switzerland. A visitor from one of them sees the box
 * empty and ticks it themselves.
 */
const ASK_UNTICKED = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
  'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
]);

/**
 * Whether the sign-up box opens ticked for a visitor from this country
 * (Cloudflare's two-letter code). A country not known opens it empty.
 */
export function emailConsentTickedFor(country: string | null | undefined): boolean {
  const code = (country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return false;
  return !ASK_UNTICKED.has(code);
}
