import React, { useEffect, useRef, useState } from 'react';
import { atlasImageUrl } from './client';

// A Tea Atlas picture: fetched with the session only when it nears the screen,
// shown from a blob URL. There is no open URL to copy.
//
// `fit="natural"` (the reader) shows the picture at its own shape: never wider
// than the column, never upscaled past its own size, and a portrait never
// taller than most of the screen, so it sits in the text instead of taking it
// over. `fit="cover"` (issue covers in lists) fills a fixed 3:4 frame, so a
// column of covers lines up whatever shape each one is.
export const AtlasImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  fit?: 'natural' | 'cover';
}> = ({ src, alt, className = '', eager = false, fit = 'natural' }) => {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const [url, setUrl] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
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
    setShown(false);
    atlasImageUrl(src)
      .then(u => { if (live) setUrl(u); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [near, src]);

  if (failed && fit === 'natural') return null;

  if (fit === 'cover') {
    return (
      <div ref={holder} className={`relative aspect-[3/4] overflow-hidden bg-tea-elevated ${className}`}>
        {url && !failed && (
          <img
            src={url}
            alt={alt}
            draggable={false}
            decoding="async"
            onLoad={() => setShown(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
    );
  }

  return (
    // Until the picture arrives, a quiet 3:2 space holds its place so the
    // text below does not jump when it lands.
    <div ref={holder} className={`${shown ? '' : 'aspect-[3/2] bg-tea-elevated/60'} ${className}`}>
      {url && (
        <img
          src={url}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={() => setShown(true)}
          className={`block mx-auto w-auto max-w-full h-auto max-h-[80vh] transition-opacity duration-500 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0 absolute'}`}
        />
      )}
    </div>
  );
};
