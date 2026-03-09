import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { PublicProduct, PublicProductType } from '../types';

export const usePublicProducts = () => {
  return useQuery({
    queryKey: ['products', 'public'],
    queryFn: async () => {
      const data = await api.products.listPublic();
      return (data || []).map((p: any): PublicProduct => ({
        id: p.id,
        type: (p.type || 'Misc') as PublicProductType,
        givenName: p.given_name || '',
        chineseName: p.chinese_name || '',
        productName: p.product_name || '',
        year: p.year,
        originCountry: p.origin_country || '',
        originRegion: p.origin_region || '',
        pricePerGramUSD: Number(p.retail_price_per_gram_usd) || 0,
        fixedRetailPriceUSD: p.fixed_retail_price_usd != null ? Number(p.fixed_retail_price_usd) : null,
        stockGrams: p.stock_grams || 0,
        description: p.description || '',
        tastingNotes: Array.isArray(p.tasting_notes) ? p.tasting_notes : [],
        imageUrl: p.image_url || '',
        status: p.status || 'Active',
        isPersonal: !!p.is_personal,
        canReorder: !!p.can_reorder,
        isFeatured: !!p.is_featured,
        isOneOfAKind: !p.can_reorder,
        lore: p.lore || '',
        showWisdom: p.show_wisdom == null ? true : !!p.show_wisdom,
        processingNotes: p.processing_notes || '',
        terroir: p.terroir || '',
        mood: p.mood || '',
        experience: p.experience || '',
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
};
