import React, { useRef, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { LogoEmblem } from './Logos/LogoEmblem';
import { LogoText } from './Logos/LogoText';
import { api } from '../lib/api';

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
const CharacterRevealCapture: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) { setProgress(1); return; }

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const el = sectionRef.current;
      if (!el) return;
      const totalScrollable = el.offsetTop + el.offsetHeight - window.innerHeight;
      const raw = scrollTop / totalScrollable;
      setProgress(Math.max(0, Math.min(1, raw)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  // Ease-out curve
  const ease = (t: number) => 1 - Math.pow(1 - t, 2.5);

  // 1. Logo drops from top (0% → 40%)
  const logoPosP = ease(Math.max(0, Math.min(1, progress / 0.40)));
  const logoOpacity = 0.15 + 0.85 * logoPosP;
  const logoEntryScale = 1.6 - 0.6 * logoPosP;
  // Teaser text fades in just before characters (42% → 50%)
  const teaserP = Math.max(0, Math.min(1, (progress - 0.42) / 0.08));
  // Logo grows slightly while characters come in (50% → 85%)
  const logoGrowP = Math.max(0, Math.min(1, (progress - 0.50) / 0.35));
  const logoScale = 1 + logoGrowP * 0.2;
  // 2. 家 center scales in (50% → 60%)
  const centerP = ease(Math.max(0, Math.min(1, (progress - 0.50) / 0.10)));
  // 3. 佳 left slides in (60% → 70%)
  const leftP = ease(Math.max(0, Math.min(1, (progress - 0.60) / 0.10)));
  // 4. 嘉 right slides in (70% → 80%)
  const rightP = ease(Math.max(0, Math.min(1, (progress - 0.70) / 0.10)));
  // 5. Email rises from below (82% → 95%)
  const emailP = ease(Math.max(0, Math.min(1, (progress - 0.82) / 0.13)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.newsletter.subscribe(email);
      setEmail('');
      setSubmitted(true);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const isVisible = progress > 0;

  return (
    <>
      {/* Scroll spacer — creates the scroll distance */}
      <div ref={sectionRef} style={{ height: '160vh' }} />

      {/* Fixed overlay — no background, content floats over Act 1 */}
      {isVisible && (
        <div className="fixed inset-0 flex flex-col items-center justify-center px-6 z-30 pointer-events-none pt-[env(safe-area-inset-top)] pb-[calc(44px+env(safe-area-inset-bottom,0px))]">

          {/* Logo — drops from top */}
          <div
            className="mb-8"
            style={{
              opacity: logoOpacity,
              transform: `translateY(${(1 - logoPosP) * -400}px) scale(${logoEntryScale * logoScale})`,
            }}
          >
            <LogoText size="hero" color="var(--tea-text-sec)" />
          </div>

          {/* Teaser lines */}
          <div
            className="flex flex-col items-center gap-[0px] mb-7"
            style={{
              animation: teaserP >= 1 ? 'teaserBreath 4s ease-in-out infinite' : 'none',
              opacity: teaserP,
            }}
          >
            <p className="text-[15px] md:text-[16px] tracking-[0.06em] italic text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
              <span className="font-semibold not-italic text-tea-gold">tea</span> &middot; leaf and water
            </p>
            <p className="text-[14px] md:text-[15px] tracking-[0.06em] italic mt-[1px] text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
              <span className="font-semibold not-italic text-tea-gold">jiā</span> &middot; one sound, three pillars...
            </p>
          </div>

          {/* Characters */}
          <div className="flex items-end justify-center gap-5 md:gap-8">
            {/* 佳 — slides from left */}
            <div className="flex flex-col items-center" style={{ opacity: leftP, transform: `translateX(${(1 - leftP) * -60}px)` }}>
              <span className="text-[48px] sm:text-[69px] leading-none" style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}>佳</span>
              <p className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
                <span>beauty</span><span>excellence</span>
              </p>
            </div>

            {/* 家 — center, scales in */}
            <div className="flex flex-col items-center" style={{ opacity: centerP, transform: `scale(${centerP})` }}>
              <span className="text-[48px] sm:text-[69px] leading-none" style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}>家</span>
              <p className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
                <span>home</span><span>devotion</span>
              </p>
            </div>

            {/* 嘉 — slides from right */}
            <div className="flex flex-col items-center" style={{ opacity: rightP, transform: `translateX(${(1 - rightP) * 60}px)` }}>
              <span className="text-[48px] sm:text-[69px] leading-none" style={{ fontFamily: "'Ma Shan Zheng', cursive", color: 'var(--tea-gold)' }}>嘉</span>
              <p className="flex flex-col items-center text-[14px] md:text-[15px] tracking-[0.04em] font-light mt-3 leading-[1.4] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
                <span>praise</span><span>celebration</span>
              </p>
            </div>
          </div>

          {/* Email capture */}
          <div
            className="flex flex-col items-center mt-6 sm:mt-12 pointer-events-auto w-full max-w-[280px]"
            style={{ opacity: emailP, transform: `translateY(${(1 - emailP) * 20}px)` }}
          >
            <p className="text-base italic font-light text-tea-text-dim" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>stay connected</p>
            <p className="text-base italic font-light mt-1 text-tea-text-sec" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>it's nothing without you</p>
            {submitted ? (
              <p className="mt-4 text-base font-light text-tea-gold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>You're in.</p>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="w-full relative mt-3">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your email"
                    disabled={loading}
                    className="w-full bg-transparent text-base font-light text-center text-tea-text outline-none pb-2.5 pl-7 pr-10 transition-colors placeholder:italic placeholder:text-tea-text-dim disabled:opacity-50"
                    style={{ fontFamily: 'var(--font-display)', border: 'none', borderBottom: '1px solid rgb(var(--tea-gold-rgb) / 0.25)', borderRadius: 0, letterSpacing: '0.04em' }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = 'rgb(var(--tea-gold-rgb) / 0.5)'; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = 'rgb(var(--tea-gold-rgb) / 0.25)'; }}
                  />
                  <button type="submit" disabled={loading} className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors duration-300 text-tea-text-dim hover:text-tea-gold disabled:opacity-50" aria-label="Submit email">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M10 4.5L13.5 8 10 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
                {error && (
                  <p className="mt-2 text-xs text-tea-text-dim" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>{error}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSection,
  onAccountClick,
}) => {
  const shouldAnimate = !hasAnimated;
  const mountRef = useRef(false);
  if (!mountRef.current) {
    mountRef.current = true;
    requestAnimationFrame(() => { hasAnimated = true; });
  }

  const initial = (vals: Record<string, any>) => shouldAnimate ? vals : false;

  // Scroll-driven fade-out for Act 1 + glow position
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [glowY, setGlowY] = useState(1);
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const fadeEnd = vh * 0.4;
      setFadeOpacity(Math.max(0, 1 - scrollY / fadeEnd));
      const glowEnd = vh * 0.6;
      setGlowY(Math.max(0, 1 - scrollY / glowEnd));
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

      {/* Act 1 bottom glow — fades out on scroll */}
      <div
        className="fixed bottom-0 left-0 w-screen h-[200px] pointer-events-none z-[2]"
        style={{
          background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgb(var(--tea-gold-rgb) / 0.18) 0%, rgb(var(--tea-gold-rgb) / 0.05) 50%, transparent 100%)',
          opacity: glowY,
        }}
      />

      {/* Scroll-driven glow — rises to top as you enter Act 2 */}
      <div
        className="fixed left-0 w-screen h-[200px] pointer-events-none z-[2]"
        style={{
          top: 0,
          background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgb(var(--tea-gold-rgb) / 0.18) 0%, rgb(var(--tea-gold-rgb) / 0.05) 50%, transparent 100%)',
          opacity: Math.max(0, 1 - glowY),
        }}
      />

      {/* ── Act 1: Hero ── */}
      <div
        className="relative flex flex-col items-center justify-between px-8"
        style={{ minHeight: 'calc(100dvh - 44px - env(safe-area-inset-bottom, 0px))', opacity: fadeOpacity }}
      >
        <div />

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
              <LogoEmblem size={76} color="var(--tea-gold)" className="opacity-70 lg:hidden" />
              <LogoEmblem size={108} color="var(--tea-gold)" className="opacity-70 hidden lg:block" />
            </button>
          </motion.div>

          <motion.h1
            className="text-tea-text max-w-[380px] lg:max-w-[560px] text-[28px] md:text-[34px] lg:text-[48px] leading-[1.35] tracking-[0.01em] font-normal mt-8 sm:mt-12"
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
                className="group text-tea-text-sec/90 hover:text-tea-text transition-colors duration-300 cursor-pointer bg-transparent border-none text-[15px] md:text-[16px] lg:text-[17px] leading-[1.8] tracking-[0.005em] flex items-center gap-1.5"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="font-semibold text-tea-gold">{item.accent}</span>
                <span className="underline decoration-tea-gold/0 group-hover:decoration-tea-gold/30 underline-offset-[3px] transition-all duration-300">{item.rest}</span>
                <span className="opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all duration-300 text-tea-gold text-xs">→</span>
              </button>
            ))}
          </motion.div>
        </div>

        {/* Teaser + scroll cue — pulses to invite scrolling */}
        <motion.div
          className="flex flex-col items-center pb-4 lg:pb-[18px] gap-4"
          style={{ animation: 'teaserBreath 4s ease-in-out infinite' }}
          initial={initial({ opacity: 0 })}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.6, delay: 1.2 } : { duration: 0 }}
        >
          <div className="flex flex-col items-center">
            <p className="text-[15px] md:text-[16px] tracking-[0.06em] italic text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
              <span className="font-semibold not-italic text-tea-gold">tea</span> &middot; leaf and water
            </p>
            <p className="text-[14px] md:text-[15px] tracking-[0.06em] italic mt-[1px] text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>
              <span className="font-semibold not-italic text-tea-gold">jiā</span> &middot; one sound, three pillars...
            </p>
          </div>
          <svg
            width="16" height="10" viewBox="0 0 16 10" fill="none"
            className="text-tea-gold/40"
            aria-hidden="true"
          >
            <path d="M1 1l7 7 7-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>

      {/* ── Act 2: Character reveal + email capture ── */}
      <CharacterRevealCapture />
    </div>
  );
};
