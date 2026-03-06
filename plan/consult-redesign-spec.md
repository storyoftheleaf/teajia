# Consult Page Redesign — Build Plan

## Concept

"The Conversation" — question-driven layout with immersive visuals. Page opens with "What brings you here?", 5 path cards route to the right service, selected card reveals content inline. Always has content below (Adrian, Projects, Testimonials, CTA).

---

## Build Steps

### Step 1: Rewrite ConsultPage.tsx shell

Replace the entire ConsultPage with the new structure. Remove tabs, split-screen hero, and the old Overview component.

**File:** `src/components/ConsultPage.tsx`

**State:**
- `selectedPath: string | null` — which card is selected (null = no selection)
- `inquiryOpen: boolean` + `inquiryPreselect: string` — same as current
- `isTransitioning: boolean` — for crossfade between services

**Structure (top to bottom):**
```tsx
<div className="w-full animate-[fadeIn_0.6s_ease-out]">
  <PageHeader title="Consult" onCartClick={...} onAccountClick={...} cartItemCount={...} />

  <div className="max-w-[1400px] mx-auto">
    {/* Opening */}
    <div className="pt-8 md:pt-12 lg:pt-16">
      <h2 className="font-serif text-2xl md:text-3xl font-light text-tea-ink dark:text-tea-paper">
        What brings you here?
      </h2>
      <div className="w-12 h-[1px] bg-tea-seal mt-4 mb-8 md:mb-10" />
    </div>

    {/* Path Cards */}
    <PathCardGrid selectedPath={selectedPath} onSelect={setSelectedPath} />

    {/* "Just talk" link */}
    <button onClick={() => openInquiry('')} className="mt-4 font-sans text-sm text-tea-ink/40 ...">
      Or, just start a conversation <ChevronRight />
    </button>

    {/* Expanded service content (conditional) */}
    {selectedPath && (
      <div ref={contentRef} className="mt-10 md:mt-12" aria-live="polite">
        <ServiceContent path={selectedPath} onOpenInquiry={openInquiry} onNavigate={...} />
      </div>
    )}

    {/* Divider */}
    <div className="border-t border-tea-ink/5 dark:border-white/5 mt-16 md:mt-20" />

    {/* Adrian */}
    <AdrianSection />

    {/* Projects Preview */}
    <ProjectsPreview selectedPath={selectedPath} onSelectProject={...} onViewAll={...} />

    {/* Testimonials */}
    <TestimonialRotator />

    {/* Closing CTA */}
    <ClosingCTA onOpenInquiry={() => openInquiry('')} />
  </div>

  <InquiryForm isOpen={inquiryOpen} onClose={...} preselect={inquiryPreselect} />
</div>
```

**Keep these imports from old file:**
- `PageHeader`, `Icons`, `InquiryForm`, `consultProjects`, `consultTestimonials`, `useSectionReveal`, `SECTION_GAP_LG`

**Remove:**
- `PageHeaderTabs` import and usage
- `CONSULT_TABS`, `TAB_TO_VIEW`, `VIEW_TO_TAB` constants
- `ConsultView` type usage (replace with simple string paths)
- Old `Overview` component (entire thing, ~320 lines)
- Imports: `TeaHouseDesign`, `SourcingJourneys`, `Projects` (as sub-page views), `ProjectDetail`, `SwipeCarousel` (only needed in ProjectsPreview)
- `StickyInquiryBar` import/usage

**Navigation to Projects/ProjectDetail still works:** Keep `navigateTo('projects')` and `navigateTo('project-detail', id)` for when user clicks "View all projects" or a project card. These render the existing `Projects.tsx` and `ProjectDetail.tsx` as before.

---

### Step 2: PATH_CARDS data constant

Define at top of ConsultPage.tsx (or in a separate constants file):

```tsx
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
];
```

---

### Step 3: PathCardGrid component

Can be inline in ConsultPage or a small component in `src/components/consult/PathCardGrid.tsx`.

**Grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  {PATH_CARDS.map(card => (
    <button
      key={card.id}
      aria-pressed={selectedPath === card.id}
      onClick={() => onSelect(selectedPath === card.id ? null : card.id)}  // toggle
      className={`
        ${card.flagship ? 'md:col-span-2' : ''}
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
```

**Toggle behavior:** Clicking a selected card deselects it (sets `selectedPath` to null). This lets users collapse the content if they want to browse the cards again.

**Mobile scroll:** When selecting a card (and it wasn't already selected), call:
```tsx
if (window.innerWidth < 768) {
  setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}
```

---

### Step 4: ServiceContent switcher

A component that renders the right content based on `selectedPath`.

**File:** `src/components/consult/ServiceContent.tsx`

```tsx
interface ServiceContentProps {
  path: string;
  onOpenInquiry: (preselect: string) => void;
  onNavigateToProjects: (filter?: string) => void;
  onNavigateToShop: () => void;
  onNavigateToMagazine: () => void;
}

export const ServiceContent: React.FC<ServiceContentProps> = ({ path, ...props }) => {
  switch (path) {
    case 'design':    return <DesignContent {...props} />;
    case 'sessions':  return <SessionsContent {...props} />;
    case 'journeys':  return <JourneysContent {...props} />;
    case 'sourcing':  return <SourcingContent {...props} />;
    case 'events':    return <EventsContent {...props} />;
    default:          return null;
  }
};
```

Wrap in a fade transition. Use a `key={path}` on the wrapper div to trigger re-mount animation:

```tsx
<div
  key={selectedPath}
  className="animate-[fadeIn_0.4s_ease-out]"
>
  <ServiceContent path={selectedPath} ... />
</div>
```

---

### Step 5: Build DesignContent

**File:** Can live inside `ServiceContent.tsx` or as a separate file.

**Shared helper** — reuse across all service content:
```tsx
const ServiceHero = ({ ariaLabel }: { ariaLabel: string }) => (
  <CardContainer variant="dark" className="w-full overflow-hidden mb-8 md:mb-10">
    <div className="w-full bg-tea-ink/90" style={{ height: 'clamp(200px, 35vh, 400px)' }}
         role="img" aria-label={ariaLabel} />
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

const PrimaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="text-tea-seal hover:text-tea-seal/80 text-xs uppercase tracking-widest font-medium
               flex items-center gap-1 transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);

const SecondaryCTA = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="text-tea-ink/40 dark:text-tea-paper/40 hover:text-tea-seal text-xs uppercase tracking-widest
               font-medium flex items-center gap-1 transition-colors duration-300 min-h-[44px]
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    {label}
    <Icons.ChevronRight className="w-3.5 h-3.5" />
  </button>
);
```

**DesignContent layout:**

```tsx
const PILLARS = ['Design', 'Curation', 'Tea Selection', 'Training', 'Operations'];

const PROCESS = [
  { step: 1, title: 'Conversation', desc: 'Share your vision' },
  { step: 2, title: 'Vision & Concept', desc: 'Written design direction' },
  { step: 3, title: 'Sourcing & Creation', desc: 'Sourcing and installation' },
  { step: 4, title: 'Training', desc: 'Your team learns the practice' },
  { step: 5, title: 'Opening', desc: 'Launch and refinement' },
];

const DesignContent = ({ onOpenInquiry, onNavigateToProjects }) => (
  <>
    <ServiceHero ariaLabel="A completed tea space with natural materials" />
    <ServiceLabel>Space Design</ServiceLabel>
    <ServiceHeading>Tea House Design & Curation</ServiceHeading>
    <ServiceDivider />

    <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-10">
      Complete tea space creation — from concept through opening. Design, curation, tea selection,
      training, and operations. For hotels, resorts, retreat centers, private residences, and new
      tea house owners.
    </p>

    {/* Pillars */}
    <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-3">
      What's Involved
    </p>
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-8">
      {PILLARS.map((p, i) => (
        <span key={p} className="text-sm text-tea-ink/60 dark:text-tea-paper/60">
          {p}{i < PILLARS.length - 1 && <span className="text-tea-ink/20 dark:text-tea-paper/20 ml-3">&middot;</span>}
        </span>
      ))}
    </div>

    {/* Process — desktop horizontal, mobile compact list */}
    <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-4">
      The Process
    </p>
    {/* Desktop */}
    <div className="hidden md:flex gap-8 relative mb-8">
      <div className="absolute top-4 left-0 right-0 h-[1px] bg-tea-ink/5 dark:bg-white/5" />
      {PROCESS.map(({ step, title, desc }) => (
        <div key={step} className="flex-1 relative z-10">
          <span className="text-tea-seal font-mono text-sm">{step}</span>
          <h4 className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper mt-1">{title}</h4>
          <p className="text-[11px] text-tea-ink/40 dark:text-tea-paper/40 mt-0.5">{desc}</p>
        </div>
      ))}
    </div>
    {/* Mobile */}
    <div className="md:hidden space-y-3 mb-8">
      {PROCESS.map(({ step, title, desc }) => (
        <div key={step} className="flex items-baseline gap-3">
          <span className="text-tea-seal font-mono text-sm w-4 shrink-0">{step}</span>
          <div>
            <span className="font-serif text-sm font-medium text-tea-ink dark:text-tea-paper">{title}</span>
            <span className="text-tea-ink/30 dark:text-tea-paper/30 mx-1.5">&mdash;</span>
            <span className="text-[11px] text-tea-ink/40 dark:text-tea-paper/40">{desc}</span>
          </div>
        </div>
      ))}
    </div>

    <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mb-8">
      Projects range from $5,000 to $100,000+. Every project is scoped through conversation.
    </p>

    <div className="flex flex-col gap-2">
      <PrimaryCTA label="Start a conversation" onClick={() => onOpenInquiry('Space design or tea integration')} />
      <SecondaryCTA label="See completed spaces" onClick={() => onNavigateToProjects('space')} />
    </div>
  </>
);
```

---

### Step 6: Build SessionsContent

Same file or alongside DesignContent.

```tsx
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

const SessionsContent = ({ onOpenInquiry }) => (
  <>
    <ServiceHero ariaLabel="Ceremonial tea space with floor seating" />
    <ServiceLabel>Sessions</ServiceLabel>
    <ServiceHeading>Sessions & Guidance</ServiceHeading>
    <ServiceDivider />

    <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-10">
      Tea experiences and practice support — in the Bali studio or wherever you are.
    </p>

    <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mb-2">
      Offerings
    </p>
    <div className="max-w-[640px]">
      {OFFERINGS.map(({ name, price, desc }) => (
        <div key={name} className="flex items-start justify-between py-5 border-b border-tea-ink/5 dark:border-white/5 last:border-0">
          <div>
            <h4 className="font-serif text-base text-tea-ink dark:text-tea-paper">{name}</h4>
            <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mt-1">{desc}</p>
          </div>
          <span className="font-sans text-sm text-tea-seal whitespace-nowrap ml-4">{price}</span>
        </div>
      ))}
    </div>

    <p className="text-[11px] uppercase tracking-wider font-medium text-tea-ink/40 dark:text-tea-paper/40 mt-8 mb-3">
      What You Walk Away With
    </p>
    <ul className="space-y-1.5 mb-8">
      {WALKAWAY.map(item => (
        <li key={item} className="text-sm text-tea-ink/60 dark:text-tea-paper/60 flex items-start gap-2">
          <span className="text-tea-seal mt-0.5">&middot;</span> {item}
        </li>
      ))}
    </ul>

    <PrimaryCTA label="Book a session" onClick={() => onOpenInquiry('A session or practice guidance')} />
  </>
);
```

---

### Step 7: Build JourneysContent, SourcingContent, EventsContent

These are short. Can all live in ServiceContent.tsx.

**JourneysContent:**
```tsx
const JourneysContent = ({ onOpenInquiry, onNavigateToMagazine }) => (
  <>
    <ServiceHero ariaLabel="Mountain tea terraces at sunrise" />
    <ServiceLabel>Travel</ServiceLabel>
    <ServiceHeading>Sourcing Journeys</ServiceHeading>
    <ServiceDivider />

    <div className="max-w-[640px] space-y-4 mb-8">
      <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
        Travel to tea origins with a guide who knows the way. Taiwan, China, and beyond.
      </p>
      <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70">
        For two decades, I've built relationships with farmers, masters, and artisans across Asia.
        These aren't tours — each journey is shaped around what calls to you.
      </p>
    </div>

    <p className="text-sm text-tea-seal uppercase tracking-wider mb-8">Seasonal &middot; By invitation</p>

    <div className="flex flex-col gap-2">
      <PrimaryCTA label="Start a conversation" onClick={() => onOpenInquiry('A sourcing journey')} />
      <SecondaryCTA label="Read stories from tea origins" onClick={onNavigateToMagazine} />
    </div>
  </>
);
```

**SourcingContent:** (no hero image)
```tsx
const SourcingContent = ({ onOpenInquiry, onNavigateToShop }) => (
  <>
    <ServiceLabel>Supply</ServiceLabel>
    <ServiceHeading>Tea Sourcing</ServiceHeading>
    <ServiceDivider />

    <p className="font-serif text-lg italic text-tea-ink dark:text-tea-paper max-w-[640px] mb-4">
      Quality tea for your space, your collection, or your community.
    </p>
    <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-8">
      Direct sourcing from Taiwan, China, and trusted origins. For individual collectors seeking access
      to exceptional teas. For retreat centers, hotels, and communities wanting quality tea as part of
      what they offer.
    </p>

    <div className="flex flex-col gap-2">
      <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('Tea sourcing')} />
      <SecondaryCTA label="Browse the shop" onClick={onNavigateToShop} />
    </div>
  </>
);
```

**EventsContent:**
```tsx
const EventsContent = ({ onOpenInquiry }) => (
  <>
    <ServiceHero ariaLabel="Group tea ceremony with candles and charcoal" />
    <ServiceLabel>Events</ServiceLabel>
    <ServiceHeading>Tea Experiences for Gatherings</ServiceHeading>
    <ServiceDivider />

    <p className="font-sans text-sm leading-relaxed text-tea-ink/70 dark:text-tea-paper/70 max-w-[640px] mb-6">
      I bring everything — tea, teaware, the setup, and the atmosphere — to your gathering.
      Retreats, dinners, brand activations, celebrations.
    </p>
    <p className="text-sm text-tea-seal mb-1">From $500 for a half-day.</p>
    <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 mb-8">
      Full-day and multi-day experiences quoted based on scope.
    </p>

    <PrimaryCTA label="Inquire" onClick={() => onOpenInquiry('An event or group experience')} />
  </>
);
```

---

### Step 8: Build AdrianSection

Small inline component or section in ConsultPage.

```tsx
const AdrianSection = () => {
  const reveal = useSectionReveal();
  return (
    <section ref={reveal.ref} className={`mt-16 md:mt-20 ${reveal.className}`} style={reveal.style}>
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Photo */}
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
```

---

### Step 9: Build ProjectsPreview

Simplified version of the Projects grid — shows 3 cards, filtered by selected path.

```tsx
const ProjectsPreview = ({ selectedPath, onSelectProject, onViewAll }) => {
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
                   flex items-center gap-1 transition-colors duration-300 min-h-[44px]">
        View all projects <Icons.ChevronRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
};

const ProjectCard = ({ project, onClick }) => (
  <button onClick={onClick} className="text-left group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-seal/50 rounded-sm">
    <CardContainer variant="dark" className="overflow-hidden mb-3 group-hover:-translate-y-1 transition-all duration-300">
      <div className="w-full bg-tea-ink/90" style={{ aspectRatio: '16/10' }} role="img" aria-label={`${project.name} project`} />
    </CardContainer>
    <h4 className="font-serif text-base font-medium text-tea-ink dark:text-tea-paper">{project.name}</h4>
    <p className="text-xs uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">{project.location}</p>
  </button>
);
```

---

### Step 10: Build TestimonialRotator

Auto-rotating single testimonial with crossfade.

```tsx
const TestimonialRotator = () => {
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
```

---

### Step 11: Build ClosingCTA

```tsx
const ClosingCTA = ({ onOpenInquiry }) => {
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
```

---

### Step 12: Wire up navigation

The ConsultPage still needs to handle navigating TO the full Projects view and ProjectDetail view (these existing components remain unchanged).

Keep the existing `currentView` / `navigateTo` pattern but simplified:
- `currentView` can be `'main'` | `'projects'` | `'project-detail'`
- Default is `'main'` (the new layout)
- "View all projects" sets `'projects'` and renders `<Projects />`
- Clicking a project card sets `'project-detail'` and renders `<ProjectDetail />`
- Back buttons on those pages return to `'main'`

```tsx
if (currentView === 'projects') {
  return <Projects onBack={() => navigateTo('main')} onSelectProject={(id) => navigateTo('project-detail', id)} />;
}
if (currentView === 'project-detail' && selectedProject) {
  return <ProjectDetail project={selectedProject} onBack={() => navigateTo('projects')} onOpenInquiry={openInquiry} />;
}
// else render the main layout
```

---

### Step 13: Mobile sticky selection indicator

When a card is selected and user scrolls past the card grid, show a compact bar below the PageHeader.

Uses `IntersectionObserver` on the card grid container:
```tsx
const cardsRef = useRef<HTMLDivElement>(null);
const [cardsVisible, setCardsVisible] = useState(true);

useEffect(() => {
  if (!cardsRef.current) return;
  const obs = new IntersectionObserver(([e]) => setCardsVisible(e.isIntersecting), { threshold: 0 });
  obs.observe(cardsRef.current);
  return () => obs.disconnect();
}, []);
```

Render the bar (mobile only, inside the page before the content):
```tsx
{selectedPath && !cardsVisible && (
  <div className="md:hidden sticky top-[var(--header-height,56px)] z-20 bg-white/80 dark:bg-[#1a1a1a]/80
                  backdrop-blur-xl border-b border-tea-ink/5 dark:border-white/5 px-4 py-2.5
                  flex items-center justify-between animate-[fadeIn_0.2s_ease-out]">
    <span className="font-serif text-sm text-tea-ink dark:text-tea-paper">
      {PATH_CARDS.find(c => c.id === selectedPath)?.service}
    </span>
    <button onClick={() => cardsRef.current?.scrollIntoView({ behavior: 'smooth' })}
      className="text-tea-seal text-xs uppercase tracking-wider">
      Change
    </button>
  </div>
)}
```

---

### Step 14: Clean up old files

Once the new ConsultPage is working:

**Files to delete:**
- `src/components/consult/SessionsGuidance.tsx` — absorbed into SessionsContent
- `src/components/consult/TeaSourcing.tsx` — absorbed into SourcingContent
- `src/components/consult/StickyInquiryBar.tsx` — no longer used

**Files to keep:**
- `src/components/consult/InquiryForm.tsx` — unchanged
- `src/components/consult/Projects.tsx` — still used as sub-view
- `src/components/consult/ProjectDetail.tsx` — still used as sub-view
- `src/components/consult/ProjectPage.tsx` — if used elsewhere
- `src/components/consult/ServiceBadge.tsx` — optional, could reuse in cards

**Files absorbed but keep for reference until confirmed working:**
- `src/components/consult/TeaHouseDesign.tsx` — content moved to DesignContent
- `src/components/consult/SourcingJourneys.tsx` — content moved to JourneysContent

---

## File Summary

| File | Action | Notes |
|---|---|---|
| `src/components/ConsultPage.tsx` | **Rewrite** | New shell: PageHeader, opening, cards, content, Adrian, projects, testimonials, CTA |
| `src/components/consult/ServiceContent.tsx` | **Create** | Switcher + DesignContent, SessionsContent, JourneysContent, SourcingContent, EventsContent + shared helpers (ServiceHero, ServiceLabel, etc.) |
| `src/components/consult/InquiryForm.tsx` | **Keep** | No changes |
| `src/components/consult/Projects.tsx` | **Keep** | Used as sub-view for "View all projects" |
| `src/components/consult/ProjectDetail.tsx` | **Keep** | Used as sub-view for individual projects |
| `src/components/consult/TeaHouseDesign.tsx` | **Delete after confirm** | Content absorbed into DesignContent |
| `src/components/consult/SourcingJourneys.tsx` | **Delete after confirm** | Content absorbed into JourneysContent |
| `src/components/consult/SessionsGuidance.tsx` | **Delete** | Content absorbed into SessionsContent |
| `src/components/consult/TeaSourcing.tsx` | **Delete** | Content absorbed into SourcingContent |
| `src/components/consult/StickyInquiryBar.tsx` | **Delete** | No longer needed |
| `src/components/consult/ServiceBadge.tsx` | **Keep** | Optional reuse |
| `src/components/consult/ProjectPage.tsx` | **Keep** | Check if used elsewhere |
| `src/types/consult.ts` | **Update** | Simplify ConsultView type to `'main' \| 'projects' \| 'project-detail'` |
| `src/data/consultProjects.ts` | **Keep** | No changes |
| `src/data/consultTestimonials.ts` | **Keep** | No changes |

---

## Key Behaviors Checklist

- [ ] Page loads with no card selected — shows cards + Adrian + Projects + Testimonials + CTA
- [ ] Clicking a card reveals service content between cards and Adrian section
- [ ] Clicking the same card again deselects it (collapses content)
- [ ] Switching cards crossfades content (no layout jump)
- [ ] Mobile: tapping a card smooth-scrolls to content
- [ ] Mobile: sticky bar shows service name + "Change" when scrolled past cards
- [ ] "Just talk" link opens InquiryForm with no preselection
- [ ] Each service CTA opens InquiryForm with correct preselection
- [ ] "See completed spaces" scrolls to Projects and filters to spaces
- [ ] "View all projects" navigates to full Projects sub-view
- [ ] Project card click navigates to ProjectDetail sub-view
- [ ] Back buttons on Projects/ProjectDetail return to main view
- [ ] Testimonials auto-rotate every 6s (respects prefers-reduced-motion)
- [ ] Closing CTA button is the only solid/filled button on the page
- [ ] All sections use useSectionReveal for scroll-triggered fade-in
- [ ] Dark mode works throughout
- [ ] All buttons have min-h-[44px] and focus-visible rings
