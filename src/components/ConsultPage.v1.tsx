import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
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
import { useScrollDirection } from '../hooks/useScrollDirection';
import { Button } from './shared/Button';

/* =====================================================
   SERVICE_ITEMS — icon-led directory for wayfinding
   ===================================================== */

const SERVICE_ITEMS = [
  {
    id: 'design',
    label: 'Full Tea House Design',
    desc: 'Architecture, materials, layout, atmosphere. The whole picture.',
    icon: 'home' as const,
  },
  {
    id: 'sourcing',
    label: 'Tea Curation & Sourcing',
    desc: 'Building a tea collection that tells a story. Every leaf chosen with intention.',
    icon: 'leaf' as const,
  },
  {
    id: 'sessions',
    label: 'Training & Ceremony',
    desc: 'Learning to hold space through tea. For yourself, for your guests, for the room.',
    icon: 'book' as const,
  },
  {
    id: 'journeys',
    label: 'Sourcing Journeys',
    desc: 'Travel to tea origins with twenty years of relationships opening the door.',
    icon: 'map' as const,
  },
  {
    id: 'events',
    label: 'Events & Experiences',
    desc: 'Tea brought to your gathering. Retreats, dinners, celebrations.',
    icon: 'calendar' as const,
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

  // Parallax for hero section
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroParallaxY = useTransform(heroScrollProgress, [0, 1], [0, 30]);

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
      <Helmet>
        <title>Consult — Teajia</title>
        <meta name="description" content="Tea space design, sourcing guidance, ceremony training, and origin journeys. Twenty years of practice distilled into services for those who take tea seriously." />
      </Helmet>
      <PageHeader title="Consult" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />

      <div className="max-w-[1400px] mx-auto">
        {/* #1 Cinematic hero with atmospheric image background */}
        <div ref={heroRef} className="relative -mx-4 md:-mx-6 lg:-mx-8 overflow-hidden" style={{ minHeight: '340px' }}>
          {/* Parallax background image */}
          <motion.div
            className="absolute inset-0"
            style={{ y: heroParallaxY }}
          >
            <img
              src="https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1600/v1773838032/2023-09-29_IMG_4021_njgry2.heic"
              alt=""
              className="w-full h-full object-cover"
              style={{ minHeight: '120%' }}
            />
          </motion.div>
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, var(--tea-bg) 30%, transparent 70%), linear-gradient(to top, var(--tea-bg) 5%, transparent 60%)'
          }} />
          {/* Content */}
          <div className="relative z-[1] px-4 md:px-6 lg:px-8 pt-16 md:pt-20 lg:pt-24 pb-12 md:pb-16">
            <h2 className="font-display text-3xl md:text-4xl lg:text-[3.2rem] font-light text-tea-text leading-[1.15] tracking-[-0.01em]">
              Tea spaces, sourcing,<br className="hidden sm:block" /> guidance.
            </h2>
            <p className="font-sans text-sm text-tea-text/60 mt-4 max-w-[480px] leading-relaxed">
              Twenty years of tea across Taiwan, China, Japan, and Bali — distilled into services for those
              ready to bring tea deeper into their lives.
            </p>
            <div className="w-16 h-[1px] bg-tea-gold/40 mt-8" />
          </div>
        </div>

        <div className="h-10 md:h-14" />

        {/* Service Directory */}
        <ServiceDirectory onItemClick={scrollToSection} />

        {/* Adrian — between overview and depth */}
        <AdrianSection onOpenInquiry={() => openInquiry('')} />

        {/* #15 Services label with gold accent underline + #14 more spacing */}
        <div className="mt-14 md:mt-20">
          <p className="text-[10px] uppercase tracking-[0.25em] text-tea-text-dim font-sans mb-1">
            Services
          </p>
          <div className="w-10 h-[1px] bg-tea-gold/40" />
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

        {/* Testimonial Carousel */}
        <TestimonialCarousel />

        {/* Closing CTA */}
        <ClosingCTA onOpenInquiry={() => openInquiry('')} />
      </div>

      {/* #19 Floating mobile inquiry CTA */}
      <FloatingInquiryCTA onOpenInquiry={() => openInquiry('')} />

      <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
    </div>
  );
};

/* =====================================================
   FloatingInquiryCTA — sticky bottom bar on mobile
   ===================================================== */

const FloatingInquiryCTA: React.FC<{ onOpenInquiry: () => void }> = ({ onOpenInquiry }) => {
  const scrollDir = useScrollDirection();
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const handleScroll = () => setPastHero(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Show only on mobile, after scrolling past hero, hide when scrolling down
  const visible = pastHero && scrollDir.direction !== 'down';

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-drawer md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-tea-bg/90 backdrop-blur-md border-t border-tea-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={onOpenInquiry}
          className="w-full bg-tea-gold text-tea-bg font-sans text-xs uppercase tracking-[0.15em] font-medium
                     py-3 rounded-xl transition-colors hover:bg-tea-gold-lt active:bg-tea-gold/80
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
        >
          Start a Conversation
        </button>
      </div>
    </div>
  );
};

/* =====================================================
   ServiceDirectory — icon-led cards for wayfinding
   ===================================================== */

const SERVICE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  home: Icons.Home,
  leaf: ({ className }) => <Icons.Leaf className={className} />,
  book: Icons.BookOpen,
  map: Icons.Location,
  calendar: Icons.Calendar,
};

interface ServiceDirectoryProps {
  onItemClick: (sectionId: string) => void;
}

const ServiceDirectory: React.FC<ServiceDirectoryProps> = ({ onItemClick }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {SERVICE_ITEMS.map(item => {
      const Icon = SERVICE_ICONS[item.icon];
      return (
        <button
          key={item.id}
          onClick={() => onItemClick(item.id)}
          className="w-full text-left group rounded-lg bg-tea-surface
                     border border-tea-border hover:border-tea-gold/20
                     px-5 py-5 flex items-start gap-4
                     transition-all duration-300 hover:-translate-y-0.5
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2"
        >
          {/* #2 Icon with subtle glow ring */}
          <span className="mt-0.5 shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                           bg-tea-gold/[0.06] group-hover:bg-tea-gold/[0.12] transition-colors duration-300">
            <Icon className="w-5 h-5 text-tea-gold" />
          </span>
          <div className="min-w-0">
            <span className="font-serif text-base text-tea-text font-medium leading-tight block
                             group-hover:text-tea-gold transition-colors duration-300">
              {item.label}
            </span>
            <span className="text-[13px] text-tea-text-sec leading-relaxed mt-1 block">
              {item.desc}
            </span>
          </div>
        </button>
      );
    })}
  </div>
);

/* =====================================================
   AdrianSection — redesigned, mobile-first
   ===================================================== */

const AdrianSection: React.FC<{ onOpenInquiry: () => void }> = ({ onOpenInquiry }) => {
  const reveal = useSectionReveal();
  return (
    <section ref={reveal.ref} className={`mt-16 md:mt-20 ${reveal.className}`} style={reveal.style}>
      {/* #3 Editorial pull-quote treatment */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Photo — full-width on mobile, constrained on desktop */}
        <div className="relative shrink-0 w-full md:w-[380px]">
          <img
            src="https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_600/v1773837991/2021-06-27_IMG_7745_Original_ehkz30.jpg"
            alt=""
            className="w-full aspect-[3/2] md:aspect-[4/5] object-cover bg-tea-text/[0.06] rounded-lg"
            loading="lazy"
          />
          {/* Subtle gold corner accent */}
          <div className="absolute bottom-0 left-0 w-12 h-[2px] bg-tea-gold/30" />
          <div className="absolute bottom-0 left-0 w-[2px] h-12 bg-tea-gold/30" />
        </div>

        {/* Text */}
        <div className="flex flex-col justify-center">
          <p className="font-display text-xl md:text-2xl lg:text-[1.75rem] text-tea-text leading-snug mb-5 font-light">
            Twenty years in tea culture.<br className="hidden md:block" />
            Taiwan, China, Japan, Bali, and beyond.
          </p>
          <p className="text-sm text-tea-text/60 leading-[1.8] max-w-[520px] mb-3">
            We work with individuals deepening their personal tea practice, with collectors seeking rare and aged teas, and with retreat centers, hotels, and private residences ready to bring tea culture into their spaces. For larger projects, that means everything from room design and teaware curation to tea sourcing and staff training.
          </p>
          <p className="text-sm text-tea-text/60 leading-[1.8] max-w-[520px] mb-3">
            A background in design and visual art shapes every detail. Two decades of sourcing relationships across Asia ground every recommendation. An international practice rooted in Bali.
          </p>
          <button
            onClick={onOpenInquiry}
            className="text-sm text-tea-gold hover:text-tea-gold-lt transition-colors duration-200 leading-[1.8] max-w-[520px] text-left mt-2"
          >
            Every engagement begins with a conversation &rarr;
          </button>
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
    <section ref={reveal.ref} className={`mt-16 md:mt-24 pt-12 md:pt-16 ${reveal.className}`} style={reveal.style}>
      <div className="divider-warm mb-10" />
      <p className="text-[10px] uppercase tracking-[0.25em] text-tea-gold font-sans mb-2 flex items-center gap-3">
        <span className="w-8 h-[1px] bg-tea-gold/30" />
        Portfolio
      </p>
      <h3 className="font-display text-2xl md:text-3xl font-light text-tea-text">Projects</h3>
      <div className="w-12 h-[1px] bg-tea-gold/30 mt-4 mb-10" />

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

      <Button onClick={onViewAll} variant="ghost" size="sm" icon={<Icons.ChevronRight className="w-3.5 h-3.5" />} className="text-tea-gold hover:text-tea-gold/80 uppercase tracking-[0.15em] text-xs">
        View all projects
      </Button>
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

const PROJECT_TYPE_LABELS: Record<string, string> = {
  space: 'Space',
  event: 'Event',
  journey: 'Journey',
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => (
  <button onClick={onClick} className="text-left group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm">
    {/* #11 + #18 Type badge overlay + gradient on images */}
    <CardContainer variant="dark" className="overflow-hidden mb-3 md:group-hover:-translate-y-1 transition-all duration-300 relative">
      <img
        src={PROJECT_PLACEHOLDER_IMGS[project.id] || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&auto=format'}
        alt={`${project.name} project`}
        className="w-full object-cover bg-tea-elevated/90 group-hover:scale-[1.04] transition-transform duration-500"
        style={{ aspectRatio: '16/10' }}
        loading="lazy"
      />
      {/* Bottom gradient for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
           style={{ background: 'linear-gradient(to top, var(--tea-bg), transparent)' }} />
      {/* Type badge */}
      <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.15em] text-tea-gold/80
                        bg-tea-bg/60 backdrop-blur-sm rounded-full px-2.5 py-1 font-sans">
        {PROJECT_TYPE_LABELS[project.type] || project.type}
      </span>
    </CardContainer>
    <h4 className="font-serif text-base font-medium text-tea-text group-hover:text-tea-gold transition-colors duration-300">
      {project.name}
    </h4>
    <p className="text-[11px] uppercase tracking-wider text-tea-text-dim mt-0.5">{project.location}</p>
  </button>
);

/* =====================================================
   TestimonialCarousel — auto-crossfade with manual dots
   ===================================================== */

const reducedMotionQuery = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

const TestimonialCarousel: React.FC = () => {
  const reveal = useSectionReveal();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance every 5s, pause on hover
  useEffect(() => {
    if (isPaused || reducedMotionQuery?.matches) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % consultTestimonials.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused]);

  const testimonial = consultTestimonials[activeIndex];

  return (
    <section ref={reveal.ref} className={`mt-16 md:mt-24 pt-12 md:pt-16 ${reveal.className}`} style={reveal.style}>
      <div className="divider-warm mb-10" />
      <div
        className="inset-panel p-8 md:p-14 lg:p-16 text-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative max-w-[640px] mx-auto min-h-[180px]">
          {/* #9 Larger decorative quote mark */}
          <span className="font-serif text-7xl md:text-8xl text-tea-gold/15 select-none pointer-events-none leading-none block mb-0 -mt-2">
            &ldquo;
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <p className="font-serif text-lg md:text-xl lg:text-[1.35rem] italic text-tea-text leading-relaxed">
                {testimonial.quote}
              </p>
              {/* #10 Gold dash attribution */}
              <div className="mt-8 flex flex-col items-center gap-2">
                <span className="w-6 h-[1px] bg-tea-gold/40" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-tea-text/50 font-sans">{testimonial.name}</p>
                <p className="text-[11px] text-tea-text/35 font-sans">{testimonial.title}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mt-8">
          {consultTestimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`rounded-full transition-all duration-300 h-1.5 ${
                i === activeIndex
                  ? 'w-4 bg-tea-gold'
                  : 'w-1.5 bg-tea-text-sec/30 hover:bg-tea-text-sec/50'
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
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
      className={`mt-16 md:mt-24 pb-28 md:pb-36 ${reveal.className}`}
      style={reveal.style}>
      {/* #12 Dramatic closing CTA with larger typography and more breathing room */}
      <div className="inset-panel px-8 py-14 md:px-12 md:py-20 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold/60 font-sans mb-5">
          Let's begin
        </p>
        <h3 className="font-display text-2xl md:text-3xl lg:text-4xl font-light text-tea-text leading-snug">
          Every project begins<br className="hidden sm:block" /> with a conversation.
        </h3>
        <div className="w-16 h-[1px] bg-tea-gold/50 mx-auto mt-6 mb-10" />
        <Button onClick={onOpenInquiry} variant="primary" size="lg" icon={<Icons.ChevronRight className="w-3.5 h-3.5" />} className="mx-auto uppercase tracking-[0.15em] text-xs">
          Start a Conversation
        </Button>
      </div>
    </section>
  );
};
