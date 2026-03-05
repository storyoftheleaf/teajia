import React, { useState, useCallback } from 'react';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { CardContainer } from './shared/CardContainer';
import { SwipeCarousel } from './shared/SwipeCarousel';
import { Icons } from './Icons';
import { ConsultView } from '../types/consult';
import { consultProjects } from '../data/consultProjects';
import { consultTestimonials } from '../data/consultTestimonials';
import { InquiryForm } from './consult/InquiryForm';
import { TeaHouseDesign } from './consult/TeaHouseDesign';
import { SourcingJourneys } from './consult/SourcingJourneys';
import { Projects } from './consult/Projects';
import { ProjectDetail } from './consult/ProjectDetail';
import { useSectionReveal } from '../hooks/useSectionReveal';
import { SECTION_GAP_LG } from './shared/spacing';

const CTA_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2 rounded-sm';

const CONSULT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'design', label: 'Design' },
  { id: 'sourcing', label: 'Sourcing' },
  { id: 'projects', label: 'Projects' },
];

const TAB_TO_VIEW: Record<string, ConsultView> = {
  overview: 'overview',
  design: 'tea-house-design',
  sourcing: 'sourcing-journeys',
  projects: 'projects',
};

const VIEW_TO_TAB: Record<string, string> = {
  overview: 'overview',
  'tea-house-design': 'design',
  'sourcing-journeys': 'sourcing',
  projects: 'projects',
  'project-detail': 'projects',
};

interface ConsultPageProps {
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

export const ConsultPage: React.FC<ConsultPageProps> = ({ onCartClick, onAccountClick, cartItemCount = 0 }) => {
  const [currentView, setCurrentView] = useState<ConsultView>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPreselect, setInquiryPreselect] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const openInquiry = useCallback((preselect: string) => {
    setInquiryPreselect(preselect);
    setInquiryOpen(true);
  }, []);

  const navigateTo = useCallback((view: ConsultView, projectId?: string) => {
    if (reducedMotion) {
      setCurrentView(view);
      if (projectId) setSelectedProjectId(projectId);
      window.scrollTo(0, 0);
      return;
    }
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentView(view);
      if (projectId) setSelectedProjectId(projectId);
      window.scrollTo(0, 0);
      requestAnimationFrame(() => setIsTransitioning(false));
    }, 150);
  }, [reducedMotion]);

  const navigateProjects = useCallback(() => {
    navigateTo('projects');
  }, [navigateTo]);

  const selectedProject = selectedProjectId
    ? consultProjects.find(p => p.id === selectedProjectId)
    : null;

  const renderView = () => {
    switch (currentView) {
      case 'tea-house-design':
        return (
          <TeaHouseDesign
            onBack={() => navigateTo('overview')}
            onOpenInquiry={openInquiry}
            onNavigateProjects={navigateProjects}
          />
        );
      case 'sourcing-journeys':
        return (
          <SourcingJourneys
            onBack={() => navigateTo('overview')}
            onOpenInquiry={openInquiry}
            onNavigateProjects={navigateProjects}
          />
        );
      case 'projects':
        return (
          <Projects
            onBack={() => navigateTo('overview')}
            onSelectProject={(id) => navigateTo('project-detail', id)}
          />
        );
      case 'project-detail':
        if (!selectedProject) return null;
        return (
          <ProjectDetail
            project={selectedProject}
            onBack={() => navigateTo('projects')}
            onOpenInquiry={openInquiry}
            onNavigateProjects={() => navigateTo('projects')}
          />
        );
      default:
        return <Overview onOpenInquiry={openInquiry} onNavigateTo={navigateTo} />;
    }
  };

  const handleTabChange = useCallback((tabId: string) => {
    const view = TAB_TO_VIEW[tabId];
    if (view) navigateTo(view);
  }, [navigateTo]);

  const activeTab = VIEW_TO_TAB[currentView] || 'overview';

  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <PageHeader
        title="Consult"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      >
        <PageHeaderTabs
          tabs={CONSULT_TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      </PageHeader>

      <div
        className={`mt-8 transition-opacity ${reducedMotion ? '' : 'duration-300'} ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {renderView()}
      </div>

      <InquiryForm
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        preselect={inquiryPreselect}
      />
    </div>
  );
};

/* =====================================================
   OVERVIEW — the default landing view for Consult
   ===================================================== */

interface OverviewProps {
  onOpenInquiry: (preselect: string) => void;
  onNavigateTo: (view: ConsultView, projectId?: string) => void;
}

const DESIGN_SHORTCUTS = [
  { label: 'Tea Houses', action: 'tea-house-design' as ConsultView },
  { label: 'Sourcing', action: 'sourcing-journeys' as ConsultView },
  { label: 'Tea Supply', action: null }, // opens inquiry
];

const SESSION_SHORTCUTS = [
  { label: 'Private Session', preselect: 'A session or practice guidance' },
  { label: 'Guidance', preselect: 'A session or practice guidance' },
  { label: 'Events', preselect: 'An event or group experience' },
];

const Overview: React.FC<OverviewProps> = ({ onOpenInquiry, onNavigateTo }) => {
  const [hoveredPath, setHoveredPath] = useState<'design' | 'sessions' | null>(null);
  const reveal1 = useSectionReveal();
  const reveal2 = useSectionReveal();
  const reveal3 = useSectionReveal();
  const reveal4 = useSectionReveal();

  const featuredProjects = consultProjects.filter(p => p.featured);

  return (
    <>
      {/* ========== Split-Screen Landing ========== */}
      <div className={`grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-200px)] -mt-8 ${SECTION_GAP_LG}`}>

        {/* ── Design & Curation — dark side ── */}
        <div
          role="button"
          tabIndex={0}
          className={`
            group relative flex flex-col items-center justify-center text-center
            p-10 md:p-12 lg:p-16 transition-all duration-700 ease-out cursor-pointer
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tea-seal/50
            ${hoveredPath === 'design'
              ? 'bg-[#141414]'
              : hoveredPath === 'sessions'
                ? 'bg-tea-charcoal/60'
                : 'bg-tea-charcoal'
            }
          `}
          onMouseEnter={() => setHoveredPath('design')}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => onNavigateTo('tea-house-design')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateTo('tea-house-design'); } }}
          aria-label="Design & Curation — explore tea house design and sourcing"
        >
          {/* Accent glow */}
          <div className={`
            absolute inset-0 bg-gradient-to-br from-tea-seal/5 to-transparent
            transition-opacity duration-700 pointer-events-none
            ${hoveredPath === 'design' ? 'opacity-100' : 'opacity-0'}
          `} />

          <div className="relative z-10 max-w-sm">
            <Icons.Seal className={`
              w-14 h-14 md:w-16 md:h-16 mx-auto mb-6 text-tea-seal/70
              transition-all duration-500
              ${hoveredPath === 'design' ? 'scale-110 text-tea-seal' : ''}
            `} />

            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-tea-paper/40 mb-3">
              By inquiry
            </span>

            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-tea-paper mb-3">
              Design & Curation
            </h2>
            <p className="text-sm md:text-base text-tea-paper/50 mb-8 leading-relaxed">
              Tea house design, sourcing journeys, and tea supply. Every project begins with a conversation.
            </p>

            <span className="font-serif text-sm text-tea-seal inline-flex items-center gap-2 group-hover:gap-3 transition-all duration-300 mb-6">
              Explore offerings
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
            </span>

            {/* Category shortcuts */}
            <div className="flex items-center justify-center gap-3 flex-wrap" onClick={e => e.stopPropagation()}>
              {DESIGN_SHORTCUTS.map(({ label, action }) => (
                <button
                  key={label}
                  onClick={() => action ? onNavigateTo(action) : onOpenInquiry('Tea sourcing')}
                  className="text-[11px] text-tea-paper/30 hover:text-tea-seal transition-colors duration-200 uppercase tracking-wider"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sessions & Guidance — warm paper side ── */}
        <div
          role="button"
          tabIndex={0}
          className={`
            group relative flex flex-col items-center justify-center text-center
            p-10 md:p-12 lg:p-16 transition-all duration-700 ease-out cursor-pointer
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tea-seal/50
            ${hoveredPath === 'sessions'
              ? 'bg-[#EDE9DD]'
              : hoveredPath === 'design'
                ? 'bg-tea-paper/60'
                : 'bg-tea-paper'
            }
          `}
          onMouseEnter={() => setHoveredPath('sessions')}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => onOpenInquiry('A session or practice guidance')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenInquiry('A session or practice guidance'); } }}
          aria-label="Sessions & Guidance — private sessions and group experiences"
        >
          {/* Accent glow */}
          <div className={`
            absolute inset-0 bg-gradient-to-br from-tea-green/5 to-transparent
            transition-opacity duration-700 pointer-events-none
            ${hoveredPath === 'sessions' ? 'opacity-100' : 'opacity-0'}
          `} />

          <div className="relative z-10 max-w-sm">
            <Icons.Leaf className={`
              w-14 h-14 md:w-16 md:h-16 mx-auto mb-6 text-tea-green/60
              transition-all duration-500
              ${hoveredPath === 'sessions' ? 'scale-110 text-tea-green' : ''}
            `} />

            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-tea-ink/40 mb-3">
              Bali & Remote
            </span>

            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-tea-ink mb-3">
              Sessions & Guidance
            </h2>
            <p className="text-sm md:text-base text-tea-ink/50 mb-8 leading-relaxed">
              Private tea sessions, practice guidance, and group experiences. In the studio or wherever you are.
            </p>

            <span className="font-serif text-sm text-tea-seal inline-flex items-center gap-2 group-hover:gap-3 transition-all duration-300 mb-6">
              Start a conversation
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
            </span>

            {/* Category shortcuts */}
            <div className="flex items-center justify-center gap-3 flex-wrap" onClick={e => e.stopPropagation()}>
              {SESSION_SHORTCUTS.map(({ label, preselect }) => (
                <button
                  key={label}
                  onClick={() => onOpenInquiry(preselect)}
                  className="text-[11px] text-tea-ink/30 hover:text-tea-seal transition-colors duration-200 uppercase tracking-wider"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
      {/* ========== Sourcing Journeys ========== */}
      <section ref={reveal1.ref} className={`${SECTION_GAP_LG} border-b border-tea-ink/5 dark:border-white/5 pb-20 md:pb-28 lg:pb-36 ${reveal1.className}`} style={reveal1.style}>
        <CardContainer variant="dark" className="w-full overflow-hidden mb-10">
          <div className="w-full h-[40vh] md:h-[30vh] bg-tea-ink/90" role="img" aria-label="Sourcing journey through tea origins" />
        </CardContainer>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">
          Travel
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-4 text-tea-ink dark:text-tea-paper">
          Sourcing Journeys
        </h2>
        <p className="font-sans text-base font-light mb-6 text-tea-ink/70 dark:text-tea-paper/70">
          Travel to tea origins with a guide who knows the way.
        </p>
        <div className="w-12 h-[1px] bg-tea-seal mb-8" />
        <div className="max-w-[640px]">
          <p className="font-sans text-sm leading-relaxed mb-8 text-tea-ink/70 dark:text-tea-paper/70">
            For two decades, I've traveled through Taiwan, China, and beyond, building relationships with farmers, masters, and artisans. These aren't tours. Each journey is shaped around what calls to you: farms you want to visit, teas you want to source, makers you want to meet. I handle the language, the logistics, and the introductions.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => onOpenInquiry('A sourcing journey')}
            className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
          >
            Start a conversation
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigateTo('sourcing-journeys')}
            className={`text-tea-ink/40 dark:text-tea-paper/40 hover:text-tea-seal text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
          >
            See past journeys
            <Icons.ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ========== Tea Sourcing ========== */}
      <section ref={reveal2.ref} className={`${SECTION_GAP_LG} border-b border-tea-ink/5 dark:border-white/5 pb-20 md:pb-28 lg:pb-36 ${reveal2.className}`} style={reveal2.style}>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">
          Supply
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-4 text-tea-ink dark:text-tea-paper">
          Tea Sourcing
        </h2>
        <p className="font-sans text-base font-light mb-6 text-tea-ink/70 dark:text-tea-paper/70">
          Quality tea for your space, your collection, or your community.
        </p>
        <div className="w-12 h-[1px] bg-tea-seal mb-8" />
        <div className="max-w-[640px]">
          <p className="font-sans text-sm leading-relaxed mb-8 text-tea-ink/70 dark:text-tea-paper/70">
            I source directly from trusted origins in Taiwan, China, and beyond. For individual collectors seeking access to exceptional teas. For retreat centers, hotels, and communities wanting quality tea as part of what they offer. Whether it's a single order or an ongoing relationship, we start with a conversation about what you're looking for.
          </p>
        </div>
        <button
          onClick={() => onOpenInquiry('Tea sourcing')}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          Inquire
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* ========== Projects ========== */}
      <section ref={reveal3.ref} className={`${SECTION_GAP_LG} ${reveal3.className}`} style={reveal3.style}>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">
          Portfolio
        </p>
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal mb-4 text-tea-ink dark:text-tea-paper">
          Projects
        </h2>
        <p className="font-sans text-base font-light mb-6 text-tea-ink/70 dark:text-tea-paper/70">
          Spaces, events, and journeys I've brought to life.
        </p>
        <div className="w-12 h-[1px] bg-tea-seal mb-10" />

        {/* Mobile: SwipeCarousel */}
        <div className="md:hidden mb-10">
          <SwipeCarousel showDots peek={12}>
            {featuredProjects.map(project => (
              <button
                key={project.id}
                onClick={() => onNavigateTo('project-detail', project.id)}
                className={`text-left group w-full ${CTA_FOCUS}`}
              >
                <CardContainer variant="dark" className="overflow-hidden mb-4 md:hover:-translate-y-1 transition-all duration-300">
                  <div className="w-full bg-tea-ink/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} project`} />
                </CardContainer>
                <h3 className="font-serif text-lg font-medium text-tea-ink dark:text-tea-paper">
                  {project.name}
                </h3>
                <p className="text-xs uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">
                  {project.location}
                </p>
              </button>
            ))}
          </SwipeCarousel>
        </div>

        {/* Desktop: 2-column grid */}
        <div className="hidden md:grid md:grid-cols-2 gap-6 mb-10">
          {featuredProjects.map(project => (
            <button
              key={project.id}
              onClick={() => onNavigateTo('project-detail', project.id)}
              className={`text-left group w-full ${CTA_FOCUS}`}
            >
              <CardContainer variant="dark" className="overflow-hidden mb-4 md:hover:-translate-y-1 transition-all duration-300">
                <div className="w-full bg-tea-ink/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} project`} />
              </CardContainer>
              <h3 className="font-serif text-lg font-medium text-tea-ink dark:text-tea-paper">
                {project.name}
              </h3>
              <p className="text-xs uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">
                {project.location}
              </p>
            </button>
          ))}
        </div>

        <button
          onClick={() => onNavigateTo('projects')}
          className={`text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px] ${CTA_FOCUS}`}
        >
          View all projects
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* ========== Testimonials ========== */}
      <section ref={reveal4.ref} className={`${SECTION_GAP_LG} ${reveal4.className}`} style={reveal4.style}>
        <p className="text-xs uppercase tracking-[0.2em] text-tea-seal font-sans mb-2">
          What Clients Say
        </p>
        <h2 className="font-serif text-3xl md:text-4xl font-normal mb-10 text-tea-ink dark:text-tea-paper">
          Words from past projects
        </h2>

        {/* Mobile: SwipeCarousel */}
        <div className="md:hidden">
          <SwipeCarousel showDots peek={10}>
            {consultTestimonials.map(t => (
              <CardContainer key={t.id} variant="light" className="p-6">
                <p className="font-serif text-base italic leading-relaxed mb-4 text-tea-ink dark:text-tea-paper">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="text-xs uppercase tracking-wider text-tea-ink/50 dark:text-tea-paper/50">
                  {t.name}
                </p>
                <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40">
                  {t.title}
                </p>
              </CardContainer>
            ))}
          </SwipeCarousel>
        </div>

        {/* Desktop: grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {consultTestimonials.map(t => (
            <CardContainer key={t.id} variant="light" className="p-6">
              <p className="font-serif text-base italic leading-relaxed mb-4 text-tea-ink dark:text-tea-paper">
                &ldquo;{t.quote}&rdquo;
              </p>
              <p className="text-xs uppercase tracking-wider text-tea-ink/50 dark:text-tea-paper/50">
                {t.name}
              </p>
              <p className="text-xs text-tea-ink/40 dark:text-tea-paper/40">
                {t.title}
              </p>
            </CardContainer>
          ))}
        </div>
      </section>
      </div>
    </>
  );
};
