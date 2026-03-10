# TODO 12: Lazy-Load Content Data (Stories, Articles, Essays)

**Priority:** P2 — MEDIUM
**Impact:** Initial bundle size reduction, TTI improvement
**Effort:** Medium (1–2 days)
**Category:** Performance

---

## Problem

All 40+ article stories, 6 photo essays, community members, and tea inspiration images are imported at module load time in `src/content/index.ts` and eagerly loaded via `src/App.tsx:29`.

This means:
- Several hundred KB of content data is in the initial JavaScript bundle
- Content only needed for `/magazine` loads on every route (including `/shop`, `/about`, etc.)
- Increases Time to Interactive (TTI) for all users

## Current Import Chain

```
src/App.tsx
  → import { STORIES } from '../constants'
    → src/constants.ts
      → import { STORIES } from './content'
        → src/content/index.ts
          → imports 40+ article files
          → imports 6 photo essay files
```

Also eagerly imported:
- `COMMUNITY_MEMBERS` from `src/data/communityMembers.ts`
- `TEA_INSPIRE_IMAGES` from `src/data/teaInspire.ts`

## Steps

### Step 1: Dynamic Import Stories
Replace the static import in `src/constants.ts` or `src/App.tsx` with a dynamic import:

```typescript
// Before
import { STORIES } from './content';

// After
const loadStories = () => import('./content').then(m => m.STORIES);
```

### Step 2: Update StoryContext
Modify `src/context/StoryContext.tsx` to load stories on demand:
- Use React Query or a simple `useEffect` + `useState` pattern
- Show a skeleton/loading state while stories load
- Cache the result after first load

### Step 3: Lazy-Load Other Data
- `communityMembers.ts` — only needed on About page
- `teaInspire.ts` — only needed on Magazine visual tab
- `consultProjects.ts` — only needed on Consult page

### Step 4: Consider Moving Content to API
Long-term: move story/article data to the Cloudflare D1 database and fetch via API, like products already work. This completely removes content from the JS bundle.

## Files to Modify

- `src/constants.ts` — Remove static STORIES import
- `src/content/index.ts` — Keep as-is (it's the dynamic import target)
- `src/context/StoryContext.tsx` — Add lazy loading
- `src/App.tsx` — Remove direct story imports
- `src/components/MagazineTabbed.tsx` — Handle loading state for stories
- `src/components/HomePage.tsx` — Handle loading state for latest stories

## Verification

- `npm run build` — check bundle size reduction (main chunk should be significantly smaller)
- Navigate directly to `/shop` — network tab should NOT load story content
- Navigate to `/magazine` — stories load on demand with a brief loading state
- Homepage "Latest" section shows skeleton while stories load

## Related Issues

- #01 (Tailwind PostCSS — overall bundle optimization)
