import { useQuery } from '@tanstack/react-query';
import { API_URL, fetchWithTimeout } from './api';
import type { SitCreditRole } from './sitCreditContract';

export type FormalSessionCard = {
  slug: string;
  title: string;
  event_date: string;
  role?: SitCreditRole;
  writing: string;
  galleryPhoto: string | null;
  teas: Array<{ id: string; name: string; type: string | null }>;
};

export function useFormalSessionCards(profile: string) {
  return useQuery({
    queryKey: ['public-sit-links', 'session-cards', profile],
    queryFn: async ({ signal }): Promise<FormalSessionCard[]> => {
      const path = '/people/' + encodeURIComponent(profile) + '?view=cards';
      const response = await fetchWithTimeout(API_URL + '/api/public/sit-links' + path, {
        signal, cache: 'no-store', reportIncident: false,
      });
      if (!response.ok) throw new Error('Could not open sessions.');
      const { recaps } = await response.json();
      return Array.isArray(recaps) ? recaps : [];
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
}
