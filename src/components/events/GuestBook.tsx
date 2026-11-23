import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ApiError } from '../../lib/api';
import { afterSitGuestBook, GUEST_BOOK_NOTE_LIMIT, guestBookApi, type GuestBookStatus, type GuestBookData } from '../../lib/guestBookApi';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import { GuestBookPhotos } from './GuestBookPhotos';

type Draft = { note: string; confirmed: boolean };
type GuestBookWrite = { action: 'send'; note: string } | { action: 'withdraw' };

const GUEST_STATUS: Record<GuestBookStatus, string> = {
  pending: 'Pending host review',
  included: 'Included in the Guest Book',
  passed: 'Passed by the host',
};

const EMPTY_DRAFT: Draft = { note: '', confirmed: false };

export function GuestBook({ token, afterSitKey }: { token: string; afterSitKey?: string }) {
  const userId = useAppStore(state => state.activeUserId);
  const accountId = useAppStore(state => state.activeAccountId);
  const location = useLocation();
  if (!userId) {
    if (afterSitKey) return null;
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return (
      <section aria-label="Guest Book" className="mt-6 border-t border-tea-border pt-4">
        <h2 className={TYPOGRAPHY_CLASSES.h2}>Guest Book</h2>
        <Link to={`/signin?returnTo=${returnTo}`} className="btn-secondary btn-sm mt-2">Sign in to use the Guest Book</Link>
      </section>
    );
  }
  return <GuestBookPanel key={JSON.stringify([userId, accountId, afterSitKey ?? token])} token={token} accountId={accountId} userId={userId} afterSitKey={afterSitKey} />;
}

function GuestBookPanel({ token, accountId, userId, afterSitKey }: { token: string; accountId: string | null; userId: string; afterSitKey?: string }) {
  const headingId = useId();
  const countId = useId();
  const queryClient = useQueryClient();
  const queryKey = ['guest-book-attendee', userId, accountId, afterSitKey ?? token];
  const expectedAuth = accountId ? { accountId, userId } : undefined;
  const query = useQuery({
    queryKey,
    queryFn: () => afterSitKey
      ? afterSitGuestBook<GuestBookData>(token, 'read', { accountId, userId })
      : guestBookApi.read(token, expectedAuth),
    staleTime: 0, gcTime: 0, retry: false,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const write = useMutation({
    gcTime: 0,
    networkMode: 'always',
    mutationFn: (input: GuestBookWrite) => afterSitKey
      ? afterSitGuestBook(token, input.action, { accountId, userId }, input.action === 'send' ? input.note : undefined)
      : input.action === 'send'
      ? guestBookApi.send(token, input.note, expectedAuth)
      : guestBookApi.withdraw(token, expectedAuth),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true });
      setDraft(null);
    },
  });

  const own = query.data?.own;
  const activeDraft = draft ?? EMPTY_DRAFT;
  const showEditor = !own || draft !== null;
  const writePending = write.isPending;
  const unavailable = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  if (unavailable) return null;

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-tea-border pt-4">
      <h2 id={headingId} className={TYPOGRAPHY_CLASSES.h2}>Guest Book</h2>
      {query.isPending ? (
        <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Loading the Guest Book…</p>
      ) : query.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Could not load the Guest Book.</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          {query.data.entries.length > 0 && (
            <ul aria-label="Notes from session guests" className="my-3 divide-y divide-tea-border">
              {query.data.entries.map(entry => (
                <li key={entry.id} className="py-2">
                  <p className={`${TYPOGRAPHY_CLASSES.bodyLight} whitespace-pre-wrap break-words`}>{entry.note}</p>
                  <p className="text-ui-12 text-tea-text-sec break-words">{entry.display_name}</p>
                </li>
              ))}
            </ul>
          )}

          {showEditor ? (
            <form className="mt-3" onSubmit={event => {
              event.preventDefault();
              const note = activeDraft.note.trim();
              if (activeDraft.confirmed && note && note.length <= GUEST_BOOK_NOTE_LIMIT && !writePending) {
                write.mutate({ action: 'send', note });
              }
            }}>
              <label className="block text-ui-13 text-tea-text-sec">
                Your note
                <textarea
                  className="input-field mt-2 p-3 text-ui-16"
                  value={activeDraft.note}
                  maxLength={GUEST_BOOK_NOTE_LIMIT}
                  rows={3}
                  aria-describedby={countId}
                  disabled={writePending}
                  onChange={event => {
                    setDraft({ ...activeDraft, note: event.target.value, confirmed: false });
                    if (write.isError) write.reset();
                  }}
                />
              </label>
              <p id={countId} className="mt-1 text-right text-ui-12 text-tea-text-sec">
                {activeDraft.note.length}/{GUEST_BOOK_NOTE_LIMIT}
              </p>
              {own?.status === 'included' && (
                <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 text-tea-text-sec`}>
                  Changes return this note to host review.
                </p>
              )}
              <label className="flex min-h-tap cursor-pointer items-center gap-2 text-ui-13 text-tea-text-sec">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-tea-gold"
                  checked={activeDraft.confirmed}
                  disabled={writePending}
                  onChange={event => setDraft({ ...activeDraft, confirmed: event.target.checked })}
                />
                I agree to share this note with the host. If the host includes it, session guests can read it with my display name.
              </label>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                {own && (
                  <Button type="button" variant="quiet" size="sm" disabled={writePending} onClick={() => {
                    setDraft(null);
                    write.reset();
                  }}>Cancel</Button>
                )}
                <Button type="submit" variant="primary" size="sm" className="ml-auto" disabled={!activeDraft.confirmed || !activeDraft.note.trim()} loading={writePending}>
                  Send for review
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-3 border-t border-tea-border pt-3">
              <p role="status" className="text-ui-13 text-tea-text-sec">{GUEST_STATUS[own.status]}</p>
              {own.status !== 'included' && (
                <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap break-words`}>{own.note}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={writePending} onClick={() => {
                  setDraft({ note: own.note, confirmed: false });
                  write.reset();
                }}>Edit note</Button>
                <Button type="button" variant="quiet" size="sm" loading={writePending} onClick={() => write.mutate({ action: 'withdraw' })}>Withdraw note</Button>
              </div>
            </div>
          )}
          {write.isError && (
            <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">
              {write.variables?.action === 'withdraw' ? 'Could not withdraw your note.' : 'Could not send your note for review.'} Try again.
            </p>
          )}
          {write.isSuccess && write.variables.action === 'withdraw' && (
            <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">Note withdrawn.</p>
          )}
        </>
      )}
      {afterSitKey && query.isSuccess && <GuestBookPhotos credential={token} cacheKey={afterSitKey} identity={{ accountId, userId }} />}
    </section>
  );
}
