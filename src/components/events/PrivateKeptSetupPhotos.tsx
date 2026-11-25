import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, authedBlobFetch, authedFetch } from '../../lib/api';
import { FAMILY_FULL_MAX_BYTES } from '../../lib/familyContract';
import { compressImage } from '../../lib/imageCompressor';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import { OwnerSitPhotoPermission } from './OwnerSitPhotoPermission';
import { OwnerGuestBookPhoto } from './OwnerGuestBookPhoto';
import { GUEST_BOOK_PHOTOS_QUERY } from './GuestBookPhotos';
import { usePhotoEditor } from '../shared/usePhotoEditor';

type ScopedMember = { accountId: string | null; userId: string };
type SetupPhoto = { id: string; tea_id: string | null; created_at: string; own?: boolean | number; shared?: boolean | number };
type PendingPhoto = { id: string; file: File; prepared?: Blob };

export function KeptSetupPhotoContext({ setupId, teas }: { setupId: string; teas: Array<{ id: string; name: string }> }) {
  const [teaId, setTeaId] = useState('');
  return (
    <div className="mt-4">
      {teas.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-ui-13 text-tea-text-sec">
          Photo subject
          <select className="btn-field" value={teaId} onChange={event => setTeaId(event.target.value)}>
            <option value="">Whole setup</option>
            {teas.map(tea => <option key={tea.id} value={tea.id}>{tea.name}</option>)}
          </select>
        </label>
      )}
      <PrivateKeptSetupPhotos setupId={setupId} teaId={teaId || undefined} />
    </div>
  );
}

export function PrivateKeptSetupPhotos({ setupId, teaId = null }: { setupId: string; teaId?: string | null }) {
  return <PrivateSubjectPhotos subject="setup" subjectId={setupId} teaId={teaId} />;
}

export function PrivateSubjectPhotos({ subject, subjectId, teaId = null }: {
  subject: 'setup' | 'member-sit'; subjectId: string; teaId?: string | null;
}) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!userId) return null;

  const id = encodeURIComponent(subjectId);
  const endpoint = API_URL + (subject === 'setup' ? `/api/me/personal-kept-setups/${id}/photos`
    : `/api/me/private-sits/${id}/photos`);
  return <SubjectPhotos key={JSON.stringify([accountId, userId, endpoint, teaId])}
    scope={{ accountId, userId }} endpoint={endpoint} setupId={subject === 'setup' ? subjectId : undefined}
    memberSit={subject === 'member-sit'} teaId={teaId} />;
}

function SubjectPhotos({ scope, endpoint, setupId, teaId, memberSit }: {
  scope: ScopedMember; endpoint: string; setupId?: string; teaId: string | null; memberSit: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const { editPhotos, photoEditor } = usePhotoEditor({ freeShape: true });
  const queryClient = useQueryClient();
  const queryKey = ['private-subject-photos', scope.accountId, scope.userId, endpoint];
  const options = { cache: 'no-store', expectedAuth: scope } as const;
  const gallery = useQuery({
    queryKey,
    retry: false,
    queryFn: (): Promise<{ photos: SetupPhoto[] }> => authedFetch(endpoint, options),
  });

  const upload = useMutation({
    mutationFn: async (selection: PendingPhoto[]) => {
      const failed: PendingPhoto[] = [];
      const saved: SetupPhoto[] = [];
      for (const photo of selection) {
        let prepared = photo.prepared;
        try {
          if (!prepared) {
            prepared = await compressImage(photo.file, 1200, 0.78);
            if (prepared.size > FAMILY_FULL_MAX_BYTES) prepared = await compressImage(photo.file, 900, 0.7);
          }
          const body = new FormData();
          body.append('image', prepared, 'setup-photo.jpg');
          body.append('photo_id', photo.id);
          if (teaId) body.append('tea_id', teaId);
          const savedPhoto: SetupPhoto = await authedFetch(endpoint, {
            ...options, method: 'POST', body, retryTimeouts: true,
          });
          saved.push(savedPhoto);
        } catch {
          failed.push({ ...photo, prepared });
        }
      }
      return { failed, saved };
    },
    onSuccess: ({ saved }) => {
      const active = useAppStore.getState();
      if (active.activeAccountId !== scope.accountId || active.activeUserId !== scope.userId) return;
      queryClient.setQueryData<{ photos: SetupPhoto[] }>(queryKey, previous => ({
        photos: [...(previous?.photos ?? []).filter(photo => saved.every(item => item.id !== photo.id)), ...saved],
      }));
      void queryClient.invalidateQueries({ queryKey });
      if (setupId) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOK_PHOTOS_QUERY, scope.accountId, scope.userId] });
    },
  });

  const photos = gallery.data?.photos?.filter(photo => photo.tea_id === teaId) ?? [];
  const failed = upload.data?.failed ?? [];
  const savedCount = upload.data?.saved.length ?? 0;
  const canPick = gallery.isSuccess && !upload.isPending && failed.length === 0;

  return (
    <section aria-label={memberSit ? "Sit photos" : "Private photos"} className="mt-4 border-t border-tea-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ui-14 text-tea-text">{memberSit ? 'Sit photos' : 'Private photos'}</p>
        {gallery.isError ? (
          <Button variant="quiet" type="button" className="tap-target" disabled={gallery.isFetching}
            onClick={() => void gallery.refetch()}>Retry loading photos</Button>
        ) : (
          <Button variant="secondary" type="button" className="tap-target" disabled={!canPick}
            onClick={() => picker.current?.click()}>Add private photos</Button>
        )}
        <input ref={picker} type="file" accept="image/*" multiple hidden data-testid="private-setup-photo-picker"
          onChange={async event => {
            const picked = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            const files = canPick && picked.length ? await editPhotos(picked) : [];
            if (canPick && files.length) upload.mutate(files.map(file => ({ file, id: crypto.randomUUID() })));
          }} />
        {photoEditor}
      </div>
      {photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <SetupPhotoTile key={photo.id} url={`${endpoint}/${encodeURIComponent(photo.id)}`} scope={scope}
              label={`Open ${memberSit && !photo.own ? 'shared' : 'private'} photo ${index + 1}`}
              readOnly={memberSit && !photo.own}
              shared={memberSit && photo.own ? Boolean(photo.shared) : undefined}
              onShareChanged={() => queryClient.invalidateQueries({ queryKey })}
              publicPermission={setupId ? { setupId, photoId: photo.id } : undefined} onRemoved={() => {
                queryClient.setQueryData<{ photos: SetupPhoto[] }>(queryKey, previous => ({
                  photos: (previous?.photos ?? []).filter(item => item.id !== photo.id),
                }));
                void queryClient.invalidateQueries({ queryKey });
                if (setupId) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOK_PHOTOS_QUERY, scope.accountId, scope.userId] });
              }} />
          ))}
        </div>
      )}
      {upload.isPending && <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">Saving photos privately…</p>}
      {!upload.isPending && upload.isSuccess && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-ui-13 text-tea-text-sec" role="status">
            {savedCount > 0 && `${savedCount} ${savedCount === 1 ? 'photo' : 'photos'} saved privately.`}
            {savedCount > 0 && failed.length > 0 && ' '}
            {failed.length > 0 && `${failed.length} could not be saved.`}
          </p>
          {failed.length > 0 && (
            <>
              <Button variant="secondary" type="button" className="tap-target"
                onClick={() => upload.mutate(failed)}>Retry {failed.length} {failed.length === 1 ? 'photo' : 'photos'}</Button>
              <Button variant="quiet" type="button" className="tap-target" onClick={() => upload.reset()}>Dismiss</Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SetupPhotoTile({ url, scope, label, publicPermission, onRemoved, readOnly, shared, onShareChanged }: {
  url: string; scope: ScopedMember; label: string; publicPermission?: { setupId: string; photoId: string };
  onRemoved: () => void; readOnly: boolean; shared?: boolean; onShareChanged: () => void;
}) {
  const [src, setSrc] = useState<string>();
  const [open, setOpen] = useState(false);
  const options = { cache: 'no-store', expectedAuth: scope } as const;
  const photo = useQuery({
    queryKey: ['private-kept-setup-photo-bytes', scope.accountId, scope.userId, url],
    retry: false,
    gcTime: 0,
    queryFn: () => authedBlobFetch(url, options),
  });
  useEffect(() => {
    if (!photo.data) return;
    const objectUrl = URL.createObjectURL(photo.data);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.data]);

  const remove = useMutation({
    mutationFn: () => authedFetch(url, { ...options, method: 'DELETE' }),
    onSuccess: () => {
      setOpen(false);
      const active = useAppStore.getState();
      if (active.activeAccountId === scope.accountId && active.activeUserId === scope.userId) onRemoved();
    },
  });

  const changeShare = useMutation({
    mutationFn: (share: boolean) => authedFetch(url + '/share', { ...options, method: 'PUT', body: JSON.stringify({ share }) }),
    onSuccess: onShareChanged,
  });

  if (!src) {
    return photo.isError ? (
      <Button variant="quiet" type="button" className="tap-target" disabled={photo.isFetching}
        onClick={() => void photo.refetch()}>Retry photo preview</Button>
    ) : null;
  }

  return (
    <>
      <Button variant="plain" type="button" className="photo-thumb rounded-md" data-size="tasting"
        aria-label={label} onClick={() => setOpen(true)}>
        <img src={src} alt="" />
      </Button>
      <Modal isOpen={open} title={readOnly ? "Shared sit photo" : "Private photo"} onClose={() => setOpen(false)}>
        <img src={src} alt={readOnly ? "Photo shared with this sit" : "Your private photo"} className="w-full max-h-[60dvh] object-contain" />
        {open && publicPermission && (
          <OwnerSitPhotoPermission {...publicPermission} scope={scope} />
        )}
        {open && publicPermission && <OwnerGuestBookPhoto eventId={publicPermission.setupId} photoId={publicPermission.photoId} identity={scope} />}
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2 p-4">
            {changeShare.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t update sharing.</p>}
            {remove.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t remove the photo.</p>}
            {shared !== undefined && (
              <Button variant="secondary" type="button" disabled={changeShare.isPending}
                onClick={() => changeShare.mutate(!shared)}>{shared ? 'Stop sharing with this sit' : 'Share with this sit'}</Button>
            )}
            <Button variant="quiet" type="button" className="tap-target" disabled={remove.isPending}
              onClick={() => remove.mutate()}>{remove.isPending ? 'Removing…' : 'Remove photo'}</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
