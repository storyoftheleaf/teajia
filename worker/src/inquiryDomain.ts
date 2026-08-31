const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * Caps on what an unauthenticated caller may file.
 *
 * A line used to be forced to name a real product, and that requirement was
 * doing double duty as the anti-junk gate. Custom lines exist now, so the gate
 * is stated properly instead: a bounded number of lines, a bounded name, and a
 * bounded note.
 */
export const INQUIRY_MAX_ITEMS = 50;
export const INQUIRY_MAX_ITEM_NAME = 120;
export const INQUIRY_MAX_NOTE = 2000;

export interface NormalizedCartInquiry {
  storeSlug: string;
  trackingToken: string;
  refNumber: string;
  items: unknown[];
  itemsJson: string;
  totalUsd: number;
  currency: string;
}

export type CartInquiryNormalization =
  | { ok: true; value: NormalizedCartInquiry }
  | { ok: false; error: string };

export function isValidTrackingToken(value: unknown): value is string {
  return typeof value === 'string' && TRACKING_TOKEN_PATTERN.test(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function inquiryRequestFingerprint(input: {
  accountId: string;
  storeSlug: string;
  refNumber: string;
  name: string;
  contact: string;
  location: string;
  notes: string;
  itemsJson: string;
  totalUsd: number;
  currency: string;
}): Promise<string> {
  return sha256Hex(stableJson({
    accountId: input.accountId,
    storeSlug: input.storeSlug,
    refNumber: input.refNumber,
    name: input.name.trim(),
    contact: input.contact.trim(),
    location: input.location.trim(),
    notes: input.notes.trim(),
    items: JSON.parse(input.itemsJson),
    totalUsd: input.totalUsd,
    currency: input.currency,
  }));
}

export function normalizeCartInquiry(body: Record<string, unknown>): CartInquiryNormalization {
  const storeSlug = typeof body.store_slug === 'string' ? body.store_slug.trim() : '';
  if (!storeSlug) return { ok: false, error: 'Store is required' };

  if (!isValidTrackingToken(body.tracking_token)) {
    return { ok: false, error: 'Tracking token must be 32-128 base64url characters' };
  }

  const refNumber = typeof body.ref_number === 'string' ? body.ref_number.trim() : '';
  if (!refNumber) return { ok: false, error: 'Order reference is required' };

  const totalUsd = Number(body.total_estimate_usd ?? body.total_usd);
  if (!Number.isFinite(totalUsd) || totalUsd < 0) {
    return { ok: false, error: 'Total must be a finite nonnegative number' };
  }

  const itemsRaw = body.items_json ?? body.items;
  let items: unknown;
  try {
    items = typeof itemsRaw === 'string' ? JSON.parse(itemsRaw) : itemsRaw;
  } catch {
    return { ok: false, error: 'Items must be valid JSON' };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Items are required' };
  }
  if (items.length > INQUIRY_MAX_ITEMS) {
    return { ok: false, error: `An order may carry at most ${INQUIRY_MAX_ITEMS} items` };
  }
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Every item must be a valid cart line' };
    }
    const line = item as Record<string, unknown>;
    if (typeof line.name !== 'string' || !line.name.trim()
      || (line.category !== 'tea' && line.category !== 'ware')
      || typeof line.quantityGrams !== 'number' || !Number.isFinite(line.quantityGrams) || line.quantityGrams <= 0
      || typeof line.pricePerGram !== 'number' || !Number.isFinite(line.pricePerGram) || line.pricePerGram < 0
      || typeof line.totalPrice !== 'number' || !Number.isFinite(line.totalPrice) || line.totalPrice < 0) {
      return { ok: false, error: 'Every item must be a valid cart line' };
    }
    if (line.name.trim().length > INQUIRY_MAX_ITEM_NAME) {
      return { ok: false, error: `An item name may be at most ${INQUIRY_MAX_ITEM_NAME} characters` };
    }
    // Two kinds of line. A catalogue line names a product the store sells and
    // is checked against the catalogue by the caller. A custom line is a tea
    // the store does not list yet — a sample poured at a session, something
    // asked for by name — and must SAY it is custom, so a mistyped product id
    // is refused rather than quietly becoming an unpriced custom line.
    if (line.custom === true) {
      if (line.id !== undefined && line.id !== null && line.id !== '') {
        return { ok: false, error: 'A custom item must not name a product' };
      }
    } else if (typeof line.id !== 'string' || !line.id.trim()) {
      return { ok: false, error: 'Every item must be a valid cart line' };
    }
    if (line.storeSlug !== storeSlug) {
      return { ok: false, error: 'Every item must belong to the requested store' };
    }
  }

  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: 'Currency must be a three-letter code' };
  }

  return {
    ok: true,
    value: {
      storeSlug,
      trackingToken: body.tracking_token,
      refNumber,
      items,
      itemsJson: stableJson(items),
      totalUsd,
      currency,
    },
  };
}

/** The product ids among these lines. Custom lines contribute none. */
export function catalogProductIds(items: unknown[]): string[] {
  const ids = items
    .map((item) => (item as Record<string, unknown>)?.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return [...new Set(ids)];
}

export function redactPublicInquiry(row: Record<string, unknown>) {
  return {
    ref_number: row.ref_number,
    items_json: row.items,
    status: row.status,
    total_estimate_usd: row.total_usd,
    currency: row.currency,
    created_at: row.created_at,
  };
}
