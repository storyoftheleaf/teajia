export type PaymentMethodType = 'bank_transfer' | 'payment_link' | 'provider_qr' | 'other';

export interface PaymentMethodRow {
  id: string;
  contributor_id: string;
  account_id: string | null;
  method_type: PaymentMethodType;
  label: string;
  recipient_name: string;
  account_identifier: string | null;
  instructions: string | null;
  external_url: string | null;
  qr_image_url: string | null;
  position: number;
  is_published: number;
}

export interface FavoriteRow {
  contributor_id: string;
  tea_profile_id: string;
  note: string | null;
  position: number;
  is_public: number;
}

export interface PublicTeaProjection {
  id: string;
  is_public: boolean;
  [key: string]: unknown;
}

const LANGUAGE_LIMIT = 12;
const LANGUAGE_LABEL_LIMIT = 40;
const PAYMENT_REFERENCE_LIMIT = 72;
const SUPPORTED_PAYMENT_CURRENCIES = new Set([
  'AUD', 'CNY', 'EUR', 'GBP', 'HKD', 'IDR', 'JPY', 'MYR', 'SGD', 'TWD', 'USD',
]);

// The public pay page rejects any currency outside this set (parsePublicPaymentContext
// below, and its mirror in src/components/profile/profileDomain.ts). Anything that
// builds a pay link must ask here first, so a link never lands on an error state.
export function isSupportedPaymentCurrency(value: unknown): boolean {
  return typeof value === 'string' && SUPPORTED_PAYMENT_CURRENCIES.has(value.trim().toUpperCase());
}

export function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const label = item.trim().slice(0, LANGUAGE_LABEL_LIMIT);
    if (!label) continue;
    const duplicate = [...unique].some(existing => existing.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (!duplicate) unique.add(label);
    if (unique.size === LANGUAGE_LIMIT) break;
  }
  return [...unique];
}

export interface PublicPaymentContext {
  amount: string | null;
  currency: string | null;
  reference: string | null;
  errors: Array<'invalid_amount' | 'unsupported_currency' | 'invalid_reference'>;
}

export function parsePublicPaymentContext(search: URLSearchParams): PublicPaymentContext {
  const errors: PublicPaymentContext['errors'] = [];
  const rawAmount = search.get('amount')?.trim() ?? '';
  const rawCurrency = search.get('currency')?.trim().toUpperCase() ?? '';
  const rawReference = search.get('reference')?.trim() ?? '';

  let amount: string | null = null;
  if (rawAmount) {
    if (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(rawAmount) && Number(rawAmount) > 0) amount = rawAmount;
    else errors.push('invalid_amount');
  }

  let currency: string | null = null;
  if (rawCurrency) {
    if (SUPPORTED_PAYMENT_CURRENCIES.has(rawCurrency)) currency = rawCurrency;
    else errors.push('unsupported_currency');
  }

  let reference: string | null = null;
  if (rawReference) {
    if (rawReference.length <= PAYMENT_REFERENCE_LIMIT && !/[<>\u0000-\u001f]/.test(rawReference)) reference = rawReference;
    else errors.push('invalid_reference');
  }

  return { amount, currency, reference, errors };
}

export function resolvePublishedPaymentMethods(
  methods: PaymentMethodRow[],
  accountId: string | null,
): PaymentMethodRow[] {
  const published = methods.filter(method => method.is_published === 1);
  const accountMethods = accountId
    ? published.filter(method => method.account_id === accountId)
    : [];
  const selected = accountMethods.length
    ? accountMethods
    : published.filter(method => method.account_id === null);
  return [...selected].sort((left, right) => left.position - right.position || left.label.localeCompare(right.label));
}

export function projectPublicPaymentMethod(method: PaymentMethodRow) {
  const {
    id,
    method_type,
    label,
    recipient_name,
    account_identifier,
    instructions,
    external_url,
    qr_image_url,
    position,
    is_published,
  } = method;
  return {
    id,
    method_type,
    label,
    recipient_name,
    account_identifier,
    instructions,
    external_url,
    qr_image_url,
    position,
    is_published: is_published === 1,
  };
}

export function projectPublicFavorite<TTea extends PublicTeaProjection>(
  favorite: FavoriteRow,
  tea: TTea,
) {
  if (favorite.is_public !== 1 || !tea.is_public) return null;
  return {
    tea_profile_id: favorite.tea_profile_id,
    note: favorite.note,
    position: favorite.position,
    tea,
  };
}
