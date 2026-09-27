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

// contributors.links, retyped by migration 0021 from a flat {label, url}
// pair to a typed link with a fixed platform vocabulary. A WeChat entry
// carries an id rather than a url, and only a WeChat entry ever carries a
// QR image, which is why the old shape could not say either.
export const CONTRIBUTOR_LINK_PLATFORMS = ['wechat', 'instagram', 'website', 'other'] as const;
export type ContributorLinkPlatform = typeof CONTRIBUTOR_LINK_PLATFORMS[number];

export interface ContributorLink {
  platform: ContributorLinkPlatform;
  value: string;
  // The old label ("WeChat", "Instagram"), carried forward when migration
  // 0021 rewrote a link it could not confidently name a platform for. Never
  // required on a write: a link created straight in the new shape has no
  // label to lose.
  label?: string;
  qr_image_url: string | null;
}

const LINK_VALUE_LIMIT = 200;

function isContributorLinkPlatform(value: unknown): value is ContributorLinkPlatform {
  return typeof value === 'string' && (CONTRIBUTOR_LINK_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Reads the stored `links` column back into typed rows. Anything that does
 * not carry a recognised platform and a value is dropped rather than thrown,
 * the same "read at use time" stance the rest of this file takes with
 * malformed JSON: a bad row should not take the whole profile down.
 */
export function parseStoredContributorLinks(raw: string | null | undefined): ContributorLink[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const result: ContributorLink[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const platform = (item as Record<string, unknown>).platform;
    const value = (item as Record<string, unknown>).value;
    if (!isContributorLinkPlatform(platform) || typeof value !== 'string' || !value.trim()) continue;
    const qr = (item as Record<string, unknown>).qr_image_url;
    const rawLabel = (item as Record<string, unknown>).label;
    const link: ContributorLink = { platform, value, qr_image_url: typeof qr === 'string' && qr.trim() ? qr : null };
    if (typeof rawLabel === 'string' && rawLabel.trim()) link.label = rawLabel.trim();
    result.push(link);
  }
  return result;
}

/**
 * Validates a write to `links` in the new shape. Returns the typed array,
 * not a pre-stringified column value, so the caller decides when to
 * `JSON.stringify` it, the same contract `normalizeLanguages` already uses
 * for the `languages` column.
 */
export function normalizeContributorLinks(value: unknown): { value?: ContributorLink[]; error?: string } {
  if (value === undefined) return {};
  if (!Array.isArray(value)) return { error: 'links must be an array' };
  const normalized: ContributorLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return { error: 'Each link must have a platform and a value' };
    const rawPlatform = (item as Record<string, unknown>).platform;
    if (!isContributorLinkPlatform(rawPlatform)) {
      return { error: `Each link's platform must be one of ${CONTRIBUTOR_LINK_PLATFORMS.join(', ')}` };
    }
    const rawValue = typeof (item as Record<string, unknown>).value === 'string'
      ? ((item as Record<string, unknown>).value as string).trim()
      : '';
    if (!rawValue || rawValue.length > LINK_VALUE_LIMIT) {
      return { error: 'Each link must have a value' };
    }
    if (rawPlatform === 'website') {
      let url: URL;
      try { url = new URL(rawValue); } catch { return { error: 'A website link needs a valid https URL as its value' }; }
      if (url.protocol !== 'https:') return { error: 'A website link needs a valid https URL as its value' };
    }
    let qrImageUrl: string | null = null;
    const rawQr = (item as Record<string, unknown>).qr_image_url;
    if (rawQr !== undefined && rawQr !== null) {
      if (typeof rawQr !== 'string') return { error: 'qr_image_url must be a string or null' };
      const trimmedQr = rawQr.trim();
      if (trimmedQr) {
        let qrUrl: URL;
        try { qrUrl = new URL(trimmedQr); } catch { return { error: 'qr_image_url must be a valid https URL' }; }
        if (qrUrl.protocol !== 'https:') return { error: 'qr_image_url must be a valid https URL' };
        qrImageUrl = qrUrl.toString();
      }
    }
    const rawLabel = (item as Record<string, unknown>).label;
    if (rawLabel !== undefined && rawLabel !== null && typeof rawLabel !== 'string') {
      return { error: 'label must be a string or null' };
    }
    const trimmedLabel = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    const link: ContributorLink = { platform: rawPlatform, value: rawValue, qr_image_url: qrImageUrl };
    if (trimmedLabel) link.label = trimmedLabel;
    normalized.push(link);
  }
  return { value: normalized };
}

// contributor_gallery_images (migration 0020): one row per photo, same
// row-per-item shape as FavoriteRow and PaymentMethodRow above.
export interface GalleryImageRow {
  id: string;
  contributor_id: string;
  image_url: string;
  caption: string | null;
  position: number;
}

export function projectPublicGalleryImage(image: GalleryImageRow) {
  const { id, image_url, caption, position } = image;
  return { id, image_url, caption, position };
}
