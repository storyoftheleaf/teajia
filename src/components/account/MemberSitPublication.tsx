import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { API_URL, ApiError, authedBlobFetch } from '../../lib/api';
import {
  casualSitLimits, casualSitRecapPath, publicCasualSitsKey,
  type CasualSitPublicationDraft, type CasualSitPublicationStatus,
} from '../../lib/casualSitPublications';
import { isMemberSitScopeCurrent, memberSitRequest, memberSitTitle, type MemberSit, type MemberSitScope } from '../../lib/memberPrivateSits';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';

type Props = { sit: MemberSit; scope: MemberSitScope };
type SitPhoto = { id: string; own?: boolean | number };
const messageFor = (error: unknown) => error instanceof ApiError ? error.message : 'Couldn’t update the public recap. Try again.';

export function MemberSitPublication({ sit, scope }: Props) {
  return sit.role === 'host' ? <PublicationControls sit={sit} scope={scope} /> : null;
}

function PublicationControls({ sit, scope }: Props) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [feedback, setFeedback] = useState('');
  const sitPath = `/${encodeURIComponent(sit.id)}`;
  const path = sitPath + '/publication';
  const queryKey = ['member-sit-publication', scope.userId, scope.accountId, sit.id, sit.tea?.id, sit.tea?.name];
  const query = useQuery({
    queryKey,
    queryFn: () => memberSitRequest<CasualSitPublicationStatus>(scope, path),
    gcTime: 0,
    retry: false,
  });
  const change = useMutation({
    mutationFn: (draft: CasualSitPublicationDraft | null) => memberSitRequest<CasualSitPublicationStatus>(
      scope, path, draft ? 'PUT' : 'DELETE',
      draft ? { ...draft, photo: draft.photo ? { ...draft.photo, confirmed: true } : null } : undefined,
    ),
    onSuccess: (status, draft) => {
      if (!isMemberSitScopeCurrent(scope)) return;
      client.setQueryData(queryKey, status);
      void client.invalidateQueries({ queryKey: publicCasualSitsKey });
      setEditing(false);
      setConfirmingRemoval(false);
      setFeedback(draft ? 'Recap published.' : 'Recap unpublished.');
    },
  });
  const status = query.data;
  const publication = status?.publication;
  const close = () => {
    if (change.isPending) return;
    setEditing(false);
    setConfirmingRemoval(false);
    change.reset();
  };

  return (
    <section aria-label="Public recap" className="mt-4 border-t border-tea-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ui-16 text-tea-text">Public recap</h2>
        {status?.profile && (
          <Button variant="secondary" size="sm" className="tap-target" onClick={() => { setFeedback(''); setEditing(true); }}>
            {publication ? 'Edit public recap' : 'Write a public recap'}
          </Button>
        )}
      </div>
      {!status && (query.isError ? (
        <Button variant="quiet" size="sm" className="tap-target" onClick={() => void query.refetch()}>Retry loading recap</Button>
      ) : <p role="status" className="text-ui-13 text-tea-text-sec">Loading recap settings…</p>)}
      {status && !status.profile && (
        <p className="text-ui-13 text-tea-text-sec">
          Publish your <Link to="/account/profile" className="text-tea-gold hover:underline">People profile</Link> to share this recap.
        </p>
      )}
      {publication && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {publication.visible && (
            <Link to={casualSitRecapPath(publication.slug)} className="btn-quiet btn-sm tap-target">View public recap</Link>
          )}
          <Button variant="quiet" size="sm" className="tap-target" onClick={() => { setFeedback(''); setConfirmingRemoval(true); }}>
            Unpublish recap
          </Button>
        </div>
      )}
      {feedback && <p role="status" className="text-ui-13 text-tea-text-sec">{feedback}</p>}
      {editing && status?.profile && (
        <Modal isOpen onClose={close} title={publication ? 'Edit public recap' : 'Write a public recap'}>
          <PublicationForm sit={sit} scope={scope} status={status} sitPath={sitPath} busy={change.isPending}
            error={change.error} onClose={close} onSubmit={draft => change.mutate(draft)} />
        </Modal>
      )}
      {confirmingRemoval && (
        <Modal isOpen onClose={close} title="Unpublish recap?">
          <div className="p-4 space-y-3">
            <p className="text-ui-14 text-tea-text-sec">Your recap and its photo will close to visitors. You can publish a recap again from your sit.</p>
            {change.error && <p role="alert" className="text-ui-13 text-tea-text-sec">{messageFor(change.error)}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="quiet" size="sm" className="tap-target" onClick={close} disabled={change.isPending}>Cancel</Button>
              <Button variant="danger" size="sm" className="tap-target" disabled={change.isPending}
                onClick={() => change.mutate(null)}>{change.isPending ? 'Unpublishing…' : 'Unpublish recap'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function PublicationForm({ sit, scope, status, sitPath, busy, error, onClose, onSubmit }: Props & {
  status: CasualSitPublicationStatus; sitPath: string; busy: boolean; error: unknown; onClose: () => void;
  onSubmit: (draft: CasualSitPublicationDraft) => void;
}) {
  const original = status.publication;
  const [title, setTitle] = useState(original?.title ?? memberSitTitle(sit));
  const [writing, setWriting] = useState(original?.writing ?? '');
  const [teaName, setTeaName] = useState(original?.teaName ?? sit.tea?.name ?? '');
  const [linkShopTea, setLinkShopTea] = useState(original?.linkShopTea ?? false);
  const [photoId, setPhotoId] = useState(original?.photo?.id ?? '');
  const [alt, setAlt] = useState(original?.photo?.alt ?? '');
  const [consent, setConsent] = useState(false);
  const photoRadio = useId();
  const photoPath = sitPath + '/photos';
  const photoEndpoint = `${API_URL}/api/me/private-sits${photoPath}`;
  const gallery = useQuery({
    queryKey: ['private-subject-photos', scope.accountId, scope.userId, photoEndpoint],
    queryFn: () => memberSitRequest<{ photos: SitPhoto[] }>(scope, photoPath),
    retry: false,
  });
  const ownerPhotos = gallery.data?.photos.filter(photo => Boolean(photo.own)) ?? [];
  const hasShopTea = status.shopTeaName === teaName.trim();
  const validPhoto = Boolean(photoId && consent && ownerPhotos.some(photo => photo.id === photoId));
  const valid = title.trim() && teaName.trim() && (writing.trim() || validPhoto) && (!photoId || validPhoto);
  return (
    <form className="px-4 pt-4 pb-nav-gap space-y-2" onSubmit={event => {
      event.preventDefault();
      if (!valid || busy) return;
      onSubmit({ title, writing, teaName, linkShopTea: hasShopTea && linkShopTea, photo: photoId ? { id: photoId, alt } : null });
    }}>
      <p className="text-ui-13 text-tea-text-sec break-words">This recap appears on your public People profile.</p>
      <label className="block text-ui-14 text-tea-text">
        Public title
        <input className="btn-field mt-1 w-full" required maxLength={casualSitLimits.title} value={title}
          onChange={event => setTitle(event.target.value)} disabled={busy} />
      </label>
      <label className="block text-ui-14 text-tea-text">
        Short write-up{photoId ? ' (optional)' : ''}
        <textarea className="input-field mt-1 px-3 py-2 text-ui-14 resize-y" required={!photoId} rows={2} maxLength={casualSitLimits.writing}
          value={writing} onChange={event => setWriting(event.target.value)} disabled={busy} />
      </label>
      <label className="block text-ui-14 text-tea-text">
        Exact tea name
        <input className="btn-field mt-1 w-full" required maxLength={casualSitLimits.teaName} value={teaName}
          onChange={event => setTeaName(event.target.value)} disabled={busy} />
      </label>
      {hasShopTea && (
        <label className="flex min-h-tap items-center gap-2 text-ui-14 text-tea-text">
          <input type="checkbox" className="accent-tea-gold" checked={linkShopTea} onChange={event => setLinkShopTea(event.target.checked)} disabled={busy} />
          Link to the matching tea in the shop
        </label>
      )}
      <fieldset className="border-t border-tea-border pt-2 min-w-0" disabled={busy}>
        <legend className="text-ui-14 text-tea-text">Public photo</legend>
        {gallery.isPending && <p role="status" className="text-ui-13 text-tea-text-sec">Loading your photos…</p>}
        {gallery.isError && <Button variant="quiet" size="sm" className="tap-target" onClick={() => void gallery.refetch()}>Retry loading photos</Button>}
        {gallery.isSuccess && ownerPhotos.length === 0 && (
          <p className="text-ui-13 text-tea-text-sec">Add a private photo to this sit to use it in the recap.</p>
        )}
        {(ownerPhotos.length > 0 || photoId) && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-h-tap items-center gap-2 text-ui-13 text-tea-text-sec">
              <input type="radio" className="accent-tea-gold" name={photoRadio} checked={!photoId} onChange={() => setPhotoId('')} />
              No photo
            </label>
            {ownerPhotos.map((photo, index) => (
              <label key={photo.id} className="flex min-h-tap items-center gap-2 text-ui-13 text-tea-text-sec">
                <input type="radio" className="accent-tea-gold" name={photoRadio} aria-label={`Your sit photo ${index + 1}`} checked={photoId === photo.id}
                  onChange={() => { setPhotoId(photo.id); setAlt(original?.photo?.id === photo.id ? original.photo.alt : ''); setConsent(false); }} />
                <PhotoPreview url={`${photoEndpoint}/${encodeURIComponent(photo.id)}`} scope={scope} number={index + 1} />
              </label>
            ))}
          </div>
        )}
        {photoId && (
          <div className="space-y-2">
            <label className="block text-ui-14 text-tea-text">
              Describe the photo (optional)
              <input className="btn-field mt-1 w-full" maxLength={casualSitLimits.photoAlt} value={alt} onChange={event => setAlt(event.target.value)} />
            </label>
            <label className="flex min-h-tap items-center gap-2 text-ui-14 text-tea-text">
              <input type="checkbox" className="accent-tea-gold" required checked={consent} onChange={event => setConsent(event.target.checked)} />
              I have permission to show this photo publicly.
            </label>
          </div>
        )}
      </fieldset>
      {error ? <p role="alert" className="text-ui-13 text-tea-text-sec">{messageFor(error)}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="quiet" size="sm" className="tap-target" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" className="tap-target" disabled={busy || !valid}>
          {busy ? 'Publishing…' : original ? 'Publish changes' : 'Publish recap'}
        </Button>
      </div>
    </form>
  );
}

function PhotoPreview({ url, scope, number }: { url: string; scope: MemberSitScope; number: number }) {
  const [src, setSrc] = useState('');
  const photo = useQuery({
    queryKey: ['private-kept-setup-photo-bytes', scope.accountId, scope.userId, url],
    queryFn: () => authedBlobFetch(url, { cache: 'no-store', expectedAuth: scope }),
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!photo.data) return;
    const objectUrl = URL.createObjectURL(photo.data);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.data]);
  return src ? <span className="photo-thumb rounded-md" data-size="tasting"><img src={src} alt="" /></span> : <span>Photo {number}</span>;
}
