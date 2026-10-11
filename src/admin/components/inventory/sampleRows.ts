import type { Product } from '../../types';
import type { TeaCompassEntry } from '../../../components/CurateV2/types';
import { effectivePurpose } from './domain';
import type { SampleHolding } from './phone/PhoneSamplesList';

// Sampling is a state of a tea, not a second kind of record (Adrian,
// 2026-10-11): "It's just an earlier state of that product inventory." So the
// Samples view draws every sample the same way, whether it is a shelf product
// bought to sample (100 g from Lao Tong Zhi) or a Curate tea with only a
// portion in a bag. One row, the same as any Stock row, with the sampling
// controls folded out beneath it.
//
// The Stock table draws products, so a Curate-only sample becomes a product-
// shaped row here (id `curate:<entry id>`). Its edits are routed back to Curate
// by the caller; it is never written to the products table. A shelf product
// that already has a Curate record is one row, never two.

export const CURATE_ROW_PREFIX = 'curate:';
export const isCurateRow = (id: string | null | undefined) => !!id && id.startsWith(CURATE_ROW_PREFIX);
export const curateIdOfRow = (id: string) => id.slice(CURATE_ROW_PREFIX.length);

/** A product is in its sample state when its purpose says so, or it is a Curate-only sample row. */
export const isSampleRow = (p: Product) => isCurateRow(p.id) || effectivePurpose(p) === 'sample';

/**
 * Item codes ("LKY-PE1") are Adrian's internal identifiers, imported at the
 * front of a vendor's name. They are shown small beside the name, never as
 * part of it, and kept when the name is edited.
 */
const CODE = /^([A-Z]{2,6}-[A-Z0-9]{1,8}(?:-[A-Z0-9]{1,6})?)\s+(.+)$/;
export function splitItemCode(name: string | null | undefined): { code: string | null; name: string } {
  const text = (name ?? '').trim();
  const m = CODE.exec(text);
  return m ? { code: m[1], name: m[2] } : { code: null, name: text };
}
export const joinItemCode = (code: string | null, name: string) => (code ? `${code} ${name.trim()}` : name.trim());

/** The Curate record a shelf product is linked to, if there is one. */
export function linkedEntryId(product: Product, entries: readonly TeaCompassEntry[]): string | null {
  if (isCurateRow(product.id)) return curateIdOfRow(product.id);
  if (product.sourceCompassEntryId) return product.sourceCompassEntryId;
  return entries.find((e) => e.draftProductId === product.id)?.id ?? null;
}

/** The quote a sample row shows: an amount, for a number of grams, in its money. */
export function sampleQuote(p: Product): { amount: number | null; grams: number | null; currency: string } {
  return {
    amount: p.costAmount == null || Number.isNaN(Number(p.costAmount)) ? null : Number(p.costAmount),
    grams: p.quantityPurchased ? Number(p.quantityPurchased) : null,
    currency: String(p.costCurrency ?? ''),
  };
}

/**
 * A Curate-only sample as a Stock row. Only what the row reads is filled; the
 * rest stays empty because this row is never saved as a product.
 */
export function curateHoldingAsProduct(h: SampleHolding, live: TeaCompassEntry | null): Product {
  const e = h.entry;
  const amount = live ? live.priceAmount : e.price_amount;
  const grams = live ? live.pricePerUnitGrams : e.price_per_unit_grams;
  return {
    id: `${CURATE_ROW_PREFIX}${e.id}`,
    productName: live?.name || e.name || e.chinese_name || '',
    givenName: live?.shopName ?? e.shop_name ?? '',
    chineseName: live?.chineseName ?? e.chinese_name ?? undefined,
    type: (live?.type ?? e.type ?? '') as Product['type'],
    year: (live?.year ?? e.year ?? '') as Product['year'],
    form: (live?.form ?? e.form ?? '') as Product['form'],
    originRegion: e.origin_region ?? '',
    originCountry: e.origin_country ?? '',
    vendor: live?.vendorName ?? e.vendor_name ?? undefined,
    vendorId: live?.vendorId ?? e.vendor_id ?? undefined,
    stockGrams: Number(h.sample_grams ?? 0),
    lowStockThreshold: 0,
    costAmount: amount == null ? (null as unknown as number) : Number(amount),
    quantityPurchased: grams == null ? (null as unknown as number) : Number(grams),
    costCurrency: (live?.priceCurrency ?? e.price_currency ?? '') as Product['costCurrency'],
    costPerGramUSD: 0,
    pricePerGramUSD: 0,
    inventoryPurpose: 'sample',
    isSample: true,
    status: 'Draft',
    sourceCompassEntryId: e.id,
    sampleScore: (() => { try { const t = live?.tasting ?? (typeof e.tasting === 'string' ? JSON.parse(e.tasting || '{}') : e.tasting); return typeof t?.quality === 'number' ? t.quality : null; } catch { return null; } })(),
  } as unknown as Product;
}

/**
 * A shelf product bought to sample, as a sample row: its own figures until it
 * has a Curate record, then the record answers by its id. `__product_id` lets
 * the list send its edits back to the product.
 */
export function productSampleHolding(p: Product, entryId: string | null): SampleHolding {
  return {
    entry: {
      id: entryId ?? `product:${p.id}`,
      __product_id: p.id,
      name: p.productName,
      shop_name: p.givenName ?? '',
      year: p.year,
      type: p.type,
      form: p.form,
      vendor_name: p.vendor ?? '',
      vendor_id: p.vendorId ?? null,
      price_amount: p.costAmount ?? null,
      price_currency: p.costCurrency ?? '',
      price_per_unit_grams: p.quantityPurchased ?? null,
      decision: null,
      tasting: null,
    },
    stock_grams: Number(p.stockGrams ?? 0),
    sample_grams: p.stockGrams == null ? null : Number(p.stockGrams),
    samples: [],
  };
}
