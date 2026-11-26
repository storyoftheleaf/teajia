import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AUTH_TOKEN_CHANGED_EVENT, currentSignInToken } from '../lib/api';
import { hostCreditOpen } from '../lib/hostCredit';
import { hostCreditApi, type MyTeaCredit } from '../lib/hostCreditApi';
import { useAppStore } from '../lib/store';

export const TEA_CREDIT_PATH = '/account/tea-credit';

function subscribeToToken(listener: () => void): () => void {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
  return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
}

/** Whether this read says the person is a host with credit to show: any row of their own. */
export function hasTeaCredit(data: MyTeaCredit | undefined | null): boolean {
  return Boolean(data && (data.balances.length > 0 || data.lines.length > 0 || (data.spend_requests?.length ?? 0) > 0));
}

/**
 * The signed-in host's own tea credit (Launch 5, M1). Asked only while the
 * switch is open and someone is signed in; closed, nothing is fetched and
 * `data` stays undefined, so nothing shows. `storeSlug` adds what checkout in
 * that shop may offer.
 */
export function useMyTeaCredit(storeSlug?: string) {
  const open = hostCreditOpen();
  const token = useSyncExternalStore(subscribeToToken, currentSignInToken, currentSignInToken);
  const userId = useAppStore(state => state.activeUserId);
  const enabled = open && Boolean(token && userId);
  const query = useQuery({
    queryKey: ['me', 'tea-credit', userId, storeSlug ?? null],
    queryFn: () => hostCreditApi.mine(storeSlug),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  return {
    enabled,
    data: enabled ? query.data : undefined,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
  };
}
