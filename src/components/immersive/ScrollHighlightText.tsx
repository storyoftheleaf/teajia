// src/components/immersive/ScrollHighlightText.tsx
import { useEffect, useRef } from 'react';
import type { TermSegment } from '../../lib/glossaryTerms';
import { TermLink } from '../reader/GlossaryTerms';

// Splits text into word spans that brighten from dim to full as the reading
// line (≈42% down the viewport) passes them. Passive scroll listener: this is a
// continuous per-scroll state, not a one-shot reveal, so IntersectionObserver
// does not model it. Only toggles a className (no layout-triggering props).
export function ScrollHighlightText({ text, className, segments }: { text: string; className?: string; segments?: TermSegment[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');
  // Tea terms wrap their own word spans, so a term still brightens word by
  // word with the rest of the line. Spaces stay between spans, as before.
  const parts = (segments ?? [text]).map((s) => (typeof s === 'string' ? { termId: null, words: s.split(' ') } : { termId: s.termId, words: s.text.split(' ') }));
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
      {segments ? parts.map((p, pi) => {
        const spans = p.words.map((w, i) => (
          w === '' ? (i < p.words.length - 1 ? ' ' : null) : <span data-w key={i} className="shl-word">{w}{i < p.words.length - 1 ? ' ' : ''}</span>
        ));
        return p.termId ? <TermLink key={pi} termId={p.termId}>{spans}</TermLink> : <span key={pi}>{spans}</span>;
      }) : words.map((w, i) => (
        <span data-w key={i} className="shl-word">{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </p>
  );
}
