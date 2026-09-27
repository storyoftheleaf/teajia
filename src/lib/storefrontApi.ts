// Storefront API helpers for the lineage (multi-store) public surface.
// These wrap public, unauthenticated endpoints scoped to a specific store
// by slug. Kept separate from `src/lib/api.ts` (owned by another workstream)
// so the two can evolve in parallel without contract collisions.

import type { Account, PublicProduct, PublicProductType, InventoryItem } from '../types';
import type { TeaEvent } from '../types/events';
import { publicProductToInventoryItem } from './adapters';
import { splitNameYear } from './teaNameYear';

// In production, call the API on the app's own origin (relative paths) so it
// rides the China-reachable hostname via the Pages Function proxy, see the
// note in src/lib/api.ts. Dev still targets VITE_API_URL.
import { fetchWithTimeout, getApiOrigin } from './api';

const API_URL = getApiOrigin();

async function fetchJson<T>(path: string): Promise<T> {
  try {
    const res = await fetchWithTimeout(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Request failed (${res.status})`);
    }
    if (!res.ok) {
      const message = typeof data?.error === 'string' && data.error.length < 200
        ? data.error
        : `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Normalize raw product JSON from the public endpoints into PublicProduct.
 *
 * Exported because `usePublicProducts` used to keep a second hand-written copy
 * of this mapping for the legacy `/api/products/public` endpoint, and the two
 * drifted: the copy never learned `moodTags`, `flavorTags` or `cultivar`, so
 * the default Bali storefront (which is every reader who has not switched
 * stores) resolved no plant on any product page while a store-scoped one did.
 * Two mappings for one payload is one mapping too many.
 */
export function normalizeProduct(p: any): PublicProduct {
  // A tea's year lives in the vintage box, never in its name (splitNameYear).
  // Teaware keeps its name as typed: it has no year box, and an antique's date
  // is part of what the piece is.
  const isTeaware = p.type === 'Teaware' || !!p.teaware_category;
  const keep = (name: string) => ({ name, year: p.year == null ? '' : String(p.year) });
  const product = isTeaware ? keep(p.product_name || '') : splitNameYear(p.product_name || '', p.year);
  const given = isTeaware ? keep(p.given_name || '') : splitNameYear(p.given_name || '', product.year);
  const liftedYear = given.year || product.year;
  const year = p.year != null && p.year !== ''
    ? p.year
    : liftedYear
      ? (/^\d{4}$/.test(liftedYear) ? Number(liftedYear) : liftedYear)
      : p.year;
  return {
    id: p.id,
    // Undefined for rows created before the slug migration; links fall back
    // to the id, which the API still resolves.
    slug: p.slug || undefined,
    type: (p.type || 'Misc') as PublicProductType,
    form: p.form || undefined,
    pieceWeightG: p.piece_weight_g != null ? Number(p.piece_weight_g) : undefined,
    soldInWholeUnits: !!p.sold_in_whole_units,
    givenName: given.name,
    chineseName: p.chinese_name || '',
    productName: product.name,
    year,
    originCountry: p.origin_country || '',
    originRegion: p.origin_region || '',
    pricePerGramUSD: Number(p.retail_price_per_gram_usd) || 0,
    fixedRetailPriceUSD: p.fixed_retail_price_usd != null ? Number(p.fixed_retail_price_usd) : null,
    stockGrams: Number(p.stock_grams) || 0,
    description: p.description || '',
    tastingNotes: Array.isArray(p.tasting_notes) ? p.tasting_notes : [],
    imageUrl: p.image_url || '',
    additionalImages: Array.isArray(p.additional_images) ? p.additional_images : [],
    status: p.status || 'Active',
    isPersonal: !!p.is_personal,
    canReorder: !!p.can_reorder,
    isFeatured: !!p.is_featured,
    // Position in the shop-published collection, lowest first; undefined when
    // the tea is in none. Lets one surface pick THE featured tea, not any of them.
    featuredPosition: p.featured_position == null ? undefined : Number(p.featured_position),
    isOneOfAKind: !p.can_reorder,
    isCurated: !!p.is_curated,
    lore: p.lore || '',
    showWisdom: p.show_wisdom == null ? true : !!p.show_wisdom,
    processingNotes: p.processing_notes || '',
    terroir: p.terroir || '',
    mood: p.mood || '',
    experience: p.experience || '',
    material: p.material || '',
    capacityMl: p.capacity_ml != null ? Number(p.capacity_ml) : undefined,
    teawareCategory: p.teaware_category || undefined,
    quantityUnits: p.quantity_units != null ? Number(p.quantity_units) : undefined,
    tasting: p.tasting && typeof p.tasting === 'object' ? p.tasting : undefined,
    tastingSource:
      p.tasting_source === 'owner' || p.tasting_source === 'community' || p.tasting_source === 'source' || p.tasting_source === 'common'
        ? p.tasting_source
        : undefined,
    moodTags: Array.isArray(p.mood_tags) ? p.mood_tags : [],
    flavorTags: Array.isArray(p.flavor_tags) ? p.flavor_tags : [],
    cultivar: p.cultivar || null,
  };
}

/** List all publicly-visible stores in the Teajia network. */
export async function fetchNetworkStores(): Promise<Account[]> {
  const data = await fetchJson<Account[] | { stores?: Account[] }>(`/api/network/stores`);
  if (Array.isArray(data)) return data;
  return data?.stores ?? [];
}

/** Fetch a single store's public profile by slug. */
export async function fetchStore(slug: string): Promise<Account> {
  const data = await fetchJson<Account>(`/api/s/${encodeURIComponent(slug)}`);
  return data;
}

/**
 * Fetch products scoped to a single store.
 * Returns InventoryItem shape so existing Shop components (AlcoveCard etc)
 * can render them without modification.
 */
export async function fetchStoreProducts(slug: string): Promise<InventoryItem[]> {
  const data = await fetchJson<any[] | { products?: any[] }>(`/api/s/${encodeURIComponent(slug)}/products`);
  const raw: any[] = Array.isArray(data) ? data : data?.products ?? [];
  return raw.map(normalizeProduct).map(publicProductToInventoryItem);
}

/** Active events for a specific store. */
export async function fetchStoreEvents(slug: string): Promise<TeaEvent[]> {
  const data = await fetchJson<TeaEvent[] | { events?: TeaEvent[] }>(`/api/s/${encodeURIComponent(slug)}/events`);
  if (Array.isArray(data)) return data;
  return data?.events ?? [];
}
