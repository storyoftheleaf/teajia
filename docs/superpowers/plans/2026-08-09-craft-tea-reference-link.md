# Craft Tea Reference Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear Tea Reference destination to the existing Craft button list.

**Architecture:** Render the new destination from `LearnOverview` as a React Router link because it leaves the Craft subview system for the existing `/wisdom` route. Keep the current Craft row presentation and internal subview buttons unchanged.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, React server rendering

---

### Task 1: Add the Tea Reference route row

**Files:**
- Create: `src/components/LearnOverview.test.tsx`
- Modify: `src/components/LearnOverview.tsx`

- [ ] **Step 1: Write the failing rendering test**

Create `src/components/LearnOverview.test.tsx` with a focused server-rendered assertion:

```tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LearnOverview } from './LearnOverview';

describe('LearnOverview', () => {
  it('links Tea Reference to the Wisdom reference from the Craft destination list', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LearnOverview
          onStoryClick={() => undefined}
          watchedStories={{}}
          onNavigateTo={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/wisdom"');
    expect(html).toContain('Tea Reference');
    expect(html).toContain('Plants, places, producers, styles and named teas');
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npx vitest run src/components/LearnOverview.test.tsx
```

Expected: FAIL because the rendered Craft overview has no `/wisdom` link or Tea Reference copy.

- [ ] **Step 3: Add the minimal route row**

In `src/components/LearnOverview.tsx`, import `Link` from `react-router-dom`. Add the route item directly after Glossary:

```tsx
{ to: '/wisdom', label: 'Tea Reference', sub: 'Plants, places, producers, styles and named teas', icon: <Icons.Leaf className="w-5 h-5" />, iconColor: 'text-tea-gold/40' },
```

For each destination, build the existing icon, label, and description content once. Render route items with:

```tsx
<Link key={tile.to} to={tile.to} className={rowClassName}>
  {rowContent}
</Link>
```

Continue rendering Craft subview items as the existing button with `onNavigateTo(tile.id)`. Both element types must use the existing row class and visual content.

- [ ] **Step 4: Run focused GREEN verification**

Run:

```bash
npx vitest run src/components/LearnOverview.test.tsx
```

Expected: 1 test passed.

- [ ] **Step 5: Run project verification**

Run:

```bash
npm run lint
npm run lint:colors
npx vitest run src/components/LearnOverview.test.tsx src/pages/wisdom/reference.test.tsx
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Browser-check the visible behavior**

Open `http://localhost:7777/craft` at 390 by 844 and 1440 by 900. Confirm Tea Reference appears directly after Glossary, the description fits without horizontal overflow, clicking it opens `/wisdom`, and there are no console errors.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/components/LearnOverview.tsx src/components/LearnOverview.test.tsx
git commit -m "feat(craft): link tea reference"
```
