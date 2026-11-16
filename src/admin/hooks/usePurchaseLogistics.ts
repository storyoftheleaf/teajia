import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { usePrivateQueryScope } from './usePrivateQueryScope';

export function usePurchaseLogistics(enabled = true, refetchInterval?: number) {
  const scope = usePrivateQueryScope();
  const query = useQuery({
    queryKey: ['purchase-logistics', ...scope.key],
    queryFn: () => api.logistics.tracking(),
    enabled: enabled && scope.ready,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval,
  });
  return { ...query, data: enabled && scope.ready ? query.data : undefined };
}
