import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ProductEvent {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  event_date: string;
  event_end_date?: string;
  location_name?: string;
  status: string;
  flyer_image_url?: string;
  custom_name?: string;
  brew_order?: number;
}

/**
 * Fetches events that featured a given product on their tea menu.
 * Queries event_tea_menu joined with events.
 */
export function useProductEvents(productId: string | null | undefined) {
  return useQuery<ProductEvent[]>({
    queryKey: ['product-events', productId],
    queryFn: () => api.products.getEvents(productId!),
    enabled: !!productId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
