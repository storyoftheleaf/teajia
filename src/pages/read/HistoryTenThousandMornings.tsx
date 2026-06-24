/**
 * Ten Thousand Mornings — A History of Tea, N°07
 * Five thousand years of tea history, told along a horizontal ink spine
 * that draws as you scroll through the six eras.
 * Ported pixel-faithfully from the tea-article-redesign mockup
 * (History - Ten Thousand Mornings.dc.html).
 *
 * BESPOKE EFFECT — Horizontal Ink Spine + Era Rail:
 *   The horizontal timeline (#tj-rail / #tj-track) is a side-scrolling
 *   strip independent from the page's vertical scroll. The gold spine line
 *   (#tj-spinefill) draws rightward as the user drags/swipes through eras.
 *   Era characters parallax subtly on scroll. Prev/next arrow buttons,
 *   era-ribbon jump buttons, and pointer-drag-to-scroll are all wired.
 *   @keyframes tjNudge (horizontal bounce on the → arrow) is injected
 *   locally because useImmersiveChrome only injects tjFloat/tjFloatX/
 *   tjFade/tjBreath.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F,
  ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome,
  ACCENTS,
} from './immersive';

// ─── MoreFooter links ────────────────────────────────────────────────────────
const moreLinks = [
  { to: '/read/tasting',  kicker: 'Tasting · N°08',    title: 'The Vocabulary of Taste',  blurb: 'A turning wheel of everything a cup can say.' },
  { to: '/read/atlas',    kicker: 'Geography · N°06',   title: 'A Map of Mountains',        blurb: 'An atlas of where the great teas are born.' },
  { to: '/read/ritual',   kicker: 'The Ritual · N°05',  title: 'Seven Steeps',              blurb: 'The same leaves, brewed seven ways.' },
];

// ─── Shared era-body style ────────────────────────────────────────────────────
const pEra: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: 'clamp(16px,2vw,18px)',
  lineHeight: 1.78,
  color: C.taupe,
  margin: 0,
  maxWidth: '42ch',
};

// ─── Era data ────────────────────────────────────────────────────────────────
interface Era {
  index: number;
  char: string;
  charOpacity: string;
  kicker: string;
  title: string;
  body: React.ReactNode;
  dot: React.CSSProperties;
  dotLabel: string;
}

const ERA_DATA: Era[] = [
  {
    index: 0,
    char: '神',
    charOpacity: 'rgba(168,135,77,0.055)',
    kicker: 'c. 2737 BCE · Myth',
    title: 'A leaf, by accident',
    body: (
      <p style={pEra}>
        The legend says the herbalist-emperor Shénnóng was boiling water beneath a wild tree when a few
        leaves drifted into his pot. He drank, felt clear and revived — and tea entered the world as a
        happy accident, and a medicine.
      </p>
    ),
    dot: { background: 'var(--tj-gold,#a8874d)', boxShadow: '0 0 0 4px rgba(168,135,77,0.16)' },
    dotLabel: '∞ — the beginning',
  },
  {
    index: 1,
    char: '唐',
    charOpacity: 'rgba(168,135,77,0.055)',
    kicker: '618–907 · Tang Dynasty',
    title: 'Tea becomes an art',
    body: (
      <p style={pEra}>
        In a golden age, the scholar Lù Yù writes the{' '}
        <em style={{ fontStyle: 'italic', color: C.ink }}>Chá Jīng</em> — the Classic of Tea, the first
        book ever devoted to it. Tea is pressed into cakes, roasted, ground fine, and simmered with care.
        A drink becomes a discipline.
      </p>
    ),
    dot: { background: 'var(--tj-gold,#a8874d)', boxShadow: '0 0 0 4px rgba(168,135,77,0.16)' },
    dotLabel: 'c. 760 — the Classic of Tea',
  },
  {
    index: 2,
    char: '宋',
    charOpacity: 'rgba(168,135,77,0.055)',
    kicker: '960–1279 · Song Dynasty',
    title: 'The whisked cup',
    body: (
      <p style={pEra}>
        At court, tea is ground to powder and whisked to a snowy froth —{' '}
        <em style={{ fontStyle: 'italic', color: C.ink }}>diǎnchá</em>. Connoisseurs hold tea-battles,
        judging the foam's colour and how long it clings. This refined powdered art will cross the sea
        and become Japan's matcha.
      </p>
    ),
    dot: { background: 'var(--tj-gold,#a8874d)', boxShadow: '0 0 0 4px rgba(168,135,77,0.16)' },
    dotLabel: 'whisked tea & tea-battles',
  },
  {
    index: 3,
    char: '明',
    charOpacity: 'rgba(168,135,77,0.055)',
    kicker: '1368–1644 · Ming Dynasty',
    title: 'The leaf set loose',
    body: (
      <p style={pEra}>
        In 1391 the Hongwu Emperor abolishes the labour-heavy compressed tribute cakes. Whole loose
        leaves, simply steeped in hot water, take their place — and the teapot is born. This, in essence,
        is the tea we still drink today.
      </p>
    ),
    dot: { background: 'var(--tj-gold,#a8874d)', boxShadow: '0 0 0 4px rgba(168,135,77,0.16)' },
    dotLabel: '1391 — loose leaf & the teapot',
  },
  {
    index: 4,
    char: '清',
    charOpacity: 'rgba(168,135,77,0.055)',
    kicker: '1644–1912 · Qing & the World',
    title: 'Tea sets sail',
    body: (
      <p style={pEra}>
        Through the port of Canton, tea floods the world — it fills English cups, funds empires, helps
        spark a revolt in a Boston harbour, and sends clippers racing home with the season's first crop.
        Oolong and refined red teas come of age. The leaf becomes the world's drink.
      </p>
    ),
    dot: { background: 'var(--tj-gold,#a8874d)', boxShadow: '0 0 0 4px rgba(168,135,77,0.16)' },
    dotLabel: 'the age of the clippers',
  },
  {
    index: 5,
    char: '今',
    charOpacity: 'rgba(168,135,77,0.06)',
    kicker: 'Now · The Slow Return',
    title: 'The leaf comes home',
    body: (
      <p style={pEra}>
        After a century of teabags and hurry, a counter-current. Gongfu brewing revives; drinkers prize
        single mountains and single seasons again, and relearn the patience the Tang scholars would have
        recognised. Five thousand years on, the morning begins once more.
      </p>
    ),
    dot: {
      background: 'var(--tj-gold-lt,#c6a667)',
      boxShadow: '0 0 0 4px rgba(168,135,77,0.2), 0 0 14px rgba(168,135,77,0.5)',
    },
    dotLabel: 'today — your cup',
  },
];

// ─── Era panel component ──────────────────────────────────────────────────────
const EraPanel: React.FC<{ era: Era; charRef: React.Ref<HTMLDivElement> }> = ({ era, charRef }) => (
  <div
    data-era-panel={era.index}
    style={{
      position: 'relative',
      flex: 'none',
      width: 'clamp(360px,86vw,760px)',
      height: '100%',
      padding: 'clamp(36px,5vw,72px) clamp(28px,5vw,64px)',
      scrollSnapAlign: 'center',
      overflow: 'hidden',
    }}
  >
    {/* Large background character — parallaxed by the bespoke effect */}
    <div
      ref={charRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: '6%',
        top: '6%',
        fontFamily: F.cn,
        fontWeight: 200,
        fontSize: 'min(38vw,300px)',
        lineHeight: 1,
        color: era.charOpacity,
        pointerEvents: 'none',
      }}
    >
      {era.char}
    </div>

    {/* Content */}
    <div style={{ position: 'relative', maxWidth: 460 }}>
      <div style={{
        fontFamily: F.mono,
        fontSize: 11,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: C.gold,
        marginBottom: 16,
      }}>
        {era.kicker}
      </div>
      <h2 style={{
        fontFamily: F.display,
        fontWeight: 400,
        fontSize: 'clamp(30px,4.6vw,52px)',
        lineHeight: 1.04,
        color: C.cream,
        margin: '0 0 20px',
      }}>
        {era.title}
      </h2>
      {era.body}
    </div>

    {/* Timeline dot + label */}
    <div style={{
      position: 'absolute',
      left: 'clamp(28px,5vw,64px)',
      top: '74%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        display: 'inline-block',
        ...era.dot,
      }} />
      <span style={{ fontFamily: F.mono, fontSize: 12, color: C.taupe }}>{era.dotLabel}</span>
    </div>
  </div>
);

// ─── Bespoke rail hook ────────────────────────────────────────────────────────
// Ports the entire setupRail() + updateRail() from the design's DCLogic class.
// Uses refs instead of getElementById — same logic, same constants.
function useTimelineRail(
  railRef: React.RefObject<HTMLDivElement | null>,
  trackRef: React.RefObject<HTMLDivElement | null>,
  spinefillRef: React.RefObject<HTMLDivElement | null>,
  prevRef: React.RefObject<HTMLButtonElement | null>,
  nextRef: React.RefObject<HTMLButtonElement | null>,
  charRefs: React.RefObject<(HTMLDivElement | null)[]>,
  ribbonRefs: React.RefObject<(HTMLButtonElement | null)[]>,
) {
  // active era index for ribbon highlight
  const [activeEra, setActiveEra] = useState(0);

  const eraCenter = useCallback((panel: HTMLElement) => {
    return panel.offsetLeft + panel.offsetWidth / 2;
  }, []);

  const panels = useCallback(() => {
    const track = trackRef.current;
    if (!track) return [] as HTMLElement[];
    return [...track.querySelectorAll<HTMLElement>('[data-era-panel]')];
  }, [trackRef]);

  const getActiveEra = useCallback(() => {
    const rail = railRef.current;
    const ps = panels();
    if (!rail || !ps.length) return 0;
    const c = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0, bd = Infinity;
    ps.forEach((p, i) => {
      const d = Math.abs(eraCenter(p) - c);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }, [railRef, panels, eraCenter]);

  const scrollToEra = useCallback((i: number) => {
    const rail = railRef.current;
    const ps = panels();
    if (!rail || !ps[i]) return;
    const target = eraCenter(ps[i]) - rail.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [railRef, panels, eraCenter]);

  const updateRail = useCallback(() => {
    const rail = railRef.current;
    const track = trackRef.current;
    const fill = spinefillRef.current;
    const prevBtn = prevRef.current;
    const nextBtn = nextRef.current;
    if (!rail || !track) return;

    const c = rail.scrollLeft + rail.clientWidth / 2;

    // ink spine fill: draw to the center-of-viewport x position
    if (fill) {
      fill.style.width = Math.max(0, Math.min(track.scrollWidth, c)).toFixed(0) + 'px';
    }

    // parallax on each era char
    const ps = panels();
    ps.forEach((p, i) => {
      const ch = charRefs.current?.[i] ?? null;
      if (ch) {
        const off = (eraCenter(p) - c) * 0.06;
        ch.style.transform = `translateX(${off.toFixed(1)}px)`;
      }
    });

    // ribbon active state
    const act = getActiveEra();
    setActiveEra(act);

    // arrow opacity
    const max = track.scrollWidth - rail.clientWidth;
    if (prevBtn) {
      prevBtn.style.opacity = rail.scrollLeft <= 4 ? '0.25' : '1';
      prevBtn.style.pointerEvents = rail.scrollLeft <= 4 ? 'none' : 'auto';
    }
    if (nextBtn) {
      nextBtn.style.opacity = rail.scrollLeft >= max - 4 ? '0.25' : '1';
      nextBtn.style.pointerEvents = rail.scrollLeft >= max - 4 ? 'none' : 'auto';
    }
  }, [railRef, trackRef, spinefillRef, prevRef, nextRef, charRefs, panels, eraCenter, getActiveEra]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    // rAF-throttled scroll listener
    let tick = false;
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => { tick = false; updateRail(); });
    };
    rail.addEventListener('scroll', onScroll, { passive: true });

    // ribbon jump buttons
    const ribbonCleanups: (() => void)[] = [];
    ribbonRefs.current?.forEach((btn, i) => {
      if (!btn) return;
      const handler = () => scrollToEra(i);
      btn.addEventListener('click', handler);
      ribbonCleanups.push(() => btn.removeEventListener('click', handler));
    });

    // prev / next arrows
    const prevBtn = prevRef.current;
    const nextBtn = nextRef.current;
    const prevHandler = () => scrollToEra(Math.max(0, getActiveEra() - 1));
    const nextHandler = () => scrollToEra(Math.min(ERA_DATA.length - 1, getActiveEra() + 1));
    prevBtn?.addEventListener('click', prevHandler);
    nextBtn?.addEventListener('click', nextHandler);

    // pointer drag (non-touch only, matching the original)
    let down = false, sx = 0, sl = 0, moved = false;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft;
      rail.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 3) moved = true;
      rail.scrollLeft = sl - dx;
    };
    const onPointerUp = () => {
      if (down) { down = false; rail.style.cursor = 'grab'; }
    };
    // block click after drag
    const onClickCapture = (e: MouseEvent) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); }
    };
    rail.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    rail.addEventListener('click', onClickCapture, true);

    // resize
    const onResize = () => updateRail();
    window.addEventListener('resize', onResize);

    // initial paint
    updateRail();

    return () => {
      rail.removeEventListener('scroll', onScroll);
      ribbonCleanups.forEach(fn => fn());
      prevBtn?.removeEventListener('click', prevHandler);
      nextBtn?.removeEventListener('click', nextHandler);
      rail.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      rail.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('resize', onResize);
    };
  // updateRail and scrollToEra are stable (useCallback with stable deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { activeEra, scrollToEra };
}

// ─── Component ───────────────────────────────────────────────────────────────
const HistoryTenThousandMornings: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);

  // Inject @keyframes tjNudge locally — not provided by useImmersiveChrome
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-tj-nudge', '');
    style.textContent = `
      @keyframes tjNudge{ 0%,100%{ transform:translateX(0); } 50%{ transform:translateX(6px); } }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Reading progress — no extra onScroll needed
  const progress = useReadingProgress();

  // Refs for the bespoke rail effect
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const spinefillRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const charRefs = useRef<(HTMLDivElement | null)[]>(ERA_DATA.map(() => null));
  const ribbonRefs = useRef<(HTMLButtonElement | null)[]>(ERA_DATA.map(() => null));

  const { activeEra } = useTimelineRail(
    railRef, trackRef, spinefillRef, prevRef, nextRef, charRefs, ribbonRefs,
  );

  const ERA_LABELS = ['Myth', 'Tang', 'Song', 'Ming', 'Qing', 'Today'] as const;

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>Ten Thousand Mornings · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="History · N°07" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER ──────────────────────────────────────────────────────── */}
        <header style={{
          position: 'relative',
          minHeight: '72vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(40px,7vw,84px) 24px clamp(28px,5vw,52px)',
          overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 72% 56% at 50% 30%, rgba(168,135,77,0.12), transparent 62%)' }} />
          <div aria-hidden="true" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-54%)',
            fontFamily: F.cn,
            fontWeight: 200,
            fontSize: 'min(54vw,520px)',
            lineHeight: 1,
            color: 'rgba(168,135,77,0.05)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>史</div>

          <div style={{ position: 'relative', maxWidth: 840 }}>
            <div style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: '0.42em',
              textTransform: 'uppercase',
              color: C.gold,
              marginBottom: 28,
            }}>
              A History of Tea &nbsp;·&nbsp; N°07
            </div>
            <h1 style={{
              fontFamily: F.display,
              fontWeight: 400,
              fontSize: 'clamp(44px,8.4vw,104px)',
              lineHeight: 0.98,
              letterSpacing: '-0.015em',
              color: C.cream,
              margin: 0,
            }}>
              Ten Thousand <span style={{ fontStyle: 'italic', color: C.gold }}>Mornings</span>
            </h1>
            <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '30px auto' }} />
            <p style={{
              fontFamily: F.body,
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(16px,2.3vw,21px)',
              lineHeight: 1.5,
              color: C.taupe,
              margin: '0 auto',
              maxWidth: 560,
            }}>
              From an accident under a tree to the cup in your hand — nearly five thousand years of tea,
              told along a single line. Travel it from left to right.
            </p>
          </div>
        </header>

        {/* ── STANDFIRST ─────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(32px,5vw,60px) 24px clamp(20px,4vw,36px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>N</span>
            o other drink has been with us so long, or changed its costume so often. Tea has been medicine,
            currency, a court's obsession, an empire's habit, and the cause of more than one revolution. Yet
            the leaf never changed — only the way each age chose to meet it. Here is that long morning, hour
            by hour.
          </p>
        </section>

        {/* ── HORIZONTAL TIMELINE (BESPOKE EFFECT) ───────────────────────── */}
        <section style={{ padding: 'clamp(20px,3vw,32px) 0 clamp(30px,5vw,56px)' }}>

          {/* Header row: arrow hint + era ribbon */}
          <div style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 clamp(20px,5vw,40px) 18px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 28, color: C.gold, lineHeight: 1 }}>→</span>
              <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>
                Drag, swipe, or use the arrows
              </span>
            </div>

            {/* Era ribbon jump buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.5vw,16px)', flexWrap: 'wrap' }}>
              {ERA_LABELS.map((label, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <span aria-hidden="true" style={{ color: 'rgba(168,135,77,0.3)' }}>·</span>}
                  <button
                    ref={el => { ribbonRefs.current[i] = el; }}
                    data-era={i}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontFamily: F.mono,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: activeEra === i ? C.gold : C.taupe,
                      fontWeight: activeEra === i ? 500 : 400,
                      transition: 'color 240ms',
                    }}
                  >
                    {label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Rail + track */}
          <div style={{ position: 'relative' }}>
            {/* Scrollable rail */}
            <div
              ref={railRef}
              style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollSnapType: 'x proximity',
                cursor: 'grab',
                WebkitOverflowScrolling: 'touch',
                // hide scrollbar
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              } as React.CSSProperties}
            >
              {/* Track — flex row of era panels */}
              <div
                ref={trackRef}
                style={{
                  position: 'relative',
                  display: 'flex',
                  width: 'max-content',
                  height: 'clamp(580px,82vh,720px)',
                  borderTop: '1px solid rgba(168,135,77,0.14)',
                  borderBottom: '1px solid rgba(168,135,77,0.14)',
                  background: 'linear-gradient(180deg,#161109,#14100b)',
                }}
              >
                {/* Faint full-width spine baseline */}
                <div aria-hidden="true" style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '74%',
                  height: 1,
                  background: 'rgba(168,135,77,0.18)',
                }} />
                {/* Gold ink fill — drawn rightward as the user scrolls */}
                <div
                  ref={spinefillRef}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '74%',
                    height: 1,
                    width: 0,
                    background: `linear-gradient(90deg,${C.gold},var(--tj-gold-lt,#c6a667))`,
                    boxShadow: '0 0 9px rgba(168,135,77,0.5)',
                  }}
                />

                {/* Era panels */}
                {ERA_DATA.map((era) => (
                  <EraPanel
                    key={era.index}
                    era={era}
                    charRef={el => { charRefs.current[era.index] = el; }}
                  />
                ))}
              </div>
            </div>

            {/* Prev arrow — positioned at the spine line */}
            <button
              ref={prevRef}
              aria-label="Earlier"
              style={{
                position: 'absolute',
                left: 'clamp(8px,2vw,20px)',
                top: 'calc(74% + 1px)',
                transform: 'translateY(-50%)',
                zIndex: 4,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid rgba(168,135,77,0.3)',
                background: 'rgba(20,16,11,0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 240ms, border-color 240ms',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="#a8874d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Next arrow — animated with tjNudge (injected locally) */}
            <button
              ref={nextRef}
              aria-label="Later"
              style={{
                position: 'absolute',
                right: 'clamp(8px,2vw,20px)',
                top: 'calc(74% + 1px)',
                transform: 'translateY(-50%)',
                zIndex: 4,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid rgba(168,135,77,0.3)',
                background: 'rgba(20,16,11,0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 240ms, border-color 240ms',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ animation: 'tjNudge 2.6s ease-in-out infinite' }}
              >
                <path d="M5 2l5 5-5 5" stroke="#a8874d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        {/* ── PULL QUOTE ─────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{
            fontFamily: F.display,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(28px,4.8vw,54px)',
            lineHeight: 1.18,
            color: C.cream,
            margin: '0 auto',
            maxWidth: 860,
          }}>
            "Every age believed it had found the right way to drink tea. Every age was right — for its morning."
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* ── THREE WAYS ─────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 34 }}>
            <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>三</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
            <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>
              Three ways to drink the same leaf
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 'clamp(18px,3vw,28px)' }}>
            {[
              { char: '煮', title: 'Boiled · Tang',    body: 'Cakes roasted, ground, and simmered — sometimes with salt. Tea as a warm, savoury brew.' },
              { char: '點', title: 'Whisked · Song',   body: 'Powder beaten with water to a bright froth. The ancestor of matcha, lost in China, kept in Japan.' },
              { char: '泡', title: 'Steeped · Ming → now', body: 'Whole leaves loose in hot water. The simplest method — and the one that finally conquered the world.' },
            ].map(({ char, title, body }) => (
              <div key={char} data-reveal style={{
                border: '1px solid rgba(168,135,77,0.16)',
                borderRadius: 4,
                background: 'linear-gradient(160deg,#1d1810,#15110b)',
                padding: 'clamp(22px,3vw,30px)',
              }}>
                <div style={{ fontFamily: F.cn, fontSize: 26, color: C.gold, marginBottom: 14 }}>{char}</div>
                <h3 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 24, color: C.cream, margin: '0 0 6px' }}>{title}</h3>
                <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.6, color: C.dim, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CLOSING ────────────────────────────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 24px clamp(40px,6vw,72px)' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            The line runs on past us, of course — some future age will find its own way to meet the leaf.
            But this much has held for fifty centuries: someone heats water, waits, and is, for a moment,
            restored. Tea is the oldest morning we still keep.
          </p>
          <div style={{ marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Words by Teajia &nbsp;·&nbsp; A History of Tea &nbsp;·&nbsp; N°07
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default HistoryTenThousandMornings;
