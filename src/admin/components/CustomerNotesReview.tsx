import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';

import { DaySheetButton } from './guestNotes/DaySheetButton';
import { FeedbackList } from './guestNotes/FeedbackList';
import { OfferedPhotographs } from './guestNotes/OfferedPhotographs';
import { ReportsAndRequests } from './guestNotes/ReportsAndRequests';

interface GuestExcerpt {
  id: string;
  productId: string;
  productName: string;
  sourceText: string;
  attributionName: string;
  impressionId: string | null;
  showOnListing: boolean;
  showOnMainPage: boolean;
}

const views = [
  { id: 'starred', label: 'Offered', empty: 'No excerpts are waiting for review.' },
  { id: 'promoted', label: 'Approved', empty: 'No excerpts have been approved yet.' },
  { id: 'dismissed', label: 'Passed', empty: 'No excerpts have been passed on.' },
] as const;

type View = typeof views[number];
type Action =
  | { kind: 'approve' }
  | { kind: 'pass' }
  | { kind: 'place'; impressionId: string; surface: 'show_on_listing' | 'show_on_main_page'; visible: boolean };

function ExcerptRow({ excerpt, view, onUpdate, onError }: {
  excerpt: GuestExcerpt;
  view: View['id'];
  onUpdate: (action: Action, productId: string) => Promise<void>;
  onError: (error: Error) => void;
}) {
  const mutation = useMutation({
    mutationFn: (action: Action) => {
      if (action.kind === 'approve') return api.tastingNoteCandidates.approve(excerpt.id);
      if (action.kind === 'pass') return api.tastingNoteCandidates.dismiss(excerpt.id);
      return api.tastingNoteCandidates.setPlacements(action.impressionId, { [action.surface]: action.visible });
    },
    onSuccess: (_result, action) => onUpdate(action, excerpt.productId),
    onError,
  });

  const impressionId = excerpt.impressionId;
  return (
    <li className="grid min-w-0 gap-2 border-b border-tea-border py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className={TYPOGRAPHY_CLASSES.label}>{excerpt.productName}</p>
        <figure className="mt-1 min-w-0">
          <blockquote className={`${TYPOGRAPHY_CLASSES.body} whitespace-pre-wrap break-words italic text-tea-text`}>
            {excerpt.sourceText}
          </blockquote>
          <figcaption className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 break-words text-tea-text-sec`}>
            {excerpt.attributionName}
          </figcaption>
        </figure>
      </div>
      {view === 'starred' && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-quiet" disabled={mutation.isPending}
            onClick={() => mutation.mutate({ kind: 'pass' })}>Pass</button>
          <button type="button" className="btn-primary" disabled={mutation.isPending}
            onClick={() => mutation.mutate({ kind: 'approve' })}>Approve excerpt</button>
        </div>
      )}
      {view === 'promoted' && impressionId && (
        <div role="group" aria-label="Public placements" className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={excerpt.showOnListing} className="btn-chip"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ kind: 'place', impressionId, surface: 'show_on_listing', visible: !excerpt.showOnListing })}>
            Show on listing
          </button>
          <button type="button" aria-pressed={excerpt.showOnMainPage} className="btn-chip"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ kind: 'place', impressionId, surface: 'show_on_main_page', visible: !excerpt.showOnMainPage })}>
            Show on homepage
          </button>
        </div>
      )}
    </li>
  );
}

function OfferedTastingExcerpts() {
  const accountId = useAppStore(state => state.activeAccountId);
  const client = useQueryClient();
  const [view, setView] = useState<View>(views[0]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const query = useQuery<GuestExcerpt[]>({
    queryKey: ['guest-tasting-excerpts', accountId, view.id],
    queryFn: () => api.tastingNoteCandidates.list(view.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['guest-tasting-excerpts', accountId] });

  const handleUpdate = async (action: Action, productId: string) => {
    setError('');
    if (action.kind === 'place') {
      await Promise.all([
        refresh(),
        client.invalidateQueries({ queryKey: ['product-impressions', productId] }),
        client.invalidateQueries({ queryKey: ['main-tasting-excerpts'] }),
      ]);
      setMessage('Placement saved.');
      return;
    }
    await refresh();
    if (action.kind === 'approve') {
      setView(views[1]);
      setMessage('Excerpt approved. Choose where it appears.');
    } else {
      setMessage('Excerpt passed.');
    }
  };

  return (
    <div>
      <div role="group" aria-label="Excerpt status" className="flex flex-wrap items-center gap-4 border-b border-tea-border">
        {views.map(option => (
          <button key={option.id} type="button" aria-pressed={view.id === option.id} className="btn-tab"
            onClick={() => { setView(option); setMessage(''); setError(''); }}>
            {option.label}
          </button>
        ))}
      </div>
      {message && <p role="status" className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-sec`}>{message}</p>}
      {error && <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-3 text-tea-text-sec`}>{error}</p>}
      {query.isPending && <p role="status" className={`${TYPOGRAPHY_CLASSES.bodyLight} py-4 text-tea-text-sec`}>Loading excerpts…</p>}
      {query.isError && (
        <div className="flex flex-wrap items-center gap-2 py-4">
          <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>Could not load excerpts.</p>
          <button type="button" className="btn-secondary" onClick={() => void query.refetch()}>Try again</button>
        </div>
      )}
      {query.isSuccess && (query.data.length ? (
        <ul>
          {query.data.map(excerpt => (
            <ExcerptRow key={excerpt.id} excerpt={excerpt} view={view.id} onUpdate={handleUpdate}
              onError={cause => { setMessage(''); setError(cause.message); void refresh(); }} />
          ))}
        </ul>
      ) : <p className={`${TYPOGRAPHY_CLASSES.bodyLight} py-4 text-tea-text-sec`}>{view.empty}</p>)}
    </div>
  );
}

export function CustomerNotesReview() {
  return (
    // pb-nav-gap keeps the last section clear of the phone's bottom bar.
    <div className="pb-nav-gap">
      <DaySheetButton />
      <ReportsAndRequests />
      <OfferedPhotographs />
      <section aria-label="Notes" className="mt-8">
        <OfferedTastingExcerpts />
      </section>
      <FeedbackList />
    </div>
  );
}
