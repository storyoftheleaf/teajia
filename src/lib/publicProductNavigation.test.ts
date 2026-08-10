import { describe, expect, it } from 'vitest';
import { buildPublicProductHref, resolveInventoryStoreSlug } from './publicProductNavigation';

describe('store-aware public product navigation', () => {
  it('lets a cold-link store query override the persisted shop', () => {
    expect(resolveInventoryStoreSlug(new URLSearchParams('store=rayi-master'), 'barry-master')).toBe('rayi-master');
    expect(resolveInventoryStoreSlug(new URLSearchParams('store=%20'), 'barry-master')).toBe('barry-master');
    expect(resolveInventoryStoreSlug(new URLSearchParams(), null)).toBe('teajia-bali');
  });

  it('prefers a backend public path and carries its backend account slug', () => {
    expect(buildPublicProductHref({
      id: 'legacy-id',
      public_path: '/shop/product/listing-id?ref=article#tea',
      source_account_slug: 'rayi-master',
    })).toBe('/shop/product/listing-id?ref=article&store=rayi-master#tea');
  });

  it('builds a compatible product route when backend path metadata is absent', () => {
    expect(buildPublicProductHref({ id: 'tea/one' }, 'barry-master')).toBe('/shop/product/tea%2Fone?store=barry-master');
    expect(buildPublicProductHref({ id: 'tea/one' })).toBe('/shop/product/tea%2Fone');
  });

  it('does not rewrite a non-product public representation', () => {
    expect(buildPublicProductHref({
      id: 'tea-one',
      public_path: '/tea/tea-one',
      account_slug: 'rayi-master',
    })).toBe('/tea/tea-one');
  });
});
