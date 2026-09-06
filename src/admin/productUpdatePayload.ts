import type { Product } from './types';

/**
 * A number the operator actually entered, or null because they did not.
 *
 * This exists because JavaScript makes the wrong thing easy at exactly this
 * boundary. `Number('')` is 0. `Number(null)` is 0. An empty input is falsy and
 * so is a typed zero. So the natural way to write any of these cases quietly
 * turns "I cleared this field" into "the value is zero", and money does not
 * survive that: a freight rate of zero is free shipping, a cost of zero is a
 * free tea, a retail override of zero is a giveaway. None of them mean "unset".
 *
 * The same confusion has now cost this shop three separate bugs. Products
 * defaulted their freight to 0 and every hand-entered tea sold with no freight
 * in its price. Clearing the freight field saved 0, so the only way to unpin a
 * tea made it ship free. And `value ? Number(value) : null` on the retail
 * override ran it backwards: a deliberate 0 was falsy, so setting a price of
 * zero silently became no price at all.
 *
 * One rule, in one place, for every numeric column that is nullable in the
 * schema: nothing entered is null, and anything entered is the number, zero
 * included. `worker/tests/entered-number.test.ts` fails if a case in the switch
 * below stops using it.
 */
export function enteredNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  // NaN is not a number the operator entered; it is a typo, and writing it to a
  // money column would be worse than leaving the field alone.
  return Number.isFinite(n) ? n : null;
}

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
    case 'stockGrams': return { stock_grams: enteredNumber(value) };
    case 'costAmount': return { cost_amount: enteredNumber(value) };
    /* Both of these write fixed_retail_price_usd, from two different places in
       the editor, and until now they disagreed: this one turned a cleared field
       into 0, and the other turned a typed 0 into null. Two doors to one column
       with opposite rules is exactly the shape that gave the shop four freight
       rates at once. */
    case 'pricePerGramUSD': return { fixed_retail_price_usd: enteredNumber(value) };
    case 'productName': return { product_name: value };
    case 'originRegion': return { origin_region: value };
    case 'year': return { year: enteredNumber(value) };
    case 'isFeatured': return { is_featured: value };
    case 'isPublic': return { is_public: value };
    case 'showWisdom': return { show_wisdom: value };
    case 'recheckStock': return { recheck_stock: value ? 1 : 0 };
    case 'stockVerifiedAt': return { stock_verified_at: value };
    case 'material': return { material: value };
    case 'capacityMl': return { capacity_ml: enteredNumber(value) };
    case 'teawareCategory': return { teaware_category: value };
    case 'quantityUnits': return { quantity_units: enteredNumber(value) };
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
    case 'pieceWeightG': return { piece_weight_g: enteredNumber(value) };
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
    case 'fixedRetailPriceUSD': return { fixed_retail_price_usd: enteredNumber(value) };
    /* Clearing this hands the tea back to the shop freight rate and it follows
       that rate from then on; a typed 0 is Adrian saying this one ships free.
       See worker/src/shippingRate.ts. */
    case 'shippingRatePerKg': return { shipping_rate_per_kg: enteredNumber(value) };
    case 'quantityPurchased': return { quantity_purchased: enteredNumber(value) };
    case 'lowStockThreshold': return { low_stock_threshold: enteredNumber(value) };
    case 'costCurrency': return { cost_currency: value };
    case 'additionalImages': return { additional_images: JSON.stringify(value || []) };
    case 'bagPhotoUrl': return { bag_photo_url: value || null };
    default: return null;
  }
}
