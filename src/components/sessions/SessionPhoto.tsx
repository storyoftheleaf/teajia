import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBlobObjectUrl } from '../../hooks/useBlobObjectUrl';
import { mediaUrl } from '../../lib/mediaUrl';
import { revocableSitPhotoApi } from '../../lib/revocableSitPhotoApi';
import { PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';

export type SessionPhotoSource =
  | { kind: 'formal'; slug: string; fallback?: string | null }
  | { kind: 'casual'; url: string; alt: string; credit?: string };

export function SessionPhoto({ source }: { source: SessionPhotoSource }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['public-session-photo', source.kind, source.kind === 'formal' ? source.slug : source.url],
    queryFn: async ({ signal }) => {
      if (source.kind === 'formal') return revocableSitPhotoApi.forPublicRecap(source.slug, signal);
      const response = await fetch(source.url, { signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok || response.headers.get('Content-Type') !== 'image/jpeg') return null;
      return { image: await response.blob(), alt_text: source.alt, credit: source.credit };
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const loaded = useBlobObjectUrl(query.isFetching || query.isError ? undefined : query.data?.image);
  const fallback = source.kind === 'formal' && query.isSuccess && !query.isFetching && !query.data ? source.fallback : null;
  const image = loaded || (fallback ? mediaUrl(fallback) : '');
  if (!image) return null;
  const landscape = [3, 2];
  const photo: ZoomPhotograph = {
    id: image, smallSrc: image, fullSrc: image, width: landscape[0], height: landscape[1],
    alt: query.data?.alt_text || 'Photo from this sit', shape: 'across',
  };
  return (
    <div className="mt-2">
      <PhotographThumb photo={photo} size="page" className="!h-auto w-full" onOpen={() => setOpen(true)} />
      <PhotographZoom photo={open ? photo : null} onClose={() => setOpen(false)}>
        {query.data?.credit && <>Photo by {query.data.credit}</>}
      </PhotographZoom>
    </div>
  );
}
