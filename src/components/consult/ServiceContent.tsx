import React, { forwardRef } from 'react';
import { useSectionReveal } from '../../hooks/useSectionReveal';

/* =====================================================
   V2 — Editorial service sections
   ===================================================== */

/* ── Shared helpers ── */

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

const Threshold = ({ children }: { children: string }) => (
  <div className="py-16 md:py-24 flex justify-center">
    <p className="text-[1.4rem] md:text-[1.7rem] leading-[1.35] font-light text-tea-text text-center max-w-[440px] px-4"
       style={{ fontFamily: 'var(--font-display)' }}>
      {children}
    </p>
  </div>
);

/** CTA — uppercase sans-serif, visually distinct from body text */
const ServiceCTA = ({ label, onClick, variant = 'primary' }: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }) => (
  <button onClick={onClick}
    className={`text-[11px] uppercase tracking-[0.1em] transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm
               ${variant === 'primary'
                 ? 'text-tea-gold hover:text-tea-gold/70 font-medium'
                 : 'text-tea-text-dim hover:text-tea-gold font-normal'
               }`}
    style={{ fontFamily: 'var(--font-sans)' }}
  >
    {label} <span className="ml-1">&rarr;</span>
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
   DesignSection
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
        <p className="text-[11px] uppercase tracking-[0.08em] text-tea-gold mb-4"
           style={{ fontFamily: 'var(--font-sans)' }}>
          Space Design
        </p>
        <h3 className="text-[1.75rem] md:text-[2.25rem] font-light text-tea-text leading-[1.15] tracking-[-0.01em] mb-8"
            style={{ fontFamily: 'var(--font-display)' }}>
          Tea House Design<br className="sm:hidden" /> & Curation
        </h3>

        <p className="text-[15px] leading-[1.85] text-tea-text-sec max-w-[520px] mb-12"
           style={{ fontFamily: 'var(--font-body)' }}>
          From concept through opening — design, curation, tea selection, training, and operations.
        </p>

        {/* Process — numbers as a design feature */}
        <div className="mb-12 max-w-[420px]">
          {PROCESS.map(({ step, title }) => (
            <div key={step} className="flex items-center gap-5 py-3"
                 style={{ borderBottom: step < 5 ? '1px solid var(--tea-border)' : undefined }}>
              <span className="text-[1.1rem] text-tea-gold/25 tabular-nums w-6 shrink-0"
                    style={{ fontFamily: 'var(--font-display)' }}>
                {step}
              </span>
              <span className="text-[15px] font-light text-tea-text"
                    style={{ fontFamily: 'var(--font-display)' }}>
                {title}
              </span>
            </div>
          ))}
        </div>

        {/* Pricing — display font, set apart */}
        <p className="text-[1.1rem] font-light text-tea-text mb-1"
           style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-tea-gold">$5,000</span>
          <span className="text-tea-text-dim mx-2">–</span>
          <span className="text-tea-gold">$100,000+</span>
        </p>
        <p className="text-[12px] text-tea-text-dim mb-12"
           style={{ fontFamily: 'var(--font-sans)' }}>
          Every project is scoped through conversation.
        </p>

        <div className="flex flex-col items-start gap-1">
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
   SessionsSection
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
        <p className="text-[11px] uppercase tracking-[0.08em] text-tea-gold mb-4"
           style={{ fontFamily: 'var(--font-sans)' }}>
          Sessions
        </p>
        <h3 className="text-[1.75rem] md:text-[2.25rem] font-light text-tea-text leading-[1.15] tracking-[-0.01em] mb-8"
            style={{ fontFamily: 'var(--font-display)' }}>
          Sessions & Guidance
        </h3>

        <p className="text-[15px] leading-[1.85] text-tea-text-sec max-w-[480px] mb-12"
           style={{ fontFamily: 'var(--font-body)' }}>
          Tea experiences and practice support — in the Bali studio or wherever you are.
        </p>

        {/* Offerings — name in display font, desc in sans for contrast */}
        <div className="mb-12 max-w-[480px]">
          {OFFERINGS.map(({ name, price, desc }, i) => (
            <div key={name} className="py-4"
                 style={{ borderBottom: i < OFFERINGS.length - 1 ? '1px solid var(--tea-border)' : undefined }}>
              <div className="flex items-baseline justify-between gap-4">
                <h4 className="text-[1.05rem] font-light text-tea-text"
                    style={{ fontFamily: 'var(--font-display)' }}>
                  {name}
                </h4>
                <span className="text-[12px] text-tea-gold shrink-0 uppercase tracking-[0.04em]"
                      style={{ fontFamily: 'var(--font-sans)' }}>
                  {price}
                </span>
              </div>
              <p className="text-[12px] text-tea-text-dim mt-1.5 leading-relaxed tracking-[0.01em]"
                 style={{ fontFamily: 'var(--font-sans)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* Walk-away — sans-serif, distinct from body copy */}
        <p className="text-[11px] uppercase tracking-[0.08em] text-tea-text-dim mb-5"
           style={{ fontFamily: 'var(--font-sans)' }}>
          You walk away with
        </p>
        <ul className="space-y-3 mb-12 max-w-[480px]">
          {WALKAWAY.map(item => (
            <li key={item} className="flex items-start gap-3 text-[13px] text-tea-text-sec tracking-[0.01em]"
                style={{ fontFamily: 'var(--font-sans)' }}>
              <span className="text-tea-gold/30 mt-[1px]">&mdash;</span>
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
   AlsoSection
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
            className="py-7"
            style={{ borderBottom: i < ALSO_SERVICES.length - 1 ? '1px solid var(--tea-border)' : undefined }}
          >
            <h4 className="text-[1.15rem] font-light text-tea-text mb-2"
                style={{ fontFamily: 'var(--font-display)' }}>
              {svc.heading}
            </h4>
            <p className="text-[14px] leading-[1.75] text-tea-text-sec mb-1"
               style={{ fontFamily: 'var(--font-body)' }}>
              {svc.body}
            </p>
            {svc.note && (
              <p className="text-[11px] text-tea-text-dim italic tracking-[0.02em] mb-3"
                 style={{ fontFamily: 'var(--font-body)' }}>
                {svc.note}
              </p>
            )}
            <ServiceCTA label="Inquire" onClick={() => onOpenInquiry(svc.preselect)} />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start gap-1 mt-6">
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

export { WarmBand, Threshold };

export const JourneysSection = forwardRef<HTMLElement, ServiceSectionProps>(() => null);
JourneysSection.displayName = 'JourneysSection';
export const SourcingSection = forwardRef<HTMLElement, ServiceSectionProps>(() => null);
SourcingSection.displayName = 'SourcingSection';
export const EventsSection = forwardRef<HTMLElement, ServiceSectionProps>(() => null);
EventsSection.displayName = 'EventsSection';
