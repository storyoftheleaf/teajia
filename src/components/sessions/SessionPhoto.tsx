import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBlobObjectUrl } from '../../hooks/useBlobObjectUrl';
import { mediaUrl } from '../../lib/mediaUrl';
import { revocableSitPhotoApi } from '../../lib/revocableSitPhotoApi';
import { PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';

export type SessionPhotoSource =
  | { kind: 'formal'; slug: string; fallback?: string | null; placement?: 'brewing' }
  | { kind: 'casual'; url: string; alt: string; credit?: string };

/** The sit's lead photograph: the placed recap photo, else the host's first gallery picture. */
export function useSessionPhotoImage(source: SessionPhotoSource) {
  const placement = source.kind === 'formal' ? source.placement : undefined;
  const query = useQuery({
    queryKey: ['public-session-photo', source.kind, source.kind === 'formal' ? source.slug : source.url, placement],
    queryFn: async ({ signal }) => {
      if (source.kind === 'formal') return revocableSitPhotoApi.forPublicRecap(source.slug, signal, placement);
      const response = await fetch(source.url, { signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok || response.headers.get('Content-Type') !== 'image/jpeg') return null;
      return { image: await response.blob(), alt_text: source.alt, credit: source.credit, tea: undefined, observation: null, canShowInBrewing: false };
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const currentPhoto = query.isFetching || query.isError ? undefined : query.data;
  const brewingPhoto = placement === 'brewing' && currentPhoto?.canShowInBrewing === true ? currentPhoto : null;
  const loaded = useBlobObjectUrl(placement === 'brewing' ? brewingPhoto?.image : currentPhoto?.image);
  const fallback = source.kind === 'formal' && !placement && query.isSuccess && !query.isFetching && !query.data ? source.fallback : null;
  const image = loaded || (fallback ? mediaUrl(fallback) : '');
  return { image, query, brewingPhoto };
}

export function SessionPhoto({ source }: { source: SessionPhotoSource }) {
  const [open, setOpen] = useState(false);
  const { image, query, brewingPhoto } = useSessionPhotoImage(source);
  if (!image) return null;
  const landscape = [3, 2];
  const photo: ZoomPhotograph = {
    id: image, smallSrc: image, fullSrc: image, width: landscape[0], height: landscape[1],
    alt: query.data?.alt_text || 'Photo from this sit', shape: 'across',
  };
  return (
    <div className="mt-2">
      <PhotographThumb photo={photo} size="page" className="!h-auto w-full" onOpen={() => setOpen(true)} />
      {brewingPhoto && (
        <div className="space-y-1 px-3 pt-2 text-ui-13 text-tea-text-sec">
          <p>{brewingPhoto.tea && <><span className="text-tea-text">{brewingPhoto.tea.name}</span> · </>}
            Photo by {brewingPhoto.credit}
          </p>
          {brewingPhoto.observation && <p className="break-words">{brewingPhoto.observation}</p>}
        </div>
      )}
      <PhotographZoom photo={open ? photo : null} onClose={() => setOpen(false)}>
        {query.data?.credit && <>Photo by {query.data.credit}</>}
      </PhotographZoom>
    </div>
  );
}
