import { useEffect, useRef, useState } from 'react';
import { capturePhotoApi, type CaptureShopPhotoReview } from '../../lib/capturePhotoApi';
import { selectHasBundle, useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import { capturePhotoIdentity } from './CapturePhotoImage';

function hasGalleryImages(additional: unknown) {
  try {
    const images: unknown = typeof additional === 'string' ? JSON.parse(additional) : additional;
    return Array.isArray(images) && images.some(image => typeof image === 'string' && !!image);
  } catch {
    return false;
  }
}

export function CapturePhotoApproval({ src, imageUrl, onReviewPhoto }: {
  src: string;
  imageUrl?: string;
  onReviewPhoto: (src: string | null) => void;
}) {
  const photo = capturePhotoIdentity(src);
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const allowed = useAppStore(state => selectHasBundle(state, 'catalog') && selectHasBundle(state, 'publish'));
  const [review, setReview] = useState<{ value: CaptureShopPhotoReview; id: string }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!review || approved || !allowed) return;
    onReviewPhoto(src);
    preview.current?.focus();
    return () => onReviewPhoto(null);
  }, [review, approved, allowed, src, onReviewPhoto]);
  if (!photo || !allowed || !accountId || !userId) return null;
  const scope = { accountId, userId };
  const run = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the Shop photo.'); }
    finally { setPending(false); }
  };

  if (review && !approved) {
    const gallery = hasGalleryImages(review.value.snapshot.additional_images);
    return <section ref={preview} tabIndex={-1} aria-label="Shop photo preview"
      className="relative z-10 mx-4 max-h-[70dvh] w-full max-w-3xl overflow-y-auto rounded-md border border-tea-border bg-tea-surface p-4 text-tea-text outline-none"
      onClick={event => event.stopPropagation()}>
      <h2 className="text-ui-16 font-medium">Shop photo preview</h2>
      <p className="mt-1 text-ui-13 text-tea-text-sec">{review.value.name} · {gallery ? 'First image in the gallery' : 'Main Shop photo'}</p>
      <div className={gallery ? 'alcove-thumb-btn mt-3 cursor-default' : 'alcove-thumb-btn-single mt-3 cursor-default'} data-shop-frame={gallery ? undefined : 'page'}>
        <img src={imageUrl} className="alcove-thumb-img" alt="How this photo is cropped in Shop" />
      </div>
      <p className="mt-3 text-ui-13 text-tea-text-sec">
        {review.value.live ? 'Approval updates the live listing immediately.' : 'This photo appears when this tea is listed.'}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => { setReview(undefined); setError(''); }}>Cancel</Button>
        <Button type="button" size="sm" disabled={pending || !imageUrl} onClick={() => void run(async () => {
          await capturePhotoApi.approve(photo.entryId, photo.photoId, review.value, review.id, scope);
          setApproved(true);
        })}>Approve Shop photo</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">{error}</p>}
    </section>;
  }

  return <div className="absolute bottom-nav left-4 right-4 mx-auto max-w-sm rounded-md bg-tea-surface p-3 text-tea-text"
    onClick={event => event.stopPropagation()}>
    {approved ? <p role="status" className="text-ui-13">{review?.value.live ? 'Shop photo updated.' : 'Shop photo selected. List this tea in Stock to show it in Shop.'}</p>
      : <Button type="button" variant="secondary" size="sm" disabled={pending || !imageUrl}
        onClick={() => void run(async () => {
          const value = await capturePhotoApi.review(photo.entryId, photo.photoId, scope);
          setReview({ value, id: crypto.randomUUID() });
        })}>Review for Shop</Button>}
    {error && <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">{error}</p>}
  </div>;
}
