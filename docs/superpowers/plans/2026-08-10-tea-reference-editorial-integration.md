# Tea Reference Editorial Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the safe citation-aware receiving preview into a useful local Teajia editorial workflow, clean public reference presentation, and trustworthy product/origin integration without production writes or publication.

**Architecture:** Keep the existing deterministic handoff receiver and public allowlist intact. Add a second local-preview-only review projection for held facts and entity decisions, render it inside the existing admin Wisdom surface without persistence, and tighten the public catalogue so only useful cited statements and genuinely sellable products appear. Extend the legacy origin model conservatively with explicit hierarchy/elevation semantics where evidence exists; unresolved geography stays held rather than inferred.

**Tech Stack:** React 19, TypeScript, Vite preview middleware, Vitest, Playwright, Tailwind tokens.

---

### Task 1: Local private editorial review packet and screen

**Files:**
- Modify: `src/wisdom/receiving/previewImporter.ts`
- Modify: `scripts/tea-reference-website-preview/load-preview.mjs`
- Modify: `scripts/tea-reference-website-preview/vite-plugin.mjs`
- Create: `src/admin/views/TeaReferenceReviewView.tsx`
- Modify: `src/admin/views/WisdomView.tsx`
- Test: `src/wisdom/receiving/previewImporter.test.ts`
- Test: `scripts/tea-reference-website-preview/tests/vite-plugin.test.mjs`
- Test: `src/admin/views/TeaReferenceReviewView.test.tsx`

- [x] Write failing receiver tests proving the private packet contains held entity/fact state, source evidence, hierarchy context, and product-review metadata while the public packet remains unchanged.
- [x] Run the focused tests and confirm they fail because the private packet and endpoint do not exist.
- [x] Implement a deterministic private review projection and a GET-only local preview endpoint. Reject every non-GET method; do not add a writer, approval API, or production endpoint.
- [x] Build the admin Wisdom review screen with entity/fact filters, source evidence, proposed public wording, hierarchy context, product matches, and session-only `Ready`, `Needs edit`, and `Keep held` triage. State clearly that decisions are not saved.
- [x] Run focused tests and verify the private endpoint is absent outside `tea-reference-preview` mode and contains no vendor-as-producer mapping.

### Task 2: Public editorial presentation and privacy cleanup

**Files:**
- Modify: `src/pages/wisdom/ReferenceFactSections.tsx`
- Modify: `src/pages/wisdom/PreviewTeaTypePage.tsx`
- Modify: `src/pages/wisdom/PreviewOriginPage.tsx`
- Modify: `src/pages/wisdom/wisdomShared.tsx`
- Modify: `src/pages/wisdom/frame.tsx`
- Test: `src/pages/wisdom/reference.test.tsx`

- [x] Write failing tests proving public pages omit `Drafted`, `Holding`, authorship-rung copy, raw reference IDs, empty plant sections, and repeated source metadata.
- [x] Write failing tests proving citations use readable dates, compact source notes, meaningful fact text, and the approved correction sentence and `View map` treatment.
- [x] Run the focused tests and confirm the expected failures.
- [x] Implement the smallest editorial components that pass the tests, retaining source metadata and minimal excerpts without exposing full evidence or private hold reasons.
- [x] Verify desktop/mobile headings, tap targets, bottom-nav clearance, wrapping, and zero horizontal overflow.

### Task 3: Canonical origin semantics and product qualification

**Files:**
- Modify: `src/wisdom/types.ts`
- Modify: `src/wisdom/regions.ts`
- Modify: `src/pages/wisdom/RegionPage.tsx`
- Modify: `src/pages/wisdom/RegionIndexPage.tsx`
- Modify: `data/tea-wisdom-source/origins.csv`
- Modify: `public/wisdom/tea-wisdom-regions.csv`
- Modify: `src/wisdom/reference/catalogue.ts`
- Test: `src/wisdom/regions.test.ts`
- Test: `src/wisdom/reference/catalogue.test.ts`
- Test: `src/pages/wisdom/reference.test.tsx`

- [x] Write failing tests for explicit parent/level semantics, conservative missing-parent handling, tea-growing elevation labels, omission of empty plant sections, and official Jinzhai geography attribution.
- [x] Write failing catalogue tests excluding zero-stock/zero-price records from `Available teas`, differentiating duplicate lots with year metadata, and preserving active non-personal Oolong, Dark, White, and Red family candidates without inventing cited facts.
- [x] Run the focused tests and confirm the expected failures.
- [x] Implement canonical hierarchy helpers and evidence-aware elevation presentation. Do not fabricate parents for unresolved source labels or turn routes/lists into places.
- [x] Tighten sellable product qualification and expose structured reviewed-link candidates separately from fuzzy preview matches.

### Task 4: Integrated rehearsal and quality gate

**Files:**
- Modify: `tests/tea-reference-preview.spec.ts`
- Modify: `docs/_notes/tea-reference-receiving-layer.md`

- [x] Extend the browser rehearsal to cover the private review screen, Sheng, Greater Yiwu, Jinzhai, compact sources, sellable product filtering, map action, corrections, and the absence of private language on public pages.
- [x] Run the receiving suite, TypeScript lint, colour lint, normal build, preview build, and desktop/mobile Playwright rehearsal against the unchanged 12-source handoff.
- [x] Inspect the actual screens in the in-app browser and fix any hierarchy, overflow, or clarity regression.
- [x] Run a final task-scoped code review, resolve every Critical or Important finding, and commit locally without push, deploy, publication, assimilation, or database writes.
