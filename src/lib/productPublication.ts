const MISSING_LABELS = {
  name: 'tea name',
  type: 'type',
  price: 'selling price',
  stock: 'counted stock',
} as const;

export type PublicationRequirement = keyof typeof MISSING_LABELS;

export function hasProductName(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim()
    && !/^(unnamed(?: tea| product| teaware)?|untitled)$/i.test(value.trim());
}

type PublicationFacts = {
  givenName?: unknown;
  supplierName?: unknown;
  type?: unknown;
  retailPrice?: unknown;
  onHand?: unknown;
  stockKnownAt?: unknown;
};

export function publicationRequirements(product: PublicationFacts): PublicationRequirement[] {
  const missing: PublicationRequirement[] = [];
  if (!hasProductName(product.givenName) && !hasProductName(product.supplierName)) missing.push('name');
  if (typeof product.type !== 'string' || !product.type.trim() || ['Misc', 'MISSING_TYPE'].includes(product.type.trim())) missing.push('type');
  if (typeof product.retailPrice !== 'number' || !Number.isFinite(product.retailPrice) || product.retailPrice < 0) missing.push('price');
  if (!product.stockKnownAt || typeof product.onHand !== 'number' || !Number.isFinite(product.onHand) || product.onHand < 0) missing.push('stock');
  return missing;
}

export type PublicationState = {
  isPublic: boolean;
  shownInShop: boolean;
  status: unknown;
};

export type PublicationRefusal = {
  code: 'incoming_stock_not_publishable' | 'product_publication_incomplete';
  error: string;
  details: { incoming_quantity: number } | { missing: PublicationRequirement[] };
};

export function isIncomingOnly(onHand: unknown, incomingQuantity: number): boolean {
  return incomingQuantity > 0 && !(typeof onHand === 'number' && onHand > 0);
}

export function hasPublicStatus(status: unknown): boolean {
  return status === 'Active' || status === 'Sold Out';
}

export function needsPublicationReview(current: PublicationState | null, patch: Partial<PublicationState>): boolean {
  if (!current) return patch.isPublic === true || patch.shownInShop === true;
  // A legacy address stays reachable, including while it is sold out or when
  // its owner restores it from archive with both existing visibility flags.
  if (current.isPublic && current.shownInShop && (hasPublicStatus(current.status) || current.status === 'Archived')) return false;
  if (patch.isPublic === true || patch.shownInShop === true) return true;
  const next = { ...current, ...patch };
  return hasPublicStatus(next.status) && !hasPublicStatus(current.status) && next.isPublic && next.shownInShop;
}

export function publicationRefusal(product: PublicationFacts, incomingQuantity: number): PublicationRefusal | null {
  if (isIncomingOnly(product.onHand, incomingQuantity)) {
    return {
      code: 'incoming_stock_not_publishable',
      error: 'Incoming tea cannot be published until stock is received',
      details: { incoming_quantity: incomingQuantity },
    };
  }
  const missing = publicationRequirements(product);
  return missing.length > 0 ? {
    code: 'product_publication_incomplete',
    error: `Complete before publishing: ${missing.map(field => MISSING_LABELS[field]).join(', ')}.`,
    details: { missing },
  } : null;
}
