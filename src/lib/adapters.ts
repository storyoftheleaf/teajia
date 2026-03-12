import type { PublicProduct, InventoryItem } from '../types';

const CATEGORY_TO_SUBCATEGORY: Record<string, string> = {
  pot: 'brewing',
  cup: 'serving',
  tray: 'serving',
  storage: 'ritual',
  accessory: 'ritual',
  decorative: 'elements',
};

function categoryToSubcategory(cat: string): string {
  return CATEGORY_TO_SUBCATEGORY[cat] || 'ritual';
}

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
    additionalImages: p.additionalImages,
    chineseName: p.chineseName,
    lore: p.lore,
    showWisdom: p.showWisdom,
    terroir: p.terroir,
    processingNotes: p.processingNotes,
    mood: p.mood,
    experience: p.experience,
    isFeatured: p.isFeatured,
    isOneOfAKind: p.isOneOfAKind,
    isCurated: p.isCurated,
    material: p.material,
    capacityMl: p.capacityMl,
    subcategory: p.teawareCategory ? categoryToSubcategory(p.teawareCategory) : undefined,
  };
}
