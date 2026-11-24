import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function usePublicShelf(slug: string | null | undefined) {
  return useQuery({
    queryKey: ['public-shelf', slug],
    queryFn: () => api.shelf.getPublic(slug!),
    enabled: Boolean(slug),
    retry: false,
    // Recheck contact and stock when opening a shelf or returning to a person.
    refetchOnMount: 'always',
  });
}
