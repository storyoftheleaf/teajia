import { useQuery } from '@tanstack/react-query';
import { api, getTokenClaims } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Product, ExchangeRate, Customer } from '../types';
import { INITIAL_RATES } from '../constants';
import { fetchLiveRates } from '../utils';

const useAccountQueryScope = () => {
  const activeAccountId = useAppStore((state) => state.activeAccountId);
  return {
    accountScope: activeAccountId ?? 'no-account',
    userScope: getTokenClaims()?.sub ?? 'anonymous',
  };
};

// Fetch Products
export const useProducts = (options?: { enabled?: boolean }) => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['products', accountScope, userScope],
    staleTime: 1000 * 60 * 5,   // 5 min, prevents background refetch from overwriting inline edits
    refetchOnWindowFocus: false, // window focus should not clobber optimistic updates
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const data = await api.products.list();

      return (data || []).map((p: any) => ({
        id: p.id,
        type: p.type,
        form: p.form || undefined,
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
        lowStockThreshold: Number(p.low_stock_threshold) || 100,
        description: p.description || '',
        tastingNotes: Array.isArray(p.tasting_notes) ? p.tasting_notes : [],
        imageUrl: p.image_url || '',
        additionalImages: Array.isArray(p.additional_images) ? p.additional_images : [],
        bagPhotoUrl: p.bag_photo_url || undefined,
        status: p.status,
        vendor: p.vendor,
        vendorId: p.vendor_id || undefined,
        costCurrency: p.cost_currency || 'USD',
        quantityPurchased: Number(p.quantity_purchased) || 0,
        shippingRatePerKg: Number(p.shipping_rate_per_kg) || 0,
        fixedRetailPriceUSD: p.fixed_retail_price_usd ? Number(p.fixed_retail_price_usd) : null,
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
        tastingSource:
          p.tasting_source === 'owner' || p.tasting_source === 'community' || p.tasting_source === 'common'
            ? p.tasting_source
            : undefined,
        sourceCompassEntryId: p.source_compass_entry_id || undefined,
        material: p.material || undefined,
        capacityMl: p.capacity_ml == null ? undefined : Number(p.capacity_ml),
        teawareCategory: p.teaware_category || undefined,
        quantityUnits: p.quantity_units == null ? undefined : Number(p.quantity_units),
      })) as Product[];
    }
  });
};

// Fetch Exchange Rates
export const useRates = () => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['rates', accountScope, userScope],
    queryFn: async () => {
      let dbRates: ExchangeRate[] = [];

      try {
        const data = await api.rates.list();
        dbRates = (data || []).map((r: any) => ({
          currency: r.currency,
          rateToUSD: Number(r.rate_to_usd)
        }));
      } catch {
        // Fall through to live rates
      }

      // Fetch Live Rates (API)
      const liveRates = await fetchLiveRates();

      // Merge: Database overrides API, API fills gaps
      const rateMap = new Map<string, ExchangeRate>();

      liveRates.forEach(r => rateMap.set(r.currency, r));
      dbRates.forEach(r => rateMap.set(r.currency, r));

      INITIAL_RATES.forEach(r => {
          if (!rateMap.has(r.currency)) rateMap.set(r.currency, r);
      });

      return Array.from(rateMap.values()) as ExchangeRate[];
    },
    staleTime: 1000 * 60 * 60 * 6, // 6-hour TTL, rates don't change frequently
    // Keep offline rates visible immediately, but still load account-backed
    // currencies (for example AUD) instead of treating this seed as fresh for
    // the full six-hour stale window.
    placeholderData: INITIAL_RATES
  });
};

// Fetch Customers
export const useCustomers = () => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['customers', accountScope, userScope],
    staleTime: 1000 * 60 * 5,   // 5 min, same as products
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const data = await api.customers.list();
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        company: c.company || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        whatsapp: c.whatsapp || undefined,
        address: c.address || undefined,
        city: c.city || undefined,
        country: c.country || undefined,
        preferredCurrency: c.preferred_currency || 'USD',
        tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        contacts: typeof c.contacts === 'string' ? JSON.parse(c.contacts || '[]') : (c.contacts || []),
        contact_tags: Array.isArray(c.contact_tags) ? c.contact_tags : [],
        notes: c.notes || undefined,
        source: c.source || undefined,
        type: c.type || 'customer',
        userId: c.user_id || undefined,
        userLinkedAt: c.user_linked_at || undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        orderCount: Number(c.order_count) || 0,
        totalSpentUSD: Number(c.total_spent_usd) || 0,
        lastOrderDate: c.last_order_date || undefined,
        eventCount: Number(c.event_count) || 0,
        relationshipKinds: Array.isArray(c.relationship_kinds) ? c.relationship_kinds : [],
      })) as Customer[];
    }
  });
};

// Fetch Activity Logs (with pagination & filtering)
export const useActivityLogs = (params?: { limit?: number; offset?: number; action?: string; search?: string; entity_id?: string }) => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['activity_logs', accountScope, userScope, params],
    queryFn: async () => {
      try {
        return await api.activityLogs.list(params);
      } catch {
        return { logs: [], total: 0 };
      }
    }
  });
};

// Fetch Stock Ledger, global or per-product
export const useStockLedger = (productId: string | null | undefined, limit = 50, offset = 0) => {
  const { accountScope, userScope } = useAccountQueryScope();
  return useQuery({
    queryKey: ['stock_ledger', accountScope, userScope, productId ?? 'all', limit, offset],
    queryFn: async () => {
      return await api.stockLedger.list(productId || undefined, limit, offset);
    }
  });
};
