import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/** The shop's logistics services, read from the same Logistics query the tea page uses. */
export function useLogisticsServices() {
  const query = useQuery({ queryKey: ['logistics-tracking'], queryFn: () => api.logistics.tracking(), staleTime: 60_000 });
  return { ...query, services: (query.data?.services ?? []).filter(service => service.active) };
}
