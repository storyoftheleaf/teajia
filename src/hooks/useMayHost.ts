import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, AUTH_TOKEN_CHANGED_EVENT, currentSignInToken } from '../lib/api';
import { anyoneHostsOpen } from '../lib/anyoneHosts';
import { fewHostsOpen } from '../lib/fewHosts';
import { useAppStore } from '../lib/store';

export const HOST_TABLE_PATH = '/account/host';
export const hostedTablesOpen = () => fewHostsOpen() && anyoneHostsOpen();

function subscribeToToken(listener: () => void): () => void {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
  return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
}

/** True while this browser holds a sign-in. */
export function useSignedIn(): boolean {
  return Boolean(useSyncExternalStore(subscribeToToken, currentSignInToken, currentSignInToken));
}

/** Launch 3 entry points share the server's decision about available hosting doors. */
export function useMayHost() {
  const open = hostedTablesOpen();
  const token = useSyncExternalStore(subscribeToToken, currentSignInToken, currentSignInToken);
  const userId = useAppStore(state => state.activeUserId);
  const canCheck = open && Boolean(token && userId);
  const { data, isSuccess } = useQuery({
    queryKey: ['me-hosting', userId],
    queryFn: () => api.hosting.get(),
    enabled: canCheck,
    staleTime: 60_000,
    retry: false,
  });
  return {
    mayHost: canCheck && isSuccess && Array.isArray(data?.doors) && data.doors.length > 0,
    showSignIn: open && !token,
  };
}
