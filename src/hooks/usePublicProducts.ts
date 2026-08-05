import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { normalizeProduct } from '../lib/storefrontApi';
import type { PublicProduct } from '../types';

/**
 * The default storefront's catalogue.
 *
 * The row-to-object mapping is `normalizeProduct`, shared with the store-scoped
 * path in storefrontApi.ts. This hook used to carry its own copy of it, and the
 * copy fell behind three times over: no mood tags, no flavour tags, and no
 * cultivar, which meant the wisdom band resolved nothing on the one storefront
 * almost every reader sees. The endpoint differs between the two paths; the
 * shape it returns does not.
 */
export const usePublicProducts = () => {
  return useQuery({
    queryKey: ['products', 'public'],
    queryFn: async (): Promise<PublicProduct[]> => {
      const data = await api.products.listPublic();
      return (data || []).map(normalizeProduct);
    },
    staleTime: 1000 * 60 * 5,
  });
};
