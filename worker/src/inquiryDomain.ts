const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

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
  if (items.some((item) => (
    !item
    || typeof item !== 'object'
    || (item as Record<string, unknown>).storeSlug !== storeSlug
  ))) {
    return { ok: false, error: 'Every item must belong to the requested store' };
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
      itemsJson: JSON.stringify(items),
      totalUsd,
      currency,
    },
  };
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
