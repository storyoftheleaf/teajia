import React, { forwardRef } from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { useSectionReveal } from '../../hooks/useSectionReveal';

/* =====================================================
   Shared helpers — reused across all service sections
   ===================================================== */

const ServiceHero = ({ ariaLabel, img }: { ariaLabel: string; img?: string }) => (
  <CardContainer variant="dark" className="w-full overflow-hidden mb-6 md:mb-8">
    {img ? (
      <img src={img} alt={ariaLabel} className="w-full object-cover bg-tea-ink/90" style={{ height: 'clamp(180px, 30vh, 340px)' }} loading="lazy" />
    ) : (
      <div className="w-full bg-tea-ink/90" style={{ height: 'clamp(180px, 30vh, 340px)' }} role="img" aria-label={ariaLabel} />
    )}
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

/** Primary CTA — filled button with visual weight */
export const PrimaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="bg-tea-seal hover:bg-tea-seal/90 text-white text-xs uppercase tracking-widest font-medium
               py-3 px-6 rounded-[1px] transition-colors duration-300 min-h-[44px]
               inline-flex items-center gap-2
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

/** Secondary CTA — outlined/ghost style, clearly subordinate */
export const SecondaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="border border-tea-ink/15 dark:border-white/15 hover:border-tea-seal/40 hover:text-tea-seal
               text-tea-ink/50 dark:text-tea-paper/50 text-xs uppercase tracking-widest
               font-medium py-2.5 px-5 rounded-[1px] inline-flex items-center gap-1.5
               transition-all duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

/** Subtle content panel — creates visual separation from the flat background */
const ContentPanel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-tea-ink/[0.025] dark:bg-white/[0.03] border border-tea-ink/[0.06] dark:border-white/[0.06]
                   rounded-[2px] p-5 md:p-6 ${className}`}>
    {children}
  </div>
);

/** Accent callout — left border highlight for pricing or key info */
const AccentCallout = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`border-l-2 border-tea-seal/40 pl-4 py-1 ${className}`}>
    {children}
  </div>
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
        <ServiceHero ariaLabel="A completed tea space with natural materials" img="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80&auto=format" />
        <ServiceLabel>Space Design</ServiceLabel>
        <ServiceHeading>Tea House Design & Curation</ServiceHeading>
        <ServiceDivider />

        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-8">
          Complete tea space creation — from concept through opening. Design, curation, tea selection,
          training, and operations. For hotels, resorts, retreat centers, private residences, and new
          tea house owners.
        </p>

        {/* Pillars — contained chips with visual weight */}
        <ContentPanel className="mb-8 max-w-[640px]">
          <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-3">
            What's Involved
          </p>
          <div className="flex flex-wrap gap-2">
            {PILLARS.map(p => (
              <span key={p} className="text-sm text-tea-ink/70 dark:text-tea-paper/70 bg-tea-paper dark:bg-white/[0.05]
                                       border border-tea-ink/[0.08] dark:border-white/[0.08] px-3 py-1.5 rounded-[1px]">
                {p}
              </span>
            ))}
          </div>
        </ContentPanel>

        {/* Process — visually distinct panel with step cards */}
        <ContentPanel className="mb-8">
          <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-4">
            The Process
          </p>
          {/* Mobile */}
          <ol className="md:hidden space-y-3 list-none p-0 m-0">
            {PROCESS.map(({ step, title, desc }) => (
              <li key={step} className="flex items-start gap-3 bg-tea-paper dark:bg-white/[0.03]
                                          border border-tea-ink/[0.05] dark:border-white/[0.05]
                                          rounded-[1px] p-3">
                <span aria-hidden="true" className="text-tea-seal font-mono text-sm w-5 h-5 flex items-center justify-center
                                 bg-tea-seal/10 rounded-full shrink-0">{step}</span>
                <div>
                  <span className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper">{title}</span>
                  <p className="text-[11px] text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          {/* Desktop */}
          <ol className="hidden md:grid md:grid-cols-5 gap-3 list-none p-0 m-0">
            {PROCESS.map(({ step, title, desc }) => (
              <li key={step} className="bg-tea-paper dark:bg-white/[0.03]
                                          border border-tea-ink/[0.05] dark:border-white/[0.05]
                                          rounded-[1px] p-3 text-center">
                <span aria-hidden="true" className="text-tea-seal font-mono text-sm w-6 h-6 flex items-center justify-center
                                 bg-tea-seal/10 rounded-full mx-auto mb-2">{step}</span>
                <h4 className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper">{title}</h4>
                <p className="text-[11px] text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">{desc}</p>
              </li>
            ))}
          </ol>
        </ContentPanel>

        {/* Pricing — accent callout with clear emphasis */}
        <AccentCallout className="mb-10 max-w-[640px]">
          <p className="text-sm font-medium text-tea-ink/70 dark:text-tea-paper/70">
            Projects range from $5,000 to $100,000+
          </p>
          <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">
            Every project is scoped through conversation.
          </p>
        </AccentCallout>

        <div className="flex flex-wrap items-center gap-3">
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
        <ServiceHero ariaLabel="Ceremonial tea space with floor seating" img="https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&q=80&auto=format" />
        <ServiceLabel>Sessions</ServiceLabel>
        <ServiceHeading>Sessions & Guidance</ServiceHeading>
        <ServiceDivider />

        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-8">
          Tea experiences and practice support — in the Bali studio or wherever you are.
        </p>

        {/* Offerings — contained in a panel with distinct rows */}
        <ContentPanel className="max-w-[640px] mb-8">
          <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-3">
            Offerings
          </p>
          {OFFERINGS.map(({ name, price, desc }, i) => (
            <div key={name} className={`flex items-start justify-between py-4 ${i < OFFERINGS.length - 1 ? 'border-b border-tea-ink/[0.06] dark:border-white/[0.06]' : ''}`}>
              <div>
                <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper">{name}</h4>
                <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mt-1">{desc}</p>
              </div>
              <span className="font-sans text-sm text-tea-seal whitespace-nowrap ml-4 bg-tea-seal/[0.08] px-2 py-0.5 rounded-[1px]">{price}</span>
            </div>
          ))}
        </ContentPanel>

        {/* Walkaway — distinct panel */}
        <ContentPanel className="max-w-[640px] mb-10">
          <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-3">
            What You Walk Away With
          </p>
          <ul className="space-y-2">
            {WALKAWAY.map(item => (
              <li key={item} className="text-sm text-tea-ink/60 dark:text-tea-paper/60 flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-tea-seal/50 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </ContentPanel>

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
        <ServiceHero ariaLabel="Mountain tea terraces at sunrise" img="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80&auto=format" />
        <ServiceLabel>Travel</ServiceLabel>
        <ServiceHeading>Sourcing Journeys</ServiceHeading>
        <ServiceDivider />

        <div className="max-w-[640px] space-y-4 mb-6">
          <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
            Travel to tea origins with a guide who knows the way. Taiwan, China, and beyond.
          </p>
          <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
            For two decades, I've built relationships with farmers, masters, and artisans across Asia.
            These aren't tours — each journey is shaped around what calls to you.
          </p>
        </div>

        {/* Badge — distinct visual treatment */}
        <div className="inline-flex items-center gap-2 bg-tea-seal/[0.08] border border-tea-seal/20
                        text-tea-seal text-xs uppercase tracking-wider px-3.5 py-2 rounded-[1px] mb-10">
          <Icons.Calendar className="w-3.5 h-3.5" />
          Seasonal &middot; By invitation
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-10">
          Direct sourcing from Taiwan, China, and trusted origins. For individual collectors seeking access
          to exceptional teas. For retreat centers, hotels, and communities wanting quality tea as part of
          what they offer.
        </p>

        <div className="flex flex-wrap items-center gap-3">
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
        <ServiceHero ariaLabel="Group tea ceremony with candles and charcoal" img="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200&q=80&auto=format" />
        <ServiceLabel>Events</ServiceLabel>
        <ServiceHeading>Tea Experiences for Gatherings</ServiceHeading>
        <ServiceDivider />

        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-8">
          I bring everything — tea, teaware, the setup, and the atmosphere — to your gathering.
          Retreats, dinners, brand activations, celebrations.
        </p>

        {/* Pricing — accent callout */}
        <AccentCallout className="mb-10 max-w-[640px]">
          <p className="text-sm font-medium text-tea-seal">From $500 for a half-day.</p>
          <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">
            Full-day and multi-day experiences quoted based on scope.
          </p>
        </AccentCallout>

        <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('An event or group experience')} />
      </section>
    );
  }
);
EventsSection.displayName = 'EventsSection';
