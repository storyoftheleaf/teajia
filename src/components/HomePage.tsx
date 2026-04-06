import React, { useRef, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogoEmblem } from './Logos/LogoEmblem';
import { LogoText } from './Logos/LogoText';
import { fetchNetworkStores } from '../lib/storefrontApi';
import type { Account } from '../types';
import { Icons } from './Icons';

// Track across mounts — animation plays once per session
let hasAnimated = false;

interface HomePageProps {
  onNavigateToSection: (section: 'MAGAZINE' | 'LEARN' | 'SHOP' | 'OFFERINGS', magazineTab?: 'articles' | 'visual' | 'tea-inspire') => void;
  savedStoryIds?: Record<string, boolean>;
  watchedStoryIds?: Record<string, boolean>;
  onCardClick?: (story: any) => void;
  onToggleSave?: (id: string) => void;
  onShare?: (story: any) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}



/** Character reveal + email capture — scroll-driven, reversible */
interface CharacterRevealCaptureProps {
  act3Ref: React.RefObject<HTMLElement | null>;
}

const CharacterRevealCapture: React.FC<CharacterRevealCaptureProps> = ({ act3Ref }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0 = off screen, 1 = fully revealed
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [email, setEmail] = useState('');
  const isSnapping = useRef(false);
  const rafRef = useRef<number>(0);
  const snapIdxRef = useRef(0);
  const wheelCooldownRef = useRef(false);
  const wheelCooldownTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Discrete stops: Act1 → characters → email capture → exit to Act3
  // Stop 1=Act1, Stop 2=characters+email fully settled, Stop 3=Act3
  const SNAP_POINTS = [0, 0.91, 1.0];

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) { setProgress(1); return; }

    const getScrollable = () => {
      const el = sectionRef.current;
      if (!el) return null;
      return { el, total: el.offsetTop + el.offsetHeight - window.innerHeight };
    };

    // Always animate from the current clean snap point to the target.
    // Never start mid-animation — lock scroll position first so stray
    // scroll events read the right value throughout.
    const animateTo = (targetIdx: number, s: { total: number }) => {
      const startP = SNAP_POINTS[snapIdxRef.current];
      const targetP = SNAP_POINTS[targetIdx];
      if (startP === targetP) return;

      isSnapping.current = true;
      snapIdxRef.current = targetIdx;
      cancelAnimationFrame(rafRef.current);

      // Lock scroll immediately so scroll events are harmless during animation
      window.scrollTo({ top: startP * s.total, behavior: 'instant' });

      const startTime = performance.now();
      // Snappy: ~700ms for full range, never longer than 900ms
      // Reveal snap (0→0.91) plays out the full sequence; exit snap is quicker
      const isExit = targetIdx === SNAP_POINTS.length - 1;
      const duration = Math.max(isExit ? 500 : 1200, Math.abs(targetP - startP) * 1000);

      // Act 3 starts immediately after the spacer: spacer.offsetTop + spacer.offsetHeight
      // = s.total + window.innerHeight. No ref needed — pure geometry.
      const act3ScrollTarget = targetP === 1 ? s.total + window.innerHeight : null;
      const scrollStart = startP * s.total;

      const animate = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(startP + (targetP - startP) * eased);

        // During the exit snap, move the page in sync with the overlay fade —
        // Act 3 is already in position the moment the overlay becomes transparent
        if (act3ScrollTarget !== null) {
          window.scrollTo({
            top: scrollStart + (act3ScrollTarget - scrollStart) * eased,
            behavior: 'instant',
          });
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setProgress(targetP);
          if (act3ScrollTarget === null) {
            window.scrollTo({ top: targetP * s.total, behavior: 'instant' });
          }
          isSnapping.current = false;
          // Don't clear cooldown immediately — restart it from landing
          // so residual mouse momentum can't fire the next snap
          clearTimeout(wheelCooldownTimerRef.current);
          wheelCooldownTimerRef.current = setTimeout(() => {
            wheelCooldownRef.current = false;
          }, 700);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    };

    // ── Mouse wheel: one burst = one stop, period ──
    // Intercept the wheel entirely while in Act 2. Each distinct gesture
    // (detected by a pause between events) advances exactly one stop.
    const onWheel = (e: WheelEvent) => {
      const s = getScrollable();
      if (!s) return;

      const atTop = snapIdxRef.current === 0 && e.deltaY < 0;
      const pastAct2 = snapIdxRef.current === SNAP_POINTS.length - 1 && e.deltaY > 0;
      if (atTop || pastAct2) return;

      e.preventDefault();

      if (isSnapping.current || wheelCooldownRef.current) return;

      const dir = e.deltaY > 0 ? 'down' : 'up';
      const nextIdx = dir === 'down'
        ? Math.min(SNAP_POINTS.length - 1, snapIdxRef.current + 1)
        : Math.max(0, snapIdxRef.current - 1);

      if (nextIdx === snapIdxRef.current) return;

      wheelCooldownRef.current = true;
      clearTimeout(wheelCooldownTimerRef.current);
      // Safety fallback in case animateTo never completes
      wheelCooldownTimerRef.current = setTimeout(() => { wheelCooldownRef.current = false; }, 3000);

      animateTo(nextIdx, s);
    };

    // ── Touch / trackpad: free scroll, snap to nearest on settle ──
    const onScroll = () => {
      if (isSnapping.current) return;
      const s = getScrollable();
      if (!s) return;
      const p = Math.max(0, Math.min(1, window.scrollY / s.total));
      setProgress(p);
      snapIdxRef.current = SNAP_POINTS.reduce((ci, _, i) =>
        Math.abs(SNAP_POINTS[i] - p) < Math.abs(SNAP_POINTS[ci] - p) ? i : ci, 0);
    };

    const snapToNearest = () => {
      if (isSnapping.current) return;
      const s = getScrollable();
      if (!s) return;
      const p = Math.max(0, Math.min(1, window.scrollY / s.total));
      if (p <= 0.01 || p >= 0.99) return;
      const nearestIdx = SNAP_POINTS.reduce((ci, _, i) =>
        Math.abs(SNAP_POINTS[i] - p) < Math.abs(SNAP_POINTS[ci] - p) ? i : ci, 0);
      if (Math.abs(SNAP_POINTS[nearestIdx] - p) < 0.01) return;
      animateTo(nearestIdx, s);
    };

    let debounceTimer: ReturnType<typeof setTimeout>;
    const onScrollDebounced = () => {
      onScroll();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(snapToNearest, 220);
    };

    const supportsScrollEnd = 'onscrollend' in window;
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScrollDebounced, { passive: true });
    if (supportsScrollEnd) window.addEventListener('scrollend', snapToNearest, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScrollDebounced);
      if (supportsScrollEnd) window.removeEventListener('scrollend', snapToNearest);
      clearTimeout(debounceTimer);
      clearTimeout(wheelCooldownTimerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion, act3Ref]);

  // Ease-out curve
  const ease = (t: number) => 1 - Math.pow(1 - t, 2.5);

  // Sequential — logo starts immediately, everything else follows
  // 1. Logo position: descends from top of screen (0% → 40%)
  const logoPosP = ease(Math.max(0, Math.min(1, progress / 0.40)));
  // Logo opacity: starts very transparent, becomes opaque over descent (0% → 40%)
  const logoOpacity = 0.15 + 0.85 * logoPosP;
  // Logo shrinks from 1.6× down to 1× as it descends
  const logoEntryScale = 1.6 - 0.6 * logoPosP;
  // Teaser text: fades in just before 家 starts (42% → 50%)
  const teaserP = Math.max(0, Math.min(1, (progress - 0.42) / 0.08));
  // Logo grows 20% while characters come in (50% → 85%)
  const logoGrowP = Math.max(0, Math.min(1, (progress - 0.50) / 0.35));
  const logoScale = 1 + logoGrowP * 0.2;
  // 2. 家 center: scales from 0 to full (50% → 60%)
  const centerP = ease(Math.max(0, Math.min(1, (progress - 0.50) / 0.10)));
  // 3. 佳 left: slides in (60% → 70%)
  const leftP = ease(Math.max(0, Math.min(1, (progress - 0.60) / 0.10)));
  // 4. 嘉 right: slides in (70% → 80%)
  const rightP = ease(Math.max(0, Math.min(1, (progress - 0.70) / 0.10)));
  // 5. Email: rises from below (82% → 90%), starts immediately on snap 2→3, done by stop 3
  const emailP = ease(Math.max(0, Math.min(1, (progress - 0.82) / 0.08)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up email capture
    if (email.trim()) {
      setEmail('');
    }
  };


  // Show the overlay as soon as any scrolling happens, fade out at the end
  const isVisible = progress > 0;
  // Exit only after stop 3 (0.93 → 1.0) — email stop is always fully opaque
  const exitP = Math.max(0, Math.min(1, (progress - 0.93) / 0.07));
  const overlayOpacity = 1 - exitP;
  // Scroll hint appears partway through the email stop
  const hintP = Math.max(0, Math.min(1, (progress - 0.89) / 0.04)) * overlayOpacity;

  return (
    <>
      {/* Scroll spacer — creates the scroll distance */}
      <div
        ref={sectionRef}
        style={{ height: '160vh' }}
      />

      {/* Fixed overlay — viewport-locked, immune to overflow/layout issues */}
      {isVisible && overlayOpacity > 0.01 && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center px-6 z-30 pointer-events-none pt-[env(safe-area-inset-top)] pb-[calc(44px+env(safe-area-inset-bottom,0px))]"
          style={{
            opacity: overlayOpacity,
            background: 'color-mix(in srgb, black 18%, rgb(var(--tea-bg-rgb)))',
          }}
        >
          {/* Grain texture for depth */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='5' stitchTiles='stitch' seed='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
              opacity: 0.07,
              mixBlendMode: 'overlay',
            }}
          />
          {/* Logo — drops from top, lands above the teaser lines */}
          <div
            className="mb-8"
            style={{
              opacity: logoOpacity,
              transform: `translateY(${(1 - logoPosP) * -400}px) scale(${logoEntryScale})`,
            }}
          >
            <LogoText
              size="hero"
              color="var(--tea-text-sec)"
            />
          </div>

          {/* Teaser lines — hidden until just before characters */}
          <div
            className="flex flex-col items-center gap-[0px] mb-7"
            style={{
              animation: teaserP >= 1 ? 'teaserBreath 4s ease-in-out infinite' : 'none',
              opacity: teaserP,
            }}
          >
            <p
              className="text-[15px] md:text-[16px] tracking-[0.06em] italic text-tea-text-sec"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span className="font-semibold not-italic text-tea-gold">tea</span> &middot; leaf and water
            </p>
            <p
              className="text-[14px] md:text-[15px] tracking-[0.06em] italic mt-[1px] text-tea-text-sec"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span className="font-semibold not-italic text-tea-gold">jiā</span> &middot; one sound, three pillars...
            </p>
          </div>

          {/* Character row — 家 larger, aligned at character baseline */}
          <div className="flex items-end justify-center gap-5 md:gap-8">
            {/* 佳 — slides from left */}
            <div
              className="flex flex-col items-center"
              style={{
                opacity: leftP,
                transform: `translateX(${(1 - leftP) * -60}px)`,
              }}
            >
              <span
                className="text-[48px] sm:text-[69px] leading-none"
                style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}
              >
                佳
              </span>
              <p
                className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span>beauty</span>
                <span>excellence</span>
              </p>
            </div>

            {/* 家 — center anchor, larger */}
            <div
              className="flex flex-col items-center"
              style={{
                opacity: centerP,
                transform: `scale(${centerP})`,
              }}
            >
              <span
                className="text-[48px] sm:text-[69px] leading-none"
                style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}
              >
                家
              </span>
              <p
                className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span>home</span>
                <span>devotion</span>
              </p>
            </div>

            {/* 嘉 — slides from right */}
            <div
              className="flex flex-col items-center"
              style={{
                opacity: rightP,
                transform: `translateX(${(1 - rightP) * 60}px)`,
              }}
            >
              <span
                className="text-[48px] sm:text-[69px] leading-none"
                style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}
              >
                嘉
              </span>
              <p
                className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span>praise</span>
                <span>celebration</span>
              </p>
            </div>
          </div>

          {/* Email capture — input then statement */}
          <div
            className="flex flex-col items-center mt-6 sm:mt-12 pointer-events-auto w-full max-w-[280px]"
            style={{
              opacity: emailP,
              transform: `translateY(${(1 - emailP) * 20}px)`,
            }}
          >
            <p
              className="text-base italic font-light text-tea-text-dim"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
            >
              stay connected
            </p>
            <p
              className="text-base italic font-light mt-1 text-tea-text-sec"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
            >
              it's nothing without you
            </p>

            <form
              onSubmit={handleSubmit}
              className="w-full relative mt-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your email"
                className="w-full bg-transparent text-base font-light text-center text-tea-text outline-none pb-2.5 pl-7 pr-10 transition-colors placeholder:italic placeholder:text-tea-text-dim"
                style={{
                  fontFamily: 'var(--font-display)',
                  border: 'none',
                  borderBottom: '1px solid rgb(var(--tea-gold-rgb) / 0.25)',
                  borderRadius: 0,
                  letterSpacing: '0.04em',
                }}
                onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'rgb(var(--tea-gold-rgb) / 0.5)'; }}
                onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgb(var(--tea-gold-rgb) / 0.25)'; }}
              />
              <button
                type="submit"
                className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors duration-300 text-tea-text-dim hover:text-tea-gold"
                aria-label="Submit email"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M10 4.5L13.5 8 10 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>

          {/* Scroll hint — teases Act 3 */}
          <div
            className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2"
            style={{ opacity: hintP }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.25em] text-tea-text-dim"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              find a table
            </p>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              className="text-tea-gold/40"
              style={{ animation: 'teaserBreath 3s ease-in-out infinite' }}
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
};

/** Network directory strip — surfaces the lineage model on the home page. */
const NetworkDirectoryStrip: React.FC<{ sectionRef: React.RefObject<HTMLElement | null> }> = ({ sectionRef }) => {
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress: 0 when top of section is at bottom of viewport, 1 when top reaches 80% up
      const raw = (vh - rect.top) / (vh * 0.6);
      setRevealProgress(Math.max(0, Math.min(1, raw)));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sectionRef]);

  const { data: stores = [] } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 5,
  });

  if (stores.length === 0) return null;

  const ease = (t: number) => 1 - Math.pow(1 - t, 2.5);
  const easedProgress = ease(revealProgress);

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      aria-label="Teajia network"
      className="w-full max-w-5xl mx-auto px-6 pt-0 pb-16 md:pb-24 text-center"
      style={{
        opacity: easedProgress,
        transform: `translateY(${(1 - easedProgress) * 40}px)`,
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-tea-text-dim mb-3">
        The Teajia network
      </p>
      <h2
        className="text-2xl md:text-4xl text-tea-text mb-3"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Find a table near you
      </h2>
      <p className="text-sm md:text-base text-tea-text-sec italic mb-8 max-w-xl mx-auto">
        A lineage of tea houses — each independent, each with its own voice.
      </p>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 text-left mb-8">
        {stores.slice(0, 4).map((store, i) => {
          // Stagger each card: starts after section is 40% revealed, each card 8% apart
          const cardP = ease(Math.max(0, Math.min(1, (revealProgress - 0.4 - i * 0.08) / 0.2)));
          return (
          <li key={store.id} style={{ opacity: cardP, transform: `translateY(${(1 - cardP) * 20}px)` }}>
            <Link
              to={`/store/${store.slug}`}
              className="card-grid-item block p-5 group transition-colors hover:border-tea-gold"
            >
              <div className="flex items-start gap-4">
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt=""
                    className="w-12 h-12 object-contain flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-tea-gold">
                    <Icons.Seal className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg text-tea-text mb-0.5 group-hover:text-tea-gold transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {store.name}
                  </h3>
                  {(store.location_city || store.location_country) && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">
                      {[store.location_city, store.location_country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {store.tagline && (
                    <p className="text-xs text-tea-text-sec italic leading-snug">
                      {store.tagline}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          </li>
          );
        })}
      </ul>

      {stores.length > 4 && (
        <Link
          to="/find-a-table"
          className="inline-block text-sm text-tea-gold hover:text-tea-gold-lt transition-colors"
        >
          Browse all {stores.length} tables &rarr;
        </Link>
      )}
    </section>
  );
};

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSection,
  onAccountClick,
  onCartClick,
  cartItemCount = 0,
}) => {
  const shouldAnimate = !hasAnimated;
  const mountRef = useRef(false);
  const act3Ref = useRef<HTMLElement>(null);
  if (!mountRef.current) {
    mountRef.current = true;
    requestAnimationFrame(() => { hasAnimated = true; });
  }

  const initial = (vals: Record<string, any>) => shouldAnimate ? vals : false;

  // Scroll-driven fade-out for Act 1 + glow position + sticky bar visibility
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [glowY, setGlowY] = useState(1); // 1 = bottom, 0 = top
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      // Fade out over the first 40% of viewport height
      const fadeEnd = vh * 0.4;
      setFadeOpacity(Math.max(0, 1 - scrollY / fadeEnd));
      // Glow travels from bottom to top over the first 60% of viewport scroll
      const glowEnd = vh * 0.6;
      setGlowY(Math.max(0, 1 - scrollY / glowEnd));
      // Show sticky bar once scrolled past the hero (80% of vh)
      setShowStickyBar(scrollY > vh * 0.8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <Helmet>
        <title>Teajia — Fine Tea & Teaware</title>
        <meta name="description" content="Every culture brings wisdom to the table. Teajia is where it is served." />
      </Helmet>

      {/* Sticky utility bar — appears on mobile after scrolling past hero */}
      <div
        className={`lg:hidden fixed top-[env(safe-area-inset-top)] left-0 right-0 z-sticky flex items-center justify-end px-4 h-11 transition-all duration-300 ${
          showStickyBar
            ? 'opacity-100 translate-y-0 pointer-events-auto bg-tea-bg/90 backdrop-blur-md border-b border-tea-border'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        {onCartClick && (
          <button
            onClick={onCartClick}
            className="relative min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={cartItemCount > 0 ? `View cart, ${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'View cart'}
          >
            <Icons.Bag className="w-5 h-5 text-tea-text-sec" strokeWidth={1.8} />
            {cartItemCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-tea-gold text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </span>
            )}
          </button>
        )}
        {onAccountClick && (
          <button
            onClick={onAccountClick}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Account"
          >
            <Icons.User className="w-5 h-5 text-tea-text-sec" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Act 1 bottom glow — fixed to viewport bottom, fades out on scroll */}
      <div
        className="fixed bottom-0 left-0 w-screen h-[200px] pointer-events-none z-[2]"
        style={{
          background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgb(var(--tea-gold-rgb) / 0.18) 0%, rgb(var(--tea-gold-rgb) / 0.05) 50%, transparent 100%)',
          opacity: glowY,
        }}
      />

      {/* Scroll-driven glow — rises to top of viewport as you enter Act 2 */}
      <div
        className="fixed left-0 w-screen h-[200px] pointer-events-none z-[2]"
        style={{
          top: 0,
          background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgb(var(--tea-gold-rgb) / 0.18) 0%, rgb(var(--tea-gold-rgb) / 0.05) 50%, transparent 100%)',
          opacity: Math.max(0, 1 - glowY),
        }}
      />

      {/* ── Act 1: Above the fold ── */}
      <div
        className="relative flex flex-col items-center justify-between px-8"
        style={{ minHeight: 'calc(100dvh - 44px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))', opacity: fadeOpacity }}
      >

        {/* Top spacer */}
        <div />

        {/* Center content */}
        <div className="flex flex-col items-center">
          {/* Emblem with warm ambient glow */}
          <motion.div
            className="relative flex items-center justify-center"
            initial={initial({ opacity: 0, scale: 0.92 })}
            animate={{ opacity: 1, scale: 1 }}
            transition={shouldAnimate ? { duration: 1.0, delay: 0.1, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          >
            <div
              className="absolute pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgb(var(--tea-gold-rgb) / 0.08) 0%, rgb(var(--tea-gold-rgb) / 0.03) 40%, transparent 70%)',
                width: '200px',
                height: '200px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            <button
              onClick={() => onAccountClick?.()}
              className="bg-transparent border-none cursor-default p-0"
              aria-label="Home"
              tabIndex={-1}
            >
              <LogoEmblem
                size={76}
                color="var(--tea-gold)"
                className="opacity-70"
              />
            </button>
          </motion.div>

          {/* Statement */}
          <motion.h1
            className="text-tea-text max-w-[380px] text-[28px] md:text-[34px] leading-[1.35] tracking-[0.01em] font-normal mt-8 sm:mt-12"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={initial({ opacity: 0, y: 10 })}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldAnimate ? { duration: 0.8, delay: 0.35, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          >
            Tea deepens with what you bring to the table and what you leave behind.
          </motion.h1>

          {/* Grounding lines */}
          <motion.div
            className="flex flex-col items-center mt-6 sm:mt-12"
            initial={initial({ opacity: 0, y: 6 })}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldAnimate ? { duration: 0.6, delay: 0.75 } : { duration: 0 }}
          >
            {[
              { accent: 'Source', rest: ' your tea.', section: 'SHOP' as const },
              { accent: 'Discover', rest: ' the stories.', section: 'MAGAZINE' as const },
              { accent: 'Deepen', rest: ' your practice.', section: 'LEARN' as const },
              { accent: 'Create', rest: ' the spaces to share.', section: 'OFFERINGS' as const },
            ].map((item) => (
              <button
                key={item.section}
                onClick={() => onNavigateToSection(item.section)}
                className="text-tea-text-sec/90 hover:text-tea-gold transition-colors duration-300 cursor-pointer bg-transparent border-none text-[15px] md:text-[16px] leading-[1.7] tracking-[0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="font-semibold text-tea-gold">{item.accent}</span>{item.rest}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Teaser — the cliffhanger that invites scrolling */}
        <motion.div
          className="flex flex-col items-center pb-4 lg:pb-[18px]"
          style={{ animation: 'teaserBreath 4s ease-in-out infinite' }}
          initial={initial({ opacity: 0 })}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.6, delay: 1.2 } : { duration: 0 }}
        >
          <p
            className="text-[15px] md:text-[16px] tracking-[0.06em] italic text-tea-text-sec"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <span className="font-semibold not-italic text-tea-gold">tea</span> &middot; leaf and water
          </p>
          <p
            className="text-[14px] md:text-[15px] tracking-[0.06em] italic mt-[1px] text-tea-text-sec"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <span className="font-semibold not-italic text-tea-gold">jiā</span> &middot; one sound, three pillars...
          </p>
        </motion.div>

      </div>

      {/* ── Act 2: Character reveal + email capture ── */}
      <CharacterRevealCapture act3Ref={act3Ref} />

      {/* ── Act 3: Network directory — Find a table ── */}
      <NetworkDirectoryStrip sectionRef={act3Ref} />
    </div>
  );
};
