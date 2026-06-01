import type { Product } from '../../types';

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
  const stripped = name.replace(new RegExp(`[\\s,\\-–—]*${y}\\s*$`), '').trim();
  return stripped.length > 0 ? stripped : name;
}
