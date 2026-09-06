import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

/**
 * Everything customers have written about the shop's teas, and the shop's
 * decision on each.
 *
 * The shop reads all of it and picks. A customer writes a note in their own
 * tasting and that is the end of their part: they do not nominate it, and they
 * are not told it is being read here. Publishing one is entirely the shop's
 * act, which is why the wording and the name it goes out under are set on this
 * screen rather than carried over from whatever the customer typed.
 *
 * Decided notes stay in the list, marked, rather than disappearing. A decision
 * you cannot see is a decision you cannot revisit, and half of curating is
 * remembering what you already passed on.
 */
export interface CustomerTastingNote {
  journalEntryId: string;
  noteKey: string;
  productId: string;
  productName: string;
  authorUserId: string | null;
  authorName: string;
  text: string;
  writtenAt: string;
  status: 'open' | 'promoted' | 'dismissed';
}

const FIELD =
  'w-full rounded-md border border-tea-border bg-tea-bg px-3 py-2 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30';

function writtenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function NoteRow({ note }: { note: CustomerTastingNote }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // The name defaults to how the customer is known to the shop, and is meant to
  // be edited: what someone is called on a public product page is a different
  // decision from what they are called in the customer list.
  const [name, setName] = useState(note.authorName);
  const [detail, setDetail] = useState('');
  const [text, setText] = useState(note.text);
  const [error, setError] = useState<string | null>(null);

  const settled = () => {
    setOpen(false);
    return Promise.all([
      qc.invalidateQueries({ queryKey: ['customer-tasting-notes'] }),
      qc.invalidateQueries({ queryKey: ['product-impressions', note.productId] }),
    ]);
  };
  const fail = (fallback: string) => (cause: unknown) =>
    setError(cause instanceof Error ? cause.message : fallback);

  const source = { journal_entry_id: note.journalEntryId, note_key: note.noteKey, source_text: note.text };
  const promote = useMutation({
    mutationFn: () => {
      setError(null);
      return api.customerTastingNotes.promote({
        ...source,
        edited_text: text.trim(),
        attribution_name: name.trim(),
        attribution_detail: detail.trim() || undefined,
      });
    },
    onSuccess: settled,
    onError: fail('Could not publish this note.'),
  });
  const dismiss = useMutation({
    mutationFn: () => {
      setError(null);
      return api.customerTastingNotes.dismiss(source);
    },
    onSuccess: settled,
    onError: fail('Could not pass on this note.'),
  });
  const pending = promote.isPending || dismiss.isPending;
  const decided = note.status !== 'open';

  return (
    <li className="border-b border-tea-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-ui-12 font-medium text-tea-text">{note.productName}</span>
        <span className="text-ui-11 text-tea-text-sec">{note.authorName}</span>
        {writtenLabel(note.writtenAt) && (
          <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">
            {writtenLabel(note.writtenAt)}
          </span>
        )}
        {decided && (
          <span className="rounded-full bg-tea-gold/10 px-2 py-0.5 text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">
            {note.status === 'promoted' ? 'On the tea' : 'Passed'}
          </span>
        )}
      </div>
      <p className="mt-2 text-ui-13 italic leading-relaxed text-tea-text-sec">{note.text}</p>

      {!decided && !open && (
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap-target text-ui-12 text-tea-gold transition-colors hover:text-tea-gold-lt"
          >
            Put this on the tea
          </button>
          <button
            type="button"
            onClick={() => dismiss.mutate()}
            disabled={pending}
            className="tap-target text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50"
          >
            Pass
          </button>
        </div>
      )}

      {!decided && open && (
        <div className="mt-3 space-y-3">
          <label className="block space-y-1">
            <span className="text-ui-11 text-tea-text-dim">How it reads on the tea</span>
            <textarea
              aria-label="How it reads on the tea"
              value={text}
              onChange={event => setText(event.target.value)}
              rows={3}
              className={`${FIELD} resize-y`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-ui-11 text-tea-text-dim">Name it goes out under</span>
              <input aria-label="Name it goes out under" value={name} onChange={event => setName(event.target.value)} className={FIELD} />
            </label>
            <label className="block space-y-1">
              <span className="text-ui-11 text-tea-text-dim">Where they are, or what they do</span>
              <input aria-label="Where they are, or what they do" value={detail} onChange={event => setDetail(event.target.value)} className={FIELD} />
            </label>
          </div>
          {error && <p role="alert" className="text-ui-11 text-tea-text-sec">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="tap-target text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => promote.mutate()}
              disabled={pending || !text.trim() || !name.trim()}
              className="tap-target cta-solid inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-ui-12 font-medium disabled:opacity-50"
            >
              {promote.isPending && <Loader2 size={13} className="animate-spin" />}
              Publish on the tea
            </button>
          </div>
        </div>
      )}
      {decided && error && <p role="alert" className="mt-2 text-ui-11 text-tea-text-sec">{error}</p>}
    </li>
  );
}

export function CustomerNotesReview() {
  const [showDecided, setShowDecided] = useState(false);
  const query = useQuery<CustomerTastingNote[]>({
    queryKey: ['customer-tasting-notes'],
    queryFn: () => api.customerTastingNotes.list(),
  });

  const notes = query.data ?? [];
  const openNotes = useMemo(() => notes.filter(note => note.status === 'open'), [notes]);
  const decidedNotes = useMemo(() => notes.filter(note => note.status !== 'open'), [notes]);
  const shown = showDecided ? notes : openNotes;

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-ui-12 text-tea-text-sec">
        <Loader2 size={14} className="animate-spin" />
        Reading what people wrote…
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-md border border-tea-border bg-tea-surface p-4">
        <p className="text-ui-12 text-tea-text-sec">Could not read the notes.</p>
        <button type="button" onClick={() => { void query.refetch(); }} className="tap-target mt-2 text-ui-12 text-tea-gold hover:text-tea-gold-lt">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ui-12 text-tea-text-sec">
          {openNotes.length === 0
            ? 'Nothing new to read.'
            : `${openNotes.length} note${openNotes.length === 1 ? '' : 's'} waiting to be read.`}
        </p>
        {decidedNotes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDecided(value => !value)}
            className="tap-target text-ui-11 text-tea-text-sec transition-colors hover:text-tea-text"
          >
            {showDecided ? 'Hide decided' : `Show ${decidedNotes.length} already decided`}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-ui-12 text-tea-text-dim">
          Notes appear here as customers write them in their own tastings.
        </p>
      ) : (
        <ul className="mt-2">
          {shown.map(note => (
            <NoteRow key={`${note.journalEntryId}::${note.noteKey}`} note={note} />
          ))}
        </ul>
      )}
    </div>
  );
}
