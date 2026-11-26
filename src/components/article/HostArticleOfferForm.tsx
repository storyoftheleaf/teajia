import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { hostArticleOffersApi, type HostArticleOffer, type OfferScope } from '../../lib/hostArticleOffersApi';
import { Button } from '../shared/Button';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { looksLikePhoto } from '../vendors/facePhotoFile';

const MAX_PHOTOS = 8;
type FormPhoto = { id: string; file?: File };
type Action = 'offer' | 'publish' | 'decline';

export function HostArticleOfferForm({ scope, offer, onCancel, onComplete }: {
  scope: OfferScope;
  offer?: HostArticleOffer;
  onCancel: () => void;
  onComplete: (result: HostArticleOffer, isCurrent: boolean) => void;
}) {
  const [submissionId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(offer?.title ?? '');
  const [body, setBody] = useState(offer?.body ?? '');
  const [credit, setCredit] = useState(false);
  const [photos, setPhotos] = useState<FormPhoto[]>(() => offer?.photos.map(id => ({ id })) ?? []);
  const [working, setWorking] = useState<Action | null>(null);
  const [framing, setFraming] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const { editPhoto, photoEditor } = usePhotoEditor({ freeShape: true });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function framePhoto(source: File | Blob, photoId?: string) {
    setError('');
    if (source instanceof File && !looksLikePhoto(source)) {
      setError('Choose an image file.');
      return;
    }
    setFraming(true);
    try {
      const file = await editPhoto(source);
      if (!file) return;
      setPhotos(current => photoId
        ? current.map(photo => photo.id === photoId ? { id: photoId, file } : photo)
        : [...current, { id: crypto.randomUUID(), file }]);
    } catch {
      setError('Could not open that photo. Choose another file.');
    } finally {
      setFraming(false);
    }
  }

  async function save(action: Action) {
    if (working || framing) return;
    setError('');
    if (action !== 'decline' && (!title.trim() || !body.trim())) {
      setError('Add a title and the article before continuing.');
      return;
    }
    const data = new FormData();
    if (offer) {
      data.set('action', action);
    } else {
      data.set('credit', String(credit));
      data.set('submission_id', submissionId);
    }
    if (action !== 'decline') {
      data.set('title', title.trim());
      data.set('body', body.trim());
      for (const photo of photos) {
        if (photo.file) data.append('photos', photo.file);
        else data.append('keep_photo', photo.id);
      }
    }

    setWorking(action);
    try {
      const result = offer
        ? await hostArticleOffersApi.decide(scope, offer.id, data)
        : await hostArticleOffersApi.offer(scope, data);
      onComplete(result, mounted.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the article. Try again.');
    } finally {
      setWorking(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer) void save('offer');
  }

  const disabled = !!working || framing;
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-ui-14 text-tea-text-sec">
        Title
        <input className="input-field mt-1 min-h-tap px-3 py-2 text-ui-16" value={title} required maxLength={160}
          onChange={event => setTitle(event.target.value)} disabled={disabled} />
      </label>
      <label className="block text-ui-14 text-tea-text-sec">
        Article
        <textarea className="input-field mt-1 resize-y px-3 py-2 text-ui-16" value={body} required rows={6} maxLength={40000}
          onChange={event => setBody(event.target.value)} disabled={disabled} />
      </label>
      <section aria-label="Photographs" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={TYPOGRAPHY_CLASSES.label}>Photographs</h3>
          {photos.length < MAX_PHOTOS && (
            <Button type="button" variant="secondary" className="tap-target" disabled={disabled}
              icon={<ImagePlus size={16} aria-hidden="true" />} onClick={() => picker.current?.click()}>
              Add photo
            </Button>
          )}
        </div>
        <input ref={picker} type="file" accept="image/*,.heic,.heif" hidden
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void framePhoto(file);
          }} />
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {photos.map(photo => (
              <ArticleOfferPhoto key={photo.id} scope={scope} offerId={offer?.id} photo={photo} disabled={disabled}
                onEdit={source => void framePhoto(source, photo.id)}
                onRemove={() => setPhotos(current => current.filter(item => item.id !== photo.id))} />
            ))}
          </ul>
        )}
      </section>
      {offer ? (
        <p className="text-ui-14 text-tea-text-sec">
          {offer.author_name ? <>By {offer.author_name}</> : 'Publish without a byline.'}
        </p>
      ) : (
        <label className="flex min-h-tap items-center gap-2 text-ui-14 text-tea-text">
          <input type="checkbox" className="accent-tea-gold" checked={credit} disabled={disabled}
            onChange={event => setCredit(event.target.checked)} />
          Use my name if this is published
        </label>
      )}
      {error && <p role="alert" className="text-ui-14 text-tea-text-sec">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="quiet" className="tap-target" disabled={disabled} onClick={onCancel}>Cancel</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {offer && (
            <Button type="button" variant="secondary" className="tap-target" disabled={disabled}
              loading={working === 'decline'} onClick={() => void save('decline')}>
              Decline
            </Button>
          )}
          <Button type={offer ? 'button' : 'submit'} onClick={offer ? () => void save('publish') : undefined}
            className="tap-target" disabled={disabled}
            loading={working === 'offer' || working === 'publish'}>
            {offer ? 'Publish article' : 'Send to Adrian'}
          </Button>
        </div>
      </div>
      {photoEditor}
    </form>
  );
}

function ArticleOfferPhoto({ scope, offerId, photo, disabled, onEdit, onRemove }: {
  scope: OfferScope;
  offerId?: string;
  photo: FormPhoto;
  disabled: boolean;
  onEdit: (source: Blob) => void;
  onRemove: () => void;
}) {
  const stored = useQuery({
    queryKey: ['host-article-photo', scope.userId, scope.accountId, offerId, photo.id],
    queryFn: ({ signal }) => hostArticleOffersApi.photo(scope, offerId!, photo.id, signal),
    enabled: !!offerId && !photo.file,
    gcTime: 0,
    retry: false,
  });
  const blob = photo.file ?? stored.data;
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    <li className="flex items-start gap-1">
      {blob && preview ? (
        <Button type="button" variant="plain" className="photo-thumb rounded-md" data-size="page"
          aria-label="Edit photograph" disabled={disabled} onClick={() => onEdit(blob)}>
          <img src={preview} alt="" />
        </Button>
      ) : stored.isError ? (
        <Button type="button" variant="quiet" className="tap-target" disabled={disabled} onClick={() => void stored.refetch()}>
          Retry photo
        </Button>
      ) : (
        <p role="status" className="text-ui-13 text-tea-text-sec">Loading photo…</p>
      )}
      <Button type="button" variant="icon" className="tap-target" aria-label="Remove photograph"
        disabled={disabled} onClick={onRemove}>
        <X size={16} aria-hidden="true" />
      </Button>
    </li>
  );
}
