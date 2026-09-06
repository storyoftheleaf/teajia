import type { Product } from './types';

/**
 * Maps one edited field to the snake_case column payload the API expects.
 *
 * Lives in its own module, apart from ProductEditPanel, so a caller can build
 * a payload without importing the panel itself. The public shop and the public
 * product page both load that panel lazily, and importing it just to reach
 * this switch would pull the whole editor into their eager bundle.
 */
export function buildProductUpdatePayload(field: keyof Product, value: any): Record<string, any> | null {
  switch (field) {
    case 'stockGrams': return { stock_grams: Number(value) };
    case 'costAmount': return { cost_amount: Number(value) };
    case 'pricePerGramUSD': return { fixed_retail_price_usd: Number(value) };
    case 'productName': return { product_name: value };
    case 'originRegion': return { origin_region: value };
    case 'year': return { year: Number(value) };
    case 'isFeatured': return { is_featured: value };
    case 'isPublic': return { is_public: value };
    case 'showWisdom': return { show_wisdom: value };
    case 'recheckStock': return { recheck_stock: value ? 1 : 0 };
    case 'stockVerifiedAt': return { stock_verified_at: value };
    case 'material': return { material: value };
    case 'capacityMl': return { capacity_ml: Number(value) };
    case 'teawareCategory': return { teaware_category: value };
    case 'quantityUnits': return { quantity_units: Number(value) };
    case 'experience': return { experience: value };
    case 'description': return { description: value };
    case 'mood': return { mood: value };
    case 'moodTags': return { mood_tags: JSON.stringify(value || []) };
    case 'flavorTags': return { flavor_tags: JSON.stringify(value || []) };
    case 'tastingNotes': return { tasting_notes: JSON.stringify(value) };
    case 'lore': return { lore: value };
    case 'givenName': return { given_name: value };
    case 'chineseName': return { chinese_name: value };
    case 'form': return { form: value };
    case 'pieceWeightG': return { piece_weight_g: value === '' || value == null ? null : Number(value) };
    case 'soldInWholeUnits': return { sold_in_whole_units: value ? 1 : 0 };
    case 'originCountry': return { origin_country: value };
    case 'vendor': return { vendor: value };
    case 'type': return { type: value };
    case 'status': return { status: value };
    case 'imageUrl': return { image_url: value };
    case 'processingNotes': return { processing_notes: value };
    case 'terroir': return { terroir: value };
    case 'isPersonal': return { is_personal: value ? 1 : 0 };
    case 'canReorder': return { can_reorder: value ? 1 : 0 };
    case 'isCurated': return { is_curated: value ? 1 : 0 };
    case 'isSample': return { is_sample: value ? 1 : 0 };
    case 'inventoryPurpose': return { inventory_purpose: value };
    case 'isCustomWisdom': return { is_custom_wisdom: value ? 1 : 0 };
    case 'fixedRetailPriceUSD': return { fixed_retail_price_usd: value ? Number(value) : null };
    /* Empty means unset, and unset is not zero. Clearing the field hands the
       tea back to the shop freight rate and it follows that rate from then on;
       a typed 0 is Adrian saying this one ships free. Number('') is 0, so
       without this the only way to clear a rate was to accidentally make it
       free. See worker/src/shippingRate.ts. */
    case 'shippingRatePerKg':
      return {
        shipping_rate_per_kg:
          value === null || value === undefined || String(value).trim() === '' ? null : Number(value),
      };
    case 'quantityPurchased': return { quantity_purchased: Number(value) };
    case 'lowStockThreshold': return { low_stock_threshold: Number(value) };
    case 'costCurrency': return { cost_currency: value };
    case 'additionalImages': return { additional_images: JSON.stringify(value || []) };
    case 'bagPhotoUrl': return { bag_photo_url: value || null };
    default: return null;
  }
}
