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

// Plays once per session
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

// ─── Act 2: Character reveal ──────────────────────────────────────────────────
// CSS-transition driven. `active` flips when user snaps to this section.
const CharacterReveal: React.FC<{ active: boolean }> = ({ active }) => {
  const [email, setEmail] = useState('');

  // Every element starts invisible and slides/scales in when active
  const tr = (delayMs: number, fromTransform = 'translateY(22px)'): React.CSSProperties => ({
    opacity: active ? 1 : 0,
    transform: active ? 'none' : fromTransform,
    transition: `opacity 0.65s cubic-bezier(0.22,1,0.36,1) ${delayMs}ms, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up email capture
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center px-6 text-center"
      style={{
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(44px + env(safe-area-inset-bottom, 0px))',
        background: 'color-mix(in srgb, black 14%, rgb(var(--tea-bg-rgb)))',
      }}
    >
      {/* Grain for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='5' stitchTiles='stitch' seed='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
          opacity: 0.07,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Logo drops from above */}
      <div className="mb-8" style={tr(0, 'translateY(-28px) scale(1.1)')}>
        <LogoText size="hero" color="var(--tea-text-sec)" />
      </div>

      {/* Teaser lines */}
      <div className="flex flex-col items-center mb-7" style={tr(160)}>
        <p className="text-[15px] md:text-[16px] tracking-[0.06em] italic text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
          <span className="font-semibold not-italic text-tea-gold">tea</span> &middot; leaf and water
        </p>
        <p className="text-[14px] md:text-[15px] tracking-[0.06em] italic mt-[1px] text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
          <span className="font-semibold not-italic text-tea-gold">jiā</span> &middot; one sound, three pillars...
        </p>
      </div>

      {/* Characters */}
      <div className="flex items-end justify-center gap-5 md:gap-8">
        <div className="flex flex-col items-center" style={tr(340, 'translateX(-44px)')}>
          <span className="text-[48px] sm:text-[69px] leading-none" style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}>佳</span>
          <p className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
            <span>beauty</span><span>excellence</span>
          </p>
        </div>
        <div className="flex flex-col items-center" style={tr(260, 'scale(0.7)')}>
          <span className="text-[48px] sm:text-[69px] leading-none" style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}>家</span>
          <p className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
            <span>home</span><span>devotion</span>
          </p>
        </div>
        <div className="flex flex-col items-center" style={tr(340, 'translateX(44px)')}>
          <span className="text-[48px] sm:text-[69px] leading-none" style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}>嘉</span>
          <p className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
            <span>praise</span><span>celebration</span>
          </p>
        </div>
      </div>

      {/* Email capture */}
      <div
        className="flex flex-col items-center mt-8 sm:mt-12 w-full max-w-[280px] pointer-events-auto"
        style={tr(480)}
      >
        <p className="text-base italic font-light text-tea-text-dim" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>stay connected</p>
        <p className="text-base italic font-light mt-1 text-tea-text-sec" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>it's nothing without you</p>
        <form onSubmit={handleSubmit} className="w-full relative mt-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your email"
            className="w-full bg-transparent text-base font-light text-center text-tea-text outline-none pb-2.5 pl-7 pr-10 placeholder:italic placeholder:text-tea-text-dim"
            style={{ fontFamily: 'var(--font-display)', border: 'none', borderBottom: '1px solid rgb(var(--tea-gold-rgb) / 0.25)', borderRadius: 0, letterSpacing: '0.04em' }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'rgb(var(--tea-gold-rgb) / 0.5)'; }}
            onBlur={e => { e.currentTarget.style.borderBottomColor = 'rgb(var(--tea-gold-rgb) / 0.25)'; }}
          />
          <button type="submit" className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center bg-transparent border-none cursor-pointer text-tea-text-dim hover:text-tea-gold transition-colors duration-300" aria-label="Submit email">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M10 4.5L13.5 8 10 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-[calc(44px+env(safe-area-inset-bottom,0px)+20px)] left-0 right-0 flex flex-col items-center gap-2"
        style={tr(680)}
      >
        <p className="text-[11px] uppercase tracking-[0.25em] text-tea-text-dim" style={{ fontFamily: 'var(--font-body)' }}>find a table</p>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-tea-gold/40" style={{ animation: 'arrowFloat 5s ease-in-out infinite' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

// ─── Act 3: Network directory ─────────────────────────────────────────────────
// IntersectionObserver triggers CSS entrance animations when the section enters view.
const NetworkDirectoryStrip: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.disconnect(); } },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: stores = [] } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 5,
  });

  if (stores.length === 0) return null;

  const enter = (delayMs: number, from = 'translateY(36px)'): React.CSSProperties => ({
    opacity: active ? 1 : 0,
    transform: active ? 'none' : from,
    transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delayMs}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
  });

  return (
    <section
      ref={sectionRef}
      aria-label="Teajia network"
      className="w-full max-w-5xl mx-auto px-6 pt-16 pb-16 md:pb-24 text-center"
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-tea-text-dim mb-3" style={enter(0)}>
        The Teajia network
      </p>
      <h2 className="text-2xl md:text-4xl text-tea-text mb-3" style={{ fontFamily: 'var(--font-display)', ...enter(80) }}>
        Find a table near you
      </h2>
      <p className="text-sm md:text-base text-tea-text-sec italic mb-10 max-w-xl mx-auto" style={enter(180)}>
        A lineage of tea houses — each independent, each with its own voice.
      </p>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 text-left mb-8">
        {stores.slice(0, 4).map((store, i) => (
          <li key={store.id} style={enter(300 + i * 80)}>
            <Link to={`/store/${store.slug}`} className="card-grid-item block p-5 group transition-colors hover:border-tea-gold">
              <div className="flex items-start gap-4">
                {store.logo_url ? (
                  <img src={store.logo_url} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 text-tea-gold">
                    <Icons.Seal className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg text-tea-text mb-0.5 group-hover:text-tea-gold transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                    {store.name}
                  </h3>
                  {(store.location_city || store.location_country) && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-1">
                      {[store.location_city, store.location_country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {store.tagline && (
                    <p className="text-xs text-tea-text-sec italic leading-snug">{store.tagline}</p>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {stores.length > 4 && (
        <div style={enter(300 + Math.min(stores.length, 4) * 80)}>
          <Link to="/find-a-table" className="inline-block text-sm text-tea-gold hover:text-tea-gold-lt transition-colors">
            Browse all {stores.length} tables &rarr;
          </Link>
        </div>
      )}
    </section>
  );
};

// ─── HomePage ─────────────────────────────────────────────────────────────────
export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSection,
  onAccountClick,
  onCartClick,
  cartItemCount = 0,
}) => {
  const shouldAnimate = !hasAnimated;
  const mountRef = useRef(false);
  if (!mountRef.current) {
    mountRef.current = true;
    requestAnimationFrame(() => { hasAnimated = true; });
  }

  const initial = (vals: Record<string, any>) => shouldAnimate ? vals : false;

  // Section refs for snap targets
  const act1Ref = useRef<HTMLDivElement>(null);
  const act2Ref = useRef<HTMLDivElement>(null);
  const act3Ref = useRef<HTMLDivElement>(null);

  // Which act is currently active (0=hero, 1=characters, 2=network)
  const [activeAct, setActiveAct] = useState(0);

  // ── Snap scroll controller ──────────────────────────────────────────────────
  useEffect(() => {
    let current = 0;
    let snapping = false;
    let cooldown = false;
    let accumulated = 0;
    let resetTimer: ReturnType<typeof setTimeout>;
    let rafId = 0;

    const getTop = (ref: React.RefObject<HTMLElement | null>) => {
      const el = ref.current;
      if (!el) return 0;
      return Math.round(el.getBoundingClientRect().top + window.scrollY);
    };

    const snapTo = (idx: number) => {
      const tops = [getTop(act1Ref), getTop(act2Ref), getTop(act3Ref)];
      const target = tops[idx];
      const start = window.scrollY;

      if (Math.abs(target - start) < 4) {
        current = idx;
        setActiveAct(idx);
        return;
      }

      snapping = true;
      cancelAnimationFrame(rafId);

      const duration = 820;
      const t0 = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        // expo-out: launches fast, glides gently into landing
        const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        window.scrollTo(0, start + (target - start) * e);
        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          window.scrollTo(0, target);
          snapping = false;
          current = idx;
          setActiveAct(idx);
          cooldown = true;
          setTimeout(() => { cooldown = false; }, 600);
        }
      };
      rafId = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      // Allow natural scroll once deep into Act 3
      if (current === 2 && e.deltaY > 0) return;
      // Allow natural scroll up from Act 1 top
      if (current === 0 && e.deltaY < 0 && window.scrollY <= 0) return;

      // Suppress scroll while snapping or in cooldown
      if (snapping || cooldown) {
        if (current < 2 || e.deltaY < 0) e.preventDefault();
        return;
      }

      // Accumulate — prevents trackpad jitter from firing multiple snaps
      accumulated += e.deltaY;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { accumulated = 0; }, 150);

      if (Math.abs(accumulated) < 25) {
        if (current < 2) e.preventDefault();
        return;
      }

      const dir = accumulated > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(2, current + dir));
      if (next === current) return;

      e.preventDefault();
      accumulated = 0;
      snapTo(next);
    };

    // Snap to nearest on scrollend — catches trackpad deceleration
    const onScrollEnd = () => {
      if (snapping || cooldown) return;
      const scrollY = window.scrollY;
      const tops = [getTop(act1Ref), getTop(act2Ref), getTop(act3Ref)];

      // Don't snap if the user has scrolled well into Act 3
      if (scrollY > tops[2] + window.innerHeight * 0.4) return;

      let nearest = current;
      let nearestDist = Infinity;
      tops.forEach((top, i) => {
        const d = Math.abs(scrollY - top);
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      });

      if (nearestDist > 8) snapTo(nearest);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    if ('onscrollend' in window) window.addEventListener('scrollend', onScrollEnd as EventListener, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      if ('onscrollend' in window) window.removeEventListener('scrollend', onScrollEnd as EventListener);
      clearTimeout(resetTimer);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Sticky bar: only needed in Act 3 where the top nav is far away
  const showStickyBar = activeAct >= 2;

  return (
    <div className="flex flex-col items-center text-center">
      <Helmet>
        <title>Teajia — Fine Tea & Teaware</title>
        <meta name="description" content="Every culture brings wisdom to the table. Teajia is where it is served." />
      </Helmet>

      {/* Sticky utility bar — Act 3 only */}
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
          <button onClick={onAccountClick} className="min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Account">
            <Icons.User className="w-5 h-5 text-tea-text-sec" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* ── Act 1: Hero ── */}
      <div
        ref={act1Ref}
        className="relative flex flex-col items-center justify-between px-8 w-full"
        style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(44px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Ambient glow */}
        <div
          className="fixed bottom-0 left-0 w-screen h-[200px] pointer-events-none z-[2]"
          style={{
            background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgb(var(--tea-gold-rgb) / 0.18) 0%, rgb(var(--tea-gold-rgb) / 0.05) 50%, transparent 100%)',
            opacity: activeAct === 0 ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />

        <div />

        {/* Center content */}
        <div className="flex flex-col items-center">
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
                width: '200px', height: '200px',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            <button onClick={() => onAccountClick?.()} className="bg-transparent border-none cursor-default p-0" aria-label="Home" tabIndex={-1}>
              <LogoEmblem size={76} color="var(--tea-gold)" className="opacity-70" />
            </button>
          </motion.div>

          <motion.h1
            className="text-tea-text max-w-[380px] text-[28px] md:text-[34px] leading-[1.35] tracking-[0.01em] font-normal mt-8 sm:mt-12"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={initial({ opacity: 0, y: 10 })}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldAnimate ? { duration: 0.8, delay: 0.35, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          >
            Tea deepens with what you bring to the table and what you leave behind.
          </motion.h1>

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
            ].map(item => (
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

        {/* Teaser — pulses to invite scrolling */}
        <motion.div
          className="flex flex-col items-center pb-4 lg:pb-[18px]"
          style={{ animation: 'teaserBreath 4s ease-in-out infinite' }}
          initial={initial({ opacity: 0 })}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.6, delay: 1.2 } : { duration: 0 }}
        >
          <p className="text-[15px] md:text-[16px] tracking-[0.06em] italic text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
            <span className="font-semibold not-italic text-tea-gold">tea</span> &middot; leaf and water
          </p>
          <p className="text-[14px] md:text-[15px] tracking-[0.06em] italic mt-[1px] text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
            <span className="font-semibold not-italic text-tea-gold">jiā</span> &middot; one sound, three pillars...
          </p>
        </motion.div>
      </div>

      {/* ── Act 2: Character reveal ── */}
      <div ref={act2Ref} className="w-full">
        <CharacterReveal active={activeAct === 1} />
      </div>

      {/* ── Act 3: Network directory ── */}
      <div ref={act3Ref} className="w-full">
        <NetworkDirectoryStrip />
      </div>
    </div>
  );
};
