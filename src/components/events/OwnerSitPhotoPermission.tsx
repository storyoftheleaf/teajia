import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { revocableSitPhotoApi, recapPhotoPublicQuery } from '../../lib/revocableSitPhotoApi';
import { Button } from '../shared/Button';

type Props = { setupId: string; photoId: string; scope: { accountId: string | null; userId: string } };

export function OwnerSitPhotoPermission({ setupId, photoId, scope }: Props) {
  const label = useId();
  const queryClient = useQueryClient();
  const [credit, setCredit] = useState('');
  const [version, setVersion] = useState(() => crypto.randomUUID());
  const queryKey = ['sit-photo-owner-permission', scope.accountId, scope.userId, setupId, photoId];
  const status = useQuery({
    queryKey,
    queryFn: () => revocableSitPhotoApi.ownerStatus(setupId, photoId, scope),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey, exact: true });
    void queryClient.invalidateQueries({ queryKey: recapPhotoPublicQuery });
  };

  const offer = useMutation({
    mutationFn: () => revocableSitPhotoApi.offer(setupId, photoId, { id: version, credit }, scope),
    onSuccess: () => setCredit(''),
    onSettled: refresh,
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => revocableSitPhotoApi.withdraw(setupId, photoId, id, scope),
    onSuccess: () => {
      setVersion(crypto.randomUUID());
      offer.reset();
    },
    onSettled: refresh,
  });

  if (status.isError) return (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <p className="text-ui-13 text-tea-text-sec">Couldn’t check public permission.</p>
      <Button type="button" variant="quiet" size="sm" onClick={() => void status.refetch()}>Try again</Button>
    </div>
  );
  if (!status.data || (!status.data.eligible && !status.data.permission)) return null;
  const permission = status.data.permission;
  const busy = offer.isPending || withdraw.isPending || status.isFetching;
  return (
    <section aria-labelledby={label} className="space-y-2 p-4">
      <p id={label} className="text-ui-14 text-tea-text">Public recap</p>
      {permission ? (
        <>
          <p className="text-ui-13 text-tea-text-sec" role="status">
            {permission.status === 'placed' && status.data.eligible
              ? 'Approved for the public recap.' : permission.status === 'offered' && status.data.eligible
                ? 'Offered to the host for review.' : 'Permission granted. This photo is currently unavailable for the recap.'}
            {' '}Credit: {permission.credit}
          </p>
          {withdraw.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t withdraw permission. Try again.</p>}
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => withdraw.mutate(permission.id)}>
            {withdraw.isPending ? 'Withdrawing…' : 'Withdraw public permission'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-ui-13 text-tea-text-sec">
            Allow the host to include this photo and your credit in the public recap. Offer only a photo you took and have permission to share. You can withdraw it here.
          </p>
          <label className="block text-ui-13 text-tea-text-sec">
            Public credit
            <input className="btn-field mt-1 w-full" value={credit} onChange={event => setCredit(event.currentTarget.value)}
              placeholder="Name or pen name" maxLength={120} disabled={busy} />
          </label>
          {withdraw.isSuccess && <p className="text-ui-13 text-tea-text-sec" role="status">Public permission withdrawn. Your private photo is still saved.</p>}
          {offer.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t offer this photo. Check the permission and try again.</p>}
          <Button type="button" variant="secondary" size="sm" disabled={busy || !credit.trim()} onClick={() => offer.mutate()}>
            {offer.isPending ? 'Offering…' : 'Offer for public recap'}
          </Button>
        </>
      )}
    </section>
  );
}
