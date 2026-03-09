import React, { forwardRef, useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { useSectionReveal } from '../../hooks/useSectionReveal';
import { SURFACE_TREATMENTS } from '../../designTokens';

/* =====================================================
   Shared helpers — reused across all service sections
   Styles sourced from SURFACE_TREATMENTS (designTokens.ts §12)
   ===================================================== */

/** Recessed panel — from SURFACE_TREATMENTS.recessedPanel */
const alcovePanelStyle = SURFACE_TREATMENTS.recessedPanel;

/** Image inset — from SURFACE_TREATMENTS.imageInset */
const alcoveInsetStyle = SURFACE_TREATMENTS.imageInset;

/** Card frame — from SURFACE_TREATMENTS.cardFrame */
const cardFrameStyle = SURFACE_TREATMENTS.cardFrame;

const ServiceLabel = ({ children }: { children: string }) => (
  <p className="text-[11px] uppercase tracking-[0.2em] text-tea-gold mb-1.5"
     style={{ fontFamily: "'Bricolage Grotesque', 'Inter', sans-serif", fontWeight: 400 }}>
    {children}
  </p>
);

const ServiceHeading = ({ children }: { children: string }) => (
  <h3 className="text-xl md:text-2xl font-light text-tea-text mb-0 leading-snug"
      style={{ fontFamily: "'Fraunces', 'Lora', serif" }}>
    {children}
  </h3>
);

const PrimaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-medium
               flex items-center gap-1 transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

const SecondaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="text-tea-text-dim hover:text-tea-gold text-xs uppercase tracking-[0.15em]
               font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

/* =====================================================
   ServiceCard — the expandable printable card shell
   ===================================================== */

interface ServiceCardProps {
  label: string;
  heading: string;
  summary: string;
  badge?: string;
  img?: string;
  imgAlt: string;
  children: React.ReactNode;
  /** Content shown in the card footer (CTAs) — always visible */
  footer?: React.ReactNode;
}

const ServiceCard = forwardRef<HTMLElement, ServiceCardProps & { revealClassName: string; revealStyle?: React.CSSProperties }>(
  ({ label, heading, summary, badge, img, imgAlt, children, footer, revealClassName, revealStyle }, ref) => {
    const [expanded, setExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState(0);

    // Measure content height for smooth animation
    useEffect(() => {
      if (contentRef.current) {
        const measure = () => setContentHeight(contentRef.current?.scrollHeight ?? 0);
        measure();
        // Re-measure on resize
        const ro = new ResizeObserver(measure);
        ro.observe(contentRef.current);
        return () => ro.disconnect();
      }
    }, [expanded]);

    const toggle = useCallback(() => setExpanded(prev => !prev), []);

    return (
      <section ref={ref} className={`pt-8 md:pt-10 ${revealClassName}`} style={revealStyle}>
        <div style={cardFrameStyle} className="overflow-hidden relative">
          {/* Alcove texture layers — radial warmth + grain */}
          <div style={SURFACE_TREATMENTS.radialWarmth} />
          <div style={SURFACE_TREATMENTS.grainTexture.card} />

          {/* Card body — the "printable" area with padding around everything */}
          <div className="relative z-[1] px-5 py-5 md:px-7 md:py-6">
            {/* Header row: label + heading + badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <ServiceLabel>{label}</ServiceLabel>
                <ServiceHeading>{heading}</ServiceHeading>
              </div>
              {badge && (
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-tea-gold whitespace-nowrap mt-1
                                 border border-tea-gold/20 rounded-full px-3 py-1"
                      style={{ fontFamily: "'Bricolage Grotesque', 'Inter', sans-serif", fontWeight: 400 }}>
                  {badge}
                </span>
              )}
            </div>

            {/* Summary — italic serif like Alcove description */}
            <p className="font-serif text-sm leading-relaxed text-tea-text-sec italic mt-3 max-w-[640px]">
              {summary}
            </p>

            {/* Inset hero image — padded inside the card like the Alcove tea photo */}
            {img && (
              <div className="relative overflow-hidden rounded-md mt-5" style={{ height: 120, ...alcoveInsetStyle }}>
                <img
                  src={img}
                  alt={imgAlt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
              </div>
            )}

            {/* Expand/collapse button — integrated as a subtle divider with action */}
            <button
              onClick={toggle}
              aria-expanded={expanded}
              className="w-full group mt-5 mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px] bg-tea-gold/12 group-hover:bg-tea-gold/20 transition-colors" />
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-tea-text-dim
                                 group-hover:text-tea-gold transition-colors select-none whitespace-nowrap">
                  {expanded ? 'Less' : 'Details'}
                  {expanded
                    ? <Icons.ChevronUp className="w-3 h-3 transition-transform" />
                    : <Icons.ChevronDown className="w-3 h-3 transition-transform" />
                  }
                </span>
                <div className="flex-1 h-[1px] bg-tea-gold/12 group-hover:bg-tea-gold/20 transition-colors" />
              </div>
            </button>

            {/* Expandable content — no inner scroll, page scrolls naturally */}
            <div
              className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ maxHeight: expanded ? contentHeight : 0, opacity: expanded ? 1 : 0 }}
            >
              <div ref={contentRef} className="pt-5 pb-1">
                {children}
              </div>
            </div>

            {/* Footer CTAs */}
            {footer && (
              <div className="mt-3 pt-3 border-t border-tea-border">
                {footer}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
);
ServiceCard.displayName = 'ServiceCard';

/* =====================================================
   Shared section props
   ===================================================== */

export interface ServiceSectionProps {
  onOpenInquiry: (preselect: string) => void;
  onNavigateToProjects?: (filter?: string) => void;
  onNavigateToShop?: () => void;
  onNavigateToMagazine?: () => void;
}

/* =====================================================
   DesignSection
   ===================================================== */

const PILLARS = ['Design', 'Curation', 'Tea Selection', 'Training', 'Operations'];

const PROCESS = [
  { step: 1, title: 'Conversation', desc: 'Share your vision' },
  { step: 2, title: 'Vision & Concept', desc: 'Written design direction' },
  { step: 3, title: 'Sourcing & Creation', desc: 'Sourcing and installation' },
  { step: 4, title: 'Training', desc: 'Your team learns the practice' },
  { step: 5, title: 'Opening', desc: 'Launch and refinement' },
];

export const DesignSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry, onNavigateToProjects }, ref) => {
    const reveal = useSectionReveal();

    const combinedRef = (el: HTMLElement | null) => {
      (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    };

    return (
      <ServiceCard
        ref={combinedRef}
        revealClassName={reveal.className}
        revealStyle={reveal.style}
        label="Space Design"
        heading="Tea House Design & Curation"
        summary="Complete tea space creation — from concept through opening. Design, curation, tea selection, training, and operations."
        badge="By Inquiry"
        img="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80&auto=format"
        imgAlt="A completed tea space with natural materials"
        footer={
          <div className="flex flex-col gap-1">
            <PrimaryCTA label="Start a conversation" onClick={() => onOpenInquiry('Space design or tea integration')} />
            {onNavigateToProjects && (
              <SecondaryCTA label="See completed spaces" onClick={() => onNavigateToProjects('space')} />
            )}
          </div>
        }
      >
        {/* Pillars */}
        <p className="text-[11px] uppercase tracking-wider font-medium text-tea-text-dim mb-3">
          What's Involved
        </p>
        <div className="flex flex-wrap gap-2 mb-8">
          {PILLARS.map((p) => (
            <span key={p} className="text-xs text-tea-text-sec rounded-full px-3 py-1.5 tracking-wide
                                    border border-tea-border bg-tea-accent-sub/50">
              {p}
            </span>
          ))}
        </div>

        {/* Process */}
        <div className="relative px-5 py-6 md:px-6 md:py-7 mb-8 overflow-hidden" style={alcovePanelStyle}>
          <div style={SURFACE_TREATMENTS.grainTexture.panel} />
          <div style={SURFACE_TREATMENTS.ambientGlow} />
          <p className="relative text-[11px] uppercase tracking-wider font-medium text-tea-text-dim mb-5">
            The Process
          </p>
          {/* Mobile */}
          <div className="relative md:hidden space-y-4">
            {PROCESS.map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-4">
                <span className="text-tea-gold font-mono text-xs num bg-tea-gold/[0.06] rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                <div>
                  <span className="font-serif text-sm font-medium text-tea-text">{title}</span>
                  <p className="text-[11px] text-tea-text-dim mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop */}
          <div className="relative hidden md:grid md:grid-cols-5 gap-6">
            {PROCESS.map(({ step, title, desc }) => (
              <div key={step}>
                <span className="text-tea-gold font-mono text-xs num bg-tea-gold/[0.06] rounded-full w-6 h-6 flex items-center justify-center mb-2">{step}</span>
                <h4 className="font-serif text-sm font-medium text-tea-text">{title}</h4>
                <p className="text-[11px] text-tea-text-dim mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing callout */}
        <div className="border-l-2 border-tea-gold/30 pl-4">
          <p className="text-sm text-tea-text-sec">
            Projects range from $5,000 to $100,000+.
          </p>
          <p className="text-xs text-tea-text/30 mt-1">
            Every project is scoped through conversation.
          </p>
        </div>
      </ServiceCard>
    );
  }
);
DesignSection.displayName = 'DesignSection';

/* =====================================================
   SessionsSection
   ===================================================== */

const OFFERINGS = [
  { name: 'Open Sit', price: 'Free', desc: 'Come by the studio. Share tea. No appointment.' },
  { name: 'Guided Practice Setup', price: '$250 – 300', desc: '2-3 hours. Leave fully equipped. Includes $100-150 product credit.' },
  { name: 'Group Ceremonial Session', price: 'From $30/person', desc: 'Up to 12. The living room space.' },
  { name: 'Private or Group Booking', price: 'From $500', desc: 'Half-day or full-day. Your gathering.' },
];

const WALKAWAY = [
  'Teas chosen for your palate',
  'Personalized brewing guide',
  'Practice philosophy card',
  'Follow-up check-in within two weeks',
];

export const SessionsSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry }, ref) => {
    const reveal = useSectionReveal();

    const combinedRef = (el: HTMLElement | null) => {
      (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    };

    return (
      <ServiceCard
        ref={combinedRef}
        revealClassName={reveal.className}
        revealStyle={reveal.style}
        label="Sessions"
        heading="Sessions & Guidance"
        summary="Tea experiences and practice support — in the Bali studio or wherever you are."
        badge="From $50"
        img="https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&q=80&auto=format"
        imgAlt="Ceremonial tea space with floor seating"
        footer={
          <PrimaryCTA label="Book a session" onClick={() => onOpenInquiry('A session or practice guidance')} />
        }
      >
        <div className="relative max-w-[640px] mb-8 overflow-hidden" style={alcovePanelStyle}>
          <div style={SURFACE_TREATMENTS.grainTexture.panel} />
          <div style={SURFACE_TREATMENTS.ambientGlow} />
          <p className="relative text-[11px] uppercase tracking-wider font-medium text-tea-text-dim px-5 pt-5 pb-2">
            Offerings
          </p>
          {OFFERINGS.map(({ name, price, desc }) => (
            <div key={name} className="relative flex items-start justify-between px-5 py-4 last:border-0"
              style={{ borderBottom: '1px solid var(--tea-border)' }}>
              <div>
                <h4 className="font-serif text-base text-tea-text">{name}</h4>
                <p className="text-xs text-tea-text-dim mt-1">{desc}</p>
              </div>
              <span className="font-mono text-xs text-tea-gold num whitespace-nowrap ml-4 mt-1">{price}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-wider font-medium text-tea-text-dim mb-3">
          What You Walk Away With
        </p>
        <div className="border-l border-tea-gold/20 pl-4">
          <ul className="space-y-2">
            {WALKAWAY.map(item => (
              <li key={item} className="text-sm text-tea-text-sec">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </ServiceCard>
    );
  }
);
SessionsSection.displayName = 'SessionsSection';

/* =====================================================
   JourneysSection
   ===================================================== */

export const JourneysSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry, onNavigateToMagazine }, ref) => {
    const reveal = useSectionReveal();

    const combinedRef = (el: HTMLElement | null) => {
      (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    };

    return (
      <ServiceCard
        ref={combinedRef}
        revealClassName={reveal.className}
        revealStyle={reveal.style}
        label="Travel"
        heading="Sourcing Journeys"
        summary="Travel to tea origins with a guide who knows the way. Taiwan, China, and beyond."
        badge="Seasonal"
        img="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80&auto=format"
        imgAlt="Mountain tea terraces at sunrise"
        footer={
          <div className="flex flex-col gap-1">
            <PrimaryCTA label="Start a conversation" onClick={() => onOpenInquiry('A sourcing journey')} />
            {onNavigateToMagazine && (
              <SecondaryCTA label="Read stories from tea origins" onClick={onNavigateToMagazine} />
            )}
          </div>
        }
      >
        <p className="font-sans text-sm leading-relaxed text-tea-text-sec max-w-[640px] mb-6">
          For two decades, I've built relationships with farmers, masters, and artisans across Asia.
          These aren't tours — each journey is shaped around what calls to you.
        </p>

        <div className="inline-flex items-center gap-2 border border-tea-gold/15 rounded-full px-4 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-tea-gold/40" />
          <span className="text-xs text-tea-gold/70 uppercase tracking-wider">Seasonal &middot; By invitation</span>
        </div>
      </ServiceCard>
    );
  }
);
JourneysSection.displayName = 'JourneysSection';

/* =====================================================
   SourcingSection
   ===================================================== */

export const SourcingSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry, onNavigateToShop }, ref) => {
    const reveal = useSectionReveal();

    const combinedRef = (el: HTMLElement | null) => {
      (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    };

    return (
      <ServiceCard
        ref={combinedRef}
        revealClassName={reveal.className}
        revealStyle={reveal.style}
        label="Supply"
        heading="Tea Sourcing"
        summary="Quality tea for your space, your collection, or your community."
        badge="By Inquiry"
        imgAlt="Tea sourcing service"
        footer={
          <div className="flex flex-col gap-1">
            <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('Tea sourcing')} />
            {onNavigateToShop && (
              <SecondaryCTA label="Browse the shop" onClick={onNavigateToShop} />
            )}
          </div>
        }
      >
        <p className="font-sans text-sm leading-relaxed text-tea-text-sec max-w-[640px]">
          Direct sourcing from Taiwan, China, and trusted origins. For individual collectors seeking access
          to exceptional teas. For retreat centers, hotels, and communities wanting quality tea as part of
          what they offer.
        </p>
      </ServiceCard>
    );
  }
);
SourcingSection.displayName = 'SourcingSection';

/* =====================================================
   EventsSection
   ===================================================== */

export const EventsSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry }, ref) => {
    const reveal = useSectionReveal();

    const combinedRef = (el: HTMLElement | null) => {
      (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    };

    return (
      <ServiceCard
        ref={combinedRef}
        revealClassName={reveal.className}
        revealStyle={reveal.style}
        label="Events"
        heading="Tea Experiences for Gatherings"
        summary="I bring everything — tea, teaware, the setup, and the atmosphere — to your gathering."
        badge="From $500"
        img="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200&q=80&auto=format"
        imgAlt="Group tea ceremony with candles and charcoal"
        footer={
          <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('An event or group experience')} />
        }
      >
        <p className="font-sans text-sm leading-relaxed text-tea-text-sec max-w-[640px] mb-6">
          Retreats, dinners, brand activations, celebrations. Fully curated from start to finish.
        </p>

        <div className="border-l-2 border-tea-gold/30 pl-4">
          <p className="text-sm text-tea-gold/80">From $500 for a half-day.</p>
          <p className="text-xs text-tea-text-dim mt-1">
            Full-day and multi-day experiences quoted based on scope.
          </p>
        </div>
      </ServiceCard>
    );
  }
);
EventsSection.displayName = 'EventsSection';
