import { useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, authedFetch } from '../../lib/api';
import { sitLinksQuery, type ProfileSitRef } from '../../lib/publicSitConnections';
import { sitProfileCreditVerb } from '../../lib/sitCreditContract';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';

type Scope = { accountId: string | null; userId: string };

export function ProfileSitRecaps({ slug }: { slug: string }) {
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  return userId ? <EditSitRecaps key={JSON.stringify([slug, userId, activeAccountId])} slug={slug}
    scope={{ accountId: activeAccountId, userId }} /> : null;
}

function EditSitRecaps({ slug, scope }: { slug: string; scope: Scope }) {
  const heading = useId();
  const client = useQueryClient();
  const endpoint = `${API_URL}/api/me/people/${encodeURIComponent(slug)}/sit-placements`;
  const options = { expectedAuth: scope, cache: 'no-store', background: true, reportIncident: false } as const;
  const queryKey = ['private-profile-sit-options', slug, scope.userId, scope.accountId];
  const selectable = useQuery({
    queryKey,
    queryFn: (): Promise<{ recaps: Array<ProfileSitRef & { shown: 0 | 1 }> }> => authedFetch(endpoint, options),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const placement = useMutation({
    mutationFn: (sit: ProfileSitRef & { shown: 0 | 1 }) =>
      authedFetch(`${endpoint}/${encodeURIComponent(sit.slug)}`, {
        ...options,
        method: sit.shown ? 'DELETE' : 'PUT',
        body: sit.shown ? undefined : JSON.stringify({ role: sit.role }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey, exact: true }),
        client.invalidateQueries({ queryKey: [...sitLinksQuery, 'session-cards', slug], exact: true }),
      ]);
    },
  });

  if (!selectable.data?.recaps.length) return null;
  // An event can give the same person several credits. A placement uses one
  // role at a time, and the saved role takes precedence in the owner view.
  const unique = new Map<string, ProfileSitRef & { shown: 0 | 1 }>();
  for (const sit of selectable.data.recaps) {
    if (sit.shown || !unique.has(sit.slug)) unique.set(sit.slug, sit);
  }

  return (
    <section aria-labelledby={heading} className="mt-4 border-t border-tea-border pt-3">
      <h2 id={heading} className="type-section-heading">Recaps on my profile</h2>
      <ul className="divide-y divide-tea-border">
        {[...unique.values()].map(sit => (
          <li key={sit.slug} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
            <p className="min-w-0 break-words text-ui-13 text-tea-text-sec">
              {sit.title} <span className="whitespace-nowrap">· {sitProfileCreditVerb(sit.role)}</span>
            </p>
            <Button type="button" variant={sit.shown ? 'quiet' : 'secondary'} size="sm" className="tap-target"
              disabled={placement.isPending} onClick={() => placement.mutate(sit)}>
              {sit.shown ? 'Remove from my profile' : 'Show on my profile'}
              <span className="sr-only"> · {sit.title}</span>
            </Button>
          </li>
        ))}
      </ul>
      {placement.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t update this profile. Try again.</p>}
    </section>
  );
}
