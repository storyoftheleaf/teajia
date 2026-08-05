// src/components/immersive/ReadingProgress.tsx
import { useEffect, useState } from 'react';

// Thin aged-bronze bar fixed to the top of the viewport, width = scroll progress.
// Passive scroll listener (progress is not a reveal: IntersectionObserver does not fit).
// Animates width via transform-free style update; acceptable for a 2px bar.
export function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? (el.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 h-[2px] z-modal"
      style={{ width: `${pct}%`, background: 'var(--tea-gold)' }}
    />
  );
}
