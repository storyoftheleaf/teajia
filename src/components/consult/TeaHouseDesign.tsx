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

interface TeaHouseDesignProps {
  onBack: () => void;
  onOpenInquiry: (preselect: string) => void;
  onNavigateProjects: () => void;
}

const PILLARS = [
  { title: 'Design', desc: 'Space layout, atmosphere, light, and flow.' },
  { title: 'Curation', desc: 'Every object chosen with intention. Teaware, furniture, art, textiles.' },
  { title: 'Tea Selection', desc: 'A collection built for your space, your climate, your community.' },
  { title: 'Training', desc: 'Your team learns to brew, to serve, and to hold space with presence.' },
  { title: 'Operations', desc: 'The daily rhythm. Service flow, sourcing, seasonal rotation. How the space stays alive.' },
] as const;

const PROCESS_STEPS = [
  { num: '1', title: 'Conversation', desc: 'We sit together (in person or by video) and I learn about your vision, your space, and your community.' },
  { num: '2', title: 'Concept', desc: 'I send you a written design proposal with direction for atmosphere, curation, and tea.' },
  { num: '3', title: 'Creation', desc: 'Sourcing, building, installing. I bring the plan to life, object by object.' },
  { num: '4', title: 'Training', desc: 'Before you open, your team learns everything. Brewing, ceremony, service, knowledge.' },
  { num: '5', title: 'Opening', desc: 'Launch support, refinement, and the beginning of an ongoing relationship.' },
] as const;

export const TeaHouseDesign: React.FC<TeaHouseDesignProps> = ({ onBack, onOpenInquiry, onNavigateProjects }) => {
  const { ref: parallaxRef, offset, isVisible: parallaxVisible } = useParallax(0.04);
  const reveal2 = useSectionReveal();
  const reveal3 = useSectionReveal();
  const reveal4 = useSectionReveal();
  const reveal5 = useSectionReveal();
  const reveal6 = useSectionReveal();

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
            aria-label="Tea house design space"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-tea-charcoal/40 via-transparent to-tea-charcoal" />
        </div>
        <div className="relative z-10 px-6 md:px-10 pt-20 pb-16 md:pt-28 md:pb-24 min-h-[55vh] md:min-h-[45vh] flex flex-col justify-end">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans">
              Space Design
            </p>
            <ServiceBadge type="by-inquiry" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-4 text-tea-paper">
            Tea House Design & Curation
          </h1>
          <p className="font-sans text-base font-light text-tea-paper/70">
            From empty room to living tea space.
          </p>
        </div>
      </section>

      {/* The Invitation */}
      <div ref={reveal2.ref} className={`${SECTION_GAP_LG} max-w-[640px] ${reveal2.className}`} style={reveal2.style}>
        <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
          Every tea space tells a story. The light, the materials, the objects, the way a seat faces the window. I work with people who want tea to become part of how their space lives. Sometimes that's a complete tea house. Sometimes it's a single room transformed. The work covers design, curation, tea selection, training, and ongoing support, shaped to what your space and community need.
        </p>
      </div>

      {/* What's Involved */}
      <div ref={reveal3.ref} className={`${SECTION_GAP_LG} ${reveal3.className}`} style={reveal3.style}>
        {PILLARS.map(pillar => (
          <div key={pillar.title} className="mb-10">
            <h3 className="font-serif text-lg font-medium mb-2 text-tea-ink dark:text-tea-paper">
              {pillar.title}
            </h3>
            <p className="font-sans text-sm text-tea-ink/70 dark:text-tea-paper/70">
              {pillar.desc}
            </p>
          </div>
        ))}
      </div>

      {/* The Process */}
      <div ref={reveal4.ref} className={`${SECTION_GAP_LG} ${reveal4.className}`} style={reveal4.style}>
        {PROCESS_STEPS.map(step => (
          <div key={step.num} className="mb-12">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-sans text-sm text-tea-ink/40 dark:text-tea-paper/40">{step.num}</span>
              <h3 className="font-serif text-lg font-medium text-tea-ink dark:text-tea-paper">{step.title}</h3>
            </div>
            <p className="font-sans text-sm pl-7 text-tea-ink/70 dark:text-tea-paper/70">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Who This Is For */}
      <div ref={reveal5.ref} className={`${SECTION_GAP_LG} ${reveal5.className}`} style={reveal5.style}>
        <p className="font-sans text-sm text-tea-ink/70 dark:text-tea-paper/70">
          Hotels and resorts. Retreat centers. Private residences. Restaurants. New tea house owners. Anyone with a space and a vision.
        </p>
      </div>

      {/* Portfolio Link */}
      <div className={SECTION_GAP_LG}>
        <button
          onClick={onNavigateProjects}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          See spaces I've designed
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Closing CTA */}
      <div ref={reveal6.ref} className={`pt-16 md:pt-20 ${SECTION_GAP_LG} ${reveal6.className}`} style={reveal6.style}>
        <p className="font-serif text-lg font-medium mb-6 text-tea-ink dark:text-tea-paper">
          Every project is different. We start with a conversation.
        </p>
        <button
          onClick={() => onOpenInquiry('Space design or tea integration')}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          Start a conversation
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cross-section CTA */}
      <div className={`border-t border-tea-ink/10 dark:border-white/10 pt-10 ${SECTION_GAP_LG}`}>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">
          From the Shop
        </p>
        <p className="font-serif text-lg text-tea-ink dark:text-tea-paper mb-4">
          Explore teaware and furnishings for your space
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'SHOP' } }))}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          Browse the Collection
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sticky inquiry bar */}
      <StickyInquiryBar onOpenInquiry={() => onOpenInquiry('Space design or tea integration')} />
    </div>
  );
};
