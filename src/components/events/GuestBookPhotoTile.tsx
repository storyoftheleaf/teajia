import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';

export function GuestBookPhotoTile({ queryKey, load, alt, title }: {
  queryKey: readonly unknown[];
  load: (signal: AbortSignal) => Promise<Blob>;
  alt: string;
  title: string;
}) {
  const [src, setSrc] = useState('');
  const [open, setOpen] = useState(false);
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
        aria-label={`Open ${title}`} onClick={() => setOpen(true)}>
        <img src={src} alt={alt} />
      </Button>
      <Modal isOpen={open} title={title} onClose={() => setOpen(false)}>
        <img src={src} alt={alt} className="w-full max-h-[60dvh] object-contain" />
      </Modal>
    </>
  );
}
