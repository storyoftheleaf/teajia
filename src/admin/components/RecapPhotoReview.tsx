import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useBlobObjectUrl } from '../../hooks/useBlobObjectUrl';
import { ApiError } from '../../lib/api';
import { recapPhotoPublicQuery, revocableSitPhotoApi, type SitPhotoReviewEntry } from '../../lib/revocableSitPhotoApi';
import { useAppStore } from '../../lib/store';

type Scope = { accountId: string; userId: string };

export function RecapPhotoReview({ eventId }: { eventId: string }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!accountId || !userId) return null;
  return <ReviewPanel key={JSON.stringify([accountId, userId, eventId])} eventId={eventId} scope={{ accountId, userId }} />;
}

function ReviewPanel({ eventId, scope }: { eventId: string; scope: Scope }) {
  const heading = useId();
  const [selected, setSelected] = useState<SitPhotoReviewEntry>();
  const queryClient = useQueryClient();
  const queryKey = ['sit-photo-review', scope.accountId, scope.userId, eventId];
  const list = useQuery({
    queryKey,
    queryFn: () => revocableSitPhotoApi.forReview(eventId, scope),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  if (list.isPending || (list.error instanceof ApiError && [401, 403, 404].includes(list.error.status))) return null;
  const selectedEntry = list.data?.permissions.find(item => item.id === selected?.id);
  const placed = list.data?.permissions.find(item => item.status === 'placed');
  const published = list.data?.published === true;

  return (
    <section aria-labelledby={heading} className="mt-6 border-t border-tea-border pt-4">
      <h2 id={heading} className={TYPOGRAPHY_CLASSES.h2}>Public recap photo</h2>
      {list.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-ui-13 text-tea-text-sec">Couldn’t load offered photos.</p>
          <Button type="button" variant="quiet" size="sm" onClick={() => void list.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          {!list.data?.permissions.length && <p className="text-ui-13 text-tea-text-sec">No photos offered yet.</p>}
          {list.data?.permissions.length && !published ? (
            <p className="text-ui-13 text-tea-text-sec">Publish the recap before placing a photo.</p>
          ) : null}
          <ul className="divide-y divide-tea-border">
            {list.data?.permissions.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <p className="min-w-0 break-words text-ui-13 text-tea-text-sec">
                  {item.credit}{item.tea && <> · {item.tea.name}</>} · {item.status === 'placed' ? 'In the public recap' : 'Offered'}
                  {item.canShowInBrewing && ' · Also offered for Brewing experiences and the photo essay'}
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(item)}>
                  Preview<span className="sr-only"> photo by {item.credit}</span>
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {selectedEntry && (
        <ReviewPhoto key={selectedEntry.id} entry={selectedEntry} eventId={eventId} scope={scope}
          canApprove={published && !placed} onClose={() => setSelected(undefined)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey, exact: true });
            void queryClient.invalidateQueries({ queryKey: recapPhotoPublicQuery });
          }} />
      )}
    </section>
  );
}

function ReviewPhoto({ entry, eventId, scope, canApprove, onClose, onChanged }: {
  entry: SitPhotoReviewEntry; eventId: string; scope: Scope; canApprove: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const [alt, setAlt] = useState('');
  const [observation, setObservation] = useState('');
  const photo = useQuery({
    queryKey: ['sit-photo-review-preview', scope.accountId, scope.userId, eventId, entry.id],
    queryFn: () => revocableSitPhotoApi.preview(eventId, entry.id, scope),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const src = useBlobObjectUrl(photo.isSuccess && !photo.isFetching ? photo.data : undefined);
  const approval = useMutation({
    mutationFn: () => revocableSitPhotoApi.approve(eventId, entry.id, { alt_text: alt, observation }, scope),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) onChanged();
    },
  });
  return (
    <Modal isOpen title="Review public recap photo" onClose={onClose}>
      <div className="space-y-3 p-4">
        {src && <img src={src} alt="Offered setup photo" className="max-h-[45dvh] w-full object-contain" />}
        {photo.isPending && <p role="status" className="text-ui-13 text-tea-text-sec">Loading photo…</p>}
        {photo.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">This photo is unavailable.</p>}
        <p className="break-words text-ui-13 text-tea-text-sec">Photo by {entry.credit}</p>
        {canApprove && (
          <>
            <label className="block text-ui-13 text-tea-text-sec">
              Image description
              <input className="btn-field mt-1 w-full" value={alt} onChange={event => setAlt(event.currentTarget.value)}
                placeholder="Describe what’s visible" maxLength={250} disabled={approval.isPending} />
            </label>
            <label className="block text-ui-13 text-tea-text-sec">
              Observation (optional)
              <textarea className="btn-field mt-1 w-full" value={observation} onChange={event => setObservation(event.currentTarget.value)}
                rows={2} maxLength={280} disabled={approval.isPending} />
            </label>
          </>
        )}
        {approval.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t place this photo. Check the current permission.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="quiet" size="sm" onClick={onClose}>Close</Button>
          {canApprove && (
            <Button type="button" variant="primary" size="sm" disabled={!src || !alt.trim() || approval.isPending}
              onClick={() => approval.mutate()}>{approval.isPending ? 'Approving…' : 'Approve for public recap'}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
