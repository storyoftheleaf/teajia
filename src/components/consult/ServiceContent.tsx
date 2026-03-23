import React, { forwardRef } from 'react';
import { useSectionReveal } from '../../hooks/useSectionReveal';

/* =====================================================
   V2 — Editorial service sections

   Spatial strategy:
   - Alternating warm/neutral background bands (full-bleed)
   - Pull-quotes live BETWEEN sections as thresholds
   - Staggered alignment (left → indented → left)
   - Massive whitespace between zones
   ===================================================== */

/* ── Shared helpers ── */

/** Full-bleed background band — wraps a section to shift the "world" */
const WarmBand: React.FC<{ children: React.ReactNode; tone?: 'warm' | 'cool' }> = ({ children, tone = 'warm' }) => (
  <div className="-mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8"
       style={{
         background: tone === 'warm'
           ? 'rgba(184,146,78,0.035)'
           : 'rgba(90,110,90,0.04)',
       }}>
    {children}
  </div>
);

/** Pull-quote as a threshold between sections — belongs to neither */
const Threshold = ({ children }: { children: string }) => (
  <div className="py-16 md:py-24 flex justify-center">
    <p className="text-[1.4rem] md:text-[1.7rem] leading-[1.35] font-light text-tea-text text-center max-w-[440px] px-4"
       style={{ fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  </div>
);

const ServiceCTA = ({ label, onClick, variant = 'primary' }: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }) => (
  <button onClick={onClick}
    className={`text-[13px] tracking-[0.01em] transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm
               ${variant === 'primary'
                 ? 'text-tea-gold hover:text-tea-gold/70'
                 : 'text-tea-text-sec hover:text-tea-gold'
               }`}
    style={{ fontFamily: 'var(--font-body)' }}
  >
    {label} &rarr;
  </button>
);

/* ── Shared types ── */

export interface ServiceSectionProps {
  onOpenInquiry: (preselect: string) => void;
  onNavigateToProjects?: (filter?: string) => void;
  onNavigateToShop?: () => void;
  onNavigateToMagazine?: () => void;
}

const useCombinedRef = (reveal: { ref: React.RefObject<HTMLElement | null> }, ref: React.ForwardedRef<HTMLElement>) => {
  return (el: HTMLElement | null) => {
    (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
  };
};

/* =====================================================
   DesignSection — left-aligned, neutral background
   ===================================================== */

const PROCESS = [
  { step: 1, title: 'Conversation' },
  { step: 2, title: 'Vision & Concept' },
  { step: 3, title: 'Sourcing & Creation' },
  { step: 4, title: 'Training' },
  { step: 5, title: 'Opening' },
];

export const DesignSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry, onNavigateToProjects }, ref) => {
    const reveal = useSectionReveal();
    const combinedRef = useCombinedRef(reveal, ref);

    return (
      <section ref={combinedRef} className={`pb-4 ${reveal.className}`} style={reveal.style}>
        <p className="text-[11px] uppercase tracking-[0.08em] text-tea-gold mb-3"
           style={{ fontFamily: 'var(--font-sans)' }}>
          Space Design
        </p>
        <h3 className="text-2xl md:text-[2rem] font-light text-tea-text leading-snug mb-6"
            style={{ fontFamily: 'var(--font-display)' }}>
          Tea House Design & Curation
        </h3>

        <p className="text-[15px] leading-[1.8] text-tea-text-sec max-w-[520px] mb-10"
           style={{ fontFamily: 'var(--font-body)' }}>
          From concept through opening — design, curation, tea selection, training, and operations.
        </p>

        {/* Process */}
        <div className="mb-10 max-w-[400px]">
          {PROCESS.map(({ step, title }) => (
            <div key={step} className="flex items-baseline gap-4 py-2"
                 style={{ borderBottom: step < 5 ? '1px solid var(--tea-border)' : undefined }}>
              <span className="text-tea-gold/30 font-mono text-xs tabular-nums w-4 shrink-0">{step}</span>
              <span className="text-[14px] text-tea-text-sec" style={{ fontFamily: 'var(--font-body)' }}>{title}</span>
            </div>
          ))}
        </div>

        <p className="text-[14px] text-tea-text-dim mb-8" style={{ fontFamily: 'var(--font-body)' }}>
          <span className="text-tea-gold">$5,000</span> – <span className="text-tea-gold">$100,000+</span>
          <span className="ml-2 text-tea-text-dim/60">·</span>
          <span className="ml-2">scoped through conversation</span>
        </p>

        <div className="flex flex-col items-start gap-0">
          <ServiceCTA label="Start a conversation" onClick={() => onOpenInquiry('Space design or tea integration')} />
          {onNavigateToProjects && (
            <ServiceCTA label="See completed spaces" onClick={() => onNavigateToProjects('space')} variant="secondary" />
          )}
        </div>
      </section>
    );
  }
);
DesignSection.displayName = 'DesignSection';

/* =====================================================
   SessionsSection — indented, warm background band
   ===================================================== */

const OFFERINGS = [
  { name: 'Open Sit', price: 'Free', desc: 'Share tea at the studio. No appointment.' },
  { name: 'Guided Practice Setup', price: '$250 – 300', desc: '2+ hours. Leave fully equipped.' },
  { name: 'Group Ceremonial', price: 'Inquire', desc: 'Up to 24 across two tearooms.' },
  { name: 'Private Booking', price: 'From $500', desc: 'Half-day or full-day.' },
];

const WALKAWAY = [
  'Teas chosen for your palate',
  'Personalized brewing guide',
  'Practice philosophy card',
  'Follow-up within two weeks',
];

export const SessionsSection = forwardRef<HTMLElement, ServiceSectionProps>(
  ({ onOpenInquiry }, ref) => {
    const reveal = useSectionReveal();
    const combinedRef = useCombinedRef(reveal, ref);

    return (
      <section ref={combinedRef} className={`ml-6 md:ml-16 pb-4 ${reveal.className}`} style={reveal.style}>
        <p className="text-[11px] uppercase tracking-[0.08em] text-tea-gold mb-3"
           style={{ fontFamily: 'var(--font-sans)' }}>
          Sessions
        </p>
        <h3 className="text-2xl md:text-[2rem] font-light text-tea-text leading-snug mb-6"
            style={{ fontFamily: 'var(--font-display)' }}>
          Sessions & Guidance
        </h3>

        <p className="text-[15px] leading-[1.8] text-tea-text-sec max-w-[480px] mb-10"
           style={{ fontFamily: 'var(--font-body)' }}>
          Tea experiences and practice support — in the Bali studio or wherever you are.
        </p>

        {/* Offerings */}
        <div className="mb-10 max-w-[480px]">
          {OFFERINGS.map(({ name, price, desc }, i) => (
            <div key={name} className="flex items-baseline justify-between gap-4 py-3"
                 style={{ borderBottom: i < OFFERINGS.length - 1 ? '1px solid var(--tea-border)' : undefined }}>
              <div className="min-w-0">
                <span className="text-[15px] text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>{name}</span>
                <span className="text-[13px] text-tea-text-dim ml-3">{desc}</span>
              </div>
              <span className="text-[13px] text-tea-gold shrink-0">{price}</span>
            </div>
          ))}
        </div>

        {/* Walk-away */}
        <p className="text-[11px] uppercase tracking-[0.08em] text-tea-text-dim mb-4"
           style={{ fontFamily: 'var(--font-sans)' }}>
          You walk away with
        </p>
        <ul className="space-y-2 mb-8 max-w-[480px]">
          {WALKAWAY.map(item => (
            <li key={item} className="flex items-start gap-3 text-[14px] text-tea-text-sec"
                style={{ fontFamily: 'var(--font-body)' }}>
              <span className="text-tea-gold/40 mt-[2px]">&mdash;</span>
              {item}
            </li>
          ))}
        </ul>

        <ServiceCTA label="Book a session" onClick={() => onOpenInquiry('A session or practice guidance')} />
      </section>
    );
  }
);
SessionsSection.displayName = 'SessionsSection';

/* =====================================================
   AlsoSection — back to left-aligned, neutral background
   ===================================================== */

const ALSO_SERVICES = [
  {
    id: 'journeys',
    heading: 'Sourcing Journeys',
    body: 'Travel to tea origins with twenty years of relationships opening the door.',
    note: 'Seasonal · By invitation',
    preselect: 'A sourcing journey',
  },
  {
    id: 'sourcing',
    heading: 'Tea Sourcing',
    body: 'Direct sourcing from Taiwan, China, and trusted origins — for collectors, spaces, and communities.',
    preselect: 'Tea sourcing',
  },
  {
    id: 'events',
    heading: 'Gatherings & Experiences',
    body: 'Tea brought to your retreat, dinner, or celebration. Fully curated.',
    note: 'From $500',
    preselect: 'An event or group experience',
  },
];

interface AlsoSectionProps {
  onOpenInquiry: (preselect: string) => void;
  onNavigateToShop?: () => void;
  onNavigateToMagazine?: () => void;
  journeysRef: React.RefObject<HTMLElement | null>;
  sourcingRef: React.RefObject<HTMLElement | null>;
  eventsRef: React.RefObject<HTMLElement | null>;
}

export const AlsoSection: React.FC<AlsoSectionProps> = ({
  onOpenInquiry, onNavigateToShop, onNavigateToMagazine,
  journeysRef, sourcingRef, eventsRef,
}) => {
  const reveal = useSectionReveal();

  const refs: Record<string, React.RefObject<HTMLElement | null>> = {
    journeys: journeysRef,
    sourcing: sourcingRef,
    events: eventsRef,
  };

  return (
    <section ref={reveal.ref} className={`pb-4 ${reveal.className}`} style={reveal.style}>
      <div className="max-w-[520px]">
        {ALSO_SERVICES.map((svc, i) => (
          <div
            key={svc.id}
            ref={el => {
              const r = refs[svc.id];
              if (r) (r as React.MutableRefObject<HTMLElement | null>).current = el;
            }}
            className="py-6"
            style={{ borderBottom: i < ALSO_SERVICES.length - 1 ? '1px solid var(--tea-border)' : undefined }}
          >
            <h4 className="text-lg font-light text-tea-text mb-2"
                style={{ fontFamily: 'var(--font-display)' }}>
              {svc.heading}
            </h4>
            <p className="text-[14px] leading-[1.7] text-tea-text-sec"
               style={{ fontFamily: 'var(--font-body)' }}>
              {svc.body}
              {svc.note && (
                <span className="text-tea-text-dim italic ml-1">— {svc.note}</span>
              )}
            </p>
            <div className="mt-2">
              <ServiceCTA label="Inquire" onClick={() => onOpenInquiry(svc.preselect)} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start gap-0 mt-2">
        {onNavigateToShop && (
          <ServiceCTA label="Browse the shop" onClick={onNavigateToShop} variant="secondary" />
        )}
        {onNavigateToMagazine && (
          <ServiceCTA label="Stories from tea origins" onClick={onNavigateToMagazine} variant="secondary" />
        )}
      </div>
    </section>
  );
};

/* ── Exports for ConsultPage layout ── */

export { WarmBand, Threshold };

export const JourneysSection = forwardRef<HTMLElement, ServiceSectionProps>(() => null);
JourneysSection.displayName = 'JourneysSection';
export const SourcingSection = forwardRef<HTMLElement, ServiceSectionProps>(() => null);
SourcingSection.displayName = 'SourcingSection';
export const EventsSection = forwardRef<HTMLElement, ServiceSectionProps>(() => null);
EventsSection.displayName = 'EventsSection';
