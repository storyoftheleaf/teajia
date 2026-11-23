import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBlobObjectUrl } from '../../hooks/useBlobObjectUrl';
import { recapPhotoPublicQuery, revocableSitPhotoApi } from '../../lib/revocableSitPhotoApi';

export function PublicRecapPhoto({ eventSlug }: { eventSlug: string }) {
  const figure = useRef<HTMLElement>(null);
  const [restoring, setRestoring] = useState(false);
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: [...recapPhotoPublicQuery, eventSlug],
    queryFn: ({ signal }) => revocableSitPhotoApi.forPublicRecap(eventSlug, signal),
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
      <img src={imageUrl} alt={data.alt_text} className="w-full rounded-md" />
      <figcaption className="mt-2 text-ui-13 text-tea-text-sec">
        {data.observation && <p className="mb-1 whitespace-pre-wrap break-words">{data.observation}</p>}
        <p className="break-words">Photo by {data.credit}</p>
      </figcaption>
    </figure>
  );
}
