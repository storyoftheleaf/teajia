# Immersive Article Reader — AR.0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a published article as a single-page, responsive, scroll-driven immersive read (body prose + scroll-highlight reading effect + reading-progress bar), selected by an article's render mode, coexisting with the existing 4:5 carousel reader.

**Architecture:** A render-mode discriminator on `DbArticle` (reuse the existing `layout_template` field, value `immersive_scroll`) lets `/article/:slug` branch between the existing `ArticlePage` (4:5 carousel) and a new `ImmersiveArticlePage`. The new reader maps the existing `ArticleBlock[]` to vertical scrolling section components, starting with `paragraph`/`intro`/`section_heading`/`quote`/`cover`. The scroll-highlight reading effect (words brighten as the reading line passes) is a self-contained component used by the prose sections. No backend/schema change — the discriminator rides an existing field.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind v3 (CSS-variable tokens), React Query, IntersectionObserver, Playwright (Mobile + Desktop Chrome).

---

## File structure

- **Create** `src/pages/ImmersiveArticlePage.tsx` — the new reader page (fetch + render the section stack). One responsibility: render an immersive article from a `DbArticle`.
- **Create** `src/components/immersive/sections.tsx` — the section components (CoverSection, ProseSection, SectionHeading, PullQuote) that map `ArticleBlock` → scrolling section. One responsibility: per-block layout.
- **Create** `src/components/immersive/ScrollHighlightText.tsx` — the read-along brightening effect. One responsibility: the highlight effect.
- **Create** `src/components/immersive/ReadingProgress.tsx` — the thin bronze progress bar. One responsibility: progress indicator.
- **Create** `src/lib/articleRenderMode.ts` — the `getArticleRenderMode(article)` helper + the `ArticleRenderMode` type. One responsibility: the discriminator.
- **Modify** `src/App.tsx:761` — branch the `/article/:slug` route by render mode.
- **Create** `tests/immersive-article.spec.ts` — Playwright Desktop + Mobile assertions.
- **Create** `src/lib/articleRenderMode.test.ts` — unit test for the discriminator (vitest if present; else a Playwright-only fallback noted in Task 1).

---

## Pre-flight (do once, do not commit anything yet)

- [ ] **Step 0a: Confirm the working branch**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `feat/immersive-article-design` (or create a fresh branch off it). If on `main`, run `git checkout -b feat/immersive-article-reader`.

- [ ] **Step 0b: Confirm the unit test runner**

Run: `cat package.json | grep -E '"test"|vitest|"test:unit"'`
Expected: note whether `vitest` exists. If a `vitest`/`test:unit` script exists, use it for Task 1's unit test. If NOT, Task 1 still creates `src/lib/articleRenderMode.ts` but converts its check into a Playwright assertion folded into Task 6, and you skip the vitest steps (explicitly noted in Task 1).

---

## Task 1: Render-mode discriminator

**Files:**
- Create: `src/lib/articleRenderMode.ts`
- Test: `src/lib/articleRenderMode.test.ts` (only if vitest exists — see Step 0b)

- [ ] **Step 1: Write the failing unit test** (skip this file if no vitest; assertion moves to Task 6)

```ts
// src/lib/articleRenderMode.test.ts
import { describe, it, expect } from 'vitest';
import { getArticleRenderMode } from './articleRenderMode';

describe('getArticleRenderMode', () => {
  it('returns immersive_scroll when layout_template is immersive_scroll', () => {
    expect(getArticleRenderMode({ layout_template: 'immersive_scroll' } as any)).toBe('immersive_scroll');
  });
  it('defaults to carousel_4x5 when layout_template is missing', () => {
    expect(getArticleRenderMode({} as any)).toBe('carousel_4x5');
  });
  it('defaults to carousel_4x5 for any legacy template value', () => {
    expect(getArticleRenderMode({ layout_template: 'magazine' } as any)).toBe('carousel_4x5');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/articleRenderMode.test.ts`
Expected: FAIL with "Cannot find module './articleRenderMode'".

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/articleRenderMode.ts
import type { DbArticle } from '../types';

export type ArticleRenderMode = 'carousel_4x5' | 'immersive_scroll';

// The discriminator rides the existing `layout_template` field — no schema change.
// Only the explicit value 'immersive_scroll' opts into the new reader; everything
// else (missing, 'magazine', any legacy value) stays on the 4:5 carousel.
export function getArticleRenderMode(article: Pick<DbArticle, 'layout_template'>): ArticleRenderMode {
  return article.layout_template === 'immersive_scroll' ? 'immersive_scroll' : 'carousel_4x5';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/articleRenderMode.test.ts`
Expected: PASS (3 passing). If no vitest, skip — coverage comes from Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/articleRenderMode.ts src/lib/articleRenderMode.test.ts
git commit -m "feat(read): article render-mode discriminator on layout_template"
```

---

## Task 2: ReadingProgress bar

**Files:**
- Create: `src/components/immersive/ReadingProgress.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/immersive/ReadingProgress.tsx
import { useEffect, useState } from 'react';

// Thin aged-bronze bar fixed to the top of the viewport, width = scroll progress.
// Passive scroll listener (progress is not a reveal — IntersectionObserver does not fit).
// Animates width via transform-free style update; acceptable for a 2px bar.
export function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setPct(max > 0 ? (el.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 h-[2px] z-modal"
      style={{ width: `${pct}%`, background: 'var(--tea-gold)' }}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS (tsc --noEmit, no errors). The component is unused so far; that is fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/immersive/ReadingProgress.tsx
git commit -m "feat(read): immersive reading-progress bar"
```

---

## Task 3: ScrollHighlightText (the read-along effect)

**Files:**
- Create: `src/components/immersive/ScrollHighlightText.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/immersive/ScrollHighlightText.tsx
import { useEffect, useRef } from 'react';

// Splits text into word spans that brighten from dim to full as the reading
// line (≈42% down the viewport) passes them. Passive scroll listener: this is a
// continuous per-scroll state, not a one-shot reveal, so IntersectionObserver
// does not model it. Only toggles a className (no layout-triggering props).
export function ScrollHighlightText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>('[data-w]'));
    const onScroll = () => {
      const line = window.innerHeight * 0.42;
      for (const s of spans) {
        const top = s.getBoundingClientRect().top;
        s.classList.toggle('shl-on', top < line);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [text]);
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span data-w key={i} className="shl-word">{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </p>
  );
}
```

- [ ] **Step 2: Add the effect's CSS to the reader stylesheet**

Append to `src/styles/reader-animations.css`:

```css
/* Scroll-highlight read-along effect (immersive reader) */
.shl-word { color: rgba(221, 210, 189, 0.28); transition: color 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
.shl-word.shl-on { color: var(--tea-text); }
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/immersive/ScrollHighlightText.tsx src/styles/reader-animations.css
git commit -m "feat(read): scroll-highlight read-along text effect"
```

---

## Task 4: Section components (block → scrolling section)

**Files:**
- Create: `src/components/immersive/sections.tsx`

- [ ] **Step 1: Write the section components**

```tsx
// src/components/immersive/sections.tsx
import type { ArticleBlock } from '../../types';
import { ScrollHighlightText } from './ScrollHighlightText';

// Cover: full-height image backdrop with overlaid title. Phone-first; the same
// markup reads wider on desktop via the responsive measure classes below.
export function CoverSection({ title, subtitle, image, kicker }: {
  title: string; subtitle?: string; image?: string; kicker?: string;
}) {
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      {image && (
        <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(transparent 28%, rgba(20,18,15,.55) 62%, rgba(20,18,15,.97))' }}
      />
      <div className="relative z-[2] px-6 pb-16 md:px-16 md:pb-24 w-full">
        {kicker && (
          <span className="inline-block font-sans text-ui-10 tracking-[0.22em] uppercase text-tea-gold-lt border border-tea-border rounded-full px-3 py-1 mb-4">
            {kicker}
          </span>
        )}
        <h1 className="font-display font-semibold text-tea-text leading-[0.94] text-[52px] md:text-[88px]">
          {title}
        </h1>
        {subtitle && <p className="font-body text-tea-text-sec mt-4 text-ui-16 md:text-[20px] max-w-[640px]">{subtitle}</p>}
      </div>
    </section>
  );
}

// Reading column: capped measure even on wide screens (prose never goes full-bleed).
function ReadingColumn({ children }: { children: React.ReactNode }) {
  return <div className="px-6 md:px-0 mx-auto max-w-[680px]">{children}</div>;
}

// Prose: the spine. Uses the scroll-highlight effect on the body text.
export function ProseSection({ text, dropcap }: { text: string; dropcap?: boolean }) {
  return (
    <section className="py-20 md:py-32">
      <ReadingColumn>
        <ScrollHighlightText
          text={text}
          className={`font-body text-[18px] md:text-[20px] leading-[1.78] ${dropcap ? 'immersive-dropcap' : ''}`}
        />
      </ReadingColumn>
    </section>
  );
}

export function SectionHeading({ text }: { text: string }) {
  return (
    <section className="pt-12 pb-2 md:pt-20">
      <ReadingColumn>
        <h3 className="font-display font-medium text-tea-text leading-[1.05] text-[34px] md:text-[44px]">{text}</h3>
      </ReadingColumn>
    </section>
  );
}

export function PullQuote({ text, attribution }: { text: string; attribution?: string }) {
  return (
    <section className="py-24 md:py-32 text-center px-6">
      <blockquote className="font-display font-medium italic text-tea-gold-lt leading-[1.18] text-[32px] md:text-[46px] max-w-[760px] mx-auto">
        {text}
      </blockquote>
      {attribution && (
        <cite className="block mt-8 font-sans not-italic text-ui-11 tracking-[0.16em] uppercase text-tea-text-dim">{attribution}</cite>
      )}
    </section>
  );
}

// Maps one ArticleBlock to its section. Unmapped block types render nothing in
// AR.0 (added in AR.1/AR.2); they are intentionally skipped, not errored.
export function renderBlock(block: ArticleBlock, index: number) {
  switch (block.type) {
    case 'cover':
      return <CoverSection key={index} title={block.title} subtitle={block.subtitle} image={block.image} kicker={block.kicker} />;
    case 'intro':
      return <ProseSection key={index} text={block.text} dropcap />;
    case 'paragraph':
      return <ProseSection key={index} text={block.text} />;
    case 'section_heading':
      return <SectionHeading key={index} text={block.text} />;
    case 'quote':
      return <PullQuote key={index} text={block.text} attribution={block.attribution} />;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Add the drop-cap CSS**

Append to `src/styles/reader-animations.css`:

```css
/* Immersive prose drop cap */
.immersive-dropcap::first-letter {
  font-family: var(--font-display); float: left; font-size: 70px; line-height: 0.66;
  padding: 9px 12px 0 0; color: var(--tea-gold); font-weight: 600;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/immersive/sections.tsx src/styles/reader-animations.css
git commit -m "feat(read): immersive section components (cover, prose, heading, quote)"
```

---

## Task 5: ImmersiveArticlePage

**Files:**
- Create: `src/pages/ImmersiveArticlePage.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/pages/ImmersiveArticlePage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import type { DbArticle } from '../types';
import { ReadingProgress } from '../components/immersive/ReadingProgress';
import { renderBlock } from '../components/immersive/sections';

export default function ImmersiveArticlePage() {
  const { slug } = useParams();
  const { data: article, isLoading, isError } = useQuery<DbArticle>({
    queryKey: ['article', slug],
    queryFn: () => api.articles.getBySlug(slug as string),
    enabled: !!slug,
  });

  if (isLoading) return <div className="min-h-[100dvh] bg-tea-bg" data-testid="immersive-loading" />;
  if (isError || !article) return <div className="min-h-[100dvh] bg-tea-bg flex items-center justify-center text-tea-text-dim">Article not found</div>;

  return (
    <div className="bg-tea-bg text-tea-text min-h-[100dvh]" data-testid="immersive-article">
      <Helmet><title>{article.title} · Teajia</title></Helmet>
      <ReadingProgress />
      <article>
        {article.blocks.map((block, i) => renderBlock(block, i))}
      </article>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ImmersiveArticlePage.tsx
git commit -m "feat(read): immersive article page renders the block stack"
```

---

## Task 6: Route branching + the render-mode split

**Files:**
- Modify: `src/App.tsx` (the `/article/:slug` route at ~line 761, the lazy-import block at ~line 84)

- [ ] **Step 1: Add the lazy import**

Near the other lazy imports (`src/App.tsx:84`, where `ArticlePage` is imported), add:

```tsx
const ImmersiveArticlePage = lazy(() => import('./pages/ImmersiveArticlePage'));
```

- [ ] **Step 2: Create a render-mode router wrapper component**

In `src/App.tsx`, above the `<Routes>` (or co-located with the other small route helpers), add a tiny wrapper that fetches the article's render mode and picks the reader. Because both readers fetch by slug with the SAME query key `['article', slug]`, the inner reader reuses the cached result (no double fetch):

```tsx
function ArticleRouteSwitch() {
  const { slug } = useParams();
  const { data: article } = useQuery<DbArticle>({
    queryKey: ['article', slug],
    queryFn: () => api.articles.getBySlug(slug as string),
    enabled: !!slug,
  });
  // Until the article loads, default to the carousel reader's own loading UI by
  // rendering it; it shares the same query so there is no extra request.
  if (article && getArticleRenderMode(article) === 'immersive_scroll') {
    return <ImmersiveArticlePage />;
  }
  return <ArticlePage />;
}
```

Ensure these imports exist at the top of `src/App.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import type { DbArticle } from './types';
import { getArticleRenderMode } from './lib/articleRenderMode';
```

(Some of these may already be imported — do not duplicate; add only the missing ones.)

- [ ] **Step 3: Point the route at the switch**

Replace the element of the `/article/:slug` route (`src/App.tsx:761`) so it renders `<ArticleRouteSwitch />` inside the same `ErrorBoundary` + `Suspense` wrappers the route already uses. Keep all existing wrappers; only swap the innermost `<ArticlePage />` for `<ArticleRouteSwitch />`.

- [ ] **Step 4: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Verify the color lint**

Run: `npm run lint:colors`
Expected: "All color rules pass." (No `text-[Npx]` from the banned scale, no raw white, no opacity on borders.)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(read): branch /article/:slug by render mode (immersive vs carousel)"
```

---

## Task 7: Playwright proof (Desktop + Mobile)

**Files:**
- Create: `tests/immersive-article.spec.ts`

This task needs a published article whose `layout_template = 'immersive_scroll'`. The test seeds one via the admin API if a seed path exists; otherwise it asserts against a known slug. To keep the test self-contained and not depend on prod data, it stubs the article fetch with `page.route`.

- [ ] **Step 1: Write the test**

```ts
// tests/immersive-article.spec.ts
import { test, expect } from '@playwright/test';

const ARTICLE = {
  id: 'test-immersive', slug: 'the-rock-remembers', title: 'The Rock Remembers',
  status: 'published', tags: [], layout_template: 'immersive_scroll',
  created_at: '2026-06-16', updated_at: '2026-06-16',
  blocks: [
    { type: 'cover', title: 'The Rock Remembers', kicker: 'Origin · Wuyi', image: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&q=80' },
    { type: 'intro', text: 'Some teas taste of the place that made them. Wuyi is one of them, and it took me years to learn how to hear it.' },
    { type: 'section_heading', text: 'Then comes the fire.' },
    { type: 'paragraph', text: 'By the third pass the green has gone entirely, folded down into warm stone and dried longan and a faint mineral sweetness underneath.' },
    { type: 'quote', text: 'You do not drink the leaf. You drink the mountain.', attribution: 'Master Chen' },
  ],
};

test.beforeEach(async ({ page }) => {
  // Stub both possible API origins for the by-slug fetch.
  await page.route('**/api/**/articles/**', (route) => {
    if (route.request().url().includes(ARTICLE.slug) || route.request().url().includes('by-slug')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARTICLE) });
    }
    return route.continue();
  });
});

test('immersive article renders the stack and does not error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/article/the-rock-remembers');
  await expect(page.getByTestId('immersive-article')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Rock Remembers' })).toBeVisible();
  await expect(page.getByText('You do not drink the leaf.')).toBeVisible();

  // No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);

  // No error boundary / 404 text.
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('Article not found')).toHaveCount(0);

  // Scroll to the bottom; the highlight effect toggles class without crashing.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const lit = await page.locator('.shl-word.shl-on').count();
  expect(lit).toBeGreaterThan(0);

  expect(errors.filter((e) => !e.includes('favicon') && !/40[13]/.test(e))).toEqual([]);
});
```

- [ ] **Step 2: Run on Mobile Chrome**

Ensure the dev server is running (`npm run dev`, port 7777). Then run (Playwright needs the sandbox disabled per the project memory):

Run: `npm run test:mobile -- tests/immersive-article.spec.ts`
Expected: PASS (1 test). If it fails on the stubbed route URL, inspect the actual `getBySlug` URL in `src/lib/api.ts` and tighten the `page.route` glob to match.

- [ ] **Step 3: Run on Desktop Chrome**

Run: `npx playwright test --project='Desktop Chrome' tests/immersive-article.spec.ts --reporter=list`
Expected: PASS. (If no `Desktop Chrome` project exists in `playwright.config.ts`, add one mirroring the Mobile project with `devices['Desktop Chrome']`, then re-run.)

- [ ] **Step 4: Read the screenshots**

Open the screenshots saved under `test-results/` for both projects. Confirm: prose reads in a capped measure on desktop (not full-bleed), cover fills the viewport, no visual breakage. This is a human-eye check; note anything off for AR.1.

- [ ] **Step 5: Commit**

```bash
git add tests/immersive-article.spec.ts playwright.config.ts
git commit -m "test(read): immersive article reader proof on desktop + mobile"
```

---

## Task 8: Manual verification + push

- [ ] **Step 1: Seed one real immersive article (manual, owner)**

In the admin, create or edit a draft article, set its template/layout to `immersive_scroll` (the field backing `layout_template`), give it a cover + a few paragraph blocks, publish it. (If the admin editor has no control for `layout_template` yet, set it directly via the admin API `api.articles.update(id, { layout_template: 'immersive_scroll' })` from the browser console while authenticated — wiring an editor control is AR.5.)

- [ ] **Step 2: View it**

Open `http://localhost:7777/article/<that-slug>`. Confirm: it renders as the scrolling immersive reader (not the 4:5 carousel), the progress bar advances, words brighten as you scroll, the cover fills the screen, prose is centered with a comfortable measure, and resizing the window from phone-width to desktop-width keeps it beautiful with no horizontal scroll.

- [ ] **Step 3: Confirm coexistence**

Open any EXISTING published article (one without `layout_template = 'immersive_scroll'`) at `/article/<its-slug>`. Confirm it still renders the original 4:5 carousel unchanged.

- [ ] **Step 4: Push**

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

- [ ] **Step 5: Report**

Summarize for Adrian (curatorial, not a diff): the immersive reader is live behind the render-mode switch, the old carousel is untouched, and what to look at to feel it.

---

## Self-review notes (resolved)

- **Spec coverage:** AR.0 scope = reader foundation + render mode + body prose + scroll-highlight + progress bar + coexistence + responsive. All present (Tasks 1–8). The wider catalog, text-effect dials, interactive/data family, authoring UI, and share-card generation are AR.1–AR.6 — out of scope for THIS plan by design.
- **No schema change:** discriminator reuses `layout_template`; confirmed the field exists on `DbArticle` (`src/types.ts:1032`).
- **No double fetch:** both readers share query key `['article', slug]`; the switch reuses the cache.
- **Type consistency:** `getArticleRenderMode`, `ArticleRenderMode`, `renderBlock`, section component names are consistent across Tasks 1/4/5/6.
- **Brand law:** uses tokens + `text-ui-N` scale + `font-display/body/sans`; Task 6 Step 5 runs `lint:colors` as the gate.
```
