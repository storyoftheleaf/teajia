import type { FavoriteTea, FavoriteWrite, PaymentContext, ProfileAssociation, ProfileFavorite, SelfProfile } from './types';

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

  return { amount, currency, reference, errors };
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
  return url.toString();
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
