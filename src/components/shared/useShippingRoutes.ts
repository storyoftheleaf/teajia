import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ShippingRoute } from './routeFreight';

export const SHIPPING_ROUTES_KEY = ['shipping-routes'] as const;

/** The shop's shipping routes, read once and shared by Settings and the buying basket. */
export function useShippingRoutes() {
  return useQuery<ShippingRoute[]>({ queryKey: SHIPPING_ROUTES_KEY, queryFn: () => api.shippingRoutes.list(), staleTime: 5 * 60_000 });
}
