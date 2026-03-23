import React, { useRef, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { LogoEmblem } from './Logos/LogoEmblem';
import { LogoText } from './Logos/LogoText';

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
  const [progress, setProgress] = useState(0); // 0 = off screen, 1 = fully revealed
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [email, setEmail] = useState('');

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
      // Use raw page scroll — progress starts from the very first pixel of scrolling
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
  // 5. Email: rises from below (82% → 95%)
  const emailP = ease(Math.max(0, Math.min(1, (progress - 0.82) / 0.13)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up email capture
    if (email.trim()) {
      setEmail('');
    }
  };


  // Show the overlay as soon as any scrolling happens
  const isVisible = progress > 0;

  return (
    <>
      {/* Scroll spacer — creates the scroll distance */}
      <div
        ref={sectionRef}
        style={{ height: '160vh' }}
      />

      {/* Fixed overlay — viewport-locked, immune to overflow/layout issues */}
      {isVisible && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center px-6 z-30 pointer-events-none"
        >
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
              className="text-[12px] md:text-[13px] tracking-[0.08em] italic"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span className="font-semibold not-italic">tea</span> &middot; leaf and water
            </p>
            <p
              className="text-[11px] md:text-[12px] tracking-[0.08em] italic -mt-[1px]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span className="font-semibold not-italic">jiā</span> &middot; one sound, three pillars...
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
                className="text-[69px] leading-none"
                style={{ fontFamily: "'Ma Shan Zheng', cursive", color: '#a8874d' }}
              >
                佳
              </span>
              <p
                className="flex flex-col items-center text-[13px] md:text-[14px] tracking-[0.04em] font-light mt-3 leading-[1.4]"
                style={{ fontFamily: 'var(--font-display)', color: '#b5a892' }}
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
                className="text-[69px] leading-none"
                style={{ fontFamily: "'Ma Shan Zheng', cursive", color: '#a8874d' }}
              >
                家
              </span>
              <p
                className="flex flex-col items-center text-[13px] md:text-[14px] tracking-[0.04em] font-light mt-3 leading-[1.4]"
                style={{ fontFamily: 'var(--font-display)', color: '#b5a892' }}
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
                className="text-[69px] leading-none"
                style={{ fontFamily: "'Ma Shan Zheng', cursive", color: '#a8874d' }}
              >
                嘉
              </span>
              <p
                className="flex flex-col items-center text-[13px] md:text-[14px] tracking-[0.04em] font-light mt-3 leading-[1.4]"
                style={{ fontFamily: 'var(--font-display)', color: '#b5a892' }}
              >
                <span>praise</span>
                <span>celebration</span>
              </p>
            </div>
          </div>

          {/* Email capture — input then statement */}
          <div
            className="flex flex-col items-center mt-12 pointer-events-auto w-full max-w-[280px]"
            style={{
              opacity: emailP,
              transform: `translateY(${(1 - emailP) * 20}px)`,
            }}
          >
            <p
              className="text-base italic font-light text-tea-text-sec/50"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
            >
              stay connected
            </p>
            <p
              className="text-base italic font-light mt-1"
              style={{ fontFamily: 'var(--font-display)', color: '#d4c4a8', letterSpacing: '0.04em' }}
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
                className="w-full bg-transparent text-base font-light text-center outline-none pb-2.5 pl-7 pr-7 transition-colors placeholder:italic placeholder:text-tea-text-sec/50"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: '#ede4d4',
                  border: 'none',
                  borderBottom: '1px solid rgba(184,146,78,0.2)',
                  borderRadius: 0,
                  letterSpacing: '0.04em',
                }}
                onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(184,146,78,0.45)'; }}
                onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(184,146,78,0.2)'; }}
              />
              <button
                type="submit"
                className="absolute right-0 bottom-2.5 bg-transparent border-none cursor-pointer transition-colors duration-300 text-tea-gold/40 hover:text-tea-gold/80"
                aria-label="Submit"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M10 4.5L13.5 8 10 11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateToSection,
}) => {
  const shouldAnimate = !hasAnimated;
  const mountRef = useRef(false);
  if (!mountRef.current) {
    mountRef.current = true;
    requestAnimationFrame(() => { hasAnimated = true; });
  }

  const initial = (vals: Record<string, any>) => shouldAnimate ? vals : false;

  // Scroll-driven fade-out for Act 1
  const [fadeOpacity, setFadeOpacity] = useState(1);
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Fade out over the first 40% of viewport height
      const fadeEnd = window.innerHeight * 0.4;
      setFadeOpacity(Math.max(0, 1 - scrollY / fadeEnd));
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

      {/* ── Act 1: Above the fold ── */}
      <div
        className="flex flex-col items-center justify-between px-8"
        style={{ minHeight: 'calc(100dvh - 70px)', opacity: fadeOpacity }}
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
                background: 'radial-gradient(circle at 50% 50%, rgba(184,146,78,0.08) 0%, rgba(184,146,78,0.03) 40%, transparent 70%)',
                width: '200px',
                height: '200px',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            <LogoEmblem
              size={76}
              color="var(--tea-gold)"
              className="opacity-70"
            />
          </motion.div>

          {/* Statement */}
          <motion.h1
            className="text-tea-text max-w-[380px] text-[28px] md:text-[34px] leading-[1.35] tracking-[0.01em] font-normal mt-[48px]"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={initial({ opacity: 0, y: 10 })}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldAnimate ? { duration: 0.8, delay: 0.35, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          >
            Tea deepens with what you bring to the table and what you leave behind.
          </motion.h1>

          {/* Grounding lines */}
          <motion.div
            className="flex flex-col items-center mt-[48px]"
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
                className="text-tea-text-sec hover:text-tea-gold transition-colors duration-300 cursor-pointer bg-transparent border-none text-[15px] md:text-[16px] leading-[1.7] tracking-[0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span className="font-semibold" style={{ animation: 'teaserBreath 4s ease-in-out infinite' }}>{item.accent}</span>{item.rest}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Teaser — sits at bottom of viewport via justify-between, scrolls normally */}
        <motion.div
          className="flex flex-col items-center pb-[25px]"
          style={{ animation: 'teaserBreath 4s ease-in-out infinite' }}
          initial={initial({ opacity: 0 })}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.6, delay: 1.2 } : { duration: 0 }}
        >
          <p
            className="text-[12px] md:text-[13px] tracking-[0.08em] italic"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <span className="font-semibold not-italic">tea</span> &middot; leaf and water
          </p>
          <p
            className="text-[11px] md:text-[12px] tracking-[0.08em] italic -mt-[1px]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <span className="font-semibold not-italic">jiā</span> &middot; one sound, three pillars...
          </p>
        </motion.div>
      </div>

      {/* ── Act 2: Character reveal + email capture ── */}
      <CharacterRevealCapture />
    </div>
  );
};
