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
import { TYPOGRAPHY_CLASSES } from '../designTokens';

/* =====================================================
   Data
   ===================================================== */

const SERVICES = [
  {
    id: 'design',
    label: 'Tea House Design & Curation',
    desc: 'From concept through opening. Design, curation, tea selection, training, and operations.',
    price: '$5,000 – $100,000+',
    preselect: 'Space design or tea integration',
    cta: 'Start a conversation',
  },
  {
    id: 'sourcing',
    label: 'Tea Curation & Sourcing',
    desc: 'Direct sourcing from Taiwan, China, and trusted origins, for collectors, spaces, and communities.',
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
   AdvisePage, main shell
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

  // Portfolio is not built yet, the projects sub-views are hidden. Any old /advise?v=projects
  // or ?v=project-detail link falls back to the main page. See TODO.md (Advise portfolio).
  const portfolioEnabled = false;

  // Sub-views
  if (portfolioEnabled && currentView === 'projects') {
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

  if (portfolioEnabled && currentView === 'project-detail' && selectedProject) {
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

  /* ── Main layout, four tonal moments ── */
  return (
    <div data-testid="advise-page" className="w-full animate-[fadeIn_0.6s_ease-out]">
      <Helmet>
        <title>Advise · Teajia</title>
        <meta name="description" content="Tea space design, sourcing guidance, ceremony training. Twenty years of practice distilled into services for those who take tea seriously." />
      </Helmet>
      <PageHeader title="Advise" onCartClick={onCartClick} onAccountClick={onAccountClick} cartItemCount={cartItemCount} />

      <div data-testid="advise-hero" className="bg-tea-bg">
        <div className="max-w-[1400px] mx-auto">
          <div
            ref={heroReveal.ref}
            className={`pt-14 md:pt-20 lg:pt-24 pb-10 md:pb-14 ${heroReveal.className}`}
            style={heroReveal.style}
          >
            <h2 className="text-[2rem] md:text-[2.8rem] lg:text-[3.5rem] font-normal text-tea-text leading-[1.1] tracking-[-0.02em]"
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
                src="/api/media/site/2021-06-27_IMG_7745_Original_ehkz30.jpg"
                alt=""
                width={600}
                height={750}
                className="w-full aspect-[3/2] md:aspect-[4/5] object-cover bg-tea-surface rounded-xl"
                loading="lazy"
              />
            </div>
            <div className="flex flex-col justify-center max-w-[460px]">
              <p className="text-[1.05rem] md:text-[1.15rem] font-normal text-tea-text leading-[1.4] tracking-[-0.005em] mb-6"
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
        </div>
      </div>

      <div
        data-testid="advise-services-band"
        className="-mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10 bg-tea-surface/40 border-y border-tea-border"
      >
        <div
          ref={servicesReveal.ref}
          className={`max-w-[1400px] mx-auto ${servicesReveal.className}`}
          style={servicesReveal.style}
        >
          <Services />
        </div>
      </div>

      <div data-testid="advise-testimonial-band" className="bg-tea-bg">
        <div className="max-w-[1400px] mx-auto">
          <Testimonial />
        </div>
      </div>

      <div
        data-testid="advise-closing-band"
        className="-mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10 bg-tea-surface/20 border-t border-tea-border"
      >
        <div className="max-w-[1400px] mx-auto">
          <ClosingCTA onOpenInquiry={() => openInquiry('')} />
        </div>
      </div>

      <FloatingInquiryCTA onOpenInquiry={() => openInquiry('')} />
      <InquiryForm isOpen={inquiryOpen} onClose={() => setInquiryOpen(false)} preselect={inquiryPreselect} />
    </div>
  );
};

/* =====================================================
   FloatingInquiryCTA, floating pill
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
      className={`fixed z-drawer right-5 bottom-nav-gap
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
   Services, editorial ledger
   ===================================================== */

const Services: React.FC = () => (
  <section
    data-testid="advise-services"
    aria-labelledby="advise-services-title"
    className="py-16 md:py-20 lg:py-24"
  >
    <p id="advise-services-title" className={`${TYPOGRAPHY_CLASSES.label} mb-5 text-tea-text-dim`}>
      Services
    </p>
    <div className="border-y border-tea-border">
      {SERVICES.map((svc, index) => {
        const isDesign = svc.id === 'design';

        return (
          <motion.article
            key={svc.id}
            data-service-id={svc.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 border-b border-tea-border py-9 last:border-b-0 md:grid-cols-[2.25rem_minmax(13rem,0.82fr)_minmax(18rem,1.18fr)] md:gap-x-8 md:py-12 lg:gap-x-14"
          >
            <span className={`${TYPOGRAPHY_CLASSES.label} pt-1 text-tea-gold`}>
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="min-w-0">
              <h3 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{svc.label}</h3>
              <span className={`${TYPOGRAPHY_CLASSES.mono} mt-3 block uppercase tracking-[0.1em] text-tea-gold/70 tabular-nums`}>
                {svc.price}
              </span>
            </div>

            <div className="col-start-2 mt-5 min-w-0 md:col-start-3 md:mt-0">
              <p className="font-body text-ui-14 leading-[1.8] text-tea-text-sec">{svc.desc}</p>

              {isDesign && (
                <Link
                  to="/for-your-space"
                  className="tap-target group mt-5 inline-flex min-h-[44px] items-center gap-2 font-sans text-ui-12 uppercase tracking-[0.1em] text-tea-text-sec transition-colors duration-200 hover:text-tea-text"
                >
                  <span>Hotels, studios, and teams</span>
                  <span className="text-tea-gold/60 transition-colors duration-200 group-hover:text-tea-gold">&rarr;</span>
                </Link>
              )}

              {'offerings' in svc && svc.offerings && (
                <div className="mt-7 grid grid-cols-1 border-t border-tea-border min-[520px]:grid-cols-2">
                  {svc.offerings.map((offering, offeringIndex) => (
                    <div
                      key={offering.name}
                      data-offering-name={offering.name}
                      className={`border-b border-tea-border py-5 min-[520px]:px-5 ${
                        offeringIndex % 2 === 0 ? 'min-[520px]:border-r min-[520px]:pl-0' : 'min-[520px]:pr-0'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <h4 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{offering.name}</h4>
                        <span className={`${TYPOGRAPHY_CLASSES.mono} shrink-0 uppercase tracking-[0.1em] text-tea-gold/70 tabular-nums`}>
                          {offering.price}
                        </span>
                      </div>
                      <p className="mt-2 font-sans text-ui-12 leading-relaxed text-tea-text-sec">
                        {offering.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.article>
        );
      })}
    </div>
  </section>
);

/* =====================================================
   ProjectsPreview, simplified header
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
   Testimonial, single quote, no panel, no carousel
   ===================================================== */

const Testimonial: React.FC = () => {
  const testimonial = adviseTestimonials[0];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 1 }}
      className="py-20 text-center md:py-28 lg:py-32"
    >
      <p className="text-[1.5rem] md:text-[1.85rem] font-normal text-tea-text leading-[1.35] max-w-[540px] mx-auto tracking-[-0.01em]"
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
   ClosingCTA, biggest type on the page
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
    className="pb-32 pt-16 text-center md:pb-40 md:pt-24"
  >
    <h3 className="text-[2rem] md:text-[2.75rem] lg:text-[3.25rem] font-normal text-tea-text leading-[1.1] tracking-[-0.02em] mx-auto max-w-[580px]"
        style={{ fontFamily: 'var(--font-display)' }}>
      Every project begins with a conversation.
    </h3>
    <button
      onClick={onOpenInquiry}
      className="mt-10 cta-solid text-xs font-medium
                 py-2.5 px-6 hover:bg-tea-gold/90 transition-colors duration-300
                 active:scale-95 min-h-[44px]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      Start a conversation <span className="ml-1">&rarr;</span>
    </button>
  </motion.section>
);
