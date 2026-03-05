import React from 'react';
import { Icons } from '../Icons';
import { CardContainer } from '../shared/CardContainer';
import { useSectionReveal } from '../../hooks/useSectionReveal';
import { SECTION_GAP_LG } from '../shared/spacing';
import { useParallax } from '../../hooks/useParallax';
import { ServiceBadge } from './ServiceBadge';
import { StickyInquiryBar } from './StickyInquiryBar';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2 rounded-sm';
const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-ink/5 dark:hover:bg-white/5 px-2 -ml-2';

interface SourcingJourneysProps {
  onBack: () => void;
  onOpenInquiry: (preselect: string) => void;
  onNavigateProjects: () => void;
}

export const SourcingJourneys: React.FC<SourcingJourneysProps> = ({ onBack, onOpenInquiry, onNavigateProjects }) => {
  const { ref: parallaxRef, offset, isVisible: parallaxVisible } = useParallax(0.04);
  const reveal2 = useSectionReveal();
  const reveal3 = useSectionReveal();

  return (
    <div className="w-full">
      {/* Back navigation */}
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-ink/70 dark:text-tea-paper/70" />
        <span className="font-serif text-sm text-tea-ink/70 dark:text-tea-paper/70">Consult</span>
      </button>

      {/* Parallax Hero */}
      <section ref={parallaxRef} className="relative -mx-6 md:-mx-10 mb-10 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-tea-ink/90 transition-transform duration-100"
            style={{
              transform: `translateY(${parallaxVisible ? offset : 0}px) scale(1.1)`,
              filter: 'brightness(0.3) saturate(0.7)',
            }}
            role="img"
            aria-label="Sourcing journey through tea origins"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-tea-charcoal/40 via-transparent to-tea-charcoal" />
        </div>
        <div className="relative z-10 px-6 md:px-10 pt-20 pb-16 md:pt-28 md:pb-24 min-h-[55vh] md:min-h-[45vh] flex flex-col justify-end">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans">
              Travel
            </p>
            <ServiceBadge type="seasonal" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-4 text-tea-paper">
            Sourcing Journeys
          </h1>
          <p className="font-sans text-base font-light text-tea-paper/70">
            Travel to tea origins with a guide who knows the way.
          </p>
        </div>
      </section>

      {/* Body */}
      <div ref={reveal2.ref} className={`${SECTION_GAP_LG} max-w-[640px] ${reveal2.className}`} style={reveal2.style}>
        <p className="font-sans text-sm leading-relaxed mb-10 text-tea-ink/70 dark:text-tea-paper/70">
          For two decades, I've traveled through Taiwan, China, and beyond, building relationships with farmers, masters, and artisans. These aren't tours. Each journey is shaped around what calls to you: farms you want to visit, teas you want to source, makers you want to meet. I handle the language, the logistics, and the introductions.
        </p>

        {/* Additional journey images */}
        <div className="space-y-6 mb-10">
          <CardContainer variant="dark" className="w-full overflow-hidden">
            <div className="w-full h-[40vh] md:h-[30vh] bg-tea-ink/90" role="img" aria-label="Tea farm visit" />
          </CardContainer>
          <CardContainer variant="dark" className="w-full overflow-hidden">
            <div className="w-full h-[40vh] md:h-[30vh] bg-tea-ink/90" role="img" aria-label="Tea master meeting" />
          </CardContainer>
          <CardContainer variant="dark" className="w-full overflow-hidden">
            <div className="w-full h-[40vh] md:h-[30vh] bg-tea-ink/90" role="img" aria-label="Tea processing observation" />
          </CardContainer>
        </div>
      </div>

      {/* Links */}
      <div ref={reveal3.ref} className={`${SECTION_GAP_LG} ${reveal3.className}`} style={reveal3.style}>
        <button
          onClick={onNavigateProjects}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] mb-6 ${CTA_FOCUS}`}
        >
          See past journeys
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="pt-16 md:pt-20">
          <p className="font-serif text-lg font-medium mb-6 text-tea-ink dark:text-tea-paper">
            Every journey is different. We start with a conversation.
          </p>
          <button
            onClick={() => onOpenInquiry('A sourcing journey')}
            className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
          >
            Start a conversation
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cross-section CTA */}
      <div className={`border-t border-tea-ink/10 dark:border-white/10 pt-10 ${SECTION_GAP_LG}`}>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">
          From the Magazine
        </p>
        <p className="font-serif text-lg text-tea-ink dark:text-tea-paper mb-4">
          Read stories from tea origins
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'MAGAZINE' } }))}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          Read the Magazine
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sticky inquiry bar */}
      <StickyInquiryBar onOpenInquiry={() => onOpenInquiry('A sourcing journey')} />
    </div>
  );
};
