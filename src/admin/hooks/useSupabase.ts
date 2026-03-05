import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Product, ExchangeRate } from '../types';
import { INITIAL_RATES } from '../constants';
import { fetchLiveRates } from '../utils';

// Fetch Products
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      // We select from the view which handles price calculations
      const { data, error } = await supabase.from('product_pricing_view').select('*');
      
      if (error) {
        console.error("Supabase Error:", error);
        // Check for "relation does not exist" error (Postgres code 42P01)
        if (error.code === '42P01') {
          console.error("CRITICAL: The database tables do not exist. Please run the content of 'db_setup.sql' in your Supabase SQL Editor.");
          alert("Database not setup! Please run the db_setup.sql script in your Supabase Dashboard.");
        }
        throw error;
      }
      
      return (data || []).map((p: any) => ({
        id: p.id,
        type: p.type,
        givenName: p.given_name || '',
        chineseName: p.chinese_name || '', 
        productName: p.product_name,
        year: p.year,
        originCountry: p.origin_country,
        originRegion: p.origin_region,
        pricePerGramUSD: Number(p.retail_price_per_gram_usd) || 0,
        costPerGramUSD: Number(p.cost_per_gram_usd) || 0,
        costAmount: Number(p.cost_amount) || 0,
        stockGrams: p.stock_grams || 0,
        lowStockThreshold: p.low_stock_threshold || 100,
        description: p.description || '',
        tastingNotes: p.tasting_notes || [],
        imageUrl: p.image_url || '',
        status: p.status,
        vendor: p.vendor,
        costCurrency: p.cost_currency || 'USD',
        quantityPurchased: p.quantity_purchased || 0,
        shippingRatePerKg: Number(p.shipping_rate_per_kg) || 0, 
        fixedRetailPriceUSD: p.fixed_retail_price_usd ? Number(p.fixed_retail_price_usd) : null,
        isPersonal: p.is_personal || false,
        canReorder: p.can_reorder || false,
        isPublic: p.is_public ?? true,
        isFeatured: p.is_featured || false,
        lore: p.lore || '',
        isCustomWisdom: p.is_custom_wisdom || false,
        showWisdom: p.show_wisdom ?? true,
        processingNotes: p.processing_notes || '',
        mood: p.mood || '',
        experience: p.experience || '',
        liquorColor: p.liquor_color || ''
      })) as Product[];
    }
  });
};

// Fetch Exchange Rates
export const useRates = () => {
  return useQuery({
    queryKey: ['rates'],
    queryFn: async () => {
      // 1. Try to fetch from Supabase (Manual Overrides)
      const { data, error } = await supabase.from('exchange_rates').select('*');
      
      let dbRates: ExchangeRate[] = [];
      
      if (!error && data) {
         dbRates = data.map((r: any) => ({
            currency: r.currency,
            rateToUSD: Number(r.rate_to_usd)
         }));
      }

      // 2. Fetch Live Rates (API)
      const liveRates = await fetchLiveRates();

      // 3. Merge: Database overrides API, API fills gaps
      const rateMap = new Map<string, ExchangeRate>();
      
      // Initialize with Live Rates
      liveRates.forEach(r => rateMap.set(r.currency, r));
      
      // Override with DB Rates
      dbRates.forEach(r => rateMap.set(r.currency, r));

      // Ensure all standard currencies exist (Fallbacks)
      INITIAL_RATES.forEach(r => {
          if (!rateMap.has(r.currency)) rateMap.set(r.currency, r);
      });

      return Array.from(rateMap.values()) as ExchangeRate[];
    },
    // Refresh rates every hour
    staleTime: 1000 * 60 * 60, 
    initialData: INITIAL_RATES
  });
};

// Fetch Activity Logs (#6)
export const useActivityLogs = () => {
  return useQuery({
    queryKey: ['activity_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        // Return empty array if table doesn't exist yet to prevent UI crash
        console.warn("Activity logs table not found or error:", error.message);
        return []; 
      }
      return data;
    }
  });
};
