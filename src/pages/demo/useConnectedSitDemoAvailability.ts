import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../../lib/api';

export const connectedSitDemoAvailabilityKey = ['connected-sit-demo-availability'] as const;
export const connectedSitDemoPath = '/demo/connected-sit';

export function useConnectedSitDemoAvailability() {
  return useQuery({
    queryKey: connectedSitDemoAvailabilityKey,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_URL}/api/public/connected-sit-demo`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        signal,
      });
      if (response.status === 404) return false;
      if (!response.ok) throw new Error('Demo availability could not be checked.');
      const data = await response.json() as { available?: boolean };
      return data.available === true;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: 15_000,
    retry: false,
  });
}
