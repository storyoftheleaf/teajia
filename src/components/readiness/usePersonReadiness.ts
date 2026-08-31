import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { PersonReadinessInput } from './teaMasterReadiness';

/**
 * The person half of being a tea master, read from the signed-in reader's own
 * profile.
 *
 * Shared by Your Table and the store's Launch Center so the two surfaces cannot
 * disagree about whether this person can be paid. The query keys are the ones
 * the profile page already uses, so all three read one cache.
 *
 * `isLoaded` is separate from the counts because a not-yet-answered read looks
 * exactly like an empty one, and a surface must not announce a missing payment
 * method it has not actually measured.
 */
export function usePersonReadiness(enabled: boolean): PersonReadinessInput & { isLoaded: boolean } {
  const profileQuery = useQuery({
    queryKey: ['profile', 'self'],
    queryFn: api.profile.getSelf,
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const profile = profileQuery.data?.profile ?? null;

  const paymentsQuery = useQuery({
    queryKey: ['profile', 'payment-methods'],
    queryFn: api.profile.listPaymentMethods,
    enabled: enabled && Boolean(profile),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const publishedPaymentMethods = paymentsQuery.data?.methods.filter(method => method.is_published).length ?? 0;
  const profileLoaded = profileQuery.isSuccess;
  const paymentsLoaded = paymentsQuery.isSuccess;

  // Held stable so a caller can put this straight into a dependency list
  // without recomputing on every render of the panel it lives in.
  return useMemo(() => ({
    hasProfile: Boolean(profile),
    identityReady: Boolean(profile?.display_name.trim() && profile?.beginnings?.trim()),
    isPublished: Boolean(profile?.is_published),
    publishedPaymentMethods,
    // A person with no profile has nothing left to read, so the absence of a
    // payment answer is not an unfinished read.
    isLoaded: profileLoaded && (!profile || paymentsLoaded),
  }), [profile, publishedPaymentMethods, profileLoaded, paymentsLoaded]);
}
