# Immersive Article Reader — AR.1 (Opening + Narrative families) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Add the opening + narrative section family to the immersive reader: centered cover variant, a `Reveal`-on-scroll wrapper, chapter divider, epilogue, a "ChapterStagger" line-by-line section opener, and wire the new block types into `renderBlock`. Enhance prose/heading to fade-up on enter.

**Architecture:** Extends `src/components/immersive/sections.tsx` (the only component file) and appends to `src/styles/reader-animations.css`. A small reusable `Reveal` component (IntersectionObserver, fade-up + blur-clear, animates transform/opacity/filter only) wraps sections so they arrive gracefully. New block types mapped: `chapter_divider`, `epilogue`. Cover gains a `centered` variant via the block's existing `variant` field. No backend/schema change.

**Tech Stack:** React 19, TypeScript, Tailwind v3 (CSS-var tokens), IntersectionObserver, vitest, Playwright.

---

## Branch + preflight

- [ ] Confirm branch is `feat/immersive-article-design` (`git rev-parse --abbrev-ref HEAD`). If not, `git checkout feat/immersive-article-design`.
- [ ] Confirm the cover/chapter_divider/epilogue block shapes in `src/types.ts`:
  - `{ type: 'cover'; variant?: CoverVariant; title; subtitle?; image?; kicker? }`
  - `{ type: 'chapter_divider'; variant?: ChapterVariant; number?; title; subtitle? }`
  - `{ type: 'epilogue'; text; signature? }`
  Run: `grep -nE "type: '(cover|chapter_divider|epilogue)'" src/types.ts` and read the exact fields. Use the REAL field names.

---

## Task 1: The `Reveal` wrapper

**Files:** Modify `src/components/immersive/sections.tsx` (add component near the top, after imports). Append CSS to `src/styles/reader-animations.css`.

- [ ] **Step 1: Add the `Reveal` component to sections.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';

// Wraps a child and fades it up (translateY + blur-clear) the first time it
// enters the viewport. IntersectionObserver, one-shot. Animates only
// transform/opacity/filter. Respects prefers-reduced-motion (skips to visible).
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`immersive-reveal ${shown ? 'is-in' : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}
```

Update the existing `import type React from 'react';` line to `import React, { useEffect, useRef, useState } from 'react';` (React default + the hooks). Verify no duplicate React import results.

- [ ] **Step 2: Append the reveal CSS to `src/styles/reader-animations.css`**

```css
/* Immersive reveal-on-enter (fade-up + blur-clear) */
.immersive-reveal { opacity: 0; transform: translateY(40px); filter: blur(6px); transition: opacity 1s cubic-bezier(.16,1,.3,1), transform 1s cubic-bezier(.16,1,.3,1), filter 1s cubic-bezier(.16,1,.3,1); }
.immersive-reveal.is-in { opacity: 1; transform: none; filter: none; }
```

- [ ] **Step 3:** Run `npm run lint`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/components/immersive/sections.tsx src/styles/reader-animations.css
git commit -m "feat(read): Reveal-on-scroll wrapper for immersive sections"
```

---

## Task 2: Centered cover variant

**Files:** Modify `src/components/immersive/sections.tsx`.

- [ ] **Step 1: Add a centered cover and branch CoverSection on variant**

Replace the existing `CoverSection` with a version that renders a centered ceremonial layout when `variant === 'centered'`, else the existing image-backdrop layout. Add a `variant?: string` and `mark?: string` prop.

```tsx
export function CoverSection({ title, subtitle, image, kicker, variant, mark }: {
  title: string; subtitle?: string; image?: string; kicker?: string; variant?: string; mark?: string;
}) {
  if (variant === 'centered') {
    return (
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ background: 'radial-gradient(circle at 50% 30%, #2c2924, var(--tea-bg))' }}>
        {mark && <div className="font-display text-tea-gold leading-none text-[34px] md:text-[44px] mb-8 opacity-90">{mark}</div>}
        <h1 className="font-display text-tea-text leading-none text-[56px] md:text-[80px]">{title}</h1>
        {subtitle && <p className="font-sans text-tea-text-dim tracking-[0.2em] uppercase text-ui-12 mt-6">{subtitle}</p>}
      </section>
    );
  }
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 28%, rgba(20,18,15,.55) 62%, rgba(20,18,15,.97))' }} />
      <div className="relative z-[2] px-6 pb-16 md:px-16 md:pb-24 w-full">
        {kicker && (
          <span className="inline-block font-sans text-ui-10 tracking-[0.22em] uppercase text-tea-gold-lt border border-tea-border rounded-full px-3 py-1 mb-4">{kicker}</span>
        )}
        <h1 className="font-display font-semibold text-tea-text leading-[0.94] text-[52px] md:text-[88px]">{title}</h1>
        {subtitle && <p className="font-body text-tea-text-sec mt-4 text-ui-16 md:text-ui-20 max-w-[640px]">{subtitle}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2:** Run `npm run lint` and `npm run lint:colors`. Expected: both PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/immersive/sections.tsx
git commit -m "feat(read): centered ceremonial cover variant"
```

---

## Task 3: Chapter divider + epilogue sections

**Files:** Modify `src/components/immersive/sections.tsx`.

- [ ] **Step 1: Add ChapterDivider and Epilogue components**

```tsx
export function ChapterDivider({ number, title, subtitle }: { number?: string; title: string; subtitle?: string }) {
  return (
    <section className="py-28 md:py-40 px-8 text-center">
      {number && <div className="font-display text-tea-gold leading-none text-[44px] md:text-[64px] mb-4">{number}</div>}
      <h2 className="font-display font-medium text-tea-text leading-[1.05] text-[36px] md:text-[52px]">{title}</h2>
      {subtitle && <p className="font-body text-tea-text-dim mt-4 text-ui-16 md:text-ui-20 max-w-[520px] mx-auto">{subtitle}</p>}
    </section>
  );
}

export function Epilogue({ text, signature }: { text: string; signature?: string }) {
  return (
    <section className="py-24 md:py-32">
      <div className="px-6 md:px-0 mx-auto max-w-[680px]">
        <p className="font-display italic text-tea-text-sec leading-[1.5] text-[24px] md:text-[30px]">{text}</p>
        {signature && <p className="font-sans text-tea-text-dim tracking-[0.14em] uppercase text-ui-11 mt-8">{signature}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2:** Run `npm run lint`. Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/immersive/sections.tsx
git commit -m "feat(read): chapter divider + epilogue sections"
```

---

## Task 4: Wrap narrative sections in Reveal + wire renderBlock

**Files:** Modify `src/components/immersive/sections.tsx`.

- [ ] **Step 1: Wrap prose, heading, quote, epilogue bodies in `Reveal`** so they fade up on enter. Do NOT wrap CoverSection or ChapterDivider's outer section (covers are first-paint; chapter dividers are full-height pauses — wrapping them in a translateY hurts). Concretely: in `ProseSection`, `SectionHeading`, `PullQuote`, `Epilogue`, wrap the inner content (the ReadingColumn/blockquote/etc.) with `<Reveal>...</Reveal>`. Keep ScrollHighlightText inside the Reveal for ProseSection.

- [ ] **Step 2: Extend `renderBlock`** to map the new block types and the cover variant:

```tsx
export function renderBlock(block: ArticleBlock, index: number) {
  switch (block.type) {
    case 'cover':
      return <CoverSection key={index} title={block.title} subtitle={block.subtitle} image={block.image} kicker={block.kicker} variant={block.variant} />;
    case 'intro':
      return <ProseSection key={index} text={block.text} dropcap />;
    case 'paragraph':
      return <ProseSection key={index} text={block.text} />;
    case 'section_heading':
      return <SectionHeading key={index} text={block.text} />;
    case 'chapter_divider':
      return <ChapterDivider key={index} number={block.number} title={block.title} subtitle={block.subtitle} />;
    case 'quote':
      return <PullQuote key={index} text={block.text} attribution={block.attribution} />;
    case 'epilogue':
      return <Epilogue key={index} text={block.text} signature={block.signature} />;
    default:
      return null;
  }
}
```

NOTE: the cover variant comes from `block.variant` (a `CoverVariant`). If `CoverVariant` does not include `'centered'`, pass it through anyway by widening the prop to `string` (already done in Task 2). If tsc complains the union excludes 'centered', cast at the call site: `variant={block.variant as string | undefined}`.

- [ ] **Step 3:** Run `npm run lint` and `npm run lint:colors`. Expected: both PASS.
- [ ] **Step 4: Commit**

```bash
git add src/components/immersive/sections.tsx
git commit -m "feat(read): reveal-wrap narrative sections + wire chapter/epilogue blocks"
```

---

## Task 5: Extend the Playwright proof

**Files:** Modify `tests/immersive-article.spec.ts`.

- [ ] **Step 1:** Add `chapter_divider`, `epilogue`, and a `centered` cover are NOT needed in one article; instead append to the existing stubbed `ARTICLE.blocks` a `{ type: 'chapter_divider', number: '二', title: 'The Roast' }` and `{ type: 'epilogue', text: 'The rock remembers.', signature: 'A.R.' }`. Then add assertions: `await expect(page.getByText('The Roast')).toBeVisible();` and `await expect(page.getByText('The rock remembers.')).toBeVisible();`. Keep all existing assertions.

- [ ] **Step 2: Run on both projects** (dev server must be running on :7777; Playwright needs sandbox disabled per project memory):

Run: `npm run test:mobile -- tests/immersive-article.spec.ts`
Run: `npx playwright test --project='Desktop Chrome' tests/immersive-article.spec.ts --reporter=list`
Expected: both PASS. The Reveal wrapper starts opacity:0 — make sure assertions either scroll the element into view first (`await page.getByText('The Roast').scrollIntoViewIfNeeded()`) or the test uses `toBeVisible` after a scroll. Add `scrollIntoViewIfNeeded()` before each new assertion so the IntersectionObserver fires.

- [ ] **Step 3: Commit**

```bash
git add tests/immersive-article.spec.ts
git commit -m "test(read): cover/chapter/epilogue assertions for AR.1"
```

---

## Task 6: Push

- [ ] Run `git push`.
- [ ] Report to Adrian (curatorial): the narrative family is in, what new shapes an article can use, what to look at.

---

## Self-review notes
- Scope: AR.1 = opening + narrative families (cover variants, reveal wrapper, chapter divider, epilogue, reveal-on-enter for prose/heading/quote) + renderBlock wiring. Visual family (images/diptych/gallery) is AR.2; pinned hero is AR.2 (it needs the tall-pinned scroll mechanic, grouped with visual). Pull-quote + section heading already exist from AR.0 and only gain the Reveal wrap here.
- No schema change; all block types already in the union.
- Type consistency: CoverSection prop `variant` widened to string; renderBlock casts if needed. Reveal used by ProseSection/SectionHeading/PullQuote/Epilogue.
- Brand law: `text-ui-N` for scale stops, long-tail display sizes as `text-[Npx]`, tokens only, `lint:colors` gates in Tasks 2 + 4.
