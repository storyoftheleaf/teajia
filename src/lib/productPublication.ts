const MISSING_LABELS = {
  name: 'tea name',
  type: 'type',
  price: 'selling price',
  stock: 'counted stock',
} as const;

type PublicationRequirement = keyof typeof MISSING_LABELS;

export function hasProductName(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim()
    && !/^(unnamed(?: tea| product| teaware)?|untitled)$/i.test(value.trim());
}

export function publicationRequirements(product: {
  givenName?: unknown;
  supplierName?: unknown;
  type?: unknown;
  retailPrice?: unknown;
  onHand?: unknown;
  stockKnownAt?: unknown;
}): PublicationRequirement[] {
  const missing: PublicationRequirement[] = [];
  if (!hasProductName(product.givenName) && !hasProductName(product.supplierName)) missing.push('name');
  if (typeof product.type !== 'string' || !product.type.trim() || ['Misc', 'MISSING_TYPE'].includes(product.type.trim())) missing.push('type');
  if (typeof product.retailPrice !== 'number' || !Number.isFinite(product.retailPrice) || product.retailPrice < 0) missing.push('price');
  if (!product.stockKnownAt || typeof product.onHand !== 'number' || !Number.isFinite(product.onHand) || product.onHand < 0) missing.push('stock');
  return missing;
}
