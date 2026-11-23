import { useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ApiError } from '../../lib/api';
import { guestBookApi, type GuestBookAction, type GuestBookReviewEntry, type GuestBookStatus } from '../../lib/guestBookApi';
import { useAppStore } from '../../lib/store';
import { GuestBookPhotoReview } from './GuestBookPhotoReview';

const REVIEW_STATUS: Record<GuestBookStatus, string> = {
  pending: 'Pending review',
  included: 'Included',
  passed: 'Passed',
};

export function GuestBookReview({ eventId }: { eventId: string }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!accountId || !userId) return null;

  return <ReviewPanel key={JSON.stringify([accountId, userId, eventId])} eventId={eventId} accountId={accountId} userId={userId} />;
}

function ReviewPanel({ eventId, accountId, userId }: { eventId: string; accountId: string; userId: string }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const queryKey = ['guest-book-review', accountId, userId, eventId];
  const expectedAuth = { accountId, userId };
  const query = useQuery({
    queryKey,
    queryFn: () => guestBookApi.listForReview(eventId, expectedAuth),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey, exact: true });
  const review = useMutation({
    gcTime: 0,
    networkMode: 'always',
    mutationFn: ({ entry, action }: { entry: GuestBookReviewEntry; action: GuestBookAction }) =>
      guestBookApi.review(eventId, entry, action, expectedAuth),
    onSuccess: refresh,
    onError: async error => {
      if (error instanceof ApiError && error.status === 409) await refresh();
    },
  });
  const unavailable = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  if (unavailable) return null;
  const conflict = review.error instanceof ApiError && review.error.status === 409;

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-tea-border pt-4">
      <h2 id={headingId} className={TYPOGRAPHY_CLASSES.h2}>Guest Book</h2>
      {query.isPending ? (
        <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Loading Guest Book notes…</p>
      ) : query.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Could not load Guest Book notes.</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : query.data.entries.length === 0 ? (
        <p className={TYPOGRAPHY_CLASSES.bodyLight}>No notes submitted yet.</p>
      ) : (
        <>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>
            Included notes appear with the guest’s display name in the attendee Guest Book.
          </p>
          {review.isError && (
            <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">
              {conflict ? 'This note changed. Read it again before reviewing.' : 'Could not save the review. Try again.'}
            </p>
          )}
          <ul className="mt-2 divide-y divide-tea-border">
            {query.data.entries.map(entry => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-ui-13 text-tea-text break-words">{entry.display_name}</p>
                    <span role="status" className="text-ui-12 text-tea-text-sec">{REVIEW_STATUS[entry.status]}</span>
                  </div>
                  <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap break-words`}>{entry.note}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {entry.status !== 'passed' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      aria-label={entry.status === 'included' ? `Remove note from ${entry.display_name}` : `Pass on note from ${entry.display_name}`}
                      disabled={review.isPending}
                      onClick={() => review.mutate({ entry, action: 'pass' })}
                    >
                      {entry.status === 'included' ? 'Remove' : 'Pass'}
                    </Button>
                  )}
                  {entry.status !== 'included' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Include note from ${entry.display_name}`}
                      disabled={review.isPending}
                      onClick={() => review.mutate({ entry, action: 'include' })}
                    >
                      Include
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <GuestBookPhotoReview eventId={eventId} identity={expectedAuth} />
    </section>
  );
}
