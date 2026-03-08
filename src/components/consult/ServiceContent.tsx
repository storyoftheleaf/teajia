import React, { forwardRef } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { useSectionReveal } from '../../hooks/useSectionReveal';

/* =====================================================
   Shared helpers — reused across all service sections
   ===================================================== */

const ServiceHero = ({ ariaLabel }: { ariaLabel: string }) => (
  <CardContainer variant="dark" className="w-full overflow-hidden mb-6 md:mb-8">
    <div className="w-full bg-tea-ink/90" style={{ height: 'clamp(180px, 30vh, 340px)' }}
         role="img" aria-label={ariaLabel} />
  </CardContainer>
);

const ServiceLabel = ({ children }: { children: string }) => (
  <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">{children}</p>
);

const ServiceHeading = ({ children }: { children: string }) => (
  <h3 className="font-serif text-2xl md:text-3xl font-normal text-tea-ink dark:text-tea-paper mb-0">
    {children}
  </h3>
);

const ServiceDivider = () => (
  <div className="w-12 h-[1px] bg-tea-seal mt-3 mb-6" />
);

const PrimaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium
               flex items-center gap-1 transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

const SecondaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="text-tea-ink/40 dark:text-tea-paper/40 hover:text-tea-seal text-xs uppercase tracking-widest
               font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

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
    return (
      <section ref={(el) => {
        // Combine forwarded ref and reveal ref
        (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} className={`pt-12 md:pt-16 ${reveal.className}`} style={reveal.style}>
        <ServiceHero ariaLabel="A completed tea space with natural materials" />
        <ServiceLabel>Space Design</ServiceLabel>
        <ServiceHeading>Tea House Design & Curation</ServiceHeading>
        <ServiceDivider />

        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-10">
          Complete tea space creation — from concept through opening. Design, curation, tea selection,
          training, and operations. For hotels, resorts, retreat centers, private residences, and new
          tea house owners.
        </p>

        {/* Pillars */}
        <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-3">
          What's Involved
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-8">
          {PILLARS.map((p, i) => (
            <span key={p} className="text-sm text-tea-ink/60 dark:text-tea-paper/60">
              {p}{i < PILLARS.length - 1 && <span className="text-tea-ink/20 dark:text-tea-paper/20 ml-3">&middot;</span>}
            </span>
          ))}
        </div>

        {/* Process */}
        <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-4">
          The Process
        </p>
        {/* Mobile (base) */}
        <div className="md:hidden space-y-3 mb-8">
          {PROCESS.map(({ step, title, desc }) => (
            <div key={step} className="flex items-baseline gap-3">
              <span className="text-tea-seal font-mono text-sm w-4 shrink-0">{step}</span>
              <div>
                <span className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper">{title}</span>
                <span className="text-tea-ink/30 dark:text-tea-paper/30 mx-1.5">&mdash;</span>
                <span className="text-[11px] text-tea-ink/40 dark:text-tea-paper/40">{desc}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop */}
        <div className="hidden md:flex gap-8 relative mb-8">
          <div className="absolute top-4 left-0 right-0 h-[1px] bg-tea-ink/5 dark:bg-white/5" />
          {PROCESS.map(({ step, title, desc }) => (
            <div key={step} className="flex-1 relative z-10">
              <span className="text-tea-seal font-mono text-sm">{step}</span>
              <h4 className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper mt-1">{title}</h4>
              <p className="text-[11px] text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mb-8">
          Projects range from $5,000 to $100,000+. Every project is scoped through conversation.
        </p>

        <div className="flex flex-col gap-2">
          <PrimaryCTA label="Start a conversation" onClick={() => onOpenInquiry('Space design or tea integration')} />
          {onNavigateToProjects && (
            <SecondaryCTA label="See completed spaces" onClick={() => onNavigateToProjects('space')} />
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
    return (
      <section ref={(el) => {
        (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} className={`pt-12 md:pt-16 border-t border-tea-ink/5 dark:border-white/5 ${reveal.className}`} style={reveal.style}>
        <ServiceHero ariaLabel="Ceremonial tea space with floor seating" />
        <ServiceLabel>Sessions</ServiceLabel>
        <ServiceHeading>Sessions & Guidance</ServiceHeading>
        <ServiceDivider />

        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-10">
          Tea experiences and practice support — in the Bali studio or wherever you are.
        </p>

        <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-2">
          Offerings
        </p>
        <div className="max-w-[640px]">
          {OFFERINGS.map(({ name, price, desc }) => (
            <div key={name} className="flex items-start justify-between py-5 border-b border-tea-ink/5 dark:border-white/5 last:border-0">
              <div>
                <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper">{name}</h4>
                <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mt-1">{desc}</p>
              </div>
              <span className="font-sans text-sm text-tea-seal whitespace-nowrap ml-4">{price}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mt-8 mb-3">
          What You Walk Away With
        </p>
        <ul className="space-y-1.5 mb-8">
          {WALKAWAY.map(item => (
            <li key={item} className="text-sm text-tea-ink/60 dark:text-tea-paper/60 flex items-start gap-2">
              <span className="text-tea-seal mt-0.5">&middot;</span> {item}
            </li>
          ))}
        </ul>

        <PrimaryCTA label="Book a session" onClick={() => onOpenInquiry('A session or practice guidance')} />
      </section>
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
    return (
      <section ref={(el) => {
        (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} className={`pt-12 md:pt-16 border-t border-tea-ink/5 dark:border-white/5 ${reveal.className}`} style={reveal.style}>
        <ServiceHero ariaLabel="Mountain tea terraces at sunrise" />
        <ServiceLabel>Travel</ServiceLabel>
        <ServiceHeading>Sourcing Journeys</ServiceHeading>
        <ServiceDivider />

        <div className="max-w-[640px] space-y-4 mb-8">
          <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
            Travel to tea origins with a guide who knows the way. Taiwan, China, and beyond.
          </p>
          <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
            For two decades, I've built relationships with farmers, masters, and artisans across Asia.
            These aren't tours — each journey is shaped around what calls to you.
          </p>
        </div>

        <p className="text-sm text-tea-seal uppercase tracking-wider mb-8">Seasonal &middot; By invitation</p>

        <div className="flex flex-col gap-2">
          <PrimaryCTA label="Start a conversation" onClick={() => onOpenInquiry('A sourcing journey')} />
          {onNavigateToMagazine && (
            <SecondaryCTA label="Read stories from tea origins" onClick={onNavigateToMagazine} />
          )}
        </div>
      </section>
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
    return (
      <section ref={(el) => {
        (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} className={`pt-12 md:pt-16 border-t border-tea-ink/5 dark:border-white/5 ${reveal.className}`} style={reveal.style}>
        <ServiceLabel>Supply</ServiceLabel>
        <ServiceHeading>Tea Sourcing</ServiceHeading>
        <ServiceDivider />

        <p className="font-serif text-lg italic text-tea-ink dark:text-tea-paper max-w-[640px] mb-4">
          Quality tea for your space, your collection, or your community.
        </p>
        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-8">
          Direct sourcing from Taiwan, China, and trusted origins. For individual collectors seeking access
          to exceptional teas. For retreat centers, hotels, and communities wanting quality tea as part of
          what they offer.
        </p>

        <div className="flex flex-col gap-2">
          <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('Tea sourcing')} />
          {onNavigateToShop && (
            <SecondaryCTA label="Browse the shop" onClick={onNavigateToShop} />
          )}
        </div>
      </section>
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
    return (
      <section ref={(el) => {
        (reveal.ref as React.MutableRefObject<HTMLElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
      }} className={`pt-12 md:pt-16 border-t border-tea-ink/5 dark:border-white/5 ${reveal.className}`} style={reveal.style}>
        <ServiceHero ariaLabel="Group tea ceremony with candles and charcoal" />
        <ServiceLabel>Events</ServiceLabel>
        <ServiceHeading>Tea Experiences for Gatherings</ServiceHeading>
        <ServiceDivider />

        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-6">
          I bring everything — tea, teaware, the setup, and the atmosphere — to your gathering.
          Retreats, dinners, brand activations, celebrations.
        </p>
        <p className="text-sm text-tea-seal mb-1">From $500 for a half-day.</p>
        <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mb-8">
          Full-day and multi-day experiences quoted based on scope.
        </p>

        <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('An event or group experience')} />
      </section>
    );
  }
);
EventsSection.displayName = 'EventsSection';
