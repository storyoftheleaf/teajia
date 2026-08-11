const DEFAULT_PUBLIC_STORE_SLUG = 'teajia-bali';

type PublicProductLinkSource = {
  id?: unknown;
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
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return '/shop';
  return addStoreToProductPath(`/shop/product/${encodeURIComponent(id)}`, storeSlug);
}
