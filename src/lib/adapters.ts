import type { PublicProduct, InventoryItem } from '../types';

/**
 * Converts a PublicProduct (from D1 API) to an InventoryItem shape
 * so existing shop components work without immediate refactoring.
 */
export function publicProductToInventoryItem(p: PublicProduct): InventoryItem {
  const isTea = p.type !== 'Teaware' && p.type !== 'Misc';
  return {
    id: p.id,
    category: isTea ? 'tea' : 'ware',
    type: p.type,
    name: p.givenName || p.productName,
    year: p.year ? String(p.year) : '',
    origin: [p.originRegion, p.originCountry].filter(Boolean).join(', '),
    variant: p.productName,
    stock_g: p.stockGrams,
    cost_price: '0',
    price_per_gram: isTea ? String(p.pricePerGramUSD) : undefined,
    price_50g: !isTea ? String(p.fixedRetailPriceUSD ?? p.pricePerGramUSD) : undefined,
    description: p.description,
    tags: p.tastingNotes,
    image: p.imageUrl,
    chineseName: p.chineseName,
    lore: p.lore,
    showWisdom: p.showWisdom,
    mood: p.mood,
    experience: p.experience,
    isFeatured: p.isFeatured,
    isOneOfAKind: p.isOneOfAKind,
  };
}
