// storeHost.ts — maps a hostname to a store slug so a dedicated subdomain
// (e.g. au.teajia.com) opens straight onto that store's shop at the root URL,
// with no /store/<slug> in the address bar.
//
// The storefront is otherwise path-resolved (/store/:slug). This is the one
// place that lets a marketing-friendly subdomain stand in for a store.
//
// To add another store subdomain later, add a line to HOST_TO_SLUG.

const HOST_TO_SLUG: Record<string, string> = {
  'au.teajia.com': 'teajia-australia',
};

/**
 * Returns the store slug a hostname is dedicated to, or null if the host is
 * the normal multi-page site. Subdomain match is exact on the full host.
 */
export function storeSlugForHost(host: string): string | null {
  const normalized = host.toLowerCase().replace(/:\d+$/, '');
  return HOST_TO_SLUG[normalized] ?? null;
}

/** Convenience: the store slug for the current browser host, if any. */
export function currentHostStoreSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return storeSlugForHost(window.location.host);
}
