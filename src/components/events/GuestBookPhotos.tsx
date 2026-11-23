import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ApiError } from '../../lib/api';
import type { GuestBookStatus } from '../../lib/guestBookApi';
import { guestBookPhotoApi } from '../../lib/guestBookPhotoApi';
import { Button } from '../shared/Button';
import { GuestBookPhotoTile } from './GuestBookPhotoTile';

export const GUEST_BOOK_PHOTOS_QUERY = 'after-sit-guest-book-photos';
export const GUEST_BOOK_PHOTO_STATE: Record<GuestBookStatus, string> = {
  pending: 'Pending host review',
  included: 'Included in the Guest Book',
  passed: 'Passed by the host',
};
const PAGE_SIZE = 12;

export function GuestBookPhotos({ credential, cacheKey, identity }: {
  credential: string; cacheKey: string; identity: { accountId: string | null; userId: string };
}) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const [page, setPage] = useState(0);
  const [photoId, setPhotoId] = useState('');
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(false);
  const key = [GUEST_BOOK_PHOTOS_QUERY, identity.accountId, identity.userId, cacheKey];
  const data = useQuery({
    queryKey: key, queryFn: ({ signal }) => guestBookPhotoApi.list(credential, identity, signal),
    retry: false, gcTime: 0, staleTime: 0,
  });
  const change = useMutation({
    gcTime: 0, networkMode: 'always',
    mutationFn: (input: { withdraw: string } | { photoId: string; grantId: string; description: string }) =>
      'withdraw' in input
        ? guestBookPhotoApi.withdraw(credential, input.withdraw, identity)
        : guestBookPhotoApi.offer(credential, { action: 'photo-offer', ...input }, identity),
    onSuccess: async (_, input) => {
      if ('withdraw' in input) queryClient.removeQueries({ queryKey: [...key, 'included', input.withdraw] });
      else {
        setPhotoId('');
        setDescription('');
        setConsent(false);
      }
      await queryClient.invalidateQueries({ queryKey: key, exact: true });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: key, exact: true }),
  });

  if (data.error instanceof ApiError && [401, 403, 404].includes(data.error.status)) return null;

  const own = data.data?.own ?? [];
  const choices = own.filter(photo => !photo.grant_id);
  const contributed = own.filter(photo => photo.grant_id);
  const chosen = choices.find(photo => photo.id === photoId);
  const gallery = data.data?.gallery ?? [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(gallery.length / PAGE_SIZE) - 1));
  const available = gallery.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section aria-labelledby={headingId} className="mt-4 border-t border-tea-border pt-3">
      <h3 id={headingId} className={TYPOGRAPHY_CLASSES.h3}>Photos for session guests</h3>
      {data.isPending && <p role="status" className="text-ui-13 text-tea-text-sec">Loading photos…</p>}
      {data.isError ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p role="status" className="text-ui-13 text-tea-text-sec">Couldn’t load Guest Book photos.</p>
          <Button variant="quiet" size="sm" onClick={() => void data.refetch()}>Try again</Button>
        </div>
      ) : data.isSuccess && (
        <>
          {available.length > 0 ? (
            <ul aria-label="Photos shared in the Guest Book" className="my-3 flex flex-wrap gap-3">
              {available.map(photo => (
                <li key={photo.id}>
                  <GuestBookPhotoTile queryKey={[...key, 'included', photo.id]} alt={photo.alt_text}
                    title={`Photo by ${photo.display_name}`}
                    load={signal => guestBookPhotoApi.read(credential, { action: 'photo-bytes', grantId: photo.id }, identity, signal)} />
                  <p className="text-ui-12 text-tea-text-sec break-words">{photo.display_name}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-ui-13 text-tea-text-sec">No photos have been included yet.</p>}
          {gallery.length > PAGE_SIZE && (
            <nav aria-label="Guest Book photo pages" className="flex flex-wrap items-center gap-2">
              <Button variant="quiet" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous photos</Button>
              <Button variant="quiet" size="sm" disabled={(currentPage + 1) * PAGE_SIZE >= gallery.length}
                onClick={() => setPage(currentPage + 1)}>Next photos</Button>
            </nav>
          )}
          {contributed.length > 0 && (
            <ul aria-label="Your photo contributions" className="my-3 divide-y divide-tea-border">
              {contributed.map(photo => (
                <li key={photo.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-ui-13 text-tea-text break-words">{photo.alt_text}</p>
                    <p className="text-ui-12 text-tea-text-sec">{photo.status && GUEST_BOOK_PHOTO_STATE[photo.status]}</p>
                  </div>
                  <Button variant="quiet" size="sm" disabled={change.isPending} onClick={() => {
                    if (photo.grant_id) change.mutate({ withdraw: photo.grant_id });
                  }}>Withdraw photo</Button>
                </li>
              ))}
            </ul>
          )}
          {choices.length > 0 ? (
            <form className="mt-3 grid gap-2" onSubmit={event => {
              event.preventDefault();
              if (chosen && consent && !change.isPending) {
                change.mutate({ photoId: chosen.id, grantId: crypto.randomUUID(), description });
              }
            }}>
              <label className="flex flex-wrap items-center gap-2 text-ui-13 text-tea-text-sec">
                Choose a private photo
                <select className="btn-field max-w-full" value={photoId} onChange={event => {
                  setPhotoId(event.target.value);
                  setDescription('');
                  setConsent(false);
                  change.reset();
                }} disabled={change.isPending}>
                  <option value="">Select photo</option>
                  {choices.map((photo, index) => <option key={photo.id} value={photo.id}>
                    {photo.tea_name || 'Whole setup'} · {index + 1}
                  </option>)}
                </select>
              </label>
              {chosen && (
                <>
                  <GuestBookPhotoTile key={chosen.id} queryKey={[...key, 'own', chosen.id]} alt="Your selected private photo"
                    title="Your selected private photo"
                    load={signal => guestBookPhotoApi.read(credential, { action: 'private-photo-preview', photoId: chosen.id }, identity, signal)} />
                  <label className="block text-ui-13 text-tea-text-sec">
                    Photo description (optional)
                    <input className="input-field mt-1" value={description} maxLength={250} disabled={change.isPending}
                      onChange={event => setDescription(event.target.value)} />
                  </label>
                  <label className="flex min-h-tap cursor-pointer items-center gap-2 text-ui-13 text-tea-text-sec">
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-tea-gold" checked={consent}
                      disabled={change.isPending} onChange={event => setConsent(event.target.checked)} />
                    I agree to share this photo with the host for review. If included, it appears with my name in this session’s Guest Book.
                  </label>
                  <Button type="submit" variant="primary" size="sm" className="justify-self-end"
                    disabled={!consent} loading={change.isPending}>Send photo for review</Button>
                </>
              )}
            </form>
          ) : !contributed.length && <p className="mt-2 text-ui-13 text-tea-text-sec">Save a private photo with your setup above to offer it here.</p>}
          {change.isError && <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">Couldn’t update the contribution. Try again.</p>}
          {change.isSuccess && <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">
            {'withdraw' in change.variables ? 'Photo withdrawn.' : 'Photo sent for host review.'}
          </p>}
        </>
      )}
    </section>
  );
}
