import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ShopCollectionEntry } from '../types';

/**
 * Fetches shop-published collections for the public storefront bands.
 * Stale after 5 minutes. Returns an empty array on error so the
 * rest of the shop is unaffected.
 */
export const usePublicShopCollections = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-shop-collections'],
    queryFn: async (): Promise<ShopCollectionEntry[]> => {
      const res = await api.collections.publicShop();
      return res.collections ?? [];
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  return {
    collections: data ?? [],
    isLoading,
    isError: !!error,
  };
};
