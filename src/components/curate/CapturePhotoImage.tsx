import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import { capturePhotoApi } from '../../lib/capturePhotoApi';
import { isTokenScopedToAccount } from '../../lib/api';
import { mediaUrl } from '../../lib/mediaUrl';
import { useAppStore } from '../../lib/store';

const PRIVATE_PHOTO = /^\/api\/curate\/capture\/([A-Za-z0-9_-]{1,120})\/photos\/([a-f0-9-]{36})$/;
const SHOP_PHOTO = /^https:\/\/media\.teajia\.co\/curate-approved\/([a-f0-9-]{36})$/;

export function capturePhotoIdentity(src?: string | null) {
  const match = src?.match(PRIVATE_PHOTO);
  return match ? { entryId: match[1], photoId: match[2] } : null;
}

export const getStockCapturePhotoId = (src?: string | null) => src?.match(SHOP_PHOTO)?.[1];

export function useCapturePhotoUpload(entryId: string) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  return async (file: File | Blob) => {
    if (!accountId || !userId) throw new Error('Sign in to save a private photo.');
    return capturePhotoApi.upload(entryId, file, { accountId, userId });
  };
}

export function useCapturePhotoUrl(src?: string | null, stockPreview = false, original = false) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const [loaded, setLoaded] = useState<{ key: string; url: string }>();
  const identity = capturePhotoIdentity(src);
  const projectedPhotoId = stockPreview ? getStockCapturePhotoId(src) : undefined;
  const needsAuth = Boolean(identity || projectedPhotoId);
  const canRead = !!accountId && !!userId && isTokenScopedToAccount(accountId, userId);
  const key = JSON.stringify([src, accountId, userId, stockPreview, original]);
  // Reuse private bytes across the thumbnail, its sheet and the full-size
  // viewer. The query is memory-only, and the app clears it on token changes.
  const { data: blob } = useQuery({
    queryKey: ['capture-photo-bytes', accountId, userId, src, stockPreview, original],
    enabled: needsAuth && canRead,
    staleTime: 30_000,
    gcTime: 30_000,
    retry: false,
    queryFn: () => {
      const scope = { accountId: accountId!, userId: userId! };
      return identity
        ? capturePhotoApi.blob(identity.entryId, identity.photoId, scope, original)
        : capturePhotoApi.stockBlob(projectedPhotoId!, scope);
    },
  });
  useEffect(() => {
    if (!blob || !canRead) return;
    const url = URL.createObjectURL(blob);
    setLoaded({ key, url });
    return () => URL.revokeObjectURL(url);
  }, [blob, canRead, key]);
  if (needsAuth) return canRead && blob && loaded?.key === key ? loaded.url : undefined;
  return mediaUrl(src);
}

export function useCapturePhotoFrame(src?: string | null) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const identity = capturePhotoIdentity(src);
  return useQuery({
    queryKey: ['capture-photo-frame', accountId, userId, src],
    enabled: !!identity && !!accountId && !!userId && isTokenScopedToAccount(accountId, userId),
    staleTime: 30_000,
    gcTime: 30_000,
    retry: false,
    queryFn: () => capturePhotoApi.frame(identity!.entryId, identity!.photoId, { accountId: accountId!, userId: userId! }),
  });
}

type CapturePhotoImageProps = ImgHTMLAttributes<HTMLImageElement> & { stockPreview?: boolean };

/** Keep the reserved photo space quiet until the browser has decoded pixels.
 * Remount on URL changes so an old photo's load state cannot reveal a new one. */
function ReadyCapturePhoto({ style, onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [ready, setReady] = useState(false);
  return <img {...props} style={{ ...style, visibility: ready ? style?.visibility : 'hidden' }}
    onLoad={event => { setReady(event.currentTarget.naturalWidth > 0); onLoad?.(event); }}
    onError={event => { setReady(false); onError?.(event); }} />;
}

function ResolvedCapturePhoto(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <ReadyCapturePhoto key={JSON.stringify([props.src, props.srcSet])} {...props} />;
}

function AuthenticatedCapturePhoto({ src, stockPreview, ...props }: CapturePhotoImageProps) {
  const url = useCapturePhotoUrl(src, stockPreview);
  return <ResolvedCapturePhoto {...props} src={url} />;
}

export function CapturePhotoImage({ src, stockPreview = false, ...props }: CapturePhotoImageProps) {
  if (capturePhotoIdentity(src) || (stockPreview && getStockCapturePhotoId(src))) {
    return <AuthenticatedCapturePhoto {...props} src={src} stockPreview={stockPreview} />;
  }
  return <ResolvedCapturePhoto {...props} src={mediaUrl(src)} />;
}

/** Upload orientation never chooses a frame. Only a saved, explicit choice
 * changes the width; every thumbnail in the same row keeps its height. */
export function CapturePhotoThumbnail({ src, small = false, ...props }: CapturePhotoImageProps & { small?: boolean }) {
  const saved = useCapturePhotoFrame(src).data?.frame?.aspect;
  const aspect = saved === 2 / 3 || saved === 3 / 2 ? saved : 1;
  const height = small ? 'var(--space-8)' : 'var(--capture-photo-height)';
  return <span className={small ? 'block overflow-hidden rounded-md border border-tea-border h-8' : 'capture-photo-thumbnail'}
    style={{ width: `calc(${height} * ${aspect})` }}>
    <CapturePhotoImage {...props} src={src} className="w-full h-full object-cover pointer-events-none" />
  </span>;
}
