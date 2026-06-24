/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  IMMERSIVE READER — shared primitives                             ║
 * ║                                                                   ║
 * ║  The espresso-and-gold scrolling article system for the Read      ║
 * ║  section. Ported pixel-faithfully from the Claude Design mockups  ║
 * ║  (tea-article-redesign). These are full-page vertical reads with  ║
 * ║  drop caps, marginalia, pull quotes, scroll-reveal fade-ups, a    ║
 * ║  reading-progress bar, a grain texture, and a gold accent that    ║
 * ║  can shift to copper / jade / claret.                             ║
 * ║                                                                   ║
 * ║  Distinct from the 4:5 paginated carousel at /article/:slug.      ║
 * ║  Imagery is elegant typographic / SVG plates — built to be        ║
 * ║  swapped for real photography later.                              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

// ─── Palette ─────────────────────────────────────────────────────────────────
// The design's exact literal values, kept scoped to the immersive reader so the
// dark editorial palette stays faithful to the mockups regardless of the site
// theme. `gold` / `goldLt` are driven by a CSS variable so the accent tweak
// can swap them live.
export const C = {
  bg: '#14100b',
  ink: '#ede4d4',
  cream: '#f3ead9',
  warm: '#e3d6bd',
  taupe: '#cdc0a8',
  dim: '#80735f',
  gold: 'var(--tj-gold,#a8874d)',
  goldLt: 'var(--tj-gold-lt,#c6a667)',
} as const;

export const F = {
  display: "'Cormorant Garamond',serif",
  body: "'Lora',Georgia,serif",
  ui: "'Plus Jakarta Sans',sans-serif",
  mono: "'IBM Plex Mono',monospace",
  cn: "'Noto Serif SC',serif",
} as const;

export const ACCENTS = ['#a8874d', '#b06a3c', '#6f8f6a', '#9a5246'] as const;

// Grain SVG data-URI (matches the mockup's fractal-noise overlay).
const grainUri =
  "data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export function grainCss(baseFreq = '0.8', size = 120): React.CSSProperties {
  const uri = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${baseFreq}' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`;
  return {
    position: 'absolute',
    inset: 0,
    opacity: 0.07,
    mixBlendMode: 'overlay',
    backgroundImage: `url("${uri}")`,
    backgroundSize: `${size}px`,
  };
}

// ─── Accent application ──────────────────────────────────────────────────────
export function applyAccent(g: string) {
  const root = document.documentElement;
  root.style.setProperty('--tj-gold', g);
  root.style.setProperty('--tj-gold-lt', `color-mix(in oklab, ${g} 68%, #f0e6d0)`);
}

export function clearAccent() {
  const root = document.documentElement;
  root.style.removeProperty('--tj-gold');
  root.style.removeProperty('--tj-gold-lt');
}

// ─── Scroll reveal hook ──────────────────────────────────────────────────────
// Returns a ref to attach to the article root. Any descendant carrying
// `data-reveal` fades + lifts in as it enters the viewport. `deps` lets a
// caller re-arm the observer after switching directions.
export function useReveals(deps: React.DependencyList = []) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'none';
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -7% 0px' },
    );
    const raf = requestAnimationFrame(() => {
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        if (el.dataset.tjRevealed) return;
        el.dataset.tjRevealed = '1';
        el.style.opacity = '0';
        el.style.transform = 'translateY(26px)';
        el.style.transition =
          'opacity 900ms cubic-bezier(0.22,0.61,0.36,1), transform 900ms cubic-bezier(0.22,0.61,0.36,1)';
        io.observe(el);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rootRef;
}

// ─── Reading progress hook ───────────────────────────────────────────────────
// Drives the gold bar under the nav. Optional `onScroll` lets a page hook in
// extra scroll-linked work (e.g. the Thread's drawing line).
export function useReadingProgress(onScroll?: () => void) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const handle = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      setPct(Math.max(0, Math.min(1, p)) * 100);
      onScroll?.();
    };
    window.addEventListener('scroll', handle, { passive: true });
    handle();
    return () => window.removeEventListener('scroll', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return pct;
}

// ─── Page-level effects ──────────────────────────────────────────────────────
// Locks the site background to the espresso tone while an immersive read is
// mounted (the rest of the app may be lighter), and injects the keyframes the
// designs rely on. Restores everything on unmount.
export function useImmersiveChrome(accent: string) {
  useEffect(() => {
    const prevBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    const prevOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.body.style.background = C.bg;
    document.documentElement.style.background = C.bg;
    // Stop the browser's native pull-to-refresh from firing when a reader drags
    // down from the top of the article. These are document-scrolled long-reads;
    // the overscroll should do nothing, not reload the page.
    document.documentElement.style.overscrollBehaviorY = 'contain';
    applyAccent(accent);

    const style = document.createElement('style');
    style.setAttribute('data-tj-immersive', '');
    style.textContent = `
      @keyframes tjFloat{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(7px); } }
      @keyframes tjFloatX{ 0%,100%{ transform:translate(-50%,0); } 50%{ transform:translate(-50%,7px); } }
      @keyframes tjFade{ from{ opacity:0; } to{ opacity:1; } }
      @keyframes tjBreath{ 0%,100%{ transform:scale(0.72); opacity:0.45; } 50%{ transform:scale(1); opacity:1; } }
      .tj-immersive ::selection{ background:rgba(168,135,77,0.28); color:#f3ead9; }
      .tj-tabs{ scrollbar-width:none; }
      .tj-tabs::-webkit-scrollbar{ display:none; }
      .tj-morecard{ transition:border-color 240ms; }
      .tj-morecard:hover{ border-color:rgba(168,135,77,0.4) !important; }
      .tj-tab:hover{ color:#ede4d4 !important; }
      .tj-explore-link{ transition:color 200ms; }
      .tj-explore-link:hover{ color:var(--tj-gold,#a8874d) !important; }
    `;
    document.head.appendChild(style);

    return () => {
      document.body.style.background = prevBg;
      document.documentElement.style.background = prevHtmlBg;
      document.documentElement.style.overscrollBehaviorY = prevOverscroll;
      clearAccent();
      style.remove();
    };
    // accent re-applied separately below so changing it doesn't tear down chrome
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
}

// ─── Root wrapper ────────────────────────────────────────────────────────────
export const ImmersiveRoot: React.FC<{ children: React.ReactNode; rootRef?: React.Ref<HTMLDivElement> }> = ({
  children,
  rootRef,
}) => (
  <div
    ref={rootRef}
    className="tj-immersive"
    style={{
      position: 'relative',
      background: C.bg,
      color: C.ink,
      fontFamily: F.body,
      overflowX: 'hidden',
      minHeight: '100vh',
    }}
  >
    {/* fixed grain texture */}
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        opacity: 0.05,
        mixBlendMode: 'overlay',
        backgroundImage: `url("${grainUri}")`,
        backgroundSize: '170px',
      }}
    />
    {children}
  </div>
);

// ─── Nav bar (single-article variant) ────────────────────────────────────────
export const ImmersiveNav: React.FC<{
  eyebrow: string; // e.g. "Conversations · N°02"
  progress: number;
  backTo?: string;
}> = ({ eyebrow, progress, backTo = '/read' }) => (
  <nav
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '13px clamp(18px,4vw,40px)',
      background: 'rgba(20,16,11,0.72)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(168,135,77,0.12)',
    }}
  >
    <Link to={backTo} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit' }}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M9.5 3.5L5 7.5l4.5 4" stroke="#a8874d" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink }}>
        Teajia
      </span>
    </Link>
    <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap' }}>
      {eyebrow}
    </span>
    <ProgressTrack progress={progress} />
  </nav>
);

export const ProgressTrack: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%', background: 'rgba(168,135,77,0.08)' }}>
    <div
      style={{
        height: '100%',
        width: `${progress}%`,
        background: `linear-gradient(90deg,${C.gold},${C.goldLt})`,
        transition: 'width 90ms linear',
      }}
    />
  </div>
);

// ─── Accent tweak control (retired) ──────────────────────────────────────────
// The reader-facing accent swatch row (gold / copper / jade / claret) was
// removed by design decision: every Read page stays on the gold accent
// (ACCENTS[0], the default the pages already initialise with). The component is
// kept as a no-op so the existing call sites compile unchanged; nothing renders.
export const AccentSwatches: React.FC<{ accent: string; setAccent: (a: string) => void }> = () => null;

// ─── "More from The Art of Tea" footer ─────────────────────────────────────
export type MoreLink = { to: string; kicker: string; title: string; blurb: string };

export const MoreFooter: React.FC<{ links: MoreLink[] }> = ({ links }) => (
  <footer style={{ borderTop: '1px solid rgba(168,135,77,0.14)', padding: 'clamp(40px,6vw,72px) clamp(20px,5vw,56px) clamp(64px,9vw,110px)' }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.gold, marginBottom: 26 }}>
        More from The Art of Tea
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 'clamp(14px,2vw,22px)' }}>
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="tj-morecard"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(168,135,77,0.16)',
              borderRadius: 4,
              padding: 24,
              background: 'linear-gradient(160deg,#1b160f,#15110b)',
            }}
          >
            <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginBottom: 12 }}>{l.kicker}</div>
            <div style={{ fontFamily: F.display, fontSize: 25, color: C.ink, lineHeight: 1.1 }}>{l.title}</div>
            <div style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13.5, color: C.dim, marginTop: 8 }}>{l.blurb}</div>
          </Link>
        ))}
      </div>
    </div>
  </footer>
);
