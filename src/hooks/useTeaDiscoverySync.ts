import { useEffect, useRef } from 'react';
import { syncTeaDiscoveryProfile } from '../lib/teaDiscoverySync';

/**
 * Reconciles the device-saved Tea Discovery profile with the server.
 *
 * - On login / first authenticated mount: pulls the server profile and adopts
 *   it if newer, or pushes the local one up if it's newer (so a profile taken
 *   while anonymous gets persisted the moment the member signs in).
 * - Quiz completion itself pushes directly (see DiscoverPage), so no
 *   debounced change-watcher is needed here.
 */
export function useTeaDiscoverySync(isAuthenticated: boolean) {
  const prevAuthRef = useRef(isAuthenticated);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const justLoggedIn = isAuthenticated && !prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      return;
    }

    if (!hasFetchedRef.current || justLoggedIn) {
      hasFetchedRef.current = true;
      syncTeaDiscoveryProfile().catch(() => {});
    }
  }, [isAuthenticated]);
}
