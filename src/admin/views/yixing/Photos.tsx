import { useEffect, useRef, useState } from 'react';
import { loadPhoto, type Auth } from './data';

export function useReviewPhotos(hashes: string[], { accountId, userId }: Auth) {
  const ids = hashes.join(',');
  const key = JSON.stringify([accountId, userId, ids]);
  const [result, setResult] = useState({ key: '', urls: [] as string[], failed: false });
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    const urls: string[] = [];
    Promise.all(ids.split(',').map(hash => loadPhoto(hash, { accountId, userId }, controller.signal)))
      .then(blobs => {
        if (controller.signal.aborted) return;
        blobs.forEach(blob => urls.push(URL.createObjectURL(blob)));
        setResult({ key, urls, failed: false });
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ key, urls: [], failed: true });
      });
    return () => {
      controller.abort();
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [ids, key, accountId, userId]);
  return result.key === key ? result : { urls: [], failed: false };
}

export function Thumbnail({ hash, auth }: { hash?: string; auth: Auth }) {
  const slot = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setInView(true); observer.disconnect(); }
    });
    if (slot.current) observer.observe(slot.current);
    return () => observer.disconnect();
  }, []);
  const { urls } = useReviewPhotos(inView && hash ? [hash] : [], auth);
  return <span ref={slot} className="block h-[var(--capture-photo-height)] w-[var(--capture-photo-height)] shrink-0 bg-tea-surface">
    {urls[0] && <img className="h-full w-full object-cover" alt="" src={urls[0]} />}
  </span>;
}
