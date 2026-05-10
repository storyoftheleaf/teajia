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
