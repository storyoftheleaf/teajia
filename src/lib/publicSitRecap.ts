import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicSessionTea, SessionGuestItem, SessionPerson, SessionPhotograph, SessionSignature } from '../../shared/sessionTea';
import { API_URL, authedFetch, fetchWithTimeout } from './api';
import { useAppStore } from './store';

export type PublicRecapTea = PublicSessionTea & { items: SessionGuestItem[] };

export type PublicSitRecap = {
  slug: string;
  title: string;
  event_date: string;
  people: SessionPerson[];
  note: { text: string; by: SessionSignature | null } | null;
  galleryPhoto: string | null;
  teas: PublicRecapTea[];
  table: SessionPhotograph[];
  guestBook: { text: string; by: SessionSignature }[];
};

/** A photograph path from the worker is relative to the API. */
export function sessionPhotoSrc(src: string): string {
  return src.startsWith('/api/') ? API_URL + src : src;
}

export function usePublicSitRecap(slug: string) {
  return useQuery({
    queryKey: ['public-sit-recap', slug],
    enabled: Boolean(slug),
    queryFn: async ({ signal }): Promise<PublicSitRecap | null> => {
      const response = await fetchWithTimeout(`${API_URL}/api/public/sit-recaps/${encodeURIComponent(slug)}`, {
        signal, cache: 'no-store', reportIncident: false,
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Could not open this recap.');
      return (await response.json()).recap as PublicSitRecap;
    },
    staleTime: 0,
    retry: false,
  });
}

export type RecapSeat = {
  seated: boolean;
  teas?: { id: string; name: string }[];
  own?: { note: string; status: string; tea_id: string | null; public_recap: number } | null;
};

const seatPath = (slug: string) => `${API_URL}/api/me/sit-recaps/${encodeURIComponent(slug)}/guest-book`;

/** Whether the signed-in visitor sat at this table (the existing seat check), and their entry. */
export function useRecapSeat(slug: string) {
  const userId = useAppStore(state => state.activeUserId);
  return useQuery({
    queryKey: ['recap-seat', slug, userId],
    enabled: Boolean(slug && userId),
    queryFn: () => authedFetch(seatPath(slug), { cache: 'no-store', background: true, reportIncident: false }) as Promise<RecapSeat>,
    retry: false,
  });
}

export function useSendRecapNote(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { note: string; teaId: string | null; publicRecap: boolean }) =>
      authedFetch(seatPath(slug), { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['recap-seat', slug] }),
  });
}
