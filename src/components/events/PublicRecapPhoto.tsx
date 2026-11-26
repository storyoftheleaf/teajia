import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teaTableOpen } from '../../lib/teaTable';
import { useBlobObjectUrl } from '../../hooks/useBlobObjectUrl';
import { recapPhotoPublicQuery, revocableSitPhotoApi } from '../../lib/revocableSitPhotoApi';

export function PublicRecapPhoto({ eventSlug, placement }: { eventSlug: string; placement?: 'essay' }) {
  const figure = useRef<HTMLElement>(null);
  const [restoring, setRestoring] = useState(false);
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: [...recapPhotoPublicQuery, eventSlug, placement ?? 'recap'],
    queryFn: ({ signal }) => revocableSitPhotoApi.forPublicRecap(eventSlug, signal, placement),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: false,
    networkMode: 'always',
  });
  const imageUrl = useBlobObjectUrl(isFetching || isError || restoring ? undefined : data?.image);

  useEffect(() => {
    const conceal = () => {
      if (figure.current) figure.current.hidden = true;
    };
    const recheck = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setRestoring(true);
      void refetch().finally(() => setRestoring(false));
    };
    window.addEventListener('pagehide', conceal);
    window.addEventListener('pageshow', recheck);
    return () => {
      window.removeEventListener('pagehide', conceal);
      window.removeEventListener('pageshow', recheck);
    };
  }, [refetch]);

  if (!data || !imageUrl || isFetching || isError || restoring) return null;
  return (
    <figure ref={figure} className="mb-8">
      <img src={imageUrl} alt={data.alt_text} className="max-h-[45dvh] max-w-full rounded-md object-contain" />
      <figcaption className="mt-2 text-ui-13 text-tea-text-sec">
        {data.tea && <p className="mb-1 break-words text-tea-text">{data.tea.name}</p>}
        {data.observation && <p className="mb-1 whitespace-pre-wrap break-words">{data.observation}</p>}
        <p className="break-words">Photo by {data.credit}</p>
        {!placement && data.canShowInBrewing && teaTableOpen() && (
          <a className="btn-quiet btn-sm tap-target mt-1" href="/tea-table">The Tea Table</a>
        )}
      </figcaption>
    </figure>
  );
}
