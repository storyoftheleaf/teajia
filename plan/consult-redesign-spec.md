# Consult Page Redesign — Complete Layout Specification

## Concept: "The Conversation" (Option 4 + Option 3 Visuals)

The page opens with a question — "What brings you here?" — and routes visitors to the right service based on their answer. When a path is selected, immersive visual content expands below. The page is never empty; unselected state shows a warm default with projects and proof. Selected state zooms into the relevant service with atmosphere and detail.

---

## Design Principles

1. **Visitor-first, not service-list.** Organize by what people seek, not what you offer.
2. **Always have content.** No blank states. Default view is inviting. Selected view is focused.
3. **Pricing where it belongs.** Sessions show prices. Design work says "By Inquiry." No ambiguity.
4. **Adrian is present.** This is a person, not an agency. His voice, his photo, his experience grounds the page.
5. **One CTA everywhere.** Every path leads to the same inquiry form. Pre-selected based on context.
6. **Photographs earn their space.** Each image is atmospheric and purposeful, not decorative filler.

---

## Page Structure (Top to Bottom)

```
PageHeader ("Consult")
    |
Opening — tagline + question
    |
Path Cards — 5 service options + "just talk" link
    |
[Service Content — expands when a card is selected]
    |
Divider
    |
Adrian Section — portrait, bio, credibility
    |
Projects Preview — filtered by selection when active
    |
Testimonials — single rotating quote
    |
Closing CTA — "Every project begins with a conversation."
```

---

## Section 1: PageHeader

Use the standard `PageHeader` component. **No tabs.** The old Overview/Design/Sourcing/Projects tabs are gone — the path cards replace them entirely.

```
PageHeader
  title: "Consult"
  onCartClick, onAccountClick, cartItemCount (standard props)
  children: none (no PageHeaderTabs)
```

The header collapses on mobile scroll as usual (title shrinks from text-4xl to text-base). On desktop it stays expanded.

---

## Section 2: Opening

Directly below the PageHeader. Generous breathing room.

**Desktop:**
```
                                                    pt-12 lg:pt-16

    What brings you here?                           font-serif text-2xl md:text-3xl
                                                    text-tea-ink dark:text-tea-paper
                                                    font-light

    [12px tea-seal divider line]                    w-12 h-[1px] bg-tea-seal mt-4 mb-10
```

**Mobile:**
Same, but `pt-8 mb-8`. The question is left-aligned (matching the rest of the site's editorial alignment — never centered on mobile).

**Desktop alignment:** Left-aligned within the max-w-[1400px] container. Consistent with HomePage, LearnHub, etc.

---

## Section 3: Path Cards

Five cards in a grid. Each card represents a visitor intent mapped to a service.

### Card Data

| # | Visitor Intent (headline) | Subline | Service | Badge |
|---|---|---|---|---|
| 1 | I want to create a tea space | Hotels, retreats, homes, community spaces | Tea House Design | By Inquiry |
| 2 | I want to deepen my practice | Sessions, guidance, building a practice | Sessions & Guidance | From $50 |
| 3 | I want to travel to tea origins | Sourcing journeys through Asia | Sourcing Journeys | Seasonal |
| 4 | I need quality tea for my space | Sourcing for businesses and collectors | Tea Sourcing | By Inquiry |
| 5 | I want a tea experience for an event | Retreats, dinners, celebrations, gatherings | Events | From $500 |

### Grid Layout

**Desktop (lg+):**
```
┌──────────────────────────────────────────────────────────┐
│  1. I want to create a tea space            By Inquiry   │   ← full width, flagship
└──────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────┐
│  2. Deepen my practice   │  │  3. Travel to origins    │   ← 2 columns
│     From $50             │  │     Seasonal             │
└──────────────────────────┘  └──────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────┐
│  4. Quality tea          │  │  5. Event experience     │   ← 2 columns
│     By Inquiry           │  │     From $500            │
└──────────────────────────┘  └──────────────────────────┘
```

CSS: `grid grid-cols-1 lg:grid-cols-2 gap-3`. Card #1 spans `lg:col-span-2`.

**Tablet (md):** Same 2-column grid. Card #1 still spans full width.

**Mobile:** Single column stack. All cards full width. Gap: `gap-3`.

### Individual Card Design

Each card is a `<button>` element (not a link — it controls content on the same page).

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   I want to create a tea space                          │  ← font-serif text-base md:text-lg
│   Hotels, retreats, homes, community spaces             │  ← font-sans text-sm text-tea-ink/50
│                                                         │
│   Design & Curation  ·  By Inquiry                  →   │  ← text-[11px] uppercase tracking-wider
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Styling:**

```
Default state:
  border border-tea-ink/10 dark:border-white/10
  bg-transparent
  rounded-[1px]                          (matches CardContainer)
  p-5 md:p-6
  text-left
  transition-all duration-300

Hover state:
  border-tea-ink/20 dark:border-white/20
  bg-tea-ink/[2%] dark:bg-white/[2%]

Selected state:
  border-tea-seal/40
  bg-tea-seal/[4%] dark:bg-tea-seal/[6%]
  shadow-[0_0_0_1px_rgba(var(--tea-seal-rgb),0.15)]

Focus state:
  focus-visible:outline-none
  focus-visible:ring-2 focus-visible:ring-tea-seal/50 focus-visible:ring-offset-2
```

**Card internal layout:**

```
<button className="...card styles...">
  <div className="flex flex-col gap-1.5">
    {/* Headline */}
    <span className="font-serif text-base md:text-lg text-tea-ink dark:text-tea-paper">
      I want to create a tea space
    </span>

    {/* Subline */}
    <span className="font-sans text-sm text-tea-ink/50 dark:text-tea-paper/50">
      Hotels, retreats, homes, community spaces
    </span>
  </div>

  {/* Bottom row — service name + badge + arrow */}
  <div className="flex items-center justify-between mt-4 pt-3 border-t border-tea-ink/5 dark:border-white/5">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">
        Design & Curation
      </span>
      <span className="text-tea-ink/20 dark:text-tea-paper/20">·</span>
      <span className="text-[11px] uppercase tracking-wider text-tea-seal">
        By Inquiry
      </span>
    </div>
    <ChevronRight className="w-4 h-4 text-tea-ink/20 dark:text-tea-paper/20
                              group-hover:text-tea-seal transition-colors" />
  </div>
</button>
```

**Min touch target:** Each card is naturally > 44px tall due to padding + content. Good.

**Flagship card (#1) on desktop:** Same internal design, but the extra width gives it breathing room. Optionally, on lg+ screens, the flagship card can have a subtle background image on the right side (a faded, low-opacity photograph of a designed tea space). This is a progressive enhancement — works without the image, gets richer with one.

### "Just Talk" Link

Below the card grid, with `mt-4`:

```
Or, just start a conversation →
```

Styled as:
```
font-sans text-sm text-tea-ink/40 dark:text-tea-paper/40
hover:text-tea-seal transition-colors duration-300
inline-flex items-center gap-1.5
cursor-pointer
```

The arrow is a `ChevronRight` icon, w-3.5 h-3.5. Clicking opens the InquiryForm with no preselection.

---

## Section 4: Expanded Service Content

This is the heart of the redesign. When a path card is selected, a content block appears between the cards and the Adrian section.

### Container

```
<div className="mt-10 md:mt-12">
  {/* Content transitions here */}
</div>
```

**Transition behavior:**
- First selection: Content fades in (opacity 0→1, translate-y 8px→0, 400ms ease-out)
- Switching between services: Crossfade (current fades out 150ms, new fades in 300ms)
- Content height animates smoothly (no jarring layout shifts)

**Respects `prefers-reduced-motion`:** If enabled, instant swap with no animation.

### Content Structure (shared pattern)

Every service follows this template, with content varying:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   [Atmospheric Photo — full width, rounded-[1px]]        │   ← 35vh mobile, 40vh desktop
│                                                          │
└──────────────────────────────────────────────────────────┘

    SERVICE NAME                                               ← text-xs uppercase tracking-[0.2em] tea-seal
    Headline                                                   ← font-serif text-2xl md:text-3xl
    ─── (tea-seal divider)                                     ← w-12 h-[1px] mt-3 mb-6

    Body text / details / pricing                              ← max-w-[640px]
    (varies per service)

    [Primary CTA]                                              ← text-tea-seal, uppercase, tracking
    [Secondary link]                                           ← text-tea-ink/40, uppercase, tracking

```

### Photo Treatment

Each service has an atmospheric hero image. Use a `CardContainer variant="dark"` wrapper:

```jsx
<CardContainer variant="dark" className="w-full overflow-hidden mb-8 md:mb-10">
  <div
    className="w-full bg-tea-ink/90"
    style={{ height: 'clamp(200px, 35vh, 400px)' }}
    role="img"
    aria-label="..."
  >
    {/* When real photo exists: <img> with object-cover */}
    {/* Placeholder: empty dark div, same as current pattern */}
  </div>
</CardContainer>
```

This gives the image the site's signature barely-rounded dark frame with subtle shadow. The `clamp()` prevents it from being too small on tiny screens or too large on 4K.

---

### Service 1: Tea House Design & Curation

**Photo:** A completed tea space — warm lighting, natural materials, tea table visible.

**Content:**

```
SPACE DESIGN                                          ← label
Tea House Design & Curation                           ← heading
───                                                   ← divider

Complete tea space creation — from concept through
opening. Design, curation, tea selection, training,
and operations. For hotels, resorts, retreat centers,
private residences, and new tea house owners.          ← single paragraph, max-w-[640px]

WHAT'S INVOLVED                                        ← sub-label, mt-10

Design · Curation · Tea Selection · Training · Operations
                                                       ← flex-wrap, gap-x-3 gap-y-1
                                                       ← text-sm text-tea-ink/60
                                                       ← dots are text-tea-ink/20

THE PROCESS                                            ← sub-label, mt-8

1  Conversation                                        ← numbered list, clean
2  Vision & Concept                                      each number is text-tea-seal
3  Sourcing & Creation                                   title is font-medium
4  Training                                              one-line description in text-tea-ink/50
5  Opening

                                                       ← mt-8
Projects range from $5,000 to $100,000+                ← font-sans text-sm text-tea-ink/50
Every project is scoped through conversation.

Start a conversation →                                 ← primary CTA
See completed spaces →                                 ← secondary (scrolls to Projects, filters to Spaces)
```

**Process list layout:**

```
Desktop: 5 items in a row (flex, gap-8, each item w-1/5-ish)
Mobile: 5 items stacked vertically, compact

Each item:
┌──────────┐
│  1       │  ← text-tea-seal font-mono text-sm
│  Conver- │  ← font-serif text-sm font-medium
│  sation  │
│  Share    │  ← text-[11px] text-tea-ink/40, 1 line
│  your    │
│  vision  │
└──────────┘
```

Desktop layout for the process: a horizontal row of 5 steps with subtle connecting lines (a thin horizontal line behind them at 50% height, `absolute`, `bg-tea-ink/5`). Each step sits on top of this line.

Mobile: vertical stack, each step is a single row:
```
1   Conversation — Share your vision
2   Concept — Written design direction
3   Creation — Sourcing and installation
4   Training — Your team learns the practice
5   Opening — Launch and refinement
```

---

### Service 2: Sessions & Guidance

**Photo:** The living room ceremonial space — floor seating, circle, warm atmosphere.

**Content:**

```
SESSIONS                                               ← label
Sessions & Guidance                                    ← heading
───                                                    ← divider

Tea experiences and practice support — in the Bali
studio or wherever you are.                            ← brief intro

                                                       ← mt-10
```

**Offerings — the key differentiator of this section.** This is where real pricing lives. Layout as a clean, scannable list:

```
OFFERINGS                                              ← sub-label

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Open Sit                                            Free       │
│  Come by the studio. Share tea. No appointment.                 │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                 │
│  Guided Practice Setup                          $250 – 300      │
│  2–3 hours. Leave fully equipped.                               │
│  Includes $100–150 product credit.                              │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                 │
│  Group Ceremonial Session                    From $30/person    │
│  Up to 12. The living room space.                               │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                 │
│  Private or Group Booking                    From $500          │
│  Half-day or full-day. Your gathering.                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Styling for each offering row:**

```
<div className="flex items-start justify-between py-5 border-b border-tea-ink/5 last:border-0">
  <div>
    <h4 className="font-serif text-base text-tea-ink">Open Sit</h4>
    <p className="text-sm text-tea-ink/50 mt-1">Come by the studio. Share tea.</p>
  </div>
  <span className="font-sans text-sm text-tea-seal whitespace-nowrap ml-4">Free</span>
</div>
```

The price sits right-aligned. On mobile, same layout works — the flex row with `items-start` keeps the price from wrapping awkwardly. If the description is long, it wraps under itself while the price stays top-right.

**After the offerings:**

```
WHAT YOU WALK AWAY WITH                                ← sub-label, mt-8

· Teas chosen for your palate                          ← bulleted list
· Personalized brewing guide                             styled as:
· Practice philosophy card                               text-sm text-tea-ink/60
· Follow-up check-in within two weeks                    · = text-tea-seal mr-2
```

Then:
```
Book a Session →                                       ← primary CTA (opens inquiry, preselect: session)
```

---

### Service 3: Sourcing Journeys

**Photo:** Mountain tea terraces, or a tea farmer at work.

**Content:**

```
TRAVEL                                                 ← label
Sourcing Journeys                                      ← heading
───                                                    ← divider

Travel to tea origins with a guide who knows the
way. Taiwan, China, and beyond.                        ← brief intro

For two decades, I've built relationships with
farmers, masters, and artisans across Asia. These
aren't tours — each journey is shaped around what
calls to you.                                          ← second paragraph

                                                       ← mt-8
Seasonal · By invitation                               ← text-sm text-tea-seal uppercase tracking-wider

Start a conversation →                                 ← primary CTA
Read stories from tea origins →                        ← secondary (links to Magazine)
```

This is intentionally shorter than the other sections. Sourcing Journeys are rare, personal, and not something you sell with bullet points. The brevity signals exclusivity.

---

### Service 4: Tea Sourcing

**Photo:** None. This section is text-only — the simplest offering doesn't need visual weight.

**Content:**

```
SUPPLY                                                 ← label
Tea Sourcing                                           ← heading
───                                                    ← divider

Quality tea for your space, your collection,
or your community.                                     ← tagline, font-serif text-lg, italic

Direct sourcing from Taiwan, China, and trusted
origins. For individual collectors seeking access
to exceptional teas. For retreat centers, hotels,
and communities wanting quality tea as part of
what they offer.                                       ← body paragraph

Inquire →                                              ← primary CTA
Browse the shop →                                      ← secondary (links to Shop)
```

Compact. No image, no pricing grid. This is an inquiry-driven service.

---

### Service 5: Events

**Photo:** A group tea ceremony in action — candles, charcoal, people gathered.

**Content:**

```
EVENTS                                                 ← label
Tea Experiences for Gatherings                         ← heading
───                                                    ← divider

I bring everything — tea, teaware, the setup, and
the atmosphere — to your gathering. Retreats,
dinners, brand activations, celebrations.              ← brief intro

From $500 for a half-day.                              ← text-sm text-tea-seal
Full-day and multi-day experiences quoted
based on scope.                                        ← text-sm text-tea-ink/50

Inquire →                                              ← primary CTA
```

Also compact. Events are inquiry-driven.

---

## Section 5: Divider

A full-width horizontal line separating service content from the proof section below.

```
<div className="border-t border-tea-ink/5 dark:border-white/5 mt-16 md:mt-20" />
```

---

## Section 6: Adrian Section

This grounds the page in a real person. It appears whether or not a service is selected.

**Layout:**

```
Desktop (md+):
┌──────────────┬──────────────────────────────────────────┐
│              │                                          │
│   [Portrait  │  ADRIAN RASMUSSEN                        │  ← text-[11px] uppercase tracking-[0.2em]
│    photo     │                                          │     text-tea-ink/40
│    square    │  Twenty years in tea culture.             │  ← font-serif text-lg
│    aspect    │  Taiwan, China, Bali, and beyond.         │
│    160x160]  │                                          │
│              │  Brief bio — 2-3 sentences about         │  ← text-sm text-tea-ink/60, mt-3
│              │  who you're working with when you         │
│              │  inquire. His design background,          │
│              │  his sourcing relationships, his          │
│              │  approach to space and practice.          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘

Mobile:
[Portrait photo — full width, aspect-[4/3], mb-6]

ADRIAN RASMUSSEN
Twenty years in tea culture.
Taiwan, China, Bali, and beyond.

Brief bio text...
```

**Photo treatment:**
- Desktop: 160x160px square, `rounded-[1px]`, `object-cover`, in a flex row with the text
- Mobile: Full width, aspect-[4/3], `rounded-[1px]`, `object-cover`
- Placeholder state: `bg-tea-ink/5 dark:bg-white/5` with "Photo" text centered (matching AboutPage pattern)

**Spacing:** `mt-16 md:mt-20` from the divider above.

This section is NOT a CTA. No button. It's just presence and credibility. The CTA comes at the very end.

---

## Section 7: Projects Preview

Shows 3 featured projects. When a service is selected, projects filter to show relevant types (spaces for Design, journeys for Sourcing Journeys, events for Events). When nothing is selected, show all featured.

**Layout:**

```
PORTFOLIO                                              ← text-xs uppercase tracking-[0.2em] tea-seal
Projects                                               ← font-serif text-2xl md:text-3xl
───                                                    ← w-12 h-[1px] bg-tea-seal, mb-8
```

**Desktop (md+):** 3-column grid of project cards

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│  [image]   │  │  [image]   │  │  [image]   │
│  16/10     │  │  16/10     │  │  16/10     │
│            │  │            │  │            │
│  Name      │  │  Name      │  │  Name      │
│  Location  │  │  Location  │  │  Location  │
└────────────┘  └────────────┘  └────────────┘
```

Grid: `grid grid-cols-1 md:grid-cols-3 gap-5`

**Mobile:** SwipeCarousel (reuse existing component) with `showDots peek={12}`.

Each project card (reuse the pattern from current Projects.tsx):
```
<button className="text-left group w-full">
  <CardContainer variant="dark" className="overflow-hidden mb-3 group-hover:-translate-y-1 transition-all duration-300">
    <div className="w-full bg-tea-ink/90" style={{ aspectRatio: '16/10' }} />
  </CardContainer>
  <h3 className="font-serif text-base font-medium text-tea-ink dark:text-tea-paper">
    {project.name}
  </h3>
  <p className="text-xs uppercase tracking-wider text-tea-ink/40 dark:text-tea-paper/40">
    {project.location}
  </p>
</button>
```

**Below the grid:**
```
View all projects →                                    ← text-tea-seal, uppercase, tracking-widest
                                                         navigates to full Projects view
```

**Filtering logic:**
- No card selected → show first 3 `featured` projects
- Card 1 (Tea House Design) → filter to `type === 'space'`, show first 3
- Card 2 (Sessions) → show first 3 featured (no session-specific projects)
- Card 3 (Sourcing Journeys) → filter to `type === 'journey'`, show first 3
- Card 4 (Tea Sourcing) → show first 3 featured (no sourcing-specific projects)
- Card 5 (Events) → filter to `type === 'event'`, show first 3

If a filter yields fewer than 3, pad with featured projects from other types.

**Spacing:** `mt-16 md:mt-20` (SECTION_GAP_LG equivalent)

---

## Section 8: Testimonials

Single testimonial, centered, elegant. Not a carousel of many — just one at a time.

**Layout:**

```
                    "                                   ← large opening quote mark
                                                         font-serif text-6xl text-tea-seal/20
                                                         absolute, decorative

    Quote text goes here, keeping it to
    two or three lines maximum for
    visual elegance and readability.                    ← font-serif text-lg md:text-xl
                                                         italic, text-tea-ink dark:text-tea-paper
                                                         text-center, max-w-[640px], mx-auto

    Name                                               ← text-xs uppercase tracking-wider
    Title                                                text-tea-ink/40, text-center, mt-4
```

If there are multiple testimonials, rotate them on a 6-second interval with a subtle crossfade (opacity transition, 400ms). No dots, no arrows — just quiet rotation. If `prefers-reduced-motion`, show the first one statically.

**Spacing:** `mt-16 md:mt-20` from Projects.

---

## Section 9: Closing CTA

The page's final beat. This is where "Every project begins with a conversation" lands — as the closing invitation, not the opening.

**Layout:**

```
    ────────────────────────────                       ← border-t, full content width

                                                       ← pt-16 md:pt-20

    Every project begins                               ← font-serif text-2xl md:text-3xl
    with a conversation.                                 text-tea-ink, font-light
                                                         text-center

    ───                                                ← w-12 h-[1px] bg-tea-seal
                                                         mx-auto, mt-4 mb-8

    [  Start a Conversation  →  ]                      ← button:
                                                         bg-tea-seal text-white
                                                         text-xs uppercase tracking-widest
                                                         py-3.5 px-8
                                                         rounded-[1px]
                                                         hover:bg-tea-seal/90
                                                         mx-auto (centered)
                                                         min-h-[44px]

                                                       ← pb-24 md:pb-32
```

This is the only filled/solid button on the entire page. Everything else is text links. The contrast makes it unmissable.

---

## Sticky Behavior

### Mobile: Sticky Selection Indicator

When the user has selected a path card and scrolls past the cards, a compact sticky bar appears below the PageHeader:

```
┌────────────────────────────────────────────────────────────┐
│  Sessions & Guidance                        Change    ×    │
└────────────────────────────────────────────────────────────┘
```

**Styling:**
```
bg-white/80 dark:bg-[#1a1a1a]/80
backdrop-blur-xl
border-b border-tea-ink/5
px-4 py-2.5
flex items-center justify-between
text-sm
```

- Service name: `font-serif text-sm text-tea-ink`
- "Change" button: `text-tea-seal text-xs uppercase tracking-wider` — scrolls back up to the cards
- Appears with `opacity 0→1` transition when cards scroll out of viewport
- Disappears when cards come back into view

This replaces the old tab system. It's lighter, contextual, and doesn't compete with the PageHeader.

### Desktop: No sticky bar needed

On desktop, the card grid is likely still visible (or one short scroll away). No sticky indicator. If the user wants to switch, they scroll up.

### Sticky Inquiry Bar (StickyInquiryBar)

**Remove from this page.** The old StickyInquiryBar was needed because the page was so long you'd lose the CTA. The new design has CTAs embedded in each service section AND a closing CTA. The sticky bar would be redundant and cluttered.

---

## Scroll-Reveal Animations

Use `useSectionReveal()` on these sections:
- Each service content block (when it first appears)
- Adrian section
- Projects section
- Testimonials
- Closing CTA

These are already established in the codebase (fade-in + translate-y, 0.6s ease-out, triggered by IntersectionObserver at 10% visibility). Keep the same behavior.

---

## Mobile Scroll Behavior

When a card is tapped on mobile:
1. Card gets selected state (instant visual feedback)
2. `scrollIntoView({ behavior: 'smooth', block: 'start' })` on the service content container
3. Content fades in as user scrolls to it

This ensures the user sees the result of their tap immediately — no confusion about what happened.

---

## Keyboard & Accessibility

- All path cards are `<button>` elements with `role` and `aria-pressed` for selected state
- Arrow keys navigate between cards (within the grid)
- Enter/Space selects a card
- Service content has `aria-live="polite"` so screen readers announce the change
- All images have descriptive `aria-label`
- Focus order: Header → Cards (1-5) → "Just talk" link → Service content → Adrian → Projects → Testimonials → CTA
- Skip link consideration: if service content is long, the "Change" sticky bar provides a way back to cards

---

## Dark Mode

All elements use the existing `dark:` variants from the design system:
- Backgrounds: `dark:bg-[#1a1a1a]` or `dark:bg-tea-ink`
- Text: `dark:text-tea-paper` / `dark:text-tea-paper/50` etc.
- Borders: `dark:border-white/10`
- tea-seal color stays the same in both modes

---

## What Gets Removed

From the current ConsultPage:
- **Split-screen hero** (the dark/light halves) — replaced by path cards
- **PageHeaderTabs** (Overview/Design/Sourcing/Projects) — replaced by path cards
- **Inline Sourcing Journeys section** on overview — now in expandable content
- **Inline Tea Sourcing section** on overview — now in expandable content
- **Inline Projects section** on overview — replaced by Projects Preview
- **Inline Testimonials grid** on overview — replaced by single rotating quote
- **StickyInquiryBar** — redundant with embedded CTAs

From sub-pages:
- **TeaHouseDesign.tsx** — content absorbed into service 1 expandable (simplified)
- **SourcingJourneys.tsx** — content absorbed into service 3 expandable (simplified)
- **SessionsGuidance.tsx** — content absorbed into service 2 expandable (enhanced with pricing)
- **TeaSourcing.tsx** — content absorbed into service 4 expandable

**Kept as-is:**
- **Projects.tsx** — still accessible via "View all projects →" link
- **ProjectDetail.tsx** — still accessible via individual project card clicks
- **InquiryForm.tsx** — still the universal inquiry modal, unchanged
- **ServiceBadge.tsx** — can be reused in card bottom row if desired

---

## Component Architecture

```
ConsultPage.tsx (rewrite)
  ├── PageHeader (existing, no tabs)
  ├── PathCards (new component or inline)
  │     └── PathCard × 5
  ├── ServiceContent (new component)
  │     ├── TeaHouseDesignContent
  │     ├── SessionsContent
  │     ├── SourcingJourneysContent
  │     ├── TeaSourcingContent
  │     └── EventsContent
  ├── AdrianSection (new, small)
  ├── ProjectsPreview (new, simplified from Projects.tsx)
  ├── TestimonialRotator (new, small)
  ├── ClosingCTA (new, small)
  └── InquiryForm (existing, unchanged)
```

Could be one file or split into a few. The service content components are the largest pieces but each is just a static layout — no complex state.

---

## Typography Summary

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| "What brings you here?" | serif | text-2xl md:text-3xl | light | tea-ink |
| Card headline | serif | text-base md:text-lg | normal | tea-ink |
| Card subline | sans | text-sm | normal | tea-ink/50 |
| Card badge | sans | text-[11px] | normal | tea-seal |
| Service label | sans | text-xs | normal | tea-seal |
| Service heading | serif | text-2xl md:text-3xl | normal | tea-ink |
| Body text | sans | text-sm | normal | tea-ink/70 |
| Sub-label | sans | text-[11px] | medium | tea-ink/40 |
| Offering name | serif | text-base | normal | tea-ink |
| Offering price | sans | text-sm | normal | tea-seal |
| CTA text | sans | text-xs | medium | tea-seal |
| Adrian name | sans | text-[11px] | normal | tea-ink/40 |
| Adrian tagline | serif | text-lg | normal | tea-ink |
| Testimonial quote | serif | text-lg md:text-xl | normal (italic) | tea-ink |
| Closing line | serif | text-2xl md:text-3xl | light | tea-ink |

All with corresponding `dark:text-tea-paper` variants.

---

## Spacing Summary

| Gap | Where |
|---|---|
| pt-8 (mobile) / pt-12 (desktop) | After PageHeader |
| mb-8 / mb-10 | After opening question |
| gap-3 | Between path cards |
| mt-4 | "Just talk" link after cards |
| mt-10 / mt-12 | Service content after cards |
| mt-8 / mt-10 | Between sections within service content |
| mt-16 / mt-20 | Major section breaks (Adrian, Projects, Testimonials) |
| pt-16 / pt-20 | Closing CTA top padding |
| pb-24 / pb-32 | Page bottom padding |

These align with the existing SECTION_GAP and SECTION_GAP_LG constants.

---

## Performance Notes

- **No sub-pages loaded.** All 5 service content blocks are lightweight JSX. Render the selected one; the others don't mount.
- **Images lazy-load.** Service hero images only load when that service is selected (since the component mounts on selection).
- **No scroll-snap.** Unlike Option 3, this layout uses natural scroll. Snap-scrolling on a content-heavy page fights the user.
- **SwipeCarousel** only used for the Projects Preview on mobile (existing, optimized component).
- **Testimonial rotation** uses a simple `setInterval` — no external library.
