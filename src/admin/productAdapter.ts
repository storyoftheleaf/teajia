import type { Product } from './types';
import { storedRatePerKg } from '../lib/shippingRate';

export function normalizeAdminProductTastingSource(value: unknown): Product['tastingSource'] | undefined {
  return value === 'owner' || value === 'community' || value === 'source' || value === 'common'
    ? value
    : undefined;
}

export function mapAdminProduct(p: any): Product {
  return ({
        id: p.id,
        type: p.type,
        form: p.form || undefined,
        pieceWeightG: p.piece_weight_g == null ? undefined : Number(p.piece_weight_g),
        soldInWholeUnits: !!p.sold_in_whole_units,
        givenName: p.given_name || '',
        chineseName: p.chinese_name || '',
        productName: p.product_name,
        year: p.year,
        originCountry: p.origin_country,
        originRegion: p.origin_region,
        pricePerGramUSD: Number(p.retail_price_per_gram_usd) || 0,
        costPerGramUSD: Number(p.cost_per_gram_usd) || 0,
        costAmount: Number(p.cost_amount) || 0,
        stockGrams: Number(p.stock_grams) || 0,
        lowStockThreshold: p.low_stock_threshold == null ? 100 : Number(p.low_stock_threshold),
        description: p.description || '',
        tastingNotes: Array.isArray(p.tasting_notes) ? p.tasting_notes : [],
        imageUrl: p.image_url || '',
        additionalImages: Array.isArray(p.additional_images) ? p.additional_images : [],
        bagPhotoUrl: p.bag_photo_url || undefined,
        status: p.status,
        vendor: p.vendor,
        vendorId: p.vendor_id || undefined,
        /* 'UNK', not 'USD'. This is the display boundary and inventing dollars
           here is the same fault the schema default is: a row with no currency
           recorded would render as a dollar cost and price accordingly. 'UNK'
           is the shop's sentinel for a currency nobody recorded. */
        costCurrency: p.cost_currency || 'UNK',
        costCurrencySource: p.cost_currency_source ?? null,
        quantityPurchased: Number(p.quantity_purchased) || 0,
        /* NULL stays NULL. `Number(x) || 0` turned every tea that follows the
           shop rate into a tea pinned at zero, in the admin's own model, and
           that is the only thing in the inventory list Adrian can see: the cell
           printed a dash with a gold dot beside it and a title saying the tea
           was "pinned to this tea in Yuan", about a tea nobody had pinned. The
           dot is the ONLY thing separating a rate a tea owns from one it is
           borrowing, so it was saying the opposite of the truth on every row.
           Three call sites downstream (the CSV export's "Ship rate source"
           column, the Add Product modal, the edit panel) were already written
           to read a null here and had never once been handed one. */
        shippingRatePerKg: storedRatePerKg(p.shipping_rate_per_kg),
        fixedRetailPriceUSD: p.fixed_retail_price_usd == null ? null : Number(p.fixed_retail_price_usd),
        isPersonal: !!p.is_personal,
        canReorder: !!p.can_reorder,
        isPublic: p.is_public == null ? true : !!p.is_public,
        shownInShop: p.shown_in_shop == null ? true : !!p.shown_in_shop,
        ownerUserId: p.owner_user_id ?? null,
        isFeatured: !!p.is_featured,
        isSample: !!p.is_sample,
        inventoryPurpose: p.inventory_purpose || null,
        stockKnownAt: p.stock_known_at || null,
        inventoryLocation: p.storage_location || p.inventory_location || null,
        inTransit: !!p.in_transit,
        lore: p.lore || '',
        isCustomWisdom: !!p.is_custom_wisdom,
        showWisdom: p.show_wisdom == null ? true : !!p.show_wisdom,
        processingNotes: p.processing_notes || '',
        terroir: p.terroir || '',
        mood: p.mood || '',
        moodTags: Array.isArray(p.mood_tags) ? p.mood_tags : (() => { try { return JSON.parse(p.mood_tags || '[]'); } catch { return []; } })(),
        flavorTags: Array.isArray(p.flavor_tags) ? p.flavor_tags : (() => { try { return JSON.parse(p.flavor_tags || '[]'); } catch { return []; } })(),
        experience: p.experience || '',
        recheckStock: !!p.recheck_stock,
        stockVerifiedAt: p.stock_verified_at || null,
        tasting: p.tasting && typeof p.tasting === 'object' ? p.tasting : undefined,
        tastingSource: normalizeAdminProductTastingSource(p.tasting_source),
        sourceCompassEntryId: p.source_compass_entry_id || undefined,
        material: p.material || undefined,
        capacityMl: p.capacity_ml == null ? undefined : Number(p.capacity_ml),
        teawareCategory: p.teaware_category || undefined,
        quantityUnits: p.quantity_units == null ? undefined : Number(p.quantity_units),
  }) as Product;
}
