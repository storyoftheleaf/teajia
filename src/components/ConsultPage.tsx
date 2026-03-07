import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { ServiceContent } from './consult/ServiceContent';
import { useSectionReveal } from '../hooks/useSectionReveal';

/* =====================================================
   PATH_CARDS data
   ===================================================== */

const PATH_CARDS = [
  {
    id: 'design',
    headline: 'I want to create a tea space',
    subline: 'Hotels, retreats, homes, community spaces',
    service: 'Design & Curation',
    badge: 'By Inquiry',
    inquiryPreselect: 'Space design or tea integration',
    flagship: true,
  },
  {
    id: 'sessions',
    headline: 'I want to deepen my practice',
    subline: 'Sessions, guidance, building a practice',
    service: 'Sessions & Guidance',
    badge: 'From $50',
    inquiryPreselect: 'A session or practice guidance',
  },
  {
    id: 'journeys',
    headline: 'I want to travel to tea origins',
    subline: 'Sourcing journeys through Asia',
    service: 'Sourcing Journeys',
    badge: 'Seasonal',
    inquiryPreselect: 'A sourcing journey',
  },
  {
    id: 'sourcing',
    headline: 'I need quality tea for my space',
    subline: 'Sourcing for businesses and collectors',
    service: 'Tea Sourcing',
    badge: 'By Inquiry',
    inquiryPreselect: 'Tea sourcing',
  },
  {
    id: 'events',
    headline: 'I want a tea experience for an event',
    subline: 'Retreats, dinners, celebrations, gatherings',
    service: 'Events',
    badge: 'From $500',
    inquiryPreselect: 'An event or group experience',
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
  const [currentView, setCurrentView] = useState<ConsultView>('main');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPreselect, setInquiryPreselect] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [cardsVisible, setCardsVisible] = useState(true);

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const openInquiry = useCallback((preselect: string) => {
    setInquiryPreselect(preselect);
    setInquiryOpen(true);
  }, []);

  const navigateTo = useCallback((view: ConsultView, projectId?: string) => {
    setCurrentView(view);
    if (projectId) setSelectedProjectId(projectId);
    window.scrollTo(0, 0);
  }, []);

  // IntersectionObserver for sticky mobile bar
  useEffect(() => {
    if (!cardsRef.current) return;
    const obs = new IntersectionObserver(([e]) => setCardsVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(cardsRef.current);
    return () => obs.disconnect();
  }, []);

  const handleSelectPath = useCallback((pathId: string) => {
    const next = selectedPath === pathId ? null : pathId;
    setSelectedPath(next);
    // Mobile: scroll to content when selecting
    if (next && window.innerWidth < 768) {
      setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [selectedPath]);

  const navigateToSection = useCallback((section: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { section } }));
  }, []);

  const selectedProject = selectedProjectId
    ? consultProjects.find(p => p.id === selectedProjectId)
    : null;

  // Sub-views: Projects and ProjectDetail
  if (currentView === 'projects') {
    return (
      <div className="w-full animate-[fadeIn_0.6s_ease-out]">
        <PageHeader title="Consult" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
        <div className="mt-8">
          <Projects onBack={() => navigateTo('main')} onSelectProject={(id) => navigateTo('project-detail', id)} />
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
            onBack={() => navigateTo('projects')}
            onOpenInquiry={openInquiry}
            onNavigateProjects={() => navigateTo('projects')}
          />
        </div>
        <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
      </div>
    );
  }

  // Main layout
  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader title="Consult" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />

      {/* Mobile sticky selection indicator */}
      {selectedPath && !cardsVisible && (
        <div className="md:hidden sticky top-[var(--header-height,56px)] z-20 bg-white/80 dark:bg-[#1a1a1a]/80
                        backdrop-blur-xl border-b border-tea-ink/5 dark:border-white/5 px-4 py-2.5
                        flex items-center justify-between animate-[fadeIn_0.2s_ease-out]">
          <span className="font-serif text-sm text-tea-ink dark:text-tea-paper">
            {PATH_CARDS.find(c => c.id === selectedPath)?.service}
          </span>
          <button onClick={() => cardsRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="text-tea-seal text-xs uppercase tracking-wider min-h-[44px] flex items-center">
            Change
          </button>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        {/* Opening */}
        <div className="pt-8 md:pt-12 lg:pt-16">
          <h2 className="font-serif text-2xl md:text-3xl font-light text-tea-ink dark:text-tea-paper">
            What brings you here?
          </h2>
          <div className="w-12 h-[1px] bg-tea-seal mt-4 mb-8 md:mb-10" />
        </div>

        {/* Path Cards */}
        <div ref={cardsRef}>
          <PathCardGrid selectedPath={selectedPath} onSelect={handleSelectPath} />
        </div>

        {/* "Just talk" link */}
        <button
          onClick={() => openInquiry('')}
          className="mt-4 font-sans text-sm text-tea-ink/40 dark:text-tea-paper/40 hover:text-tea-seal
                     transition-colors duration-200 flex items-center gap-1 min-h-[44px]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm"
        >
          Or, just start a conversation
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Expanded service content */}
        {selectedPath && (
          <div
            ref={contentRef}
            key={selectedPath}
            className="mt-10 md:mt-12 animate-[fadeIn_0.4s_ease-out]"
            aria-live="polite"
          >
            <ServiceContent
              path={selectedPath}
              onOpenInquiry={openInquiry}
              onNavigateToProjects={() => navigateTo('projects')}
              onNavigateToShop={() => navigateToSection('SHOP')}
              onNavigateToMagazine={() => navigateToSection('MAGAZINE')}
            />
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-tea-ink/5 dark:border-white/5 mt-16 md:mt-20" />

        {/* Adrian */}
        <AdrianSection />

        {/* Projects Preview */}
        <ProjectsPreview
          selectedPath={selectedPath}
          onSelectProject={(id) => navigateTo('project-detail', id)}
          onViewAll={() => navigateTo('projects')}
        />

        {/* Testimonials */}
        <TestimonialRotator />

        {/* Closing CTA */}
        <ClosingCTA onOpenInquiry={() => openInquiry('')} />
      </div>

      <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
    </div>
  );
};

/* =====================================================
   PathCardGrid
   ===================================================== */

interface PathCardGridProps {
  selectedPath: string | null;
  onSelect: (id: string) => void;
}

const PathCardGrid: React.FC<PathCardGridProps> = ({ selectedPath, onSelect }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {PATH_CARDS.map(card => (
      <button
        key={card.id}
        aria-pressed={selectedPath === card.id}
        onClick={() => onSelect(card.id)}
        className={`
          ${'flagship' in card && card.flagship ? 'md:col-span-2' : ''}
          group text-left p-5 md:p-6 rounded-[1px] transition-all duration-300
          border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2
          ${selectedPath === card.id
            ? 'border-tea-seal/40 bg-tea-seal/[4%] dark:bg-tea-seal/[6%]'
            : 'border-tea-ink/10 dark:border-white/10 hover:border-tea-ink/20 dark:hover:border-white/20 hover:bg-tea-ink/[2%] dark:hover:bg-white/[2%]'
          }
        `}
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-serif text-base md:text-lg text-tea-ink dark:text-tea-paper">
            {card.headline}
          </span>
          <span className="font-sans text-sm text-tea-ink/50 dark:text-tea-paper/50">
            {card.subline}
          </span>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-tea-ink/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">
              {card.service}
            </span>
            <span className="text-tea-ink/20 dark:text-tea-paper/20">&middot;</span>
            <span className="text-[11px] uppercase tracking-wider text-tea-seal">
              {card.badge}
            </span>
          </div>
          <Icons.ChevronRight className="w-4 h-4 text-tea-ink/20 dark:text-tea-paper/20 group-hover:text-tea-seal transition-colors" />
        </div>
      </button>
    ))}
  </div>
);

/* =====================================================
   AdrianSection
   ===================================================== */

const AdrianSection: React.FC = () => {
  const reveal = useSectionReveal();
  return (
    <section ref={reveal.ref} className={`mt-16 md:mt-20 ${reveal.className}`} style={reveal.style}>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Photo placeholder */}
        <div className="w-full md:w-40 md:h-40 aspect-[4/3] md:aspect-square bg-tea-ink/5 dark:bg-white/5
                        rounded-[1px] flex items-center justify-center shrink-0">
          <span className="text-sm text-tea-ink/30 dark:text-tea-paper/30 uppercase tracking-widest">Photo</span>
        </div>
        {/* Text */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-tea-ink/40 dark:text-tea-paper/40 mb-2">
            Adrian Rasmussen
          </p>
          <p className="font-serif text-lg text-tea-ink dark:text-tea-paper mb-3">
            Twenty years in tea culture. Taiwan, China, Bali, and beyond.
          </p>
          <p className="text-sm text-tea-ink/60 dark:text-tea-paper/60 leading-relaxed max-w-[480px]">
            Adrian's background in design and visual art shapes everything he creates — from the way
            tea is presented to the spaces where it's shared. Two decades of sourcing relationships
            across Asia. A practice rooted in Bali with international reach.
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
  selectedPath: string | null;
  onSelectProject: (id: string) => void;
  onViewAll: () => void;
}

const ProjectsPreview: React.FC<ProjectsPreviewProps> = ({ selectedPath, onSelectProject, onViewAll }) => {
  const reveal = useSectionReveal();

  const getProjects = () => {
    const filterMap: Record<string, string> = {
      design: 'space',
      journeys: 'journey',
      events: 'event',
    };
    const typeFilter = selectedPath ? filterMap[selectedPath] : null;
    let filtered = typeFilter
      ? consultProjects.filter(p => p.type === typeFilter)
      : consultProjects.filter(p => p.featured);

    // Pad to 3 if needed
    if (filtered.length < 3) {
      const featured = consultProjects.filter(p => p.featured && !filtered.includes(p));
      filtered = [...filtered, ...featured].slice(0, 3);
    }
    return filtered.slice(0, 3);
  };

  const projects = getProjects();

  return (
    <section ref={reveal.ref} className={`mt-16 md:mt-20 ${reveal.className}`} style={reveal.style}>
      <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">Portfolio</p>
      <h3 className="font-serif text-2xl md:text-3xl font-normal text-tea-ink dark:text-tea-paper">Projects</h3>
      <div className="w-12 h-[1px] bg-tea-seal mt-3 mb-8" />

      {/* Desktop grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-5 mb-8">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
        ))}
      </div>

      {/* Mobile carousel */}
      <div className="md:hidden mb-8">
        <SwipeCarousel showDots peek={12}>
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
          ))}
        </SwipeCarousel>
      </div>

      <button onClick={onViewAll}
        className="text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium
                   flex items-center gap-1 transition-colors duration-300 min-h-[44px]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
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

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => (
  <button onClick={onClick} className="text-left group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    <CardContainer variant="dark" className="overflow-hidden mb-3 group-hover:-translate-y-1 transition-all duration-300">
      <div className="w-full bg-tea-ink/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} project`} />
    </CardContainer>
    <h4 className="font-serif text-base font-medium text-tea-ink dark:text-tea-paper">{project.name}</h4>
    <p className="text-xs uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">{project.location}</p>
  </button>
);

/* =====================================================
   TestimonialRotator
   ===================================================== */

const TestimonialRotator: React.FC = () => {
  const reveal = useSectionReveal();
  const [index, setIndex] = useState(0);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion || consultTestimonials.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % consultTestimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const t = consultTestimonials[index];

  return (
    <section ref={reveal.ref} className={`mt-16 md:mt-20 text-center ${reveal.className}`} style={reveal.style}>
      <div className="relative max-w-[640px] mx-auto">
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-serif text-6xl text-tea-seal/20 select-none pointer-events-none">
          &ldquo;
        </span>
        <p key={t.id} className="font-serif text-lg md:text-xl italic text-tea-ink dark:text-tea-paper leading-relaxed
                                  animate-[fadeIn_0.4s_ease-out]">
          {t.quote}
        </p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-tea-ink/50 dark:text-tea-paper/50">{t.name}</p>
          <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40">{t.title}</p>
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
      className={`border-t border-tea-ink/5 dark:border-white/5 mt-16 md:mt-20 pt-16 md:pt-20 pb-24 md:pb-32 text-center ${reveal.className}`}
      style={reveal.style}>
      <h3 className="font-serif text-2xl md:text-3xl font-light text-tea-ink dark:text-tea-paper">
        Every project begins with a conversation.
      </h3>
      <div className="w-12 h-[1px] bg-tea-seal mx-auto mt-4 mb-8" />
      <button onClick={onOpenInquiry}
        className="bg-tea-seal hover:bg-tea-seal/90 text-white text-xs uppercase tracking-widest font-medium
                   py-3.5 px-8 rounded-[1px] transition-colors min-h-[44px] mx-auto inline-flex items-center gap-2
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2">
        Start a Conversation
        <Icons.ChevronRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
};
