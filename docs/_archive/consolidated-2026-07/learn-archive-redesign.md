# Learn Section Redesign — "The Archive as Treasure Trove"

## Context

The Learn section ("The Archive") feels flat and catalog-like. It should feel like discovering a treasure of wisdom — a place overflowing with resources that make any tea person say "wow, there's so much here for me." Mobile-first. All features must be immediately discoverable and accessible.

## Why It Feels Flat (Root Causes)

1. **No visual imagery** — Entirely text + icons + one abstract SVG diagram
2. **Uniform card density** — Every section uses similar card styles at similar sizes
3. **List-heavy** — Course index is a flat table, resource grid is uniform 2x3
4. **No narrative voice** — Generic copy, not Adrian speaking
5. **No emotional hook** — No quotes, no wonder moment, no sensory language
6. **Monotone rhythm** — Every section: heading -> cards/list -> link
7. **No connection to tea** — No tea-type colors, sensory language, or cultural elements
8. **Mobile is stacked boxes** — No horizontal swipe despite `SwipeCarousel` existing
9. **Sparse overview** — Rich sub-sections exist but overview doesn't surface them
10. **Glossary underserved** — 58 terms with Chinese characters, deep dives, "Try This" — buried as a 5-item preview list

## Design Principles

- **Abundance visible at a glance** — stat ribbon, counts on every tile, content previews
- **All categories immediately discoverable** — nothing hidden behind metaphors or doors
- **Alternating rhythm** — horizontal carousels interleaved with vertical sections, dark/light alternation
- **Real content previews** — actual terms, actual quotes, actual brewing instructions (not just titles)
- **Glossary as star feature** — prominent spotlight card with Chinese characters
- **Adrian's voice** — personal editorial framing at top and bottom
- **Mobile-native** — SwipeCarousel for 4 sections, touch-optimized card sizes

---

## File to Rewrite

`src/components/LearnOverview.tsx` — complete rewrite of the overview layout

## Data Imports Needed

```typescript
// Keep existing
import { LEARN_CURRICULUM } from '../constants';
import { GLOSSARY_TERMS, GLOSSARY_CATEGORIES } from '../data/glossary';
import { teaMapPins } from '../data/teaMapPins';

// Add new
import { LEARN_PATHS } from '../constants';
import { COMMUNITY_WISDOM } from '../data/communityWisdom';
import { CURATED_COLLECTIONS } from '../data/curatedCollections';
import { TEA_SPACES } from '../data/teaSpaces';
```

## Components to Reuse

- `SwipeCarousel` from `src/components/shared/SwipeCarousel.tsx` — horizontal touch carousel (used in 4 sections)
- `CardContainer` from `src/components/shared/CardContainer.tsx` — dark/light card variants
- `FeaturedCard` from `src/components/shared/FeaturedCard.tsx` — large showcase card
- `SearchInput` from `src/components/shared/SearchInput.tsx` — search bar
- `useSectionReveal()` from `src/hooks/useSectionReveal.ts` — scroll-triggered animations
- `Icons` from `src/components/Icons.tsx` — all icon components

## Components to Remove from This Page

- `CategoryPills` — replaced by horizontal category carousel
- `TermPreviewList` — replaced by glossary spotlight
- `MolecularDiagram` (inline SVG) — replaced by glossary spotlight card

## Props Interface (Keep Unchanged)

```typescript
interface LearnOverviewProps {
  onStoryClick: (story: Story) => void;
  watchedStories: Record<string, boolean>;
  onNavigateTo: (view: LearnView) => void;
  onNavigateToConsult?: () => void;
}
```

---

## Section-by-Section Layout (Mobile 375px, scrolling top to bottom)

---

### Section 1: Hero Header with Editorial Voice (~280px)

**Content:**
- "The Archive" in `font-serif italic text-3xl` (existing style)
- Adrian's editorial line: *"Everything I wish someone had given me when I started. Take what you need."* in `font-serif italic text-sm text-tea-ink/60 dark:text-tea-paper/60` with a subtle left border in tea-seal (`border-l-2 border-tea-seal/30 pl-3`)
- Stat ribbon: `58 terms · 6 courses · 3 journeys · 10 voices · 6 playlists` — use `font-mono text-[10px] tracking-[0.3em] uppercase text-tea-seal` with `·` separators. Compute counts dynamically from data array lengths.
- `SearchInput` component below with existing cross-section search logic

**Visual:** No card container — text directly on paper background. `useSectionReveal()` for fade-in.

**Implementation notes:**
- Keep existing search logic (cross-section search across courses, terms, resources)
- Keep existing search results dropdown
- Replace the old generic description paragraph and CategoryPills with the editorial line and stat ribbon

---

### Section 2: Discovery Map — Horizontal Category Carousel (~140px)

**Content:** 8-9 category tiles in a `SwipeCarousel`:

```typescript
const DISCOVERY_TILES = [
  { id: 'course', label: 'Courses', icon: <Icons.BookOpen />, count: LEARN_CURRICULUM.length, view: 'course' },
  { id: 'glossary', label: 'Glossary', icon: <Icons.Book />, count: GLOSSARY_TERMS.length, view: 'glossary' },
  { id: 'journeys', label: 'Journeys', icon: <Icons.Compass />, count: CURATED_COLLECTIONS.length, view: 'journeys' },
  { id: 'playlists', label: 'Playlists', icon: <Icons.Music />, count: null, view: 'playlists' },
  { id: 'videos', label: 'Videos', icon: <Icons.Film />, count: null, view: 'videos' },
  { id: 'visual-guides', label: 'Guides', icon: <Icons.Download />, count: null, view: 'visual-guides' },
  { id: 'reading', label: 'Reading', icon: <Icons.Book />, count: null, view: 'reading' },
  { id: 'wisdom', label: 'Wisdom', icon: <Icons.Users />, count: COMMUNITY_WISDOM.length, view: 'wisdom' },
  { id: 'spaces', label: 'Spaces', icon: <Icons.Home />, count: TEA_SPACES.length, view: 'spaces' },
];
```

**Visual:** Each tile ~100px wide. `CardContainer variant="light"`. Icon in `text-tea-seal w-5 h-5`, label in `font-serif text-xs`, count in `font-mono text-[10px] text-tea-ink/40`. Peek the next card to invite swiping.

**Interaction:** Tap tile -> `onNavigateTo(tile.view)`. Swipe horizontally.

---

### Section 3: Glossary Spotlight — "Term of the Day" (~320px)

**Content:** One featured glossary term shown in depth:
- Category badge: e.g., "Ceremony" in `text-[10px] uppercase tracking-wider text-tea-seal border border-white/15 px-2 py-0.5`
- Term name: `font-serif text-2xl text-tea-paper`
- Chinese characters: `text-3xl text-tea-seal/30` positioned decoratively (top-right or beside term)
- Pronunciation: `font-mono italic text-xs text-tea-paper/50`
- Definition: first 2-3 lines, `text-sm text-tea-paper/60 leading-relaxed`
- "Try This" callout if term has `deepDive.tryThis`: small pill with green-tinted background showing the suggestion title
- CTAs: "Explore term →" and "See all {count} terms →"

**Visual:** `CardContainer variant="dark"` — this is the hero section, dark background makes it pop. Gold thin divider (`border-t border-tea-seal/20`) between definition area and CTAs.

**Interaction:** Tap card body -> navigate to glossary filtered to that term. "See all" -> navigate to full glossary. Term rotates daily:

```typescript
const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
const termsWithChinese = GLOSSARY_TERMS.filter(t => t.chineseCharacters);
const spotlightTerm = termsWithChinese[dayOfYear % termsWithChinese.length];
```

**Data:** `GLOSSARY_TERMS` — filter to terms that have `chineseCharacters` and ideally `deepDive`.

---

### Section 4: Learning Paths — Horizontal Swipe Carousel (~220px)

**Content:** 5 learning paths from `LEARN_PATHS` as swipeable cards:
- Path icon (use existing `PATH_ICONS` mapping)
- Title in `font-serif text-base`
- Description 1-liner in `font-serif italic text-xs text-tea-ink/50`
- Module count: `font-mono text-[10px]` e.g., "3 modules"
- Progress bar: thin horizontal bar at card bottom showing completion (modules completed / total)

**Visual:** `SwipeCarousel` with ~280px-wide cards. `CardContainer variant="light"`. Subtle left accent can use path-specific muted colors. Progress bar: `h-1 bg-tea-seal` over `bg-tea-ink/5`.

**Interaction:** Swipe between paths. Tap -> `onNavigateTo('course')` (could pass path filter in future).

**Progress calculation:**
```typescript
const getPathProgress = (path) => {
  const pathModules = LEARN_CURRICULUM.filter(m => path.modules.includes(m.id));
  const completed = pathModules.filter(m => m.lessons.every(l => watchedStories[l.id])).length;
  return completed / pathModules.length;
};
```

---

### Section 5: Course Index — Compact Numbered List (~350px)

**Content:** All 6 curriculum modules as a numbered list. For each row:
- Module number: `font-mono text-xs text-tea-ink/20` padded to 2 digits ("01")
- Title: `font-serif text-sm` with hover -> `text-tea-seal`
- First lesson title as preview: `text-[11px] italic text-tea-ink/35` (NEW — shows what's inside)
- Lesson count: `text-[10px] font-mono text-tea-ink/30`
- Completion indicator: filled check circle (tea-seal) or hollow play circle

**Visual:** Keep current Course Index container styling (`bg-tea-ink/[0.03] border border-tea-ink/10 rounded-[1px]` with `divide-y`). Add the first-lesson preview line beneath each title.

**Section header:** "Curriculum" with "View all →" link to `onNavigateTo('course')`.

**Interaction:** Tap row -> `onStoryClick(getModuleTarget(mod))` (existing behavior).

**Implementation:** This is a refinement of the existing course index, not a full rewrite. Add the first-lesson subtitle line and keep everything else.

---

### Section 6: Community Voices — Pull-Quote Carousel (~260px)

**Content:** First 4 entries from `COMMUNITY_WISDOM` as pull-quote cards:
- Large decorative opening quote mark: `text-6xl text-tea-seal/15 font-serif` as background/watermark element
- Body text: first ~100 chars in `font-serif italic text-sm text-tea-ink/80 leading-relaxed`
- Author name: `text-xs font-sans tracking-wide text-tea-ink/60`
- Wisdom type badge: small colored left border (reflection=`border-l-blue-400/40`, tip=`border-l-emerald-400/40`, ritual=`border-l-purple-400/40`)
- Tea reference: if `teaReferenced` exists, show in `font-mono text-[10px] text-tea-seal/60`

**Visual:** `SwipeCarousel` with ~300px-wide cards. `CardContainer variant="light"` with 3px colored left border per type. Dot pagination.

**Section header:** "Community Voices" with subtitle *"Reflections from tea practitioners"* in italic serif.

**Interaction:** Swipe between quotes. Tap any card -> `onNavigateTo('wisdom')`.

---

### Section 7: Guided Journeys — Vertical Card Stack (~300px)

**Content:** All 3 entries from `CURATED_COLLECTIONS` as stacked full-width cards:
- Journey number watermark: `text-5xl text-white/5 font-serif` positioned top-left
- Title: `font-serif text-lg text-tea-paper`
- Difficulty badge with color mapping (beginner=green, intermediate=blue, explorer=tea-seal)
- Duration: `font-mono text-[11px] text-tea-paper/40`
- First step teaser: *"Start with: {guideSteps[0].teaName}"* in `font-mono text-[11px] text-tea-paper/50`
- Step count: `text-[10px] text-tea-paper/30`

**Visual:** `CardContainer variant="dark"` for each. Full-width. Subtle radial gradient overlay like existing atlas cards. `gap-3` between cards.

**Section header:** "Guided Journeys" with subtitle *"Step-by-step tasting experiences"*

**Interaction:** Tap card -> `onNavigateTo('journeys')`.

---

### Section 8: Atlas & Places — Horizontal Carousel (~180px)

**Content:** All `teaMapPins` as swipeable location cards:
- Type badge: "Terroir" / "Culture" / "Technique" / "Studio" (use existing `PIN_TYPE_LABELS` mapping) in `text-[10px] tracking-wider text-tea-seal border border-white/15 px-2 py-0.5`
- Name: `font-serif text-sm text-tea-paper`
- Location: `text-[11px] text-tea-paper/40`

**Visual:** `SwipeCarousel` with ~200px-wide cards. `CardContainer variant="dark"` with existing topographic radial gradient texture.

**Section header:** "Places" with subtitle *"Tea locations around the world"*

**Interaction:** Swipe. Tap -> `onStoryClick(geographyLesson)` (existing navigation to lesson l3-1).

---

### Section 9: Resource Library — Icon Grid 3x2 (~280px)

**Content:** 6 resource tiles in a 3-column grid:

```typescript
const RESOURCE_TILES = [
  { id: 'playlists', label: 'Playlists', subtitle: 'Music for tea', icon: <Icons.Music />, view: 'playlists' },
  { id: 'videos', label: 'Videos', subtitle: 'Watch & learn', icon: <Icons.Film />, view: 'videos' },
  { id: 'visual-guides', label: 'Guides', subtitle: 'Charts & refs', icon: <Icons.Download />, view: 'visual-guides' },
  { id: 'reading', label: 'Reading', subtitle: 'Books & articles', icon: <Icons.Book />, view: 'reading' },
  { id: 'spaces', label: 'Spaces', subtitle: 'Design inspo', icon: <Icons.Home />, view: 'spaces' },
  { id: 'glossary', label: 'Glossary', subtitle: '58+ terms', icon: <Icons.BookOpen />, view: 'glossary' },
];
```

**Visual:** Keep existing resource grid styling: `grid grid-cols-2 md:grid-cols-3 gap-3`. Dark tiles with icon, label, subtitle. Hover: `border-tea-seal/30`.

**Section header:** "Resources & Tools" with subtitle *"Deepen your practice"*

**Interaction:** Tap -> `onNavigateTo(tile.view)`.

---

### Section 10: Tea Space Teaser (~160px)

**Content:** One tea space highlight:
- Space type badge
- Title: `font-serif text-base`
- Description preview: `font-serif italic text-sm text-tea-ink/60`
- CTA: "See all 6 spaces →"

**Visual:** `CardContainer variant="light"` with warm tint background (`bg-tea-beige/10`). Feels different — lighter, warmer, aspirational. Full-width.

**Data:** `TEA_SPACES[0]` (or random selection).

**Interaction:** Tap -> `onNavigateTo('spaces')`.

---

### Section 11: Closing Editorial Note (~100px)

**Content:** *"This archive grows with every session. If you have a term, a ritual, or a place that should be here — reach out."*

**Visual:** No card. `font-serif italic text-sm text-tea-ink/40 dark:text-tea-paper/40 leading-relaxed`. Thin divider above (`border-t border-tea-ink/10`). Generous `pb-32` for bottom tab bar.

**Interaction:** Optional "reach out" links to consult page via `onNavigateToConsult?.()`.

---

## Layout Rhythm Summary

| # | Section | ~Height | Card Style | Direction |
|---|---------|---------|------------|-----------|
| 1 | Hero + Stats | 280px | None (text) | Vertical |
| 2 | Category Discovery | 140px | Light tiles | **Horizontal swipe** |
| 3 | Glossary Spotlight | 320px | **Dark hero** | Vertical |
| 4 | Learning Paths | 220px | Light cards | **Horizontal swipe** |
| 5 | Course Index | 350px | Light list | Vertical |
| 6 | Community Voices | 260px | Light quotes | **Horizontal swipe** |
| 7 | Guided Journeys | 300px | Dark stack | Vertical |
| 8 | Atlas Places | 180px | Dark cards | **Horizontal swipe** |
| 9 | Resource Grid | 280px | Dark tiles | Grid |
| 10 | Tea Space Teaser | 160px | Light warm | Vertical |
| 11 | Footer Note | 100px | None (text) | Vertical |

**Total scroll:** ~2,890px. Dark/light alternation. 4 horizontal carousels break up vertical flow.

---

## Implementation Steps

1. Read `SwipeCarousel.tsx` to understand its props API (items, renderItem, peek, showDots, etc.)
2. Read all data files to verify exact export names and shapes (glossary, communityWisdom, curatedCollections, teaSpaces, teaMapPins)
3. Read `FeaturedCard.tsx` to understand if it can be reused for the glossary spotlight or if a custom card is better
4. Rewrite `LearnOverview.tsx` from scratch, section by section top-to-bottom
5. Keep the existing props interface unchanged
6. Keep the existing cross-section search logic
7. Add `useSectionReveal()` to each of the 11 sections
8. Test on mobile viewport (375px) and verify all navigation targets work
9. Test SwipeCarousel touch interactions in all 4 carousel sections
10. Verify dark mode, desktop responsive breakpoints, and reduced-motion support

## Verification

1. `npm run dev` -> Learn section on mobile (375px width)
2. All 11 sections render with correct dark/light/horizontal/vertical rhythm
3. 4 SwipeCarousel sections respond to touch swipe
4. Every tap target navigates to the correct sub-view
5. Glossary spotlight shows a term with Chinese characters, rotates daily
6. Stat ribbon counts are accurate
7. Community voices show real quotes with author attribution
8. Journey cards show first-step tea name
9. `useSectionReveal` animations fire on scroll
10. `prefers-reduced-motion` disables all animations
11. Dark mode renders correctly
12. Desktop breakpoints (md, lg) apply wider layouts
