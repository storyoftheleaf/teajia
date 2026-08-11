# Tea Reference Markdown Revision Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch the supported Tea Reference material as polished English Markdown-backed pages and give the head admin one compact workflow for flagging page sections, exporting a grouped regeneration brief, and resolving completed revisions.

**Architecture:** Tracked Markdown is the canonical public wording. A deterministic local builder validates page identity, hierarchy, section keys, English prose, and citation provenance, then emits a generated public registry consumed by the existing Wisdom pages. A narrow account-scoped Worker API stores revision flags in D1 and exports stable Markdown; it never edits content. Public reference pages expose a head-admin-only flag sheet, while the existing Wisdom admin surface presents a concise grouped issue queue.

**Tech Stack:** React 19, TypeScript, Vite 6, Vitest, Cloudflare Workers, D1, Tailwind v3, Playwright.

---

## Safety and product boundaries

- Do not add or rename global navigation items or public routes.
- Do not publish, deploy, push, or write to a live database.
- Do not expose exact evidence, original Chinese passages, translation provenance, capture hashes, private notes, or held/conflict language publicly.
- Do not classify publishers, retailers, or vendors as producers.
- Do not flatten origin hierarchy or treat a route/list/topic as a geographic place.
- Keep exact-lot descriptions and personal tasting outside cited common reference characteristics.
- The website may create, list, export, and resolve issue metadata only. It cannot edit Markdown, regenerate content, approve content, or publish it.
- Preserve user-owned untracked files and unrelated work.

## Task 1: Canonical English Markdown pages and deterministic registry

**Files:**

- Create: `data/tea-reference/pages/*.md`
- Create: `data/tea-reference/private/translations.json`
- Create: `scripts/tea-reference-markdown/build-pages.mjs`
- Create: `scripts/tea-reference-markdown/lib/page-builder.mjs`
- Create: `scripts/tea-reference-markdown/tests/page-builder.test.mjs`
- Create: `src/wisdom/reference/generatedPages.ts`
- Modify: `package.json`
- Modify as needed: `src/wisdom/reference/types.ts`
- Modify as needed: `src/wisdom/reference/catalogue.ts`

- [ ] Write failing tests that define the page-file contract: stable front matter, real section keys, source IDs, parent relationship, ordinary English prose, compact citation markers, and deterministic code-point ordering.
- [ ] Add failing tests proving Han-script prose is rejected outside explicit `native_name` metadata and private translation records.
- [ ] Add failing tests proving every public citation resolves to private source provenance and no private evidence or translation metadata appears in the generated public registry.
- [ ] Add failing tests proving unresolved taxonomy candidates and inventory-derived Oolong, Dark, Red, and White gaps are absent.
- [ ] Add a semantic test that prevents route/list/grouping records from becoming origin places. Retain such supported research as non-public Markdown drafts or typed reference topics rather than squeezing it into `tea_area`.
- [ ] Implement the smallest front-matter and section parser needed for this fixed contract. Do not add a general CMS or a runtime Markdown parser.
- [ ] Author the current supported pages in polished English. Preserve native tea/place names only as secondary metadata. Public source display titles must be English.
- [ ] Store exact original-language evidence and its English translation separately in the private translation registry, including locator/source ID, method, version, and date. Public prose must be paraphrase, not a machine-translated quotation.
- [ ] Emit `src/wisdom/reference/generatedPages.ts` deterministically and add a check mode that fails when the generated registry is stale.
- [ ] Integrate the generated pages with the existing citation-aware catalogue without exposing private fields or weakening product/origin qualification.
- [ ] Run the focused builder and reference tests twice and confirm byte-identical output.
- [ ] Commit the task-scoped content/builder changes locally.

## Task 2: Private revision issue persistence and API

**Files:**

- Create: `worker/migrations/083_tea_reference_issues.sql` (or the next available migration number discovered at implementation time)
- Create or modify: `worker/src/teaReferenceIssues.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/types.ts` if required by the existing Worker conventions
- Create: `worker/src/teaReferenceIssues.test.ts`
- Modify: `worker/src/index.test.ts` only for route-level coverage where necessary

- [ ] Inspect the existing authenticated account context and platform-owner authorization helpers. Reuse them; do not invent client-trusted role checks.
- [ ] Write failing tests for create, list, deterministic Markdown export, resolve selected, duplicate idempotency, unknown page/section rejection, missing note, unauthorized access, and cross-account denial.
- [ ] Add an account-scoped `tea_reference_issues` table with the fields approved in the design. Add indexes for open issues by account/page and the duplicate-open lookup.
- [ ] Implement a deep issue module whose public operations are create, list, export, and resolve. Keep SQL and Markdown escaping internal to that module.
- [ ] Validate page and section against the generated canonical registry; never accept arbitrary routes, snapshots, source IDs, or Markdown paths from the browser.
- [ ] Derive the current public text snapshot and source IDs server-side from the canonical page registry whenever possible. If the Worker build cannot safely share the full generated content, share a generated validation manifest and verify the submitted snapshot against it.
- [ ] Normalize notes for duplicate detection while preserving the original note. Identical open flags return the existing record.
- [ ] Export deterministic Markdown ordered by page, section, creation time, and ID using a code-point comparator. Include source pointers and stable issue metadata, but never full evidence.
- [ ] Resolve only explicit open IDs belonging to the authenticated account. Resolution must not mutate page content or publication state.
- [ ] Wire narrow `/api/admin/tea-reference/issues` routes into the existing Worker router without affecting the public MCP or catalogue APIs.
- [ ] Run focused Worker tests, type checking, and migration validation.
- [ ] Commit the task-scoped Worker changes locally.

## Task 3: Head-admin flag sheet and compact admin issue queue

**Files:**

- Modify: `src/lib/api.ts`
- Modify: `src/admin/types.ts` or create a focused Tea Reference issue type module
- Create: `src/pages/wisdom/FlagReferenceIssueSheet.tsx`
- Create: `src/pages/wisdom/FlagReferenceIssueSheet.test.tsx`
- Modify: the shared Tea Reference public-page frame used by family, type, place, and supported topic pages
- Create: `src/admin/views/TeaReferenceIssuesView.tsx`
- Create: `src/admin/views/TeaReferenceIssuesView.test.tsx`
- Modify: `src/admin/views/WisdomView.tsx`
- Modify: `src/admin/AdminApp.tsx` only if required by the existing Wisdom tab state
- Modify: `src/styles/card-utilities.css` only for reusable styles that cannot be expressed with existing tokens

- [ ] Write failing tests proving `Flag for revision` is absent for visitors, ordinary admins, and unknown roles, and appears for the authenticated platform owner.
- [ ] Write failing sheet tests for the approved categories, page-specific real section choices, required note, preserved note after failure, current-section preview, successful duplicate handling, and 44px tap targets.
- [ ] Implement the API client methods for create/list/export/resolve using existing auth/account headers. The server remains the authorization boundary.
- [ ] Add one discreet `Flag for revision` action to the existing reference page presentation. Do not add a global navigation item, edit route labels, or expose internal IDs.
- [ ] Build a compact sheet with category, section, note, and read-only English section preview. The form never accepts replacement prose or a regeneration prompt.
- [ ] Replace the 193-card normal review experience with a grouped `Reference issues` view inside the existing `/admin/wisdom` surface. Keep any raw receiving diagnostic strictly preview-only and out of the normal production bundle.
- [ ] Group open issues by page. Show category, section label, note, current text, source count, and created date with restrained disclosure. Do not render exact evidence by default or in public markup.
- [ ] Add deterministic `Export regeneration brief` download and explicit multi-select `Resolve selected` actions. Neither action changes page content.
- [ ] Use existing Teajia typography/tokens, `tap-target`, `z-modal`, and mobile bottom-nav clearance. No horizontal scrolling.
- [ ] Run focused component tests, lint, and colour lint.
- [ ] Commit the task-scoped frontend changes locally.

## Task 4: Integration, privacy gates, and actual-screen verification

**Files:**

- Modify: `vite.config.ts` and preview tests only if required to keep private modules out of normal builds
- Modify: `tests/tea-reference-preview.spec.ts`
- Create: `tests/tea-reference-revision-workflow.spec.ts`
- Modify: `docs/_notes/tea-reference-receiving-layer.md`
- Modify: `docs/STATE_OF_THE_SITE.md` only if the new local capability materially changes the documented state

- [ ] Add an integration test from Markdown build through public page sections and citations. Confirm the page registry carries hierarchy depth without flattening Pu’er geography.
- [ ] Add production bundle guards for original Chinese prose, translation metadata, exact evidence, private issue notes, and private review modules.
- [ ] Add browser tests for a reference page, head-admin flag sheet, grouped queue, deterministic Markdown download, and resolve-selected flow using isolated local fixtures only.
- [ ] Intercept and abort all browser-test API mutations before network access. Supply fixture reads locally and assert no unexpected console errors, page errors, request failures, overflow, or mobile bottom-nav obstruction.
- [ ] Inspect the real desktop and mobile screens. Confirm the public page is calm and readable, the flag action is discreet, the sheet is concise, and the queue can be understood without reading claim-level evidence.
- [ ] Run the focused builder, reference, Worker, and UI tests.
- [ ] Run the full Tea Reference receiving suite, TypeScript lint, colour lint, normal production build, Tea Reference preview build, and the dedicated browser suite.
- [ ] Review the final diff for unrelated changes and private-data leakage.
- [ ] Commit all remaining task-scoped integration changes locally. Do not push, deploy, or write to a live database.

## Completion contract

The work is complete when Adrian can read a polished English Tea Reference page, flag one real section in a short head-admin sheet, see the issue grouped by page in Wisdom admin, export all open issues as one stable Markdown brief for local agent work, and resolve selected issues afterward. The public site must not contain original Chinese prose, private evidence, translation provenance, issue notes, raw IDs, or held-review language, and the normal production build must not ship the private receiving review.
