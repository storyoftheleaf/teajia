// Pay is private, and approval is permanent (migration 0022).
//
// The rules that decide whether a visitor may see a contributor's transfer
// details, kept apart from the handlers so a test can pin them without
// standing up a request. Two doors, and only two:
//
//   - an ACCOUNT the contributor approved (payment_access_grants, status
//     'approved'); there is no revoke and no expiry, so an approval is read
//     as a fact, never re-checked against a date;
//   - a LINK the contributor handed out (payment_share_links); the token in
//     the URL is the whole capability, so there is never an "I have a link"
//     step to type it into.
//
// The contributor always sees their own sheet. Everyone else meets the gate.

export const PAY_LINK_PARAM = 't';

/** 32 hex characters from the platform's random source. Not a JWT, not signed:
 *  it is looked up, so there is nothing to forge and nothing to expire. */
export function mintShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function isShareTokenShaped(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

export type PayAccessVia = 'owner' | 'approved' | 'link';

export interface PayAccessInputs {
  /** The signed-in viewer IS the contributor. */
  isOwner: boolean;
  /** The signed-in viewer holds an approved grant for this contributor. */
  hasApprovedGrant: boolean;
  /** The URL carried a token that resolves to one of this contributor's links. */
  hasValidLink: boolean;
}

export function decidePayAccess(inputs: PayAccessInputs): { access: 'open'; via: PayAccessVia } | { access: 'gate'; via: null } {
  if (inputs.isOwner) return { access: 'open', via: 'owner' };
  // A link wins over a grant only in what it reports: the link is what the
  // person actually followed, and it may carry an invoice's amount.
  if (inputs.hasValidLink) return { access: 'open', via: 'link' };
  if (inputs.hasApprovedGrant) return { access: 'open', via: 'approved' };
  return { access: 'gate', via: null };
}

/** Put the token on a pay URL, replacing any token already there. */
export function withShareToken(payUrl: string, token: string): string {
  const url = new URL(payUrl);
  url.searchParams.set(PAY_LINK_PARAM, token);
  return url.toString();
}

/** A WhatsApp deep link that opens a chat with the pay link prefilled.
 *  `phone` is optional: without it WhatsApp asks who to send to. */
export function whatsappShareUrl(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
