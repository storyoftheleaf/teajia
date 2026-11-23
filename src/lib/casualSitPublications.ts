import { useQuery } from '@tanstack/react-query';
import { API_URL, fetchWithTimeout } from './api';

export * from '../../shared/casualSitPublication';
import type { CasualSitRecap } from '../../shared/casualSitPublication';

export const casualSitRecapPath = (slug: string) => `/sits/casual/${encodeURIComponent(slug)}`;
const collectionPath = '/api/casual-sits';
const recapApiPath = (slug: string) => `${collectionPath}/${encodeURIComponent(slug)}`;
export const casualSitPhotoUrl = (slug: string, photoId: string) =>
  `${API_URL}${recapApiPath(slug)}/photo/${encodeURIComponent(photoId)}`;
export const publicCasualSitsKey = ['public-casual-sits'] as const;

async function readRecaps<T>(path: string): Promise<T> {
  const result = await fetchWithTimeout(API_URL + path, { cache: 'no-store', reportIncident: false, background: true });
  if (!result.ok) throw new Error('This recap is unavailable.');
  return result.json() as Promise<T>;
}

const publicReadOptions = { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: true } as const;

export function usePublicCasualSits(profileSlug: string) {
  return useQuery({
    ...publicReadOptions,
    queryKey: [...publicCasualSitsKey, 'list', profileSlug],
    queryFn: () => readRecaps<{ recaps: CasualSitRecap[] }>(`/api/people/${encodeURIComponent(profileSlug)}/casual-sits`),
    enabled: !!profileSlug,
  });
}

export function usePublicCasualSit(slug: string) {
  return useQuery({
    ...publicReadOptions,
    queryKey: [...publicCasualSitsKey, 'recap', slug],
    queryFn: () => readRecaps<{ recap: CasualSitRecap }>(recapApiPath(slug)),
    enabled: !!slug,
  });
}
