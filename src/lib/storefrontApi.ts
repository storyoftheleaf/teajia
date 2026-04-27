// Storefront API helpers for the lineage (multi-store) public surface.
// These wrap public, unauthenticated endpoints scoped to a specific store
// by slug. Kept separate from `src/lib/api.ts` (owned by another workstream)
// so the two can evolve in parallel without contract collisions.

import type { Account, PublicProduct, PublicProductType, InventoryItem } from '../types';
import type { TeaEvent } from '../types/events';
import { publicProductToInventoryItem } from './adapters';

const API_URL = import.meta.env.VITE_API_URL || '';

const REQUEST_TIMEOUT_MS = 30_000;

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Normalize raw product JSON from the public endpoints into PublicProduct. */
function normalizeProduct(p: any): PublicProduct {
  return {
    id: p.id,
    type: (p.type || 'Misc') as PublicProductType,
    givenName: p.given_name || '',
    chineseName: p.chinese_name || '',
    productName: p.product_name || '',
    year: p.year,
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
      p.tasting_source === 'owner' || p.tasting_source === 'community' || p.tasting_source === 'common'
        ? p.tasting_source
        : undefined,
    moodTags: Array.isArray(p.mood_tags) ? p.mood_tags : [],
    flavorTags: Array.isArray(p.flavor_tags) ? p.flavor_tags : [],
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
