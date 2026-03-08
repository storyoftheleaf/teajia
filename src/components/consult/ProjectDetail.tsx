import React, { useRef, useState, useEffect } from 'react';
import { Icons } from '../Icons';
import { ConsultProject } from '../../types/consult';
import { CardContainer } from '../shared/CardContainer';
import { useSectionReveal } from '../../hooks/useSectionReveal';
import { SECTION_GAP_LG } from '../shared/spacing';
import { useParallax } from '../../hooks/useParallax';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 rounded-sm';
const BACK_BTN = 'flex items-center gap-1.5 mb-8 group min-h-[44px] rounded-md hover:bg-tea-text/5 px-2 -ml-2';

interface ProjectDetailProps {
  project: ConsultProject;
  onBack: () => void;
  onOpenInquiry: (preselect: string) => void;
  onNavigateProjects: () => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, onOpenInquiry, onNavigateProjects }) => {
  const { ref: parallaxRef, offset, isVisible: parallaxVisible } = useParallax(0.04);
  const reveal2 = useSectionReveal();
  const reveal3 = useSectionReveal();
  const reveal4 = useSectionReveal();

  // Mobile swipeable gallery
  const galleryRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const galleryCount = 4;

  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const handleScroll = () => {
      const slideWidth = el.offsetWidth;
      const idx = Math.round(el.scrollLeft / slideWidth);
      setActiveSlide(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const inquiryPreselect = project.type === 'space'
    ? 'Space design or tea integration'
    : project.type === 'journey'
    ? 'A sourcing journey'
    : 'An event or group experience';

  return (
    <div className="w-full">
      {/* Back navigation */}
      <button onClick={onBack} className={BACK_BTN}>
        <Icons.Back className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform text-tea-text/70" />
        <span className="font-serif text-sm text-tea-text/70">Projects</span>
      </button>

      {/* Parallax Hero */}
      <section ref={parallaxRef} className="relative -mx-6 md:-mx-10 mb-10 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-tea-elevated/90 transition-transform duration-100"
            style={{
              transform: `translateY(${parallaxVisible ? offset : 0}px) scale(1.1)`,
              filter: 'brightness(0.3) saturate(0.7)',
            }}
            role="img"
            aria-label={`${project.name} project`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-tea-border via-transparent to-tea-bg" />
        </div>
        <div className="relative z-10 px-6 md:px-10 pt-20 pb-16 md:pt-28 md:pb-24 min-h-[55vh] md:min-h-[45vh] flex flex-col justify-end">
          <p className="text-xs uppercase tracking-[0.2em] text-tea-gold font-sans mb-3">
            {project.type === 'space' ? 'Space Design' : project.type === 'event' ? 'Event' : 'Sourcing Journey'}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-4 text-tea-paper">
            {project.name}
          </h1>
          <p className="font-sans text-sm text-tea-paper/50">
            {project.location}
          </p>
        </div>
      </section>

      <div className="h-12 md:h-20" />

      {/* The Story */}
      <div ref={reveal2.ref} className={`${SECTION_GAP_LG} max-w-[640px] ${reveal2.className}`} style={reveal2.style}>
        <h2 className="font-serif text-xl font-medium mb-4 text-tea-text">
          The Story
        </h2>
        <p className="font-sans text-sm leading-relaxed text-tea-text/70">
          {project.description}
        </p>
      </div>

      {/* The Work */}
      <div ref={reveal3.ref} className={`${SECTION_GAP_LG} max-w-[640px] ${reveal3.className}`} style={reveal3.style}>
        <h2 className="font-serif text-xl font-medium mb-4 text-tea-text">
          The Work
        </h2>
        <p className="font-sans text-sm leading-relaxed text-tea-text/70">
          {project.work}
        </p>
      </div>

      {/* Image gallery */}
      <div className={SECTION_GAP_LG}>
        {/* Mobile: horizontal swipeable */}
        <div
          ref={galleryRef}
          className="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-0 -mx-6 px-6 hide-scrollbar"
        >
          {Array.from({ length: galleryCount }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-full snap-center pr-4 last:pr-0">
              <CardContainer variant="dark" className="w-full overflow-hidden">
                <div className="w-full bg-tea-elevated/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} detail ${i + 1}`} />
              </CardContainer>
            </div>
          ))}
        </div>
        {/* Mobile dot indicators */}
        <div className="flex md:hidden justify-center gap-2 mt-4">
          {Array.from({ length: galleryCount }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                i === activeSlide ? 'bg-tea-gold' : 'bg-tea-text/20'
              }`}
            />
          ))}
        </div>

        {/* Desktop: 2-column grid */}
        <div className="hidden md:grid grid-cols-2 gap-6">
          {Array.from({ length: galleryCount }).map((_, i) => (
            <CardContainer key={i} variant="dark" className="w-full overflow-hidden">
              <div className="w-full bg-tea-elevated/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} detail ${i + 1}`} />
            </CardContainer>
          ))}
        </div>
      </div>

      {/* The Result */}
      <div ref={reveal4.ref} className={`${SECTION_GAP_LG} max-w-[640px] ${reveal4.className}`} style={reveal4.style}>
        <h2 className="font-serif text-xl font-medium mb-4 text-tea-text">
          The Result
        </h2>
        <p className="font-sans text-sm leading-relaxed text-tea-text/70">
          {project.result}
        </p>
      </div>

      {/* Closing CTAs */}
      <div className={`pt-16 md:pt-20 ${SECTION_GAP_LG}`}>
        <p className="font-serif text-lg font-medium mb-6 text-tea-text">
          Interested in something like this?
        </p>
        <button
          onClick={() => onOpenInquiry(inquiryPreselect)}
          className={`text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] mb-6 ${CTA_FOCUS}`}
        >
          Start a conversation
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div>
          <button
            onClick={onNavigateProjects}
            className={`text-tea-text/40 hover:text-tea-gold text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
          >
            See more projects
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cross-section CTA */}
      <div className={`border-t border-tea-border pt-10 ${SECTION_GAP_LG}`}>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-gold font-sans mb-2">
          From the Shop
        </p>
        <p className="font-serif text-lg text-tea-text mb-4">
          {project.type === 'space' ? 'Source teaware for your space' : 'Explore our tea collection'}
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { section: 'SHOP' } }))}
          className={`text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          Browse the Shop
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
