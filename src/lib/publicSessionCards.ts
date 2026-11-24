import { useQuery } from '@tanstack/react-query';
import { API_URL, fetchWithTimeout } from './api';
import type { SitCreditRole } from './sitCreditContract';
import type { PublicSessionTea, SessionPerson, SessionPhotograph, SessionSignature } from '../../shared/sessionTea';

export type FormalSessionCard = {
  slug: string;
  title: string;
  event_date: string;
  role?: SitCreditRole;
  host?: string;
  writing: string;
  galleryPhoto: string | null;
  /** Poured teas in order; a profile card carries full records (shared/sessionTea.ts). */
  teas: Array<PublicSessionTea | { id: string; name: string; type: string | null }>;
  people?: SessionPerson[];
  note?: { text: string; by: SessionSignature | null } | null;
  photos?: { small: SessionPhotograph[]; more: number };
};

export function useFormalSessionCards(profile?: string) {
  return useQuery({
    queryKey: ['public-sit-links', 'session-cards', profile],
    queryFn: async ({ signal }): Promise<FormalSessionCard[]> => {
      const path = profile ? '/people/' + encodeURIComponent(profile) + '?view=cards' : '/recent';
      const response = await fetchWithTimeout(API_URL + '/api/public/sit-links' + path, {
        signal, ...(profile ? {} : { method: 'POST' }), cache: 'no-store', reportIncident: false,
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
