// src/components/immersive/sections.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ArticleBlock } from '../../types';
import { ScrollHighlightText } from './ScrollHighlightText';

// Wraps a child and fades it up (translateY + blur-clear) the first time it
// enters the viewport. IntersectionObserver, one-shot. Animates only
// transform/opacity/filter. Respects prefers-reduced-motion (skips to visible).
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`immersive-reveal ${shown ? 'is-in' : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}

// Cover: full-height image backdrop with overlaid title. Phone-first; the same
// markup reads wider on desktop via the responsive measure classes below.
// A `centered` variant renders a quiet ceremonial title page (no image).
export function CoverSection({ title, subtitle, image, kicker, variant, mark }: {
  title: string; subtitle?: string; image?: string; kicker?: string; variant?: string; mark?: string;
}) {
  if (variant === 'centered') {
    return (
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ background: 'radial-gradient(circle at 50% 30%, #2c2924, var(--tea-bg))' }}
      >
        {mark && <div className="font-display text-tea-gold leading-none text-[34px] md:text-[44px] mb-8 opacity-90">{mark}</div>}
        <h1 className="font-display text-tea-text leading-none text-[56px] md:text-[80px]">{title}</h1>
        {subtitle && <p className="font-sans text-tea-text-dim tracking-[0.2em] uppercase text-ui-12 mt-6">{subtitle}</p>}
      </section>
    );
  }
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      {image && (
        <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(transparent 28%, rgba(20,18,15,.55) 62%, rgba(20,18,15,.97))' }}
      />
      <div className="relative z-[2] px-6 pb-16 md:px-16 md:pb-24 w-full">
        {kicker && (
          <span className="inline-block font-sans text-ui-10 tracking-[0.22em] uppercase text-tea-gold-lt border border-tea-border rounded-full px-3 py-1 mb-4">
            {kicker}
          </span>
        )}
        <h1 className="font-display font-semibold text-tea-text leading-[0.94] text-[52px] md:text-[88px]">
          {title}
        </h1>
        {subtitle && <p className="font-body text-tea-text-sec mt-4 text-ui-16 md:text-ui-20 max-w-[640px]">{subtitle}</p>}
      </div>
    </section>
  );
}

// Reading column: capped measure even on wide screens (prose never goes full-bleed).
function ReadingColumn({ children }: { children: React.ReactNode }) {
  return <div className="px-6 md:px-0 mx-auto max-w-[680px]">{children}</div>;
}

// ─── AR.3: Text-effect dials ──────────────────────────────────────────────
// A section opts into one effect by name. Most effects are driven by the
// `.is-in` class that <Reveal> toggles via IntersectionObserver, so they cost
// nothing until the section enters the viewport. scroll-highlight is its own
// component (a continuous per-scroll read-along), handled in ProseSection.
export type TextEffect =
  | 'none'
  | 'scroll-highlight'
  | 'word-rise'
  | 'shimmer'
  | 'blur-focus'
  | 'line-stagger'
  | 'scale-jump'
  | 'color-wipe'
  | 'underline-draw'
  | 'letter-expand';

// Splits text into per-word spans with an increasing transition-delay so words
// rise in sequence. Pure transform/opacity; the stagger is inline delay only.
function WordRise({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={`fx-word-rise ${className ?? ''}`}>
      {words.map((w, i) => (
        <span key={i} className="fx-w" style={{ transitionDelay: `${Math.min(i * 45, 1200)}ms` }}>
          {w}{i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

// Wraps a heading/phrase in a single text effect. Used by headings and openers.
// `wipe`/`underline`/`shimmer`/`letter-expand` style the text itself; the
// reveal-driven ones rely on the ancestor <Reveal> adding `.is-in`.
export function FxText({ effect, text, className, as = 'span' }: {
  effect?: TextEffect; text: string; className?: string; as?: 'span' | 'h2' | 'h3' | 'p';
}) {
  const Tag = as as React.ElementType;
  const fxClass =
    effect === 'shimmer' ? 'fx-shimmer' :
    effect === 'blur-focus' ? 'fx-blur-focus' :
    effect === 'scale-jump' ? 'fx-scale-jump' :
    effect === 'color-wipe' ? 'fx-color-wipe' :
    effect === 'underline-draw' ? 'fx-underline-draw' :
    effect === 'letter-expand' ? 'fx-letter-expand' :
    '';
  if (effect === 'word-rise') return <WordRise text={text} className={className} />;
  return <Tag className={`${fxClass} ${className ?? ''}`}>{text}</Tag>;
}

// Prose: the spine. Default reading effect is scroll-highlight (Adrian's pick);
// a block may opt into a different per-section effect via `effect`.
export function ProseSection({ text, dropcap, effect = 'scroll-highlight' }: {
  text: string; dropcap?: boolean; effect?: TextEffect;
}) {
  const proseClass = `font-body text-[18px] md:text-ui-20 leading-[1.78] ${dropcap ? 'immersive-dropcap' : ''}`;
  const body =
    effect === 'scroll-highlight' ? (
      <ScrollHighlightText text={text} className={proseClass} />
    ) : effect === 'word-rise' ? (
      <p className={proseClass}><WordRise text={text} /></p>
    ) : (
      <p className={`${proseClass} ${
        effect === 'blur-focus' ? 'fx-blur-focus' :
        effect === 'letter-expand' ? 'fx-letter-expand' : ''
      }`}>{text}</p>
    );
  return (
    <section className="py-20 md:py-32">
      <ReadingColumn>
        <Reveal>{body}</Reveal>
      </ReadingColumn>
    </section>
  );
}

export function SectionHeading({ text, effect }: { text: string; effect?: TextEffect }) {
  return (
    <section className="pt-12 pb-2 md:pt-20">
      <ReadingColumn>
        <Reveal>
          <FxText
            as="h3"
            effect={effect}
            text={text}
            className="font-display font-medium text-tea-text leading-[1.05] text-[34px] md:text-[44px]"
          />
        </Reveal>
      </ReadingColumn>
    </section>
  );
}

// `id` is the anchor a creator profile links to (quote-<contributor id>), so a
// "Quoted in" row can land on the passage rather than the top of the piece.
export function PullQuote({ text, attribution, id }: { text: string; attribution?: string; id?: string }) {
  return (
    <section id={id} className="py-24 md:py-32 text-center px-6 scroll-mt-16">
      <Reveal>
        <blockquote className="font-display font-medium italic text-tea-gold-lt leading-[1.18] text-[32px] md:text-[46px] max-w-[760px] mx-auto">
          {text}
        </blockquote>
        {attribution && (
          <cite className="block mt-8 font-sans not-italic text-ui-11 tracking-[0.16em] uppercase text-tea-text-dim">{attribution}</cite>
        )}
      </Reveal>
    </section>
  );
}

// Chapter divider: a full-height pause between movements. Number + title,
// centered. Not Reveal-wrapped (it is itself the breath).
export function ChapterDivider({ number, title, subtitle }: { number?: string; title: string; subtitle?: string }) {
  return (
    <section className="py-28 md:py-40 px-8 text-center">
      {number && <div className="font-display text-tea-gold leading-none text-[44px] md:text-[64px] mb-4">{number}</div>}
      <h2 className="font-display font-medium text-tea-text leading-[1.05] text-[36px] md:text-[52px]">{title}</h2>
      {subtitle && <p className="font-body text-tea-text-dim mt-4 text-ui-16 md:text-ui-20 max-w-[520px] mx-auto">{subtitle}</p>}
    </section>
  );
}

// Epilogue: the closing voice. Italic display, optional signature.
export function Epilogue({ text, signature }: { text: string; signature?: string }) {
  return (
    <section className="py-24 md:py-32">
      <div className="px-6 md:px-0 mx-auto max-w-[680px]">
        <Reveal>
          <p className="font-display italic text-tea-text-sec leading-[1.5] text-[24px] md:text-[30px]">{text}</p>
          {signature && <p className="font-sans text-tea-text-dim tracking-[0.14em] uppercase text-ui-11 mt-8">{signature}</p>}
        </Reveal>
      </div>
    </section>
  );
}

// ─── AR.2: Visual family ──────────────────────────────────────────────────

// Caption used under inline / plate images. Quiet sans, dim.
function ImageCaption({ caption }: { caption?: string }) {
  if (!caption) return null;
  return (
    <figcaption className="font-sans text-ui-12 tracking-[0.04em] text-tea-text-dim mt-3 text-center max-w-[680px] mx-auto px-6">
      {caption}
    </figcaption>
  );
}

// Full-bleed image with a slow ken-burns drift. Truly edge-to-edge on every
// width; a quiet scrim keeps any future caption legible. Continuous CSS
// animation (transform only), disabled under reduced-motion.
export function FullBleedImage({ url, caption }: { url?: string; caption?: string }) {
  if (!url) return null;
  return (
    <figure className="my-16 md:my-24">
      <div className="relative w-full h-[62vh] md:h-[82vh] overflow-hidden">
        <img src={url} alt={caption ?? ''} className="immersive-kenburns absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 62%, rgba(24,19,14,.28))' }} />
      </div>
      <ImageCaption caption={caption} />
    </figure>
  );
}

// Inline image: sits inside the reading flow at the prose measure, captioned,
// the read continues after it. Reveal-wrapped (fade-up on enter).
export function InlineImage({ url, caption }: { url?: string; caption?: string }) {
  if (!url) return null;
  return (
    <section className="py-10 md:py-14">
      <div className="px-6 md:px-0 mx-auto max-w-[680px]">
        <Reveal>
          <figure>
            <img src={url} alt={caption ?? ''} className="w-full rounded-xl object-cover" />
            {caption && <figcaption className="font-sans text-ui-12 tracking-[0.04em] text-tea-text-dim mt-3">{caption}</figcaption>}
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

// Split diptych: two images side by side on wide screens, stacked on phone.
export function SplitDiptych({ images, caption }: { images?: string[]; caption?: string }) {
  const imgs = (images ?? []).slice(0, 2);
  if (imgs.length === 0) return null;
  return (
    <section className="py-12 md:py-20">
      <Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4 md:px-8">
          {imgs.map((src, i) => (
            <img key={i} src={src} alt="" className="w-full h-[50vh] md:h-[64vh] object-cover rounded-xl" />
          ))}
        </div>
      </Reveal>
      <ImageCaption caption={caption} />
    </section>
  );
}

// Horizontal swipe gallery: snap-scroll row of plates. Phone swipes one at a
// time; desktop shows more per view. CSS scroll-snap (no JS).
export function SwipeGallery({ images, caption }: { images?: string[]; caption?: string }) {
  const imgs = images ?? [];
  if (imgs.length === 0) return null;
  return (
    <section className="py-12 md:py-20">
      <Reveal>
        <div className="immersive-gallery flex gap-3 md:gap-4 overflow-x-auto px-6 md:px-12 pb-2">
          {imgs.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="shrink-0 w-[82%] sm:w-[58%] md:w-[42%] lg:w-[32%] h-[52vh] md:h-[64vh] object-cover rounded-xl"
            />
          ))}
        </div>
      </Reveal>
      <ImageCaption caption={caption} />
    </section>
  );
}

// Book plate: a single image treated like a fine-press plate. Quiet duotone,
// generous mat, a hairline frame. The plate sits centered, contemplative.
export function BookPlate({ url, caption }: { url?: string; caption?: string }) {
  if (!url) return null;
  return (
    <section className="py-16 md:py-28 px-6">
      <Reveal>
        <figure className="mx-auto max-w-[560px]">
          <div className="border border-tea-border p-3 md:p-4" style={{ background: 'var(--tea-bg)' }}>
            <img src={url} alt={caption ?? ''} className="immersive-bookplate-img w-full object-cover" />
          </div>
          {caption && (
            <figcaption className="font-display italic text-tea-text-dim text-ui-15 mt-5 text-center">{caption}</figcaption>
          )}
        </figure>
      </Reveal>
    </section>
  );
}

// Pinned hero: a tall section where the image is held (sticky) while a headline
// scrolls across it, then releases. Pure CSS sticky + scrim; no scroll JS.
export function PinnedHero({ url, title, kicker }: { url?: string; title: string; kicker?: string }) {
  return (
    <section className="relative" style={{ height: '210vh' }}>
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        {url && <img src={url} alt="" className="immersive-pinned-img absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(rgba(20,18,15,.35), rgba(20,18,15,.72))' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
          {kicker && (
            <span className="font-sans text-ui-10 tracking-[0.24em] uppercase text-tea-gold-lt mb-5">{kicker}</span>
          )}
          <h2 className="font-display font-semibold text-tea-text leading-[0.96] text-[54px] md:text-[96px] max-w-[18ch]">{title}</h2>
        </div>
      </div>
    </section>
  );
}

// ─── AR.4: Interactive & data family ──────────────────────────────────────

// Comparison slider: two images framed in a double bezel, a draggable divider
// reveals the second over the first via clip-path. Pointer-driven; only
// clip-path (compositable) and the handle transform change.
export function ComparisonSlider({ before, after, beforeLabel, afterLabel, caption }: {
  before: string; after: string; beforeLabel?: string; afterLabel?: string; caption?: string;
}) {
  const [pct, setPct] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPct(Math.max(0, Math.min(100, p)));
  };
  return (
    <section className="py-14 md:py-20 px-6">
      <Reveal>
        <div className="mx-auto max-w-[760px]">
          {/* double bezel */}
          <div className="border border-tea-border p-2 md:p-3 rounded-xl" style={{ background: 'var(--tea-surface)' }}>
            <div className="border border-tea-border rounded-md overflow-hidden">
              <div
                ref={ref}
                className="relative w-full select-none touch-none"
                style={{ aspectRatio: '4 / 3', cursor: 'ew-resize' }}
                onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
                onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
                onPointerUp={() => { dragging.current = false; }}
              >
                <img src={before} alt={beforeLabel ?? 'before'} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                <img
                  src={after}
                  alt={afterLabel ?? 'after'}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
                />
                {/* handle */}
                <div className="absolute top-0 bottom-0" style={{ left: `${pct}%`, transform: 'translateX(-50%)', width: 2, background: 'var(--tea-gold)' }}>
                  <div
                    className="absolute top-1/2 left-1/2 rounded-full"
                    style={{ width: 34, height: 34, transform: 'translate(-50%,-50%)', background: 'var(--tea-bg)', border: '1px solid var(--tea-gold)' }}
                  />
                </div>
                {beforeLabel && <span className="absolute left-3 bottom-3 font-sans text-ui-10 tracking-[0.18em] uppercase text-tea-text-sec" style={{ textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>{beforeLabel}</span>}
                {afterLabel && <span className="absolute right-3 bottom-3 font-sans text-ui-10 tracking-[0.18em] uppercase text-tea-text-sec" style={{ textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>{afterLabel}</span>}
              </div>
            </div>
          </div>
          <ImageCaption caption={caption} />
        </div>
      </Reveal>
    </section>
  );
}

// Brewing steps: numbered rows. The recipe block feeds title/ingredients/steps.
export function BrewingSteps({ title, steps, ingredients, pairing }: {
  title?: string; steps: string[]; ingredients?: string[]; pairing?: string;
}) {
  return (
    <section className="py-16 md:py-24">
      <div className="px-6 md:px-0 mx-auto max-w-[680px]">
        <Reveal>
          {title && <h3 className="font-display font-medium text-tea-text leading-[1.1] text-[30px] md:text-[40px] mb-8">{title}</h3>}
          {ingredients && ingredients.length > 0 && (
            <ul className="mb-10 flex flex-wrap gap-2">
              {ingredients.map((ing, i) => (
                <li key={i} className="font-sans text-ui-12 text-tea-text-sec px-3 py-1 rounded-full" style={{ background: 'var(--tea-surface)' }}>{ing}</li>
              ))}
            </ul>
          )}
          <ol className="space-y-7">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-5 items-start">
                <span className="font-display text-tea-gold leading-none text-[30px] md:text-[38px] shrink-0 w-10 tabular-nums">{i + 1}</span>
                <span className="font-body text-tea-text-sec text-ui-17 md:text-ui-20 leading-[1.7] pt-1">{s}</span>
              </li>
            ))}
          </ol>
          {pairing && <p className="font-display italic text-tea-text-dim text-ui-16 mt-10">Pairs with {pairing}.</p>}
        </Reveal>
      </div>
    </section>
  );
}

// Tasting radar: a self-drawing polygon over labelled axes. The polygon scales
// up from the centre and its stroke draws on entering the viewport. Values are
// 0..5; derived from tasting_notes items (note length is not a score, so the
// caller passes explicit scores when present, else an even default).
export function TastingRadar({ axes, caption }: {
  axes: Array<{ label: string; value: number }>; caption?: string;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const n = axes.length;
  const cx = 130, cy = 130, R = 100;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = axes.map((ax, i) => pt(i, (Math.max(0, Math.min(5, ax.value)) / 5) * R)).map(([x, y]) => `${x},${y}`).join(' ');
  const grid = [0.33, 0.66, 1].map((f) => axes.map((_, i) => pt(i, R * f)).map(([x, y]) => `${x},${y}`).join(' '));
  return (
    <section className="py-16 md:py-24 px-6">
      <div ref={ref} className="mx-auto max-w-[420px] text-center">
        <svg viewBox="0 0 260 260" className="w-full" role="img" aria-label="Tasting profile">
          {grid.map((g, i) => <polygon key={i} points={g} fill="none" stroke="var(--tea-border)" strokeWidth="1" />)}
          {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--tea-border)" strokeWidth="1" />; })}
          <polygon
            points={poly}
            fill="rgb(var(--tea-gold-rgb) / 0.18)"
            stroke="var(--tea-gold)"
            strokeWidth="1.6"
            style={{ transformOrigin: '130px 130px', transform: shown ? 'scale(1)' : 'scale(0)', opacity: shown ? 1 : 0, transition: 'transform 1.1s cubic-bezier(.34,1.3,.5,1), opacity .6s ease' }}
          />
          {axes.map((ax, i) => {
            const [lx, ly] = pt(i, R + 22);
            return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--tea-text-dim)" fontFamily="var(--font-sans)">{ax.label}</text>;
          })}
        </svg>
        <ImageCaption caption={caption} />
      </div>
    </section>
  );
}

// Origin map: a self-drawing route across labelled waypoints (cliff to roast to
// cup). The path draws on enter via stroke-dashoffset; nodes fade after.
export function OriginMap({ locations, caption }: { locations: string[]; caption?: string }) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const W = 600, H = 220, pad = 60;
  const n = Math.max(locations.length, 2);
  const xs = locations.map((_, i) => pad + (i * (W - pad * 2)) / (n - 1));
  const ys = locations.map((_, i) => H / 2 + Math.sin(i * 1.3) * 40);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
  const LEN = 1200;
  return (
    <section className="py-16 md:py-24 px-6">
      <div ref={ref} className="mx-auto max-w-[680px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Origin route">
          <path d={d} fill="none" stroke="var(--tea-gold)" strokeWidth="1.8" strokeLinecap="round"
            strokeDasharray={LEN} strokeDashoffset={shown ? 0 : LEN}
            style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1)' }} />
          {locations.map((loc, i) => (
            <g key={i} style={{ opacity: shown ? 1 : 0, transition: `opacity .5s ease ${0.4 + i * 0.25}s` }}>
              <circle cx={xs[i]} cy={ys[i]} r="5" fill="var(--tea-bg)" stroke="var(--tea-gold)" strokeWidth="1.6" />
              <text x={xs[i]} y={ys[i] - 16} textAnchor="middle" fontSize="12" fill="var(--tea-text-dim)" fontFamily="var(--font-sans)">{loc}</text>
            </g>
          ))}
        </svg>
        <ImageCaption caption={caption} />
      </div>
    </section>
  );
}

// Count-up stat: a number eases up to its value on enter. rAF loop; only the
// text content changes. Falls back to the literal value under reduced-motion or
// when the value is not purely numeric (e.g. "3 mins").
export function CountUpStat({ value, label, context }: { value: string; label: string; context?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const m = value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  const target = m ? parseFloat(m[2].replace(/,/g, '')) : NaN;
  const prefix = m ? m[1] : '';
  const suffix = m ? m[3] : '';
  const decimals = m && m[2].includes('.') ? m[2].split('.')[1].length : 0;
  useEffect(() => {
    const el = ref.current, span = numRef.current;
    if (!el || !span) return;
    if (isNaN(target) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { span.textContent = value; return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.disconnect();
        const dur = 1400, start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          span.textContent = prefix + (target * eased).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, target, prefix, suffix, decimals]);
  return (
    <section className="py-16 md:py-24 px-6 text-center">
      <div ref={ref}>
        <div className="font-display font-semibold text-tea-gold-lt leading-none text-[64px] md:text-[112px] tabular-nums">
          <span ref={numRef}>{prefix}0{suffix}</span>
        </div>
        <p className="font-sans text-ui-12 tracking-[0.2em] uppercase text-tea-text-dim mt-4">{label}</p>
        {context && <p className="font-body italic text-tea-text-sec text-ui-16 mt-3 max-w-[480px] mx-auto">{context}</p>}
      </div>
    </section>
  );
}

// Product cross-link card: links to a Tea product. Material-flow's reference
// rule (it links to where the product lives, it does not copy it).
export function ProductCard({ title, blurb, href, image }: { title: string; blurb?: string; href: string; image?: string }) {
  return (
    <section className="py-12 md:py-16 px-6">
      <div className="px-0 mx-auto max-w-[680px]">
        <Reveal>
          <a href={href} className="group flex items-stretch gap-5 rounded-xl border border-tea-border overflow-hidden" style={{ background: 'var(--tea-surface)' }}>
            {image && <img src={image} alt="" className="w-28 md:w-40 object-cover shrink-0" />}
            <div className="py-5 pr-6 flex flex-col justify-center">
              <span className="font-sans text-ui-10 tracking-[0.2em] uppercase text-tea-gold-lt mb-2">From the shop</span>
              <h4 className="font-display text-tea-text text-[24px] md:text-[30px] leading-tight">{title}</h4>
              {blurb && <p className="font-body text-tea-text-dim text-ui-15 mt-2">{blurb}</p>}
              <span className="font-sans text-ui-12 text-tea-gold mt-3">View tea ↗</span>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

// Audio / listen block: a read-aloud control with an animated waveform. The
// bars animate via transform (scaleY) only while playing. No real audio engine
// is wired here (the brief lists it as a layout); the control toggles a visual
// playing state and plays the source if one is provided.
export function AudioBlock({ src, title }: { src?: string; title?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggle = () => {
    const a = audioRef.current;
    if (a && src) { if (playing) a.pause(); else a.play().catch(() => {}); }
    setPlaying((p) => !p);
  };
  const bars = Array.from({ length: 28 });
  return (
    <section className="py-12 md:py-16 px-6">
      <div className="mx-auto max-w-[680px]">
        <Reveal>
          <div className="flex items-center gap-5 rounded-xl border border-tea-border px-5 py-4" style={{ background: 'var(--tea-surface)' }}>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause read-aloud' : 'Play read-aloud'}
              className="shrink-0 rounded-full font-sans text-ui-11 tracking-[0.12em] uppercase text-tea-bg px-5 py-3"
              style={{ background: 'var(--tea-gold)' }}
            >
              {playing ? 'Pause' : 'Listen'}
            </button>
            <div className="flex items-end gap-[3px] h-7 flex-1 overflow-hidden" aria-hidden>
              {bars.map((_, i) => (
                <span
                  key={i}
                  className={`immersive-wavebar flex-1 rounded-full ${playing ? 'is-playing' : ''}`}
                  style={{
                    background: 'var(--tea-gold-lt)',
                    height: '100%',
                    transform: `scaleY(${0.2 + ((i * 37) % 80) / 100})`,
                    animationDelay: `${(i % 7) * 90}ms`,
                    opacity: playing ? 1 : 0.45,
                    transition: 'opacity .4s ease',
                  }}
                />
              ))}
            </div>
            {title && <span className="font-display italic text-tea-text-dim text-ui-15 shrink-0 hidden md:block">{title}</span>}
            {src && <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} preload="none" />}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// Closing colophon: credits + a "Share a card ↗" button-in-button pill. The
// outer pill is the share affordance; the inner segment opens the share-card
// generator (AR.6). `onShare` is provided by the reader page; a plain anchor
// fallback keeps the preview/editor render harmless when no handler is wired.
export function Colophon({ lines, onShare }: { lines: string[]; onShare?: () => void }) {
  const inner = (
    <>
      <span className="font-sans text-ui-12 tracking-[0.14em] uppercase text-tea-text-sec">Share a card</span>
      <span className="rounded-full font-sans text-ui-11 tracking-[0.12em] uppercase text-tea-bg px-4 py-2" style={{ background: 'var(--tea-gold)' }}>Open ↗</span>
    </>
  );
  return (
    <section className="py-24 md:py-32 px-6 text-center border-t border-tea-border">
      <Reveal>
        <div className="mx-auto max-w-[520px]">
          {lines.map((l, i) => (
            <p key={i} className="font-sans text-ui-12 tracking-[0.14em] uppercase text-tea-text-dim leading-[2.1]">{l}</p>
          ))}
          <button
            type="button"
            onClick={onShare}
            data-testid="colophon-share"
            className="inline-flex items-center gap-1 rounded-full mt-10 pl-5 pr-1 py-1 border border-tea-border"
            style={{ background: 'var(--tea-surface)' }}
          >
            {inner}
          </button>
        </div>
      </Reveal>
    </section>
  );
}

// Poem: a centered, contemplative passage. Demonstrates a text-effect dial
// wired through renderBlock, the lines rise on a line-by-line stagger.
export function PoemSection({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <section className="py-20 md:py-28 px-6 text-center">
      <Reveal>
        <div className="fx-line-stagger mx-auto max-w-[560px]">
          {lines.map((line, i) => (
            <p key={i} className="font-display italic text-tea-text-sec leading-[1.7] text-[22px] md:text-ui-28" style={{ transitionDelay: `${i * 120}ms` }}>{line}</p>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// Definition: a term + body, the term arriving with a blur-focus dial. Another
// text-effect demonstration reachable from block data.
export function DefinitionSection({ term, body, etymology }: { term: string; body: string; etymology?: string }) {
  return (
    <section className="py-16 md:py-24">
      <div className="px-6 md:px-0 mx-auto max-w-[680px]">
        <Reveal>
          <h3 className="fx-blur-focus font-display text-tea-gold-lt leading-tight text-[36px] md:text-[52px]">{term}</h3>
          {etymology && <p className="font-sans text-ui-12 tracking-[0.14em] uppercase text-tea-text-dim mt-2">{etymology}</p>}
          <p className="font-body text-tea-text-sec text-[18px] md:text-ui-20 leading-[1.78] mt-5">{body}</p>
        </Reveal>
      </div>
    </section>
  );
}

// Derive 0..5 tasting scores from tasting_notes. A note has no numeric score in
// the model, so we map by sensible keyword weighting and fall back to a middle
// value, keeps the radar meaningful without a new block field. Noted as an
// invented mapping in the handoff.
function scoresFromNotes(items: Array<{ label: string; note: string }>): Array<{ label: string; value: number }> {
  return items.slice(0, 8).map(({ label, note }) => {
    const t = note.toLowerCase();
    let v = 3;
    if (/(intense|deep|powerful|bold|strong|heavy)/.test(t)) v = 5;
    else if (/(rich|full|pronounced|lasting)/.test(t)) v = 4;
    else if (/(light|delicate|faint|subtle|soft|gentle)/.test(t)) v = 2;
    else if (/(trace|hint|whisper|barely)/.test(t)) v = 1;
    return { label, value: v };
  });
}

// Prose defaults to scroll-highlight when no dial is set; 'none' falls back to
// plain prose. Any value the prose path does not specially handle renders as
// plain prose, so an unknown stored value never breaks the read.
function normalizeEffect(e?: TextEffect): TextEffect {
  if (!e || e === 'scroll-highlight') return 'scroll-highlight';
  if (e === 'none') return 'none';
  return e;
}

// Headings have no scroll-highlight; an absent or scroll-highlight value means
// "no heading effect" (undefined), so the heading renders in its plain form.
function normalizeHeadingEffect(e?: TextEffect): TextEffect | undefined {
  if (!e || e === 'none' || e === 'scroll-highlight') return undefined;
  return e;
}

// Optional render context. The reader page passes onShare so the colophon's
// "Share a card" pill opens the share-card generator (AR.6). The editor preview
// omits it, so the pill is inert there (no modal to open in a preview pane).
export interface RenderBlockContext {
  onShare?: () => void;
  /** The article's pull quote and the anchor a creator profile links to
   *  (quote-<contributor id>). The quote block whose text matches gets the id. */
  quoteAnchor?: { text: string; id: string } | null;
}

// Maps one ArticleBlock to its section. Visual variants are read off the
// image/list/recipe/map/tasting blocks. Unmapped block types render nothing;
// they are intentionally skipped, not errored.
export function renderBlock(block: ArticleBlock, index: number, ctx?: RenderBlockContext) {
  switch (block.type) {
    case 'cover':
      return <CoverSection key={index} title={block.title} subtitle={block.subtitle} image={block.image} kicker={block.kicker} variant={block.variant} />;
    case 'intro':
      return <ProseSection key={index} text={block.text} dropcap effect={normalizeEffect(block.textEffect)} />;
    case 'paragraph':
      // The paragraph variant `drop_cap` carries dropcap; the per-block
      // text-effect dial (AR.5) rides `textEffect`, defaulting to
      // scroll-highlight when absent.
      return <ProseSection key={index} text={block.text} dropcap={block.variant === 'drop_cap'} effect={normalizeEffect(block.textEffect)} />;
    case 'section_heading':
      return <SectionHeading key={index} text={block.text} effect={normalizeHeadingEffect(block.textEffect)} />;
    case 'chapter_divider':
      return <ChapterDivider key={index} number={block.number} title={block.title} subtitle={block.subtitle} />;
    case 'quote':
      return <PullQuote key={index} text={block.text} attribution={block.attribution} id={ctx?.quoteAnchor && ctx.quoteAnchor.text.trim() === block.text.trim() ? ctx.quoteAnchor.id : undefined} />;
    case 'epilogue':
      return <Epilogue key={index} text={block.text} signature={block.signature} />;
    case 'poem':
      // Demonstrates the line-stagger text-effect dial wired from block data.
      return <PoemSection key={index} text={block.text} />;
    case 'definition':
      // Demonstrates the blur-focus text-effect dial wired from block data.
      return <DefinitionSection key={index} term={block.term} body={block.body} etymology={block.etymology} />;

    // AR.2, image variants map to the visual family.
    case 'image': {
      const src = block.url ?? block.images?.[0];
      switch (block.variant) {
        case 'split_vertical':
          return <SplitDiptych key={index} images={block.images ?? (src ? [src] : [])} caption={block.caption ?? block.description} />;
        case 'film_strip':
          return <SwipeGallery key={index} images={block.images ?? (src ? [src] : [])} caption={block.caption ?? block.description} />;
        case 'caption_bottom':
          return <InlineImage key={index} url={src} caption={block.caption ?? block.description} />;
        // `book_plate` and `pinned_hero` are added ImageVariant values (see note).
        case 'book_plate':
          return <BookPlate key={index} url={src} caption={block.caption ?? block.description} />;
        case 'pinned_hero':
          return <PinnedHero key={index} url={src} title={block.caption ?? block.description ?? ''} kicker={undefined} />;
        case 'full_bleed':
        default:
          return <FullBleedImage key={index} url={src} caption={block.caption} />;
      }
    }

    // AR.4, interactive & data family, mapped to existing blocks.
    case 'recipe':
      return <BrewingSteps key={index} title={block.title} steps={block.steps} ingredients={block.ingredients} pairing={block.pairing} />;
    case 'list':
      // A timeline list reads as an origin route; a checklist reads as steps.
      return block.variant === 'timeline'
        ? <OriginMap key={index} locations={block.items} caption={block.title} />
        : <BrewingSteps key={index} title={block.title} steps={block.items} />;
    case 'map':
      return <OriginMap key={index} locations={block.locations} caption={block.caption} />;
    case 'tasting_notes':
      return <TastingRadar key={index} axes={scoresFromNotes(block.items)} />;
    case 'stat':
      return <CountUpStat key={index} value={block.value} label={block.label} context={block.context} />;
    case 'back_matter':
      return <Colophon key={index} lines={block.lines} onShare={ctx?.onShare} />;
    case 'comparison':
      return <ComparisonSlider key={index} before={block.before} after={block.after} beforeLabel={block.beforeLabel} afterLabel={block.afterLabel} caption={block.caption} />;
    case 'audio':
      return <AudioBlock key={index} src={block.src} title={block.title} />;
    case 'product_link':
      return <ProductCard key={index} title={block.title} blurb={block.blurb} href={block.href} image={block.image} />;
    default:
      return null;
  }
}
