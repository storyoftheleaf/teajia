import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GuestBookPhotoTile } from '../../components/events/GuestBookPhotoTile';
import { Button } from '../../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { GuestBookAction, GuestBookStatus } from '../../lib/guestBookApi';
import { guestBookPhotoApi, type ReviewPhoto } from '../../lib/guestBookPhotoApi';

const STATUS: Record<GuestBookStatus, string> = {
  pending: 'Pending review', included: 'Included', passed: 'Passed',
};
const PAGE_SIZE = 12;

export function GuestBookPhotoReview({ eventId, identity }: {
  eventId: string; identity: { accountId: string; userId: string };
}) {
  const headingId = useId();
  const [page, setPage] = useState(0);
  const client = useQueryClient();
  const key = ['guest-book-photo-review', identity.accountId, identity.userId, eventId];
  const query = useQuery({
    queryKey: key, queryFn: ({ signal }) => guestBookPhotoApi.staffList(eventId, identity, signal),
    retry: false, staleTime: 0, gcTime: 0,
  });
  const refresh = () => client.invalidateQueries({ queryKey: key, exact: true });
  const review = useMutation({
    gcTime: 0, networkMode: 'always',
    mutationFn: ({ photo, action }: { photo: ReviewPhoto; action: GuestBookAction }) =>
      guestBookPhotoApi.staffReview(eventId, photo, action, identity),
    onSettled: refresh,
  });
  const photos = query.data?.photos ?? [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(photos.length / PAGE_SIZE) - 1));
  const displayed = photos.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section aria-labelledby={headingId} className="mt-4 border-t border-tea-border pt-3">
      <h3 id={headingId} className={TYPOGRAPHY_CLASSES.h3}>Photos for session guests</h3>
      {query.isPending && <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Loading photo contributions…</p>}
      {query.isError && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Couldn’t load photo contributions.</p>
          <Button variant="quiet" size="sm" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      )}
      {query.isSuccess && (photos.length === 0 ? <p className={TYPOGRAPHY_CLASSES.bodyLight}>No photos submitted yet.</p> : (
        <>
          <p className={TYPOGRAPHY_CLASSES.bodyLight}>Included photos appear in the Guest Book for verified session guests.</p>
          {review.isError && <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">Couldn’t save the review. Check the current status and try again.</p>}
          <ul className="mt-2 divide-y divide-tea-border">
            {displayed.map(photo => (
              <li key={photo.id} className="flex flex-wrap items-center gap-3 py-2">
                <GuestBookPhotoTile queryKey={[...key, 'bytes', photo.id]} alt={photo.alt_text} title={`Photo by ${photo.display_name}`}
                  load={signal => guestBookPhotoApi.staffRead(eventId, photo.id, identity, signal)} />
                <div className="min-w-0 flex-1">
                  <p className="text-ui-13 text-tea-text break-words">{photo.display_name}</p>
                  <p className="text-ui-13 text-tea-text-sec break-words">{photo.alt_text}</p>
                  <p className="text-ui-12 text-tea-text-sec" role="status">{STATUS[photo.status]}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {photo.status !== 'passed' && (
                    <Button type="button" variant="quiet" size="sm" disabled={review.isPending}
                      aria-label={photo.status === 'included' ? `Remove photo from ${photo.display_name}` : `Pass on photo from ${photo.display_name}`}
                      onClick={() => review.mutate({ photo, action: 'pass' })}>{photo.status === 'included' ? 'Remove' : 'Pass'}</Button>
                  )}
                  {photo.status !== 'included' && (
                    <Button type="button" variant="secondary" size="sm" disabled={review.isPending}
                      aria-label={`Include photo from ${photo.display_name}`}
                      onClick={() => review.mutate({ photo, action: 'include' })}>Include</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {photos.length > PAGE_SIZE && (
            <nav aria-label="Photo review pages" className="flex flex-wrap items-center gap-2">
              <Button variant="quiet" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous photos</Button>
              <Button variant="quiet" size="sm" disabled={(currentPage + 1) * PAGE_SIZE >= photos.length}
                onClick={() => setPage(currentPage + 1)}>Next photos</Button>
            </nav>
          )}
        </>
      ))}
    </section>
  );
}
