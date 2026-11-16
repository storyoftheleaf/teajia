import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNetworkStores, normalizeProduct } from './storefrontApi';

describe('storefront API transport retries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })));
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      location: { origin: 'https://teajia.test' },
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries a transient transport failure', async () => {
    const request = fetchNetworkStores();
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('storefront product tasting provenance', () => {
  it('decodes source and preserves legacy common tasting sources', () => {
    expect(normalizeProduct({ id: 'source-lot', tasting_source: 'source' }).tastingSource).toBe('source');
    expect(normalizeProduct({ id: 'legacy-common', tasting_source: 'common' }).tastingSource).toBe('common');
  });
});

it('preserves unavailable retail separately from a deliberate zero', () => {
  expect(normalizeProduct({ retail_price_per_gram_usd: null }).pricePerGramUSD).toBeNull();
  expect(normalizeProduct({ retail_price_per_gram_usd: 0 }).pricePerGramUSD).toBe(0);
});

it('refuses a quote for an unavailable DTO price without refusing a genuine zero',async()=>{
  const {publicProductToInventoryItem}=await import('./adapters');
  const {teaPurchaseQuote}=await import('./shopPurchase');
  const dto={id:'synthetic',type:'Green',stock_grams:100,retail_price_per_gram_usd:null};
  const unknown=publicProductToInventoryItem(normalizeProduct(dto));
  const free=publicProductToInventoryItem(normalizeProduct({...dto,retail_price_per_gram_usd:0}));
  expect(unknown.price_per_gram).toBeUndefined();
  expect(teaPurchaseQuote(unknown)).toBeNull();
  expect(free.price_per_gram).toBe('0');
  expect(teaPurchaseQuote(free)).not.toBeNull();
});
it('quotes independently fixed retail without requiring calculated cost or retail',async()=>{
 const {publicProductToInventoryItem}=await import('./adapters');
 const {teaPurchaseQuote}=await import('./shopPurchase');
 const fixed=publicProductToInventoryItem(normalizeProduct({id:'fixed',type:'Green',stock_grams:100,retail_price_per_gram_usd:null,cost_per_gram_usd:null,fixed_retail_price_usd:0.75}));
 expect(fixed.price_per_gram).toBe('0.75');
 expect(teaPurchaseQuote(fixed)).not.toBeNull();
});
