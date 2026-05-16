import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader } from './shared/PageHeader';
import { AdviseView } from '../types/advise';
import { adviseProjects } from '../data/adviseProjects';
import { adviseTestimonials } from '../data/adviseTestimonials';
import { InquiryForm } from './advise/InquiryForm';
import { Projects } from './advise/Projects';
import { ProjectDetail } from './advise/ProjectDetail';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useSectionReveal } from '../hooks/useSectionReveal';

/* =====================================================
   Data
   ===================================================== */

const SERVICES = [
  {
    id: 'design',
    label: 'Tea House Design & Curation',
    desc: 'From concept through opening — design, curation, tea selection, training, and operations.',
    price: '$5,000 – $100,000+',
    preselect: 'Space design or tea integration',
    cta: 'Start a conversation',
  },
  {
    id: 'sourcing',
    label: 'Tea Curation & Sourcing',
    desc: 'Direct sourcing from Taiwan, China, and trusted origins — for collectors, spaces, and communities.',
    price: 'By inquiry',
    preselect: 'Tea sourcing',
    cta: 'Inquire',
  },
  {
    id: 'sessions',
    label: 'Sessions & Guidance',
    desc: 'In the Bali studio or wherever you are.',
    price: 'From $50',
    preselect: 'A session or practice guidance',
    cta: 'Book a session',
    offerings: [
      { name: 'Open Sit', price: 'Free', desc: 'Share tea at the studio. Event based or appointment.' },
      { name: 'Guided Practice Setup', price: '$265', desc: '2+ hours. Leave fully equipped. Includes $100 teaware credit.' },
      { name: 'Group Ceremonial', price: 'Inquire', desc: 'Up to 24 across two tearooms.' },
      { name: 'Private & Events', price: 'From $500', desc: 'Your gathering, your venue or ours. Retreats, dinners, festivals, celebrations.' },
    ],
  },
] as const;

/* =====================================================
   AdvisePage — main shell
   ===================================================== */

interface AdvisePageProps {
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
}

export const AdvisePage: React.FC<AdvisePageProps> = ({ onCartClick, onAccountClick, cartItemCount = 0 }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get('v') || 'main') as AdviseView;
  const selectedProjectId = searchParams.get('pid') || null;
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryPreselect, setInquiryPreselect] = useState('');

  const scrollPositions = useRef<Record<string, number>>({});
  const prevView = useRef<AdviseView>(currentView);

  const heroReveal = useSectionReveal('up');
  const bioReveal = useSectionReveal('up');
  const servicesReveal = useSectionReveal('up');

  useEffect(() => {
    if (prevView.current !== currentView) {
      scrollPositions.current[prevView.current] = window.scrollY;
      const savedPosition = scrollPositions.current[currentView] ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, savedPosition));
      prevView.current = currentView;
    }
  }, [currentView]);

  const openInquiry = useCallback((preselect: string) => {
    setInquiryPreselect(preselect);
    setInquiryOpen(true);
  }, []);

  const navigateTo = useCallback((view: AdviseView, projectId?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (view === 'main') { next.delete('v'); next.delete('pid'); }
      else { next.set('v', view); if (projectId) next.set('pid', projectId); else next.delete('pid'); }
      return next;
    }, { replace: false });
    delete scrollPositions.current[view];
  }, [setSearchParams]);

  const selectedProject = selectedProjectId ? adviseProjects.find(p => p.id === selectedProjectId) : null;

  // Sub-views
  if (currentView === 'projects') {
    return (
      <div className="w-full animate-[fadeIn_0.6s_ease-out]">
        <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
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
        <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />
        <div className="mt-8">
          <ProjectDetail project={selectedProject} onBack={() => window.history.back()} onOpenInquiry={openInquiry} onNavigateProjects={() => navigateTo('projects')} />
        </div>
        <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
      </div>
    );
  }

  /* ── Main layout — five moments ── */
  return (
    <div className="w-full animate-[fadeIn_0.6s_ease-out]">
      <Helmet>
        <title>Advise — Teajia</title>
        <meta name="description" content="Tea space design, sourcing guidance, ceremony training. Twenty years of practice distilled into services for those who take tea seriously." />
      </Helmet>
      <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />

      <div className="max-w-[1400px] mx-auto">

        {/* ════════════════════════════════════════════
            1. HERO — heading hangs in space, then bio
            ════════════════════════════════════════════ */}
        <div
          ref={heroReveal.ref}
          className={`pt-14 md:pt-20 lg:pt-24 pb-10 md:pb-14 ${heroReveal.className}`}
          style={heroReveal.style}
        >
          <h2 className="text-[2rem] md:text-[2.8rem] lg:text-[3.5rem] font-light text-tea-text leading-[1.1] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-display)' }}>
            Tea spaces, sourcing,<br /> guidance.
          </h2>
        </div>

        <div
          ref={bioReveal.ref}
          className={`flex flex-col md:flex-row gap-10 md:gap-14 pb-24 md:pb-32 ${bioReveal.className}`}
          style={bioReveal.style}
        >
          <div className="relative shrink-0 w-full md:w-[340px]">
            <img
              src="https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_600/v1773837991/2021-06-27_IMG_7745_Original_ehkz30.jpg"
              alt=""
              width={600}
              height={750}
              className="w-full aspect-[3/2] md:aspect-[4/5] object-cover bg-tea-surface rounded-xl"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col justify-center max-w-[460px]">
            <p className="text-[1.05rem] md:text-[1.15rem] font-light text-tea-text leading-[1.4] tracking-[-0.005em] mb-6"
               style={{ fontFamily: 'var(--font-display)' }}>
              Twenty years in tea culture.<br className="hidden md:block" />
              Taiwan, China, Japan, Bali, and beyond.
            </p>
            <p className="text-ui-14 text-tea-text-sec leading-[1.85] mb-4"
               style={{ fontFamily: 'var(--font-body)' }}>
              We work with individuals deepening their personal tea practice, with collectors seeking rare and aged teas, and with retreat centers, hotels, and private residences ready to bring tea culture into their spaces. For larger projects, that means everything from room design and teaware curation to tea sourcing and staff training.
            </p>
            <p className="text-ui-14 text-tea-text-sec leading-[1.85]"
               style={{ fontFamily: 'var(--font-body)' }}>
              A background in design and visual art shapes every detail. Two decades of sourcing relationships across Asia ground every recommendation. An international practice rooted in Bali.
            </p>
            <button
              onClick={() => openInquiry('')}
              className="text-ui-11 uppercase tracking-[0.1em] text-tea-gold hover:text-tea-gold/70
                         font-medium transition-colors duration-300 text-left mt-8 min-h-[44px]"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Every engagement begins with a conversation <span className="ml-1">&rarr;</span>
            </button>
          </div>
        </div>

        {/* 2. SERVICES */}
        <div
          ref={servicesReveal.ref}
          className={`${servicesReveal.className}`}
          style={servicesReveal.style}
        >
          <Services />
        </div>

        {/* B2B link — quiet bridge for business/institutional visitors */}
        <div className="mt-10 mb-2 max-w-[560px]">
          <Link
            to="/for-your-space"
            className="inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text
                       transition-colors duration-200 group min-h-[44px]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <span className="uppercase tracking-[0.1em]">Hotels, studios, and teams</span>
            <span className="text-tea-gold/60 group-hover:text-tea-gold transition-colors duration-200">&rarr;</span>
          </Link>
        </div>

        {/* warm divider */}
        <div className="divider-warm my-16 md:my-20" />

        {/* 3. PORTFOLIO */}
        <ProjectsPreview
          onSelectProject={(id) => navigateTo('project-detail', id)}
          onViewAll={() => navigateTo('projects')}
        />

        {/* 4. TESTIMONIAL — separated by whitespace alone, not a divider */}
        <Testimonial />

        {/* warm divider */}
        <div className="divider-warm my-16 md:my-20" />

        {/* 5. CLOSE */}
        <ClosingCTA onOpenInquiry={() => openInquiry('')} />
      </div>

      <FloatingInquiryCTA onOpenInquiry={() => openInquiry('')} />
      <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
    </div>
  );
};

/* =====================================================
   FloatingInquiryCTA — floating pill
   ===================================================== */

const FloatingInquiryCTA: React.FC<{ onOpenInquiry: () => void }> = ({ onOpenInquiry }) => {
  const scrollDir = useScrollDirection();
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const next = window.scrollY > 400;
        setPastHero(prev => (prev === next ? prev : next));
        frame = 0;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const visible = pastHero && scrollDir.direction !== 'down';

  return (
    <button
      onClick={onOpenInquiry}
      className={`fixed z-drawer right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]
                  transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95 pointer-events-none'}
                  bg-tea-bg/80 backdrop-blur-md text-tea-gold
                  text-ui-11 uppercase tracking-[0.08em] font-medium
                  px-5 py-3 rounded-full
                  shadow-[0_2px_12px_rgb(var(--tea-bg-rgb)/0.25),0_0_0_1px_rgb(var(--tea-gold-rgb)/0.12)]
                  hover:bg-tea-bg/95 active:scale-[0.97]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      Start a conversation
    </button>
  );
};

/* =====================================================
   Services — dense block, each service distinct
   ===================================================== */

const Services: React.FC = () => (
  <section className="max-w-[600px]">
    {SERVICES.map((svc, i) => {
      const isDesign = svc.id === 'design';

      return (
        <React.Fragment key={svc.id}>
          {i > 0 && <div className="h-px bg-tea-border/20" />}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={`${i > 0 ? 'pt-14 md:pt-16' : ''} ${i < SERVICES.length - 1 ? 'pb-14 md:pb-16' : 'pb-6'}`}
          >
            <div className="flex items-baseline justify-between gap-6 mb-3">
            <h3 className={`font-light text-tea-text leading-tight tracking-[-0.01em]
                           ${isDesign ? 'text-[1.5rem] md:text-[1.75rem]' : 'text-[1.2rem] md:text-[1.35rem]'}`}
                style={{ fontFamily: 'var(--font-display)' }}>
              {svc.label}
            </h3>
            <span className="text-ui-11 uppercase tracking-[0.1em] text-tea-gold/70 shrink-0"
                  style={{ fontFamily: 'var(--font-sans)' }}>
              {svc.price}
            </span>
          </div>

          <p className="text-ui-14 text-tea-text-sec leading-[1.8]"
             style={{ fontFamily: 'var(--font-body)' }}>
            {svc.desc}
          </p>

          {'offerings' in svc && svc.offerings && (
            <div className="mt-8 pt-4">
              {svc.offerings.map((o, j) => (
                <div key={o.name}
                     className="flex flex-col py-4 hover:bg-tea-surface/50 transition-colors duration-200 -mx-2 px-2 rounded-md">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-ui-15 font-light text-tea-text"
                          style={{ fontFamily: 'var(--font-display)' }}>
                      {o.name}
                    </span>
                    <span className="text-ui-11 text-tea-gold/70 shrink-0 uppercase tracking-[0.1em] tabular-nums"
                          style={{ fontFamily: 'var(--font-mono, var(--font-sans))' }}>
                      {o.price}
                    </span>
                  </div>
                  {'desc' in o && (
                    <p className="text-ui-12 text-tea-text-sec mt-1.5 leading-relaxed"
                       style={{ fontFamily: 'var(--font-sans)' }}>
                      {o.desc}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          </motion.div>
        </React.Fragment>
      );
    })}
  </section>
);

/* =====================================================
   ProjectsPreview — simplified header
   ===================================================== */

interface ProjectsPreviewProps {
  onSelectProject: (id: string) => void;
  onViewAll: () => void;
}

const ProjectsPreview: React.FC<ProjectsPreviewProps> = ({ onSelectProject, onViewAll }) => {
  const projects = adviseProjects.filter(p => p.featured).slice(0, 3);

  if (projects.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mt-20 md:mt-28 ml-8 md:ml-16"
    >
      <p className="text-ui-14 italic text-tea-text-sec mb-6"
         style={{ fontFamily: 'var(--font-body)' }}>
        Selected projects
      </p>

      <div className="max-w-[480px]">
        {projects.map((project, i) => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className="w-full text-left group py-3 flex items-baseline justify-between gap-6
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-md"
            style={{ borderBottom: i < projects.length - 1 ? '1px solid var(--tea-border)' : undefined }}
          >
            <span className="text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors duration-300"
                  style={{ fontFamily: 'var(--font-body)' }}>
              {project.name}
            </span>
            <span className="text-ui-11 text-tea-text-sec shrink-0"
                  style={{ fontFamily: 'var(--font-sans)' }}>
              {project.location}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={onViewAll}
        className="text-ui-11 uppercase tracking-[0.1em] text-tea-gold/60 hover:text-tea-gold
                   transition-colors duration-300 min-h-[44px] mt-3
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-md"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        View all <span className="ml-1">&rarr;</span>
      </button>
    </motion.section>
  );
};


/* =====================================================
   Testimonial — single quote, no panel, no carousel
   ===================================================== */

const Testimonial: React.FC = () => {
  const testimonial = adviseTestimonials[0];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 1 }}
      className="mt-28 md:mt-40 text-center"
    >
      <p className="text-[1.5rem] md:text-[1.85rem] font-light text-tea-text leading-[1.35] max-w-[540px] mx-auto tracking-[-0.01em]"
         style={{ fontFamily: 'var(--font-display)' }}>
        "{testimonial.quote}"
      </p>
      <p className="text-ui-11 text-tea-text-sec mt-6 tracking-[0.1em]"
         style={{ fontFamily: 'var(--font-sans)' }}>
        {testimonial.name}<span className="text-tea-text-dim mx-2">&middot;</span>{testimonial.title}
      </p>
    </motion.section>
  );
};

/* =====================================================
   ClosingCTA — biggest type on the page
   ===================================================== */

interface ClosingCTAProps {
  onOpenInquiry: () => void;
}

const ClosingCTA: React.FC<ClosingCTAProps> = ({ onOpenInquiry }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    className="mt-16 md:mt-24 pb-32 md:pb-40 text-center"
  >
    <h3 className="text-[2rem] md:text-[2.75rem] lg:text-[3.25rem] font-light text-tea-text leading-[1.1] tracking-[-0.02em] mx-auto max-w-[580px]"
        style={{ fontFamily: 'var(--font-display)' }}>
      Every project begins with a conversation.
    </h3>
    <button
      onClick={onOpenInquiry}
      className="mt-10 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.15em] font-medium
                 py-2.5 px-6 hover:bg-tea-gold/90 transition-colors duration-300
                 active:scale-95 min-h-[44px]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      Start a conversation <span className="ml-1">&rarr;</span>
    </button>
  </motion.section>
);
