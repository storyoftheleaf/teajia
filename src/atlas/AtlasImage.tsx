import React, { useEffect, useRef, useState } from 'react';
import { atlasImageUrl } from './client';

// A Tea Atlas picture: fetched with the session only when it nears the screen,
// shown from a blob URL. There is no open URL to copy.
export const AtlasImage: React.FC<{ src: string; alt: string; className?: string; eager?: boolean }> = ({ src, alt, className = '', eager = false }) => {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (near || !holder.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(holder.current);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let live = true;
    setFailed(false);
    atlasImageUrl(src)
      .then(u => { if (live) setUrl(u); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [near, src]);

  if (failed) return null;
  return (
    <div ref={holder} className={`bg-tea-elevated/40 ${url ? '' : 'min-h-[160px]'} ${className}`}>
      {url && <img src={url} alt={alt} className="block w-full h-auto" draggable={false} />}
    </div>
  );
};
