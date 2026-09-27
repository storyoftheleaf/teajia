import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, UsersRound } from 'lucide-react';
import { api } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { AdminContributor } from '../../types';
import { ContributorEditorPanel } from '../components/ContributorEditorPanel';

export const ContributorsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AdminContributor | null | undefined>(undefined);
  const query = useQuery({
    queryKey: ['admin-contributors'],
    queryFn: () => api.people.listAdminContributors(),
    select: result => result.contributors,
    retry: false,
  });
  const contributors = query.data ?? [];

  const saved = async () => {
    setSelected(undefined);
    await queryClient.invalidateQueries({ queryKey: ['admin-contributors'] });
  };

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-tea-bg pb-nav-gap">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-tea-border pb-5">
          <div>
            <p className="text-ui-11 text-tea-text-sec">Publishing identities</p>
            <h1 className={`${TYPOGRAPHY_CLASSES.h2} mt-1 text-tea-text`}>Tea Masters</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Refresh contributors" onClick={() => query.refetch()} disabled={query.isFetching} className="tap-target rounded-md p-2 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text disabled:opacity-50"><RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} /></button>
            <button type="button" onClick={() => setSelected(null)} className="tap-target inline-flex items-center gap-2 rounded-md cta-solid px-3 py-2 text-ui-13 font-medium"><Plus size={15} /> Create contributor</button>
          </div>
        </header>

        {query.isLoading ? (
          <div aria-label="Loading contributors" className="mt-8 space-y-2">{[0, 1, 2].map(item => <div key={item} className="h-16 animate-pulse border-b border-tea-border bg-tea-surface/40" />)}</div>
        ) : query.isError ? (
          <div className="py-20 text-center"><p className="text-ui-14 text-tea-text">Could not load contributors.</p><button type="button" onClick={() => query.refetch()} className="tap-target mt-3 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></div>
        ) : contributors.length === 0 ? (
          <div className="py-20 text-center"><UsersRound size={28} className="mx-auto text-tea-text-dim" /><p className="mt-4 text-ui-14 text-tea-text">No tea masters yet.</p><p className="mt-1 text-ui-13 text-tea-text-sec">Create the first editorial identity when its voice and profile are ready.</p><button type="button" onClick={() => setSelected(null)} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Create contributor</button></div>
        ) : (
          <div className="mt-4 divide-y divide-tea-border">
            {contributors.map(contributor => (
              <button key={contributor.id} type="button" aria-label={`Edit ${contributor.display_name}`} onClick={() => setSelected(contributor)} className="tap-target group flex w-full items-start justify-between gap-4 py-4 text-left hover:bg-tea-accent-sub sm:px-2">
                <div className="min-w-0"><p className="text-ui-15 font-medium text-tea-text group-hover:text-tea-gold">{contributor.display_name}</p><p className="mt-1 text-ui-12 text-tea-text-sec">{[contributor.role, contributor.location_line].filter(Boolean).join(' · ') || 'Profile details not yet added'}</p></div>
                <div className="shrink-0 text-right"><p className="text-ui-11 text-tea-text-sec">{contributor.has_pending_draft ? (contributor.is_published === 1 ? 'Published · review changes' : 'Awaiting review') : contributor.is_published === 1 ? 'Published' : 'Draft'}</p>{contributor.face_of_account_id && <p className="mt-1 text-ui-10 text-tea-text-dim">Account host</p>}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected !== undefined && <ContributorEditorPanel contributor={selected} onClose={() => setSelected(undefined)} onSaved={saved} />}
    </main>
  );
};
