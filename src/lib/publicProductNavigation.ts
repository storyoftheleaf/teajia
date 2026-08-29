const DEFAULT_PUBLIC_STORE_SLUG = 'teajia-bali';

type PublicProductLinkSource = {
  id?: unknown;
  slug?: unknown;
  public_path?: unknown;
  account_slug?: unknown;
  source_account_slug?: unknown;
  store_slug?: unknown;
};

function cleanSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim();
  return slug || null;
}
export function resolveInventoryStoreSlug(searchParams: URLSearchParams, persistedSlug: string | null): string {
  return cleanSlug(searchParams.get('store')) ?? cleanSlug(persistedSlug) ?? DEFAULT_PUBLIC_STORE_SLUG;
}

function storeSlugFor(source: PublicProductLinkSource, fallbackStoreSlug?: string | null): string | null {
  return cleanSlug(source.account_slug)
    ?? cleanSlug(source.source_account_slug)
    ?? cleanSlug(source.store_slug)
    ?? cleanSlug(fallbackStoreSlug);
}

function addStoreToProductPath(path: string, storeSlug: string | null): string {
  if (!storeSlug) return path;
  const isAbsolute = /^https?:\/\//i.test(path);
  let url: URL;
  try {
    url = new URL(path, 'https://teajia.invalid');
  } catch {
    return path;
  }
  if (!url.pathname.startsWith('/shop/product/')) return path;
  if (!url.searchParams.has('store')) url.searchParams.set('store', storeSlug);
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

export function buildPublicProductHref(source: PublicProductLinkSource, fallbackStoreSlug?: string | null): string {
  const publicPath = typeof source.public_path === 'string' ? source.public_path.trim() : '';
  const storeSlug = storeSlugFor(source, fallbackStoreSlug);
  if (publicPath) return addStoreToProductPath(publicPath, storeSlug);
  // Prefer the readable address; fall back to the id for rows that predate it
  // and for callers that only ever had an id to hand.
  const slug = cleanSlug(source.slug);
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const segment = slug ?? id;
  if (!segment) return '/shop';
  return addStoreToProductPath(`/shop/product/${encodeURIComponent(segment)}`, storeSlug);
}

/**
 * Resolves the :id segment of /shop/product/:id against a loaded catalogue.
 *
 * The segment may be either the readable address or the legacy UUID, because
 * every link ever shared must keep working. Slug is checked first: ids are
 * UUIDs and slugs are name-derived, so the two can never be confused, but
 * checking slug first keeps the common case a single pass.
 */
export function findProductByRouteParam<T extends { id: string; slug?: string }>(
  items: T[],
  param: string | undefined,
): T | null {
  if (!param) return null;
  return items.find(i => i.slug === param) ?? items.find(i => i.id === param) ?? null;
}
