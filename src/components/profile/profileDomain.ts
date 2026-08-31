import { referenceFromPayUrl } from '../shared/paymentClaimDomain';
import type {
  FavoriteTea,
  FavoriteWrite,
  PaymentContext,
  PaymentLocalAmount,
  PaymentOrderLine,
  PaymentOrderSummaryData,
  ProfileAssociation,
  ProfileFavorite,
  SelfProfile,
} from './types';

const SUPPORTED_CURRENCIES = new Set([
  'AUD', 'CNY', 'EUR', 'GBP', 'HKD', 'IDR', 'JPY', 'MYR', 'SGD', 'TWD', 'USD',
]);
const REFERENCE_LIMIT = 72;

export function moveFavorite<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    return [...items];
  }
  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export function visiblePublicFavorites(items: ProfileFavorite[]): ProfileFavorite[] {
  return items
    .filter(item => item.is_public && item.tea?.is_public)
    .sort((left, right) => left.position - right.position);
}

export function parsePaymentContext(search: URLSearchParams): PaymentContext {
  const errors: string[] = [];
  const rawAmount = search.get('amount')?.trim() ?? '';
  const rawCurrency = search.get('currency')?.trim().toUpperCase() ?? '';
  const rawReference = search.get('reference')?.trim() ?? '';

  let amount: string | null = null;
  if (rawAmount) {
    if (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(rawAmount) && Number(rawAmount) > 0) amount = rawAmount;
    else errors.push('The amount in this link is not valid.');
  }

  let currency: string | null = null;
  if (rawCurrency) {
    if (SUPPORTED_CURRENCIES.has(rawCurrency)) currency = rawCurrency;
    else errors.push('The currency in this link is not supported.');
  }

  let reference: string | null = null;
  if (rawReference) {
    if (rawReference.length <= REFERENCE_LIMIT && !/[<>\u0000-\u001f]/.test(rawReference)) reference = rawReference;
    else errors.push('The payment reference in this link is not valid.');
  }

  // The currency the customer thinks in, which is not the currency the order is
  // owed in. Held to exactly the same bar as the others: this page is reachable
  // by URL from anywhere, so an unrecognised code is refused and said to have
  // been refused rather than passed through to a lookup.
  const rawDisplay = search.get('display')?.trim().toUpperCase() ?? '';
  let display: string | null = null;
  if (rawDisplay) {
    if (!SUPPORTED_CURRENCIES.has(rawDisplay)) {
      errors.push('The local currency in this link is not supported.');
    } else if (rawDisplay !== (currency ?? 'USD')) {
      // A link asking to show dollars beside dollars is valid and pointless.
      // It is dropped rather than reported, and nothing extra is rendered.
      display = rawDisplay;
    }
  }

  return { amount, currency, reference, display, errors };
}

/**
 * The approximate figure the worker converted, read back without trusting it.
 *
 * A number the customer might act on has to survive a malformed, stale or
 * hostile response as an absence, not as a zero: "about IDR 0" beside a real
 * dollar figure is worse than showing nothing at all.
 */
export function normalizeLocalAmount(raw: unknown): PaymentLocalAmount | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const currency = typeof value.currency === 'string' ? value.currency.trim().toUpperCase() : '';
  if (!SUPPORTED_CURRENCIES.has(currency)) return null;

  const amount = typeof value.amount === 'string' ? value.amount.trim() : '';
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) || Number(amount) <= 0) return null;

  const rate = Number(value.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const asOf = typeof value.as_of === 'string' ? value.as_of.trim() : '';
  if (!asOf || Number.isNaN(new Date(asOf).getTime())) return null;

  return { currency, amount, rate, as_of: asOf };
}

/**
 * The local figure, grouped the way the reader's own locale groups numbers.
 *
 * An Indonesian total is seven digits long and unreadable without separators,
 * and the separators differ by locale, so the platform's formatter does the
 * work rather than a hand rolled one. The ISO code leads because every code is
 * three letters, which keeps the digits of this figure in line with the digits
 * of the dollar figure above it.
 */
export function formatLocalAmount(local: PaymentLocalAmount | null | undefined): string | null {
  if (!local) return null;
  const value = Number(local.amount);
  if (!Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: local.currency,
      currencyDisplay: 'code',
    }).format(value);
  } catch {
    return `${local.currency} ${local.amount}`;
  }
}

/**
 * When the rate was taken, on the reader's own clock.
 *
 * Stated plainly because the number it qualifies is an approximation from an
 * hourly rate, and a customer comparing it against their banking app deserves
 * to know how old it is rather than to discover the gap after the transfer.
 */
export function formatRateTakenAt(local: PaymentLocalAmount | null | undefined): string | null {
  if (!local) return null;
  const taken = new Date(local.as_of);
  if (Number.isNaN(taken.getTime())) return null;
  // Day and time are joined by hand. Asking the platform for both at once
  // returns its own "August 30 at 03:00 PM", which lands a second "at" inside
  // a sentence that already has one.
  const day = taken.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  const time = taken.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/**
 * The sentence under the approximate figure.
 *
 * It names the dollar figure as the amount owed, because that is the whole
 * point of showing the other one: a customer in Jakarta reads a dollar total,
 * transfers rupiah, and the number that lands never matches the order. The
 * local figure exists to make that transfer land close, and this line exists so
 * it is never mistaken for the debt.
 */
export function localAmountNote(
  local: PaymentLocalAmount | null | undefined,
  context: Pick<PaymentContext, 'amount' | 'currency'>,
): string | null {
  const takenAt = formatRateTakenAt(local);
  if (!takenAt) return null;
  const approximation = `An approximation from the exchange rate held on ${takenAt}.`;
  if (!context.amount) return approximation;
  return `${approximation} ${context.currency ?? 'USD'} ${context.amount} is the amount owed.`;
}

export function buildPaymentPageUrl(
  slug: string,
  accountSlug?: string | null,
  origin?: string,
  context?: PaymentContext,
): string {
  const base = origin ?? (typeof window === 'undefined' ? 'https://teajia.com' : window.location.origin);
  const url = new URL(`/people/${encodeURIComponent(slug)}/pay`, base);
  if (accountSlug) url.searchParams.set('account', accountSlug);
  if (context?.amount) url.searchParams.set('amount', context.amount);
  if (context?.currency) url.searchParams.set('currency', context.currency);
  if (context?.reference) url.searchParams.set('reference', context.reference);
  // Carried so the store tabs on the pay page, which rebuild this link, do not
  // silently drop the customer's own currency when they switch between stores.
  if (context?.display) url.searchParams.set('display', context.display);
  return url.toString();
}

const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * The same shape the worker will accept, checked before the request leaves.
 *
 * A hand edited or truncated token should be an absence on this page, not a
 * 404 the customer never sees but the console does.
 */
export function isTrackingTokenShaped(value: string | null | undefined): value is string {
  return typeof value === 'string' && TRACKING_TOKEN_PATTERN.test(value);
}

/**
 * The date in the order page's own words, because this block exists to be
 * recognised rather than read. Different formatting of the same date reads as
 * a different date.
 */
export function formatOrderPlacedOn(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const placed = new Date(raw);
  if (Number.isNaN(placed.getTime())) return null;
  return placed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The order behind the token, read back without trusting any of it.
 *
 * Everything here fails to null rather than to a partial block. A summary that
 * renders half an order beside a real amount is more convincing than no
 * summary and worse than one, so anything unexpected in the payload ends the
 * attempt: a payload that is not an object, items that will not parse, an
 * empty order, or a reference that disagrees with the one already printed on
 * this page. That last case is the whole feature inverted: one order's teas
 * shown beside another order's balance.
 *
 * The order's own ref_number is deliberately not what gets compared. The
 * reference on the payment page is the invoice number, drawn from the
 * account's invoice sequence when the request was priced, so the two
 * identifiers never match and a check between them would suppress every
 * summary that has ever existed. The honest comparison is against the
 * reference in the order's own pay link, which is where the page's reference
 * came from in the first place.
 */
export function toPaymentOrderSummary(
  raw: unknown,
  pageReference: string | null,
): PaymentOrderSummaryData | null {
  if (!raw || typeof raw !== 'object') return null;
  const order = raw as Record<string, unknown>;

  const payment = order.payment as { pay_url?: string | null } | null | undefined;
  const ref = referenceFromPayUrl(payment?.pay_url)?.trim() ?? '';
  if (pageReference && ref !== pageReference.trim()) return null;

  let parsed: unknown;
  try {
    parsed = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const lines: PaymentOrderLine[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') return null;
    const line = entry as Record<string, unknown>;
    const name = typeof line.name === 'string' ? line.name.trim() : '';
    const grams = Number(line.quantityGrams);
    if (!name || !Number.isFinite(grams) || grams <= 0) return null;
    // The two forms the order page uses, kept identical to it. A customer who
    // read "100g" a screen ago should read "100g" here, not "100 grams".
    lines.push({ name, quantity: line.category === 'tea' ? `${grams}g` : `×${grams}` });
  }

  return { lines, placedOn: formatOrderPlacedOn(order.created_at) };
}

export interface ProfileReadinessItem {
  id: 'profile' | 'associations' | 'selection' | 'favorites' | 'payments';
  label: string;
  detail: string;
  ready: boolean;
}

export function profileReadiness(
  profile: SelfProfile,
  counts: { publicFavorites: number; paymentMethods: number },
): ProfileReadinessItem[] {
  const associationCount = profile.associations.length;
  const selectionCount = profile.selection_count ?? 0;
  const identityReady = Boolean(profile.display_name.trim() && profile.beginnings?.trim());
  return [
    { id: 'profile', label: 'Public identity', detail: identityReady ? 'Core profile is complete' : 'Add a name and biography', ready: identityReady },
    { id: 'associations', label: 'Accounts', detail: associationCount === 1 ? '1 associated account' : `${associationCount} associated accounts`, ready: associationCount > 0 },
    { id: 'selection', label: 'Tea selection', detail: selectionCount === 1 ? '1 tea selected' : `${selectionCount} teas selected`, ready: selectionCount > 0 },
    { id: 'favorites', label: 'Public favorites', detail: `${counts.publicFavorites} shared`, ready: counts.publicFavorites > 0 },
    { id: 'payments', label: 'Payments', detail: counts.paymentMethods === 1 ? '1 public method' : `${counts.paymentMethods} public methods`, ready: counts.paymentMethods > 0 },
  ];
}

export function primaryTeaMasterAccount(associations: ProfileAssociation[]): ProfileAssociation | null {
  return [...associations]
    .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
    .find(association => association.account_kind === 'master' && association.is_host) ?? null;
}

export function canManageHostedMasterSelection(
  primary: ProfileAssociation | null,
  activeAccountId: string | null,
  hasStockAccess: boolean,
): boolean {
  return Boolean(hasStockAccess && primary && primary.account_id === activeAccountId);
}

export function canStartProfileDraft(canCreate: boolean, _activeAccountId: string | null): boolean {
  return canCreate;
}

export function favoriteWriteFromTea(tea: FavoriteTea): FavoriteWrite {
  return {
    tea_profile_id: tea.id,
    source_account_id: tea.source_account_id || undefined,
    source_product_id: tea.source_product_id || undefined,
    source_listing_id: tea.source_listing_id || undefined,
    note: null,
    is_public: false,
  };
}

export function profileStatus(profile: SelfProfile): { label: string; detail: string } {
  if (profile.is_published || profile.publication_state === 'published') {
    return { label: 'Published', detail: 'Your public Tea Master profile is live.' };
  }
  if (profile.approval_state === 'pending' || profile.publication_state === 'awaiting_approval') {
    return { label: 'Awaiting approval', detail: 'Your draft is saved. An owner must approve publication.' };
  }
  if (profile.approval_state === 'changes_requested') {
    return { label: 'Changes requested', detail: 'Update the profile, then save a new draft for review.' };
  }
  if (profile.publication_state === 'unpublished') {
    return { label: 'Unpublished', detail: 'The profile is private. Your draft and public material are preserved.' };
  }
  return { label: 'Draft', detail: 'Complete the basics and save them for owner review.' };
}
