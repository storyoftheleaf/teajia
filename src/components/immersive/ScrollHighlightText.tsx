// src/components/immersive/ScrollHighlightText.tsx
import { useEffect, useRef } from 'react';

// Splits text into word spans that brighten from dim to full as the reading
// line (≈42% down the viewport) passes them. Passive scroll listener: this is a
// continuous per-scroll state, not a one-shot reveal, so IntersectionObserver
// does not model it. Only toggles a className (no layout-triggering props).
export function ScrollHighlightText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>('[data-w]'));
    const onScroll = () => {
      const line = window.innerHeight * 0.42;
      for (const s of spans) {
        const top = s.getBoundingClientRect().top;
        s.classList.toggle('shl-on', top < line);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [text]);
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span data-w key={i} className="shl-word">{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </p>
  );
}
