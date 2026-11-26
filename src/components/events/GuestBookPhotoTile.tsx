import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStepParam } from '../../hooks/useStepParam';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';

export function GuestBookPhotoTile({ queryKey, load, alt, title, previewId }: {
  queryKey: readonly unknown[];
  load: (signal: AbortSignal) => Promise<Blob>;
  alt: string;
  title: string;
  previewId: string;
}) {
  const [src, setSrc] = useState('');
  const [preview, setPreview] = useStepParam('guest-book-photo');
  const photo = useQuery({ queryKey, queryFn: ({ signal }) => load(signal), retry: false, gcTime: 0, staleTime: 0 });
  const blob = photo.data;
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (photo.isError) {
    return <Button variant="quiet" size="sm" onClick={() => void photo.refetch()}>Retry photo preview</Button>;
  }
  if (!src) return <p role="status" className="text-ui-12 text-tea-text-sec">Loading photo…</p>;
  return (
    <>
      <Button variant="plain" type="button" className="photo-thumb rounded-md" data-size="tasting"
        aria-label={`Open ${title}`} onClick={() => setPreview(previewId)}>
        <img src={src} alt={alt} />
      </Button>
      <Modal isOpen={preview === previewId} title={title} onClose={() => setPreview(null)}>
        <img src={src} alt={alt} className="w-full max-h-[60dvh] object-contain" />
      </Modal>
    </>
  );
}
