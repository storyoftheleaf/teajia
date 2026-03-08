import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from './shared/PageHeader';
import { CardContainer } from './shared/CardContainer';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { Icons } from './Icons';
import { ConsultView } from '../types/consult';
import { consultProjects } from '../data/consultProjects';
import { consultTestimonials } from '../data/consultTestimonials';
import { InquiryForm } from './consult/InquiryForm';
import { Projects } from './consult/Projects';
import { ProjectDetail } from './consult/ProjectDetail';
import {
  DesignSection,
  SessionsSection,
  JourneysSection,
  SourcingSection,
  EventsSection,
} from './consult/ServiceContent';
import { useSectionReveal } from '../hooks/useSectionReveal';

/* =====================================================
   TILE_DATA — compact overview for visual grid
   ===================================================== */

const TILE_DATA = [
  {
    id: 'design',
    label: 'Space Design',
    badge: 'By Inquiry',
    ariaLabel: 'Tea house and space design services',
    flagship: true,
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80&auto=format',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    badge: 'From $50',
    ariaLabel: 'Tea sessions and guided practice',
    img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80&auto=format',
  },
  {
    id: 'journeys',
    label: 'Journeys',
    badge: 'Seasonal',
    ariaLabel: 'Sourcing journeys to tea origins',
    img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&q=80&auto=format',
  },
  {
    id: 'sourcing',
    label: 'Sourcing',
    badge: 'By Inquiry',
    ariaLabel: 'Tea sourcing for businesses and collectors',
    img: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&q=80&auto=format',
  },
  {
    id: 'events',
    label: 'Events',
    badge: 'From $500',
    ariaLabel: 'Tea experiences for gatherings and events',
    img: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=80&auto=format',
  },
] as const;

/* =====================================================
   ConsultPage — main shell
   ===================================================== */

interface ConsultPageProps {
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

export const ConsultPage: React.FC<ConsultPageProps> = ({ onCartClick, onAccountClick, cartItemCount = 0 }) => {
  // URL-synced sub-view navigation — browser back works properly
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get('v') || 'main') as ConsultView;
  const selectedProjectId = searchParams.get('pid') || null;
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPreselect, setInquiryPreselect] = useState('');

  // Scroll position memory per sub-view
  const scrollPositions = useRef<Record<string, number>>({});
  const prevView = useRef<ConsultView>(currentView);

  // Section refs for scroll-to-depth
  const designRef = useRef<HTMLElement>(null);
  const sessionsRef = useRef<HTMLElement>(null);
  const journeysRef = useRef<HTMLElement>(null);
  const sourcingRef = useRef<HTMLElement>(null);
  const eventsRef = useRef<HTMLElement>(null);

  const sectionRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    design: designRef,
    sessions: sessionsRef,
    journeys: journeysRef,
    sourcing: sourcingRef,
    events: eventsRef,
  };

  // Save/restore scroll position when sub-view changes (including browser back)
  useEffect(() => {
    if (prevView.current !== currentView) {
      scrollPositions.current[prevView.current] = window.scrollY;
      const savedPosition = scrollPositions.current[currentView] ?? 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
      });
      prevView.current = currentView;
    }
  }, [currentView]);

  const openInquiry = useCallback((preselect: string) => {
    setInquiryPreselect(preselect);
    setInquiryOpen(true);
  }, []);

  const navigateTo = useCallback((view: ConsultView, projectId?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (view === 'main') {
        next.delete('v');
        next.delete('pid');
      } else {
        next.set('v', view);
        if (projectId) next.set('pid', projectId);
        else next.delete('pid');
      }
      return next;
    }, { replace: false });
    // Clear saved position for the target so it starts at top
    delete scrollPositions.current[view];
  }, [setSearchParams]);

  const scrollToSection = useCallback((sectionId: string) => {
    const ref = sectionRefs[sectionId];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const navigateToSection = useCallback((section: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { section } }));
  }, []);

  const selectedProject = selectedProjectId
    ? consultProjects.find(p => p.id === selectedProjectId)
    : null;

  // Sub-views: Projects and ProjectDetail — browser back works via URL params
  if (currentView === 'projects') {
    return (
      <div className="w-full animate-[fadeIn_0.6s_ease-out]">
        <PageHeader title="Consult" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
        <div className="mt-8">
          <Projects onBack={() => window.history.back()} onSelectProject={(id) => navigateTo('project-detail', id)} />
        </div>
        <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
      </div>
    );
  }

  if (currentView === 'project-detail' && selectedProject) {
    return (
      <div className="w-full animate-[fadeIn_0.6s_ease-out]">
        <PageHeader title="Consult" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
        <div className="mt-8">
          <ProjectDetail
            project={selectedProject}
            onBack={() => window.history.back()}
            onOpenInquiry={openInquiry}
            onNavigateProjects={() => navigateTo('projects')}
          />
        </div>
        <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
      </div>
    );
  }

  // Main layout — visual tiles + scroll-to-depth
  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader title="Consult" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />

      <div className="max-w-[1400px] mx-auto">
        {/* Hero statement */}
        <div className="pt-8 md:pt-12 lg:pt-16">
          <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl font-light text-tea-text leading-snug">
            Tea spaces, sourcing, guidance.
          </h2>
          <p className="font-sans text-sm text-tea-text/50 mt-3 max-w-[480px]">
            Twenty years of practice across Taiwan, China, and Bali — distilled into services for those
            who take tea seriously.
          </p>
          <div className="w-12 h-[1px] bg-tea-gold mt-6 mb-8 md:mb-10" />
        </div>

        {/* Visual Tile Grid */}
        <TileGrid onTileClick={scrollToSection} />

        {/* Adrian — between overview and depth */}
        <AdrianSection />

        {/* All service sections — always visible, scroll-revealed */}
        <div className="mt-12 md:mt-16">
          <p className="text-xs uppercase tracking-[0.2em] text-tea-text/30 font-sans mb-0">
            Services
          </p>
        </div>

        <DesignSection
          ref={designRef}
          onOpenInquiry={openInquiry}
          onNavigateToProjects={() => navigateTo('projects')}
        />
        <SessionsSection
          ref={sessionsRef}
          onOpenInquiry={openInquiry}
        />
        <JourneysSection
          ref={journeysRef}
          onOpenInquiry={openInquiry}
          onNavigateToMagazine={() => navigateToSection('MAGAZINE')}
        />
        <SourcingSection
          ref={sourcingRef}
          onOpenInquiry={openInquiry}
          onNavigateToShop={() => navigateToSection('SHOP')}
        />
        <EventsSection
          ref={eventsRef}
          onOpenInquiry={openInquiry}
        />

        {/* Portfolio Preview */}
        <ProjectsPreview
          onSelectProject={(id) => navigateTo('project-detail', id)}
          onViewAll={() => navigateTo('projects')}
        />

        {/* Single Testimonial */}
        <SingleTestimonial />

        {/* Closing CTA */}
        <ClosingCTA onOpenInquiry={() => openInquiry('')} />
      </div>

      <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
    </div>
  );
};

/* =====================================================
   TileGrid — visual overview, mobile-first
   ===================================================== */

interface TileGridProps {
  onTileClick: (sectionId: string) => void;
}

const TileGrid: React.FC<TileGridProps> = ({ onTileClick }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
    {TILE_DATA.map(tile => (
      <button
        key={tile.id}
        aria-label={tile.ariaLabel}
        onClick={() => onTileClick(tile.id)}
        className={`
          ${tile.flagship ? 'col-span-2 md:col-span-2 md:row-span-2' : ''}
          group relative overflow-hidden rounded-lg
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2
          transition-transform duration-300 md:hover:scale-[1.02]
        `}
      >
        {/* Image with aspect ratio */}
        <img
          src={tile.img}
          alt=""
          aria-hidden="true"
          className={`
            w-full object-cover bg-tea-text/[0.06] 
            ${tile.flagship ? 'aspect-[2/1] md:aspect-[4/3]' : 'aspect-[3/2]'}
          `}
          loading="lazy"
        />

        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent
                        md:group-hover:from-black/70 transition-all duration-300" />

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-4">
          <span className="font-serif text-base md:text-lg text-tea-paper leading-tight">
            {tile.label}
          </span>
          <span className="text-[10px] md:text-[11px] uppercase tracking-wider text-tea-paper/60 mt-1">
            {tile.badge}
          </span>
        </div>
      </button>
    ))}
  </div>
);

/* =====================================================
   AdrianSection — redesigned, mobile-first
   ===================================================== */

const AdrianSection: React.FC = () => {
  const reveal = useSectionReveal();
  return (
    <section ref={reveal.ref} className={`mt-12 md:mt-16 ${reveal.className}`} style={reveal.style}>
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Photo — full-width on mobile, constrained on desktop */}
        <img
          src="https://images.unsplash.com/photo-1545239351-ef35f43d514b?w=600&q=80&auto=format"
          alt="Adrian Rasmussen"
          className="w-full md:w-[280px] aspect-[3/2] md:aspect-[4/5] object-cover bg-tea-text/[0.06] 
                     rounded-lg shrink-0"
          loading="lazy"
        />

        {/* Text */}
        <div className="flex flex-col justify-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-tea-gold font-sans mb-3">
            Adrian Rasmussen
          </p>
          <p className="font-serif text-xl md:text-2xl text-tea-text leading-snug mb-4">
            Twenty years in tea culture.<br className="hidden md:block" />
            Taiwan, China, Bali, and beyond.
          </p>
          <p className="text-sm text-tea-text/60 leading-relaxed max-w-[520px] mb-3">
            Adrian's background in design and visual art shapes everything he creates — from the way
            tea is presented to the spaces where it's shared. Two decades of sourcing relationships
            across Asia. A practice rooted in Bali with international reach.
          </p>
          <p className="text-sm text-tea-text/40 leading-relaxed max-w-[520px]">
            Whether you're building a tea room for a resort, seeking rare teas for your collection,
            or looking to deepen your personal practice — the approach is always the same: listen first,
            then create something that lasts.
          </p>
        </div>
      </div>
    </section>
  );
};

/* =====================================================
   ProjectsPreview
   ===================================================== */

interface ProjectsPreviewProps {
  onSelectProject: (id: string) => void;
  onViewAll: () => void;
}

const ProjectsPreview: React.FC<ProjectsPreviewProps> = ({ onSelectProject, onViewAll }) => {
  const reveal = useSectionReveal();
  const projects = consultProjects.filter(p => p.featured).slice(0, 3);

  return (
    <section ref={reveal.ref} className={`mt-12 md:mt-16 pt-12 md:pt-16 border-t border-tea-border ${reveal.className}`} style={reveal.style}>
      <p className="text-xs uppercase tracking-[0.2em] text-tea-gold font-sans mb-2">Portfolio</p>
      <h3 className="font-serif text-2xl md:text-3xl font-normal text-tea-text">Projects</h3>
      <div className="w-12 h-[1px] bg-tea-gold mt-3 mb-8" />

      {/* Mobile carousel */}
      <div className="md:hidden mb-8">
        <SwipeCarousel showDots peek={12}>
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
          ))}
        </SwipeCarousel>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-5 mb-8">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
        ))}
      </div>

      <button onClick={onViewAll}
        className="text-tea-gold hover:text-tea-gold/80 text-xs uppercase tracking-[0.15em] font-medium
                   flex items-center gap-1 transition-colors duration-300 min-h-[44px]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm">
        View all projects <Icons.ChevronRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
};

/* =====================================================
   ProjectCard
   ===================================================== */

interface ProjectCardProps {
  project: typeof consultProjects[number];
  onClick: () => void;
}

const PROJECT_PLACEHOLDER_IMGS: Record<string, string> = {
  'intaaya-resort': 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600&q=80&auto=format',
  'private-residence': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80&auto=format',
  'studio-space-1': 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80&auto=format',
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => (
  <button onClick={onClick} className="text-left group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm">
    <CardContainer variant="dark" className="overflow-hidden mb-3 md:group-hover:-translate-y-1 transition-all duration-300">
      <img
        src={PROJECT_PLACEHOLDER_IMGS[project.id] || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&auto=format'}
        alt={`${project.name} project`}
        className="w-full object-cover bg-tea-elevated/90"
        style={{ aspectRatio: '16/10' }}
        loading="lazy"
      />
    </CardContainer>
    <h4 className="font-serif text-base font-medium text-tea-text">{project.name}</h4>
    <p className="text-xs uppercase tracking-wider text-tea-text/40">{project.location}</p>
  </button>
);

/* =====================================================
   SingleTestimonial — random on load, no rotation
   ===================================================== */

const SingleTestimonial: React.FC = () => {
  const reveal = useSectionReveal();
  const [testimonial] = useState(() => {
    const idx = Math.floor(Math.random() * consultTestimonials.length);
    return consultTestimonials[idx];
  });

  return (
    <section ref={reveal.ref} className={`mt-12 md:mt-16 pt-12 md:pt-16 text-center border-t border-tea-border ${reveal.className}`} style={reveal.style}>
      <div className="relative max-w-[640px] mx-auto">
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-serif text-6xl text-tea-gold/20 select-none pointer-events-none">
          &ldquo;
        </span>
        <p className="font-serif text-lg md:text-xl italic text-tea-text leading-relaxed">
          {testimonial.quote}
        </p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-tea-text/50">{testimonial.name}</p>
          <p className="text-xs text-tea-text/40">{testimonial.title}</p>
        </div>
      </div>
    </section>
  );
};

/* =====================================================
   ClosingCTA
   ===================================================== */

interface ClosingCTAProps {
  onOpenInquiry: () => void;
}

const ClosingCTA: React.FC<ClosingCTAProps> = ({ onOpenInquiry }) => {
  const reveal = useSectionReveal();
  return (
    <section ref={reveal.ref}
      className={`border-t border-tea-border mt-12 md:mt-16 pt-12 md:pt-16 pb-24 md:pb-32 text-center ${reveal.className}`}
      style={reveal.style}>
      <h3 className="font-serif text-2xl md:text-3xl font-light text-tea-text">
        Every project begins with a conversation.
      </h3>
      <div className="w-12 h-[1px] bg-tea-gold mx-auto mt-4 mb-8" />
      <button onClick={onOpenInquiry}
        className="bg-tea-gold hover:bg-tea-gold/90 text-white text-xs uppercase tracking-[0.15em] font-medium
                   py-3.5 px-8 rounded-lg transition-colors min-h-[44px] mx-auto inline-flex items-center gap-2
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2">
        Start a Conversation
        <Icons.ChevronRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
};
