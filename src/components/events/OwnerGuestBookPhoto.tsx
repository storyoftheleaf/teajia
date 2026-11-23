import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { guestBookPhotoApi } from '../../lib/guestBookPhotoApi';
import { Button } from '../shared/Button';
import { GUEST_BOOK_PHOTOS_QUERY, GUEST_BOOK_PHOTO_STATE } from './GuestBookPhotos';

export function OwnerGuestBookPhoto({ eventId, photoId, identity }: {
  eventId: string; photoId: string; identity: { accountId: string | null; userId: string };
}) {
  const client = useQueryClient();
  const key = ['guest-book-photo-owner', identity.accountId, identity.userId, eventId, photoId];
  const query = useQuery({
    queryKey: key, queryFn: () => guestBookPhotoApi.ownerStatus(eventId, photoId, identity),
    retry: false, staleTime: 0, gcTime: 0,
  });
  const remove = useMutation({
    mutationFn: (grantId: string) => guestBookPhotoApi.ownerWithdraw(eventId, photoId, grantId, identity),
    onSuccess: async () => {
      client.setQueryData(key, { grant: null });
      await client.invalidateQueries({ queryKey: [GUEST_BOOK_PHOTOS_QUERY, identity.accountId, identity.userId] });
    },
    gcTime: 0,
  });
  const grant = query.data?.grant;
  if (query.isError) return <Button variant="quiet" size="sm" onClick={() => void query.refetch()}>Retry Guest Book sharing status</Button>;
  if (!grant) return remove.isSuccess ? <p role="status" className="text-ui-13 text-tea-text-sec">Photo withdrawn from the Guest Book.</p> : null;
  return (
    <div className="mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-tea-border pt-3">
      <p className="text-ui-13 text-tea-text-sec">Guest Book · {GUEST_BOOK_PHOTO_STATE[grant.status]}</p>
      <Button variant="quiet" size="sm" loading={remove.isPending} onClick={() => remove.mutate(grant.id)}>
        Withdraw from Guest Book
      </Button>
      {remove.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t withdraw this photo. Try again.</p>}
    </div>
  );
}
