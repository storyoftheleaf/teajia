import { useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/shared/Button';
import { GuestBookPhotoTile } from '../../components/events/GuestBookPhotoTile';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ApiError } from '../../lib/api';
import { useStepParam } from '../../hooks/useStepParam';
import { guestBookApi, type GuestBookAction, type GuestBookReviewEntry, type GuestBookReviewer, type GuestBookStatus } from '../../lib/guestBookApi';
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

export function GuestBookReview({ eventId, reviewer = 'staff' }: { eventId: string; reviewer?: GuestBookReviewer }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!userId || (reviewer === 'staff' && !accountId)) return null;

  return <ReviewPanel key={JSON.stringify([reviewer, accountId, userId, eventId])}
    eventId={eventId} accountId={accountId} userId={userId} reviewer={reviewer} />;
}

function ReviewPanel({ eventId, accountId, userId, reviewer }: {
  eventId: string; accountId: string | null; userId: string; reviewer: GuestBookReviewer;
}) {
  const headingId = useId();
  const [page, setPage] = useStepParam('review-page', '1');
  const pagedIndex = /^\d+$/.test(page) ? Math.max(0, Number(page) - 1) : 0;
  const host = reviewer === 'host';
  const statusLabel = (status: GuestBookStatus) => host && status === 'passed' ? 'Hidden' : REVIEW_STATUS[status];
  const queryClient = useQueryClient();
  const queryKey = ['guest-book-review', reviewer, accountId, userId, eventId];
  const expectedAuth = { accountId, userId };
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const [notes, pictures] = await Promise.all([
        guestBookApi.listForReview(eventId, expectedAuth, reviewer, signal),
        guestBookPhotoApi.listForReview(eventId, expectedAuth, reviewer, signal),
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
      ? guestBookApi.review(eventId, part, action, expectedAuth, reviewer)
      : guestBookPhotoApi.review(eventId, part, action, expectedAuth, reviewer),
    onSuccess: refresh,
    onError: async error => {
      if (error instanceof ApiError && error.status === 409) await refresh();
    },
  });
  const unavailable = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  if (unavailable) return null;
  const conflict = review.error instanceof ApiError && review.error.status === 409;
  const entries = query.data ?? [];
  const currentPage = Math.min(pagedIndex, Math.max(0, Math.ceil(entries.length / PAGE_SIZE) - 1));
  const displayed = entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const Heading = host ? 'h3' : 'h2';

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-tea-border pt-4">
      <Heading id={headingId} className={host ? TYPOGRAPHY_CLASSES.h3 : TYPOGRAPHY_CLASSES.h2}>
        {host ? 'Guest Book contributions' : 'Guest Book'}
      </Heading>
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
          <p className={TYPOGRAPHY_CLASSES.bodyLight}>
            {host ? 'Hide notes or photos from the session’s pages. You can bring them back here.' :
              'Included notes and photos are visible to verified session guests.'}
          </p>
          {review.isError && (
            <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">
              {conflict ? 'This entry changed. Check it before reviewing again.' : 'Could not save the review. Try again.'}
            </p>
          )}
          <ul aria-label="Guest Book entries for review" className="mt-2 divide-y divide-tea-border">
            {displayed.map(({ key, displayName, note, photos }) => (
              <li key={key} className="space-y-2 py-3">
                {displayName && <p className="truncate text-ui-14 font-medium text-tea-text">{displayName}</p>}
                {note && (
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} whitespace-pre-wrap break-words`}>{note.note}</p>
                      <p role="status" className="text-ui-12 text-tea-text-sec">Note · {statusLabel(note.status)}</p>
                    </div>
                    <ReviewActions subject={`note from ${note.display_name}`} status={note.status} busy={review.isPending} host={host}
                      onReview={action => review.mutate({ kind: 'note', part: note, action })} />
                  </div>
                )}
                {photos.map(photo => (
                  <div key={photo.id} className="flex flex-wrap items-center gap-2">
                    <GuestBookPhotoTile queryKey={[...queryKey, 'photo', photo.id]} previewId={photo.id} alt={photo.alt_text}
                      title={photo.display_name ? `Photo by ${photo.display_name}` : 'Photo from the table'}
                      load={signal => guestBookPhotoApi.readForReview(eventId, photo.id, expectedAuth, reviewer, signal)} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-ui-13 text-tea-text">{photo.alt_text}</p>
                      <p role="status" className="text-ui-12 text-tea-text-sec">Photo · {statusLabel(photo.status)}</p>
                    </div>
                    <ReviewActions subject={host ? `photo: ${photo.alt_text}` : `photo from ${displayName}`}
                      status={photo.status} busy={review.isPending} host={host}
                      onReview={action => review.mutate({ kind: 'photo', part: photo, action })} />
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {entries.length > PAGE_SIZE && (
            <nav aria-label="Guest Book review pages" className="flex flex-wrap gap-2">
              <Button variant="quiet" size="sm" disabled={currentPage === 0}
                onClick={() => setPage(currentPage === 1 ? null : String(currentPage))}>Previous entries</Button>
              <Button variant="quiet" size="sm" disabled={currentPage + 1 >= Math.ceil(entries.length / PAGE_SIZE)}
                onClick={() => setPage(String(currentPage + 2))}>Next entries</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function ReviewActions({ subject, status, busy, host, onReview }: {
  subject: string; status: GuestBookStatus; busy: boolean; host: boolean; onReview: (action: GuestBookAction) => void;
}) {
  const pass = host ? 'Hide' : status === 'included' ? 'Remove' : 'Pass';
  const include = host && status === 'passed' ? 'Bring back' : 'Include';
  return (
    <div className="ml-auto flex flex-wrap gap-2">
      {status !== 'passed' && (
        <Button type="button" size="sm" variant="quiet" className="tap-target" disabled={busy}
          aria-label={`${pass === 'Pass' ? 'Pass on' : pass} ${subject}`}
          onClick={() => onReview('pass')}>{pass}</Button>
      )}
      {status !== 'included' && (
        <Button type="button" size="sm" variant="secondary" className="tap-target" disabled={busy}
          aria-label={`${include} ${subject}`} onClick={() => onReview('include')}>{include}</Button>
      )}
    </div>
  );
}
