import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/shared/Button';
import { GuestBookPhotoTile } from '../../components/events/GuestBookPhotoTile';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ApiError } from '../../lib/api';
import { guestBookApi, type GuestBookAction, type GuestBookReviewEntry, type GuestBookStatus } from '../../lib/guestBookApi';
import { guestBookPhotoApi, type ReviewPhoto } from '../../lib/guestBookPhotoApi';
import { groupGuestBookEntries } from '../../lib/groupGuestBookEntries';
import { useAppStore } from '../../lib/store';

const REVIEW_STATUS: Record<GuestBookStatus, string> = {
  pending: 'Pending review',
  included: 'Included',
  passed: 'Passed',
};
const STATUS_ORDER: Record<GuestBookStatus, number> = { pending: 0, included: 1, passed: 2 };
const PAGE_SIZE = 12;

type ReviewInput =
  | { kind: 'note'; part: GuestBookReviewEntry; action: GuestBookAction }
  | { kind: 'photo'; part: ReviewPhoto; action: GuestBookAction };

export function GuestBookReview({ eventId }: { eventId: string }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!accountId || !userId) return null;

  return <ReviewPanel key={JSON.stringify([accountId, userId, eventId])} eventId={eventId} accountId={accountId} userId={userId} />;
}

function ReviewPanel({ eventId, accountId, userId }: { eventId: string; accountId: string; userId: string }) {
  const headingId = useId();
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const queryKey = ['guest-book-review', accountId, userId, eventId];
  const expectedAuth = { accountId, userId };
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const [notes, pictures] = await Promise.all([
        guestBookApi.listForReview(eventId, expectedAuth),
        guestBookPhotoApi.staffList(eventId, expectedAuth, signal),
      ]);
      return groupGuestBookEntries(notes.entries, pictures.photos)
        .map(entry => ({
          ...entry,
          order: Math.min(entry.note ? STATUS_ORDER[entry.note.status] : Infinity,
            ...entry.photos.map(photo => STATUS_ORDER[photo.status])),
        }))
        .sort((a, b) => a.order - b.order);
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey, exact: true });
  const review = useMutation({
    gcTime: 0,
    networkMode: 'always',
    mutationFn: ({ kind, part, action }: ReviewInput) => kind === 'note'
      ? guestBookApi.review(eventId, part, action, expectedAuth)
      : guestBookPhotoApi.staffReview(eventId, part, action, expectedAuth),
    onSuccess: refresh,
    onError: async error => {
      if (error instanceof ApiError && error.status === 409) await refresh();
    },
  });
  const unavailable = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  if (unavailable) return null;
  const conflict = review.error instanceof ApiError && review.error.status === 409;
  const entries = query.data ?? [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(entries.length / PAGE_SIZE) - 1));
  const displayed = entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-tea-border pt-4">
      <h2 id={headingId} className={TYPOGRAPHY_CLASSES.h2}>Guest Book</h2>
      {query.isPending ? (
        <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Loading Guest Book entries…</p>
      ) : query.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Could not load the Guest Book.</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : entries.length === 0 ? (
        <p className={TYPOGRAPHY_CLASSES.bodyLight}>No entries submitted yet.</p>
      ) : (
        <>
          <p className={TYPOGRAPHY_CLASSES.bodyLight}>Included notes and photos are visible to verified session guests.</p>
          {review.isError && (
            <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">
              {conflict ? 'This entry changed. Check it before reviewing again.' : 'Could not save the review. Try again.'}
            </p>
          )}
          <ul aria-label="Guest Book entries for review" className="mt-2 divide-y divide-tea-border">
            {displayed.map(({ key, displayName, note, photos }) => (
              <li key={key} className="space-y-2 py-3">
                <h3 className="truncate text-ui-14 font-medium text-tea-text">{displayName}</h3>
                {note && (
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} whitespace-pre-wrap break-words`}>{note.note}</p>
                      <p role="status" className="text-ui-12 text-tea-text-sec">Note · {REVIEW_STATUS[note.status]}</p>
                    </div>
                    <ReviewActions kind="note" name={displayName} status={note.status} busy={review.isPending}
                      onReview={action => review.mutate({ kind: 'note', part: note, action })} />
                  </div>
                )}
                {photos.map(photo => (
                  <div key={photo.id} className="flex flex-wrap items-center gap-2">
                    <GuestBookPhotoTile queryKey={[...queryKey, 'photo', photo.id]} alt={photo.alt_text} title={`Photo by ${displayName}`}
                      load={signal => guestBookPhotoApi.staffRead(eventId, photo.id, expectedAuth, signal)} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-ui-13 text-tea-text">{photo.alt_text}</p>
                      <p role="status" className="text-ui-12 text-tea-text-sec">Photo · {REVIEW_STATUS[photo.status]}</p>
                    </div>
                    <ReviewActions kind="photo" name={displayName} status={photo.status} busy={review.isPending}
                      onReview={action => review.mutate({ kind: 'photo', part: photo, action })} />
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {entries.length > PAGE_SIZE && (
            <nav aria-label="Guest Book review pages" className="flex flex-wrap gap-2">
              <Button variant="quiet" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous entries</Button>
              <Button variant="quiet" size="sm" disabled={currentPage + 1 >= Math.ceil(entries.length / PAGE_SIZE)}
                onClick={() => setPage(currentPage + 1)}>Next entries</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function ReviewActions({ kind, name, status, busy, onReview }: {
  kind: 'note' | 'photo'; name: string; status: GuestBookStatus; busy: boolean; onReview: (action: GuestBookAction) => void;
}) {
  return (
    <div className="ml-auto flex flex-wrap gap-2">
      {status !== 'passed' && (
        <Button type="button" size="sm" variant="quiet" disabled={busy}
          aria-label={`${status === 'included' ? 'Remove' : 'Pass on'} ${kind} from ${name}`}
          onClick={() => onReview('pass')}>{status === 'included' ? 'Remove' : 'Pass'}</Button>
      )}
      {status !== 'included' && (
        <Button type="button" size="sm" variant="secondary" disabled={busy} aria-label={`Include ${kind} from ${name}`}
          onClick={() => onReview('include')}>Include</Button>
      )}
    </div>
  );
}
