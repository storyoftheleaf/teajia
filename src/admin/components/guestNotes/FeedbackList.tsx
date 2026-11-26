import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { familyApi } from '../../../lib/familyApi';
import type { FamilyFeedbackNote } from '../../../lib/familyContract';
import { Chip, SectionHeading, TextAction, dayLabel, errorSentence } from './parts';

/**
 * Every note members wrote, in their words. The impression and score a member
 * gave are theirs alone (Adrian, 2026-11-26): no list, page or tea shows them.
 *
 * From each row the shop can hide the whole tasting (when it was shared) or the
 * person's whole page, in one tap, and show it again the same way.
 */
export const FEEDBACK_KEY = ['family-feedback'] as const;

function FeedbackRow({ note }: { note: FamilyFeedbackNote }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const hide = useMutation({
    mutationFn: async (change: { kind: 'tasting' | 'page'; hidden: boolean }) => {
      setError(null);
      const target = change.kind === 'tasting'
        ? { target_kind: 'tasting' as const, target_id: note.journal_entry_id }
        : { target_kind: 'page' as const, target_id: note.page_id! };
      if (change.hidden) await familyApi.shop.hide(target);
      else await familyApi.shop.unhide(target);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FEEDBACK_KEY }),
    onError: cause => setError(errorSentence(cause, 'Could not change that.')),
  });
  return (
    <li className="border-b border-tea-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-ui-12 font-medium text-tea-text">{note.product_name ?? 'A tea'}</span>
        <span className="text-ui-11 text-tea-text-sec">{note.author_name}</span>
        <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">{dayLabel(note.written_at)}</span>
        {note.status !== 'open' && <Chip>{note.status === 'promoted' ? 'On the tea' : 'Passed'}</Chip>}
        {note.tasting_hidden && <Chip>Tasting hidden</Chip>}
        {note.page_hidden && <Chip>Page hidden</Chip>}
      </div>
      <p className="mt-2 text-ui-13 italic leading-relaxed text-tea-text-sec">{note.text}</p>
      {(note.shared || note.page_id) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {note.shared && (
            <TextAction tone="quiet" onClick={() => hide.mutate({ kind: 'tasting', hidden: !note.tasting_hidden })} disabled={hide.isPending}>
              {note.tasting_hidden ? 'Show this tasting' : 'Hide this tasting'}
            </TextAction>
          )}
          {note.page_id && (
            <TextAction tone="quiet" onClick={() => hide.mutate({ kind: 'page', hidden: !note.page_hidden })} disabled={hide.isPending}>
              {note.page_hidden ? 'Show their page' : 'Hide their page'}
            </TextAction>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-ui-11 text-tea-text-sec">{error}</p>}
    </li>
  );
}

export function FeedbackList() {
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: FEEDBACK_KEY, queryFn: () => familyApi.shop.feedback(), enabled: open });
  const notes = query.data?.notes ?? [];

  return (
    <section aria-label="Feedback" className="mt-8">
      <SectionHeading
        aside={(
          <TextAction tone="quiet" aria-expanded={open} onClick={() => setOpen(value => !value)}>
            {open ? 'Close the list' : 'Read every note with its rating'}
          </TextAction>
        )}
      >
        Feedback
      </SectionHeading>
      {open && (
        <>
          <p className="mt-1 text-ui-12 text-tea-text-sec">Their impression and rating are for you alone. They never appear on a page.</p>
          {query.isLoading && <p className="mt-2 text-ui-12 text-tea-text-dim">Reading what people wrote…</p>}
          {query.isError && (
            <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">
              Could not read the feedback.{' '}
              <TextAction onClick={() => { void query.refetch(); }}>Try again</TextAction>
            </p>
          )}
          {query.isSuccess && notes.length === 0 && <p className="mt-2 text-ui-12 text-tea-text-dim">No notes yet.</p>}
          {notes.length > 0 && (
            <ul className="mt-2">
              {notes.map(note => <FeedbackRow key={`${note.journal_entry_id}::${note.note_key}`} note={note} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
