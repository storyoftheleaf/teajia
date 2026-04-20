import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAppStore } from '../lib/store';

/**
 * Fetches and returns the feature flags for the current active account.
 * Returns an empty object while loading or when no account is active.
 *
 * Usage:
 *   const { features, hasFeature } = useAccountFeatures();
 *   if (hasFeature('compass')) { ... }
 */
export function useAccountFeatures() {
  const activeAccountId = useAppStore(s => s.activeAccountId);

  const { data: features = {}, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ['account-features', activeAccountId],
    queryFn: () => api.accounts.getFeatures(activeAccountId!),
    enabled: !!activeAccountId,
    staleTime: 1000 * 60 * 5,
  });

  function hasFeature(key: string): boolean {
    return !!features[key];
  }

  return { features, isLoading, hasFeature };
}

export default useAccountFeatures;
