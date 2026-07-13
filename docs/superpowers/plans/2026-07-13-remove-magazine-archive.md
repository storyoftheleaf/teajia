# Remove Magazine Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the obsolete magazine archive and its legacy photo-essay runtime graph without changing the current Read or D1 article experiences.

**Architecture:** Delete the public archive route and archive-only UI, stop seeding or restoring legacy `Story` records, and remove the six stock-photo essay fixtures. Preserve the current route family under `src/pages/read` and the D1 article route switch.

**Tech Stack:** React 19, React Router, TypeScript, Playwright, Vite

---

### Task 1: Prove the archive is retired

**Files:**
- Modify: `tests/read-entry-paths.spec.ts`

- [x] Replace archive behavior assertions with a test that `/magazine-archive` renders the standard 404.
- [x] Retain coverage proving `/read` loads and `/article/live-story` renders the mocked D1 article.
- [x] Run the focused Playwright spec and confirm the new archive assertion fails before implementation.

### Task 2: Remove the archive runtime graph

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/context/StoryContext.tsx`
- Modify: `src/content/index.ts`
- Delete: `src/content/photo-essays/*.ts`
- Delete: `src/components/MagazineTabbed.tsx`
- Delete: `src/components/PhotoEssay/*.tsx`
- Delete: `src/components/PhotoEssayDetail.tsx`

- [x] Remove the route and imports for `MagazineTabbed` and `VisualFeatureViewer`.
- [x] Remove PhotoEssay view-state transitions and rendering.
- [x] Stop restoring legacy local-storage stories; retain the context API temporarily for existing consumers with an empty initial collection.
- [x] Delete files with no remaining importers.
- [x] Run the focused Playwright spec and confirm it passes.

### Task 3: Correct the media record and verify

**Files:**
- Modify: `docs/OWNED_MEDIA_INVENTORY.md`
- Modify: `docs/tracks/04-china-reachability.md`
- Modify: `docs/superpowers/specs/2026-07-12-launch-to-real-use-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-launch-to-real-use-release-3.md`

- [x] Run `npm run build` followed by `npm run audit:china` and capture the new source/built counts.
- [x] Remove deleted inventory rows and state that the current Read route has zero stock-host dependencies.
- [x] Run `npm run lint`, `npm run lint:colors`, `npm run build`, `npm run test:china-scan`, and the focused browser spec.
- [x] Commit and push the verified branch.
