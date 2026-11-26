import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { Button } from '../../components/shared/Button';
import { useAppStore } from '../../lib/store';

import { DaySheetButton } from './guestNotes/DaySheetButton';
import { FeedbackList } from './guestNotes/FeedbackList';
import { OfferedPhotographs } from './guestNotes/OfferedPhotographs';
import { ReportsAndRequests } from './guestNotes/ReportsAndRequests';
import { TeaTableManage } from './guestNotes/TeaTableManage';

interface GuestExcerpt {
  id: string;
  productId: string;
  productName: string;
  sourceText: string;
  attributionName: string;
  impressionId: string | null;
  showOnListing: boolean;
  showOnMainPage: boolean;
  /** What the page shows once approved; may be the shop's correction. */
  publishedText?: string | null;
  publishedName?: string | null;
}

const views = [
  { id: 'starred', label: 'Offered', empty: 'No excerpts are waiting for review.' },
  { id: 'promoted', label: 'Approved', empty: 'No excerpts have been approved yet.' },
  { id: 'dismissed', label: 'Passed', empty: 'No excerpts have been passed on.' },
] as const;

type View = typeof views[number];
type Words = { text: string; byline: string };
type Action =
  | { kind: 'approve'; words?: Words }
  | { kind: 'correct'; impressionId: string; words: Words }
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
      if (action.kind === 'approve') {
        return action.words
          ? api.tastingNoteCandidates.promote(excerpt.id, { edited_text: action.words.text, attribution_name: action.words.byline })
          : api.tastingNoteCandidates.approve(excerpt.id);
      }
      if (action.kind === 'correct') return api.tastingNoteCandidates.correct(action.impressionId, { edited_text: action.words.text, attribution_name: action.words.byline });
      if (action.kind === 'pass') return api.tastingNoteCandidates.dismiss(excerpt.id);
      return api.tastingNoteCandidates.setPlacements(action.impressionId, { [action.surface]: action.visible });
    },
    onSuccess: (_result, action) => { setDraft(null); return onUpdate(action, excerpt.productId); },
    onError,
  });

  const impressionId = excerpt.impressionId;
  const shown: Words = view === 'promoted'
    ? { text: excerpt.publishedText ?? excerpt.sourceText, byline: excerpt.publishedName ?? excerpt.attributionName }
    : { text: excerpt.sourceText, byline: excerpt.attributionName };
  const corrected = view === 'promoted' && (shown.text !== excerpt.sourceText || shown.byline !== excerpt.attributionName);
  // The shop may correct a spelling or a slip; the customer's original stays on file.
  const [draft, setDraft] = useState<Words | null>(null);
  const draftReady = Boolean(draft?.text.trim() && draft.byline.trim());
  const draftChanged = Boolean(draft && (draft.text.trim() !== shown.text || draft.byline.trim() !== shown.byline));
  const saveDraft = () => {
    if (!draft || !draftReady) return;
    const words = { text: draft.text.trim(), byline: draft.byline.trim() };
    if (view === 'starred') mutation.mutate({ kind: 'approve', words });
    else if (impressionId) mutation.mutate({ kind: 'correct', impressionId, words });
  };

  if (draft) {
    return (
      <li className="grid min-w-0 gap-2 border-b border-tea-border py-4 last:border-b-0" data-testid="excerpt-correction">
        <p className={TYPOGRAPHY_CLASSES.label}>{excerpt.productName}</p>
        <label className="grid gap-1">
          <span className="text-ui-13 text-tea-text-sec">Words</span>
          <textarea className="input-field w-full text-ui-16" rows={4} value={draft.text} maxLength={2000}
            onChange={event => setDraft({ ...draft, text: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="text-ui-13 text-tea-text-sec">Signed</span>
          <input className="input-field w-full text-ui-16" value={draft.byline} maxLength={80}
            onChange={event => setDraft({ ...draft, byline: event.target.value })} />
        </label>
        <figure className="m-0 grid gap-1 text-ui-13 text-tea-text-sec" data-testid="customer-original">
          <figcaption>What the customer wrote, kept on file</figcaption>
          <blockquote className="m-0 whitespace-pre-wrap break-words italic">{excerpt.sourceText}</blockquote>
          <p className="m-0">{excerpt.attributionName}</p>
        </figure>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="quiet" type="button" disabled={mutation.isPending} onClick={() => setDraft(null)}>Cancel</Button>
          <Button variant="primary" type="button" disabled={mutation.isPending || !draftReady || (view === 'promoted' && !draftChanged)}
            onClick={saveDraft}>{view === 'starred' ? 'Approve with these words' : 'Save the words'}</Button>
        </div>
      </li>
    );
  }
  return (
    <li className="grid min-w-0 gap-2 border-b border-tea-border py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className={TYPOGRAPHY_CLASSES.label}>{excerpt.productName}</p>
        <figure className="mt-1 min-w-0">
          <blockquote className={`${TYPOGRAPHY_CLASSES.body} whitespace-pre-wrap break-words italic text-tea-text`}>
            {shown.text}
          </blockquote>
          <figcaption className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 break-words text-tea-text-sec`}>
            {shown.byline}{corrected && ' · corrected by the shop'}
          </figcaption>
        </figure>
      </div>
      {view === 'starred' && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-quiet" disabled={mutation.isPending}
            onClick={() => mutation.mutate({ kind: 'pass' })}>Pass</button>
          <Button variant="secondary" type="button" disabled={mutation.isPending}
            onClick={() => setDraft(shown)}>Correct the words</Button>
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
          <Button variant="quiet" type="button" disabled={mutation.isPending}
            onClick={() => setDraft(shown)}>Correct the words</Button>
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
    if (action.kind === 'correct') {
      await Promise.all([
        refresh(),
        client.invalidateQueries({ queryKey: ['product-impressions', productId] }),
        client.invalidateQueries({ queryKey: ['main-tasting-excerpts'] }),
      ]);
      setMessage('Words saved.');
      return;
    }
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
      <TeaTableManage />
      <section aria-label="Notes" className="mt-8">
        <OfferedTastingExcerpts />
      </section>
      <FeedbackList />
    </div>
  );
}
