import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useStepParam } from '../../hooks/useStepParam';
import { ApiError } from '../../lib/api';
import { sessionGalleryApi, type SessionGalleryPhoto } from '../../lib/afterSitAccess';
import { guestBookPhotoApi } from '../../lib/guestBookPhotoApi';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { GUEST_BOOK_PHOTOS_QUERY } from './GuestBookPhotos';
import { keptSetupPhotosEndpoint, prepareSetupPhoto, uploadSetupPhoto } from './PrivateKeptSetupPhotos';

type Identity = { accountId: string | null; userId: string };
export const SESSION_GALLERY_QUERY = 'after-sit-session-gallery';

/**
 * Photographs from the table (Launch 3, J7): what each taker offered and the
 * host included, newest first, seen only by people holding a seat link for this
 * session. No likes, counts or comments. The taker is named, by first name,
 * only when they chose to be.
 */
export function SessionGallery({ credential, galleryKey, setupId }: { credential: string; galleryKey: string; setupId: string }) {
  const userId = useAppStore(state => state.activeUserId);
  const accountId = useAppStore(state => state.activeAccountId);
  if (!userId) return null;
  return <GalleryPanel key={JSON.stringify([userId, accountId, galleryKey])} credential={credential}
    galleryKey={galleryKey} setupId={setupId} identity={{ accountId, userId }} />;
}

function GalleryPanel({ credential, galleryKey, setupId, identity }: {
  credential: string; galleryKey: string; setupId: string; identity: Identity;
}) {
  const headingId = useId();
  const client = useQueryClient();
  const queryKey = [SESSION_GALLERY_QUERY, identity.accountId, identity.userId, galleryKey];
  const gallery = useQuery({
    queryKey,
    queryFn: ({ signal }) => sessionGalleryApi.list(credential, identity, signal),
    staleTime: 0, gcTime: 0, retry: false,
  });
  const [openId, setOpenId] = useStepParam('photo');
  const photoScope = [GUEST_BOOK_PHOTOS_QUERY, identity.accountId, identity.userId];
  // `gone` is a photograph just taken out: its picture is not asked for again (that answer is a 404).
  const refresh = (gone?: string) => Promise.all([
    client.invalidateQueries({ queryKey, exact: true }),
    client.invalidateQueries({
      queryKey: [GUEST_BOOK_PHOTOS_QUERY, identity.accountId, identity.userId],
      predicate: query => !gone || query.queryKey[query.queryKey.length - 1] !== gone,
    }),
    client.invalidateQueries({ queryKey: ['private-subject-photos', identity.accountId, identity.userId] }),
  ]);

  const photos = gallery.data?.photos ?? [];
  const open = photos.find(photo => photo.id === openId);
  const imageKey = (id: string) => [...queryKey, 'image', id];

  const withdraw = useMutation({
    mutationFn: (grantId: string) => guestBookPhotoApi.withdraw(credential, grantId, identity),
    // A picture of it still loading is stopped before it is taken out: asked for
    // after, it is a 404 (A3).
    onMutate: grantId => Promise.all([
      client.cancelQueries({ queryKey: imageKey(grantId), exact: true }),
      client.cancelQueries({ queryKey: photoScope, predicate: query => query.queryKey[query.queryKey.length - 1] === grantId }),
    ]),
    onError: (_, grantId) => Promise.all([
      client.invalidateQueries({ queryKey: imageKey(grantId), exact: true }),
      client.invalidateQueries({ queryKey: photoScope, predicate: query => query.queryKey[query.queryKey.length - 1] === grantId }),
    ]),
    onSuccess: async (_, grantId) => {
      client.setQueryData<typeof gallery.data>(queryKey, previous => previous && {
        ...previous, photos: previous.photos.filter(photo => photo.id !== grantId),
      });
      // The Guest Book below shows the same photograph; its picture is gone now, so it leaves
      // that list too and is not asked for again (that answer is a 404; J13 finding 5).
      client.setQueriesData<{ gallery?: Array<{ id: string }> }>(
        { queryKey: [GUEST_BOOK_PHOTOS_QUERY, identity.accountId, identity.userId] },
        previous => previous && Array.isArray(previous.gallery)
          ? { ...previous, gallery: previous.gallery.filter(photo => photo.id !== grantId) } : previous,
      );
      // Its tiles are still on screen until the lists above re-render, so their queries are
      // left to unmount and be collected rather than removed: a removed query under a mounted
      // tile is fetched again on its next render, and that answer is a 404 (A3).
      setOpenId(null);
      await refresh(grantId);
    },
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-tea-border pt-4">
      <h2 id={headingId} className={TYPOGRAPHY_CLASSES.h2}>Photographs from the table</h2>
      {gallery.isError && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>Couldn’t open the photographs.</p>
          <Button variant="quiet" type="button" className="tap-target" disabled={gallery.isFetching}
            onClick={() => void gallery.refetch()}>Try again</Button>
        </div>
      )}
      {gallery.isSuccess && photos.length === 0 && (
        <p className={TYPOGRAPHY_CLASSES.bodyLight}>No photographs from the table yet.</p>
      )}
      {photos.length > 0 && (
        <ul aria-label="Photographs" className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-col items-start gap-1">
              <GalleryTile photo={photo} index={index} imageKey={imageKey(photo.id)}
                load={signal => sessionGalleryApi.bytes(credential, photo.id, identity, signal)}
                onOpen={() => setOpenId(photo.id)} />
              {/* The taker's own tile takes it out in one tap (J13 finding 5). */}
              {photo.own && (
                <Button variant="quiet" size="sm" type="button" className="tap-target" disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate(photo.id)}>
                  {withdraw.isPending && withdraw.variables === photo.id ? 'Withdrawing…' : 'Withdraw my photograph'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {withdraw.isError && !open && <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>Couldn’t withdraw the photograph.</p>}
      {gallery.data?.waiting && (
        <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Your photograph is with the host. It joins the table once they include it.</p>
      )}
      {gallery.data?.can_add && (
        <AddPhotograph credential={credential} setupId={setupId} identity={identity} onAdded={refresh} />
      )}
      {open && (
        <Modal isOpen title="Photograph from the table" onClose={() => setOpenId(null)}>
          <LargePhoto photo={open} imageKey={imageKey(open.id)}
            load={signal => sessionGalleryApi.bytes(credential, open.id, identity, signal)} />
          {open.taker_first_name && (
            <p className={`${TYPOGRAPHY_CLASSES.bodyLight} px-4 pt-2 break-words`}>photograph by {open.taker_first_name}</p>
          )}
          {open.own && (
            <div className="flex flex-wrap items-center justify-end gap-2 p-4">
              {withdraw.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t withdraw the photograph.</p>}
              <Button variant="quiet" type="button" className="tap-target" disabled={withdraw.isPending}
                onClick={() => withdraw.mutate(open.id)}>{withdraw.isPending ? 'Withdrawing…' : 'Withdraw my photograph'}</Button>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

function useImage(imageKey: readonly unknown[], load: (signal: AbortSignal) => Promise<Blob>) {
  const [src, setSrc] = useState('');
  const image = useQuery({ queryKey: imageKey, queryFn: ({ signal }) => load(signal), retry: false, gcTime: 60_000, staleTime: Infinity });
  const blob = image.data;
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return { src, image };
}

function GalleryTile({ photo, index, imageKey, load, onOpen }: {
  photo: SessionGalleryPhoto; index: number; imageKey: readonly unknown[];
  load: (signal: AbortSignal) => Promise<Blob>; onOpen: () => void;
}) {
  const { src, image } = useImage(imageKey, load);
  if (image.isError) {
    return <Button variant="quiet" size="sm" className="tap-target" onClick={() => void image.refetch()}>Retry photograph</Button>;
  }
  return (
    <Button variant="plain" type="button" className="photo-thumb rounded-md" data-size="page"
      aria-label={`Open photograph ${index + 1}`} onClick={onOpen}>
      {src ? <img src={src} alt={photo.alt_text} /> : <span className="sr-only">Loading photograph</span>}
    </Button>
  );
}

function LargePhoto({ photo, imageKey, load }: {
  photo: SessionGalleryPhoto; imageKey: readonly unknown[]; load: (signal: AbortSignal) => Promise<Blob>;
}) {
  const { src, image } = useImage(imageKey, load);
  if (image.isError) return <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} p-4`}>Couldn’t open the photograph.</p>;
  if (!src) return <p role="status" className={`${TYPOGRAPHY_CLASSES.bodyLight} p-4`}>Opening the photograph…</p>;
  return <img src={src} alt={photo.alt_text} className="w-full max-h-[60dvh] object-contain" />;
}

/**
 * One tap opens the device's camera or library; the photograph goes through
 * the shared photo editor, is saved privately to this sit's setup, then
 * offered to the host. The name choice is made here, before the tap.
 */
function AddPhotograph({ credential, setupId, identity, onAdded }: {
  credential: string; setupId: string; identity: Identity; onAdded: () => Promise<unknown>;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const { editPhotos, photoEditor } = usePhotoEditor({ freeShape: true });
  const [showName, setShowName] = useState(false);
  const add = useMutation({
    mutationFn: async ({ file, named }: { file: File; named: boolean }) => {
      await sessionGalleryApi.keepSetup(credential, identity);
      const photoId = crypto.randomUUID();
      await uploadSetupPhoto(keptSetupPhotosEndpoint(setupId), identity, await prepareSetupPhoto(file), photoId);
      await guestBookPhotoApi.offer(credential, {
        action: 'photo-offer', photoId, grantId: crypto.randomUUID(), description: '', showName: named,
      }, identity);
    },
    onSettled: () => onAdded(),
  });
  const alreadyOffered = add.error instanceof ApiError && add.error.status === 409;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" type="button" className="tap-target" disabled={add.isPending}
          onClick={() => picker.current?.click()}>{add.isPending ? 'Sending…' : 'Add a photograph'}</Button>
        <label className="tap-target flex flex-wrap items-center gap-2 text-ui-13 text-tea-text-sec">
          <input type="checkbox" checked={showName} onChange={event => setShowName(event.target.checked)} />
          Show my first name with it
        </label>
        <input ref={picker} type="file" accept="image/*" hidden data-testid="session-gallery-photo-picker"
          onChange={async event => {
            const picked = Array.from(event.currentTarget.files ?? []).slice(0, 1);
            event.currentTarget.value = '';
            const [file] = picked.length ? await editPhotos(picked) : [];
            if (file) add.mutate({ file, named: showName });
          }} />
        {photoEditor}
      </div>
      {add.isError && (
        <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>
          {alreadyOffered
            ? 'Your photograph is already with the table. Withdraw it to offer another.'
            : 'Couldn’t send the photograph. Try again.'}
        </p>
      )}
    </div>
  );
}
