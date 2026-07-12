import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

export interface TastingNoteCandidate {
  id: string;
  journalEntryId: string;
  noteKey: string;
  productId: string;
  status: 'starred' | 'promoted' | 'dismissed';
  sourceText: string;
  finalText: string;
  attributionName: string | null;
  attributionDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDraft {
  editedText: string;
  attributionName: string;
  attributionDetail: string;
}

export function candidateDraft(candidate: TastingNoteCandidate): CandidateDraft {
  return {
    editedText: candidate.finalText || candidate.sourceText,
    attributionName: candidate.attributionName || '',
    attributionDetail: candidate.attributionDetail || '',
  };
}

type CandidateApi = typeof api.tastingNoteCandidates;

export async function promoteCandidate(id: string, draft: CandidateDraft, client: CandidateApi = api.tastingNoteCandidates) {
  const payload = {
    edited_text: draft.editedText,
    attribution_name: draft.attributionName,
    attribution_detail: draft.attributionDetail || undefined,
  };
  await client.update(id, payload);
  return client.promote(id, payload);
}

export function dismissCandidate(id: string, client: CandidateApi = api.tastingNoteCandidates) {
  return client.dismiss(id);
}

function CandidateRow({ candidate }: { candidate: TastingNoteCandidate }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(() => candidateDraft(candidate));
  const [error, setError] = useState<string | null>(null);
  const resolved = () => qc.invalidateQueries({ queryKey: ['tasting-note-candidates'] });
  const promote = useMutation({
    mutationFn: async () => {
      setError(null);
      return promoteCandidate(candidate.id, draft);
    },
    onSuccess: resolved,
    onError: (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not promote this impression.'),
  });
  const dismiss = useMutation({
    mutationFn: () => dismissCandidate(candidate.id),
    onSuccess: resolved,
    onError: (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not dismiss this candidate.'),
  });
  const pending = promote.isPending || dismiss.isPending;

  return (
    <li className="space-y-3 border-b border-tea-border py-4 last:border-b-0">
      <p className="text-ui-12 italic leading-relaxed text-tea-text-sec">{candidate.sourceText}</p>
      <label className="block space-y-1">
        <span className="text-ui-11 text-tea-text-dim">Published impression</span>
        <textarea
          aria-label="Published impression"
          value={draft.editedText}
          onChange={event => setDraft(value => ({ ...value, editedText: event.target.value }))}
          rows={3}
          className="w-full resize-y rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-ui-11 text-tea-text-dim">Attribution name</span>
          <input aria-label="Attribution name" value={draft.attributionName} onChange={event => setDraft(value => ({ ...value, attributionName: event.target.value }))} className="w-full rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30" />
        </label>
        <label className="block space-y-1">
          <span className="text-ui-11 text-tea-text-dim">Attribution detail</span>
          <input aria-label="Attribution detail" value={draft.attributionDetail} onChange={event => setDraft(value => ({ ...value, attributionDetail: event.target.value }))} className="w-full rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30" />
        </label>
      </div>
      {error && <p role="alert" className="text-ui-11 text-tea-text-sec">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => dismiss.mutate()} disabled={pending} className="tap-target text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50">Dismiss</button>
        <button type="button" onClick={() => promote.mutate()} disabled={pending || !draft.editedText.trim() || !draft.attributionName.trim()} className="tap-target inline-flex items-center gap-1.5 rounded-md bg-tea-gold px-3 py-2 text-ui-12 font-medium text-tea-bg disabled:opacity-50">
          {promote.isPending && <Loader2 size={13} className="animate-spin" />}
          Promote impression
        </button>
      </div>
    </li>
  );
}

export function TastingNoteReviewQueue() {
  const query = useQuery<TastingNoteCandidate[]>({
    queryKey: ['tasting-note-candidates', 'starred'],
    queryFn: () => api.tastingNoteCandidates.list('starred'),
  });

  if (query.isLoading) return <div className="flex items-center gap-2 py-4 text-ui-12 text-tea-text-sec"><Loader2 size={14} className="animate-spin" />Loading review candidates…</div>;
  if (query.isError) return <div role="alert" className="rounded-md border border-tea-border bg-tea-surface p-4"><p className="text-ui-12 text-tea-text-sec">Could not load review candidates.</p><button type="button" onClick={() => query.refetch()} className="tap-target mt-2 text-ui-12 text-tea-gold hover:text-tea-gold-lt">Try again</button></div>;
  if (!query.data?.length) return <p className="py-4 text-ui-12 text-tea-text-dim">No private notes are waiting for review.</p>;

  return <ul className="rounded-md border border-tea-border bg-tea-surface px-4">{query.data.map(candidate => <CandidateRow key={candidate.id} candidate={candidate} />)}</ul>;
}
