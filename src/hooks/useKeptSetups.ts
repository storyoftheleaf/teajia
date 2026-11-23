import { useQuery } from '@tanstack/react-query';
import { API_URL, authedFetch } from '../lib/api';
import type { KeptSetupTea } from '../lib/keptSetupTasting';

export const KEPT_SETUPS_ENDPOINT = API_URL + '/api/me/personal-kept-setups';

type KeptSetup = {
  event_id: string;
  event_title: string;
  event_date: string;
  saved_at: string;
  teas: KeptSetupTea[];
};

export function useKeptSetups(accountId: string | null, userId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['private-kept-setups', accountId, userId],
    enabled: enabled && !!userId,
    queryFn: (): Promise<{ setups: KeptSetup[] }> => authedFetch(KEPT_SETUPS_ENDPOINT, {
      cache: 'no-store',
      ...(userId ? { expectedAuth: { accountId, userId } } : {}),
    }),
  });
}
