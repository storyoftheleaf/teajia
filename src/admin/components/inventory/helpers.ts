import type { Product } from '../../types';

/**
 * ONE KEY OF THE ADDRESS, CHANGED. Everything else is left exactly as it stands.
 *
 * The inventory address is not one filter. It carries the vendor, the intake
 * batch, a wisdom entry, the open product panel, the incoming view and the
 * receipt being read, and any of them can be true at once. Round seven found the
 * CLEAR controls resetting the whole thing: pressing the × on a vendor chip
 * closed the product panel beside it and dropped the receipt behind it.
 *
 * The setters had the identical bug pointed the other way. Choosing a vendor
 * from the menu, or from the search suggestions, wrote a brand new address
 * containing one key, so it did not merely fail to keep the panel and the
 * receipt, it also silently dropped the wisdom filter the operator had crossed
 * from. Round seven's own fix made that combination reachable for the first
 * time, which is what turned a latent bug into a visible one.
 *
 * Both directions go through here now, so there is one rule and no second copy
 * of it to forget: `null` clears the key, a string sets it, and neither one
 * touches anything else.
 */
export function withParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

export function isFeaturedButHidden(product: Product): boolean {
  if (!product.isFeatured) return false;
  if (product.status !== 'Active') return true;
  const isTeaware = product.type === 'Teaware';
  if (isTeaware) return (product.quantityUnits ?? 0) <= 0;
  return (product.stockGrams ?? 0) <= 0;
}

export function getRowBorderClass(product: Product): string {
  if (product.isPersonal) return 'bg-tea-accent-sub';
  return '';
}

/**
 * Strip a trailing year from a product name ONLY when it matches the product's
 * own `year` value. The Year column already carries the vintage, so a name like
 * "Aged Liu Bao 1960" reads as redundant. A trailing number that is NOT the
 * recorded vintage is left untouched. Safe to call with null/undefined year.
 */
export function stripMatchingYear(name: string, year: number | string | null | undefined): string {
  if (!name || year == null || year === '') return name;
  const y = String(year).trim();
  if (!/^\d{4}$/.test(y)) return name;
  // Match the year at the end, optionally preceded by whitespace/punctuation.
  const stripped = name.replace(new RegExp(`[\\s,\\-\u2013\u2014]*${y}\\s*$`), '').trim();
  return stripped.length > 0 ? stripped : name;
}
