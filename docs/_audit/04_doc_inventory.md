# Docs Folder Inventory (Layer 1, Part 4)

**Audit Date:** 2026-04-27  
**Total Files Surveyed:** 46 (31 in docs/, 4 in docs/brief/, 9 in docs/plan/, 2 in docs/_audit/)  
**Prior Notes:** 8 audit shards, 2 superseded briefs (merged into NETWORK_ROLLOUT_PLAN), 1 plan marked shipped (ARTICLE_UNIFICATION_PLAN)

---

## Summary Counts

### By Status
- **LIVING** (actively used, foundational): 13 files
  - VISION.md, ROADMAP.md, INDEX.md, COLOR_RULES.md, ARCHITECTURE.md (emerging), MULTI_STORE_PLAN.md, NETWORK_ROLLOUT_PLAN.md, brief/* (4 files), MAGAZINE_PLAN.md
- **SHIPPED / COMPLETE** (work done, reference value): 2 files
  - ARTICLE_UNIFICATION_PLAN.md (phases A–D shipped), SPRINT_APRIL_2026.md (phase record)
- **IN-PROGRESS** (actively being built): 8 files
  - ROADMAP.md phases, LAUNCH_CHECKLIST.md, TODO.md, plan/event-system-v2.md, plan/magazine-editor-spec.md, COMPASS_SOCIAL_PLAN.md, plan/tea-compass-spec.md, TASTING_JOURNAL_BRIEF.md
- **DEFERRED / STALE** (planned but not yet built): 6 files
  - VISION_AUDIT_4_LEARNING.md, VISION_AUDIT_5_EVENTS.md, VISION_AUDIT_6_ADMIN.md, VISION_AUDIT_7_TECHNICAL.md, teajia-complete-strategy.md, teajia-strategy-expansion.md
- **REDUNDANT / OVERLAPPING** (candidates for consolidation): 12 files
  - AUDIT.md, FUNCTIONAL_AUDIT.md, ARCHITECTURE_AUDIT.md, UI_UX_AUDIT.md, DESIGN_SYSTEM_AUDIT.md, WEBSITE_TEARDOWN.md, VISION_AUDIT_0_INDEX.md, VISION_AUDIT_1_OVERVIEW.md, VISION_AUDIT_2_SHOP.md, VISION_AUDIT_3_COMPASS.md, MEMBERS_AND_ACCESS_BRIEF.md, PHASE_1B_PLAN.md
- **REFERENCE / DECISION RECORD** (locked decisions, external contract): 5 files
  - ORDER_SYSTEM_PLAN.md, NETWORK_UI_BRIEF.md, plan/consult-redesign-spec.md, plan/learn-archive-redesign.md, plan/teajia-tasting-usage-guide.md

### By Destination
- **KEEP (rewrite tight)**: 2 files
  - VISION.md, ROADMAP.md
- **KEEP (reference)**: 5 files
  - COLOR_RULES.md, INDEX.md, LAUNCH_CHECKLIST.md, TODO.md, TEAJIA_PALETTES.md (can trim)
- **MERGE INTO STATE_OF_THE_SITE.md**: 8 audit files
  - AUDIT.md, FUNCTIONAL_AUDIT.md, ARCHITECTURE_AUDIT.md, UI_UX_AUDIT.md, DESIGN_SYSTEM_AUDIT.md, WEBSITE_TEARDOWN.md, VISION_AUDIT_0–3
- **MERGE INTO ACTIVE_BRIEFS.md** (new, for in-progress work): 6 files
  - LAUNCH_CHECKLIST.md (trim), TODO.md, plan/event-system-v2.md, COMPASS_SOCIAL_PLAN.md, TASTING_JOURNAL_BRIEF.md, brief/SPRINT_APRIL_2026.md (trim)
- **ARCHITECTURE.md** (new, created from audit): 2 files
  - MULTI_STORE_PLAN.md, VISION_AUDIT_7_TECHNICAL.md
- **FLOWS.md** (new, cross-linking guide): 4 files
  - VISION_AUDIT_1_OVERVIEW.md (connections), VISION_AUDIT_2_SHOP.md (discovery flows), VISION_AUDIT_4_LEARNING.md, VISION_AUDIT_5_EVENTS.md
- **ARCHIVE or DELETE**: 4 files
  - MEMBERS_AND_ACCESS_BRIEF.md (superseded), PHASE_1B_PLAN.md (superseded), teajia-complete-strategy.md (duplicate of VISION.md era), teajia-strategy-expansion.md (duplicate)

---

## Master Inventory Table

| File | Purpose | Status | Destination | Contradictions |
|------|---------|--------|-------------|-----------------|
| **VISION.md** | Core brand philosophy: what Teajia is, who uses it, why it exists | LIVING | KEEP (rewrite tight) | None; single source of truth |
| **ROADMAP.md** | Build sequence and phase breakdown (0–3), current blockers | LIVING | KEEP (rewrite tight) | None; synchronized with VISION |
| **INDEX.md** | Navigation guide: where to find what in docs/ | LIVING | KEEP (reference) | None; utility document |
| **COLOR_RULES.md** | Token system, safe colors, legacy alias warnings, theme rules | LIVING | KEEP (reference) | None; locked design contract |
| **TEAJIA_PALETTES.md** | Historic color/font audit and overhaul plan (March 2026) | LIVING but STALE | Trim or DELETE | Overlaps DESIGN_SYSTEM_AUDIT (newer, detailed) |
| **LAUNCH_CHECKLIST.md** | PREVIEW_MODE gates, hidden sections, product visibility | IN-PROGRESS | MERGE INTO ACTIVE_BRIEFS (trim to essentials) | None; covers restore procedure only |
| **TODO.md** | Living todo: committed work, ideas, loose ends | IN-PROGRESS | MERGE INTO ACTIVE_BRIEFS | Overlaps ROADMAP (less detailed phases) |
| **AUDIT.md** | Platform audit (March 2026): public features, admin, data layer, gaps | REDUNDANT | MERGE INTO STATE_OF_THE_SITE | Overlaps FUNCTIONAL_AUDIT (same data); subsumed by audit shards |
| **FUNCTIONAL_AUDIT.md** | Complete functional teardown (March 2026): every user action | REDUNDANT | MERGE INTO STATE_OF_THE_SITE | Duplicates AUDIT.md inventory; both from same session |
| **ARCHITECTURE_AUDIT.md** | Section silos, cross-linking gaps, connective tissue needs | REDUNDANT | MERGE INTO STATE_OF_THE_SITE + ARCHITECTURE.md | Overlaps VISION_AUDIT_7; same analysis angle |
| **UI_UX_AUDIT.md** | Typography, navigation, design system issues (13+12 categories) | REDUNDANT | MERGE INTO STATE_OF_THE_SITE | Detailed component-level; overlaps DESIGN_SYSTEM_AUDIT on color/tokens |
| **DESIGN_SYSTEM_AUDIT.md** | Triple-config drift, 169 inconsistencies, foundation issues | REDUNDANT | MERGE INTO STATE_OF_THE_SITE | Overlaps UI_UX_AUDIT and TEAJIA_PALETTES on color/spacing |
| **WEBSITE_TEARDOWN.md** | First impression audit (0–5 sec), visual hierarchy, brand cohesion | REDUNDANT | MERGE INTO STATE_OF_THE_SITE | Overlaps AUDIT (visual section); subsumed by UI_UX_AUDIT |
| **VISION_AUDIT_0_INDEX.md** | Index to 8-part vision audit, priority roadmap | REDUNDANT | MERGE INTO STATE_OF_THE_SITE | Wrapper; superseded by ROADMAP consolidation |
| **VISION_AUDIT_1_OVERVIEW.md** | "Tea Practice OS" thesis, 3 missing layers (timeline, knowledge graph, social) | REDUNDANT | MERGE INTO FLOWS.md (connective vision) | Overlaps VISION.md (dated analysis); foundational for FLOWS |
| **VISION_AUDIT_2_SHOP.md** | Discovery flows, Flavor Map, taste similarity, guided entry, product page as teacher | REDUNDANT | MERGE INTO FLOWS.md (shop discovery patterns) | Specific detail; overlaps VISION_AUDIT_1 |
| **VISION_AUDIT_3_COMPASS.md** | Session templates, smart prompts, voice pipeline, practice dashboard, search, analytics | DEFERRED | MERGE INTO FLOWS.md (compass patterns) or ARCHITECTURE.md | Detailed feature spec; overlaps plan/tea-compass-spec.md in scope |
| **VISION_AUDIT_4_LEARNING.md** | Contextual content surfacing, practice challenges, adaptive paths, living magazine | DEFERRED | MERGE INTO FLOWS.md (learning patterns) | Overlaps plan/learn-archive-redesign.md; audit-phase work |
| **VISION_AUDIT_5_EVENTS.md** | Event lifecycle (pre/during/post), anticipation building, lasting connection | DEFERRED | MERGE INTO FLOWS.md (event lifecycle) | Overlaps plan/event-system-v2.md; strategic layer |
| **VISION_AUDIT_6_ADMIN.md** | Morning dashboard, notifications, one-click fulfillment, receipt pipeline | DEFERRED | MERGE INTO FLOWS.md (admin workflows) or ARCHITECTURE.md | Overlaps ROADMAP Phase 0.6; vision-phase detail |
| **VISION_AUDIT_7_TECHNICAL.md** | Unified activity stream, product relationships, offline-first, service worker | DEFERRED | MERGE INTO ARCHITECTURE.md (technical decisions) | Overlaps ARCHITECTURE_AUDIT on silo problem; infrastructure-focused |
| **ARTICLE_UNIFICATION_PLAN.md** | Legacy Story → DbArticle migration (phases A–D shipped, phase E partial) | SHIPPED | ARCHIVE (keep as completed reference) | None; work is done and tracked |
| **MULTI_STORE_PLAN.md** | Phase 1A implementation: accounts table, multi-tenancy, store isolation, network model | LIVING | KEEP or MERGE INTO ARCHITECTURE.md | Foundational for NETWORK_ROLLOUT_PLAN; locked decisions |
| **NETWORK_ROLLOUT_PLAN.md** | Phase 1B+: tea profiles, listings, wholesale, cross-pollination, bundles | LIVING | KEEP (primary source) + ARCHITECTURE.md | Supersedes MEMBERS_AND_ACCESS_BRIEF.md and PHASE_1B_PLAN.md |
| **MEMBERS_AND_ACCESS_BRIEF.md** | Access model (5-tier, 6-bundle) — **SUPERSEDED 2026-04-26** | REDUNDANT | ARCHIVE (kept as reference for design direction §6) | Fully merged into NETWORK_ROLLOUT_PLAN |
| **PHASE_1B_PLAN.md** | Tea profiles, listings, edit suggestions, wholesale — **SUPERSEDED 2026-04-26** | REDUNDANT | ARCHIVE (kept as historical reference) | Fully merged into NETWORK_ROLLOUT_PLAN; same design conversation |
| **ORDER_SYSTEM_PLAN.md** | Order inquiry flow, payment methods, fulfillment, in-person orders | REFERENCE | KEEP (locked spec) | Complements ROADMAP Phase 0; no contradictions |
| **MAGAZINE_PLAN.md** | 4:5 format, flyer-first editorial, tap zones, page transitions, grid layout | IN-PROGRESS | KEEP (design spec) | Overlaps plan/magazine-editor-spec.md (implementation); no contradiction |
| **COMPASS_SOCIAL_PLAN.md** | Compass action bar removal, tab restructure, sharing, command center | IN-PROGRESS | MERGE INTO ACTIVE_BRIEFS | Overlaps plan/tea-compass-spec.md in scope; phase 1 actionable items |
| **NETWORK_UI_BRIEF.md** | Design language for network surfaces: catalog, listings, members, wholesale | REFERENCE | KEEP (design decision record) | Tied to NETWORK_ROLLOUT_PLAN; locked visual direction |
| **TASTING_JOURNAL_BRIEF.md** | Customer-facing journal UX: entry detail, list, past tastings, actions | IN-PROGRESS | MERGE INTO ACTIVE_BRIEFS | Overlaps plan/teajia-tasting-usage-guide.md (taxonomy) vs. UX brief |
| **brief/PERSONAS.md** | 10 audience personas: Independent Tea Master, Aspiring Operator, Tea House Founder, etc. | LIVING | KEEP (reference) | Cross-referenced by OFFER_AND_STRATEGY; single source |
| **brief/OFFER_AND_STRATEGY.md** | What Teajia offers each persona, gaps, 3 strategic moves | LIVING | KEEP (reference) | Complements PERSONAS; no contradiction |
| **brief/DEVELOPMENT_PRIORITIES.md** | Top 30 features, easiest to hardest (Tier 1–4), effort estimates | LIVING | KEEP (reference) | Synchronized with ROADMAP; no contradiction |
| **brief/SPRINT_APRIL_2026.md** | Build record: what shipped, decisions made, gift sets, magazine editor, spaces page | SHIPPED | ARCHIVE or TRIM (keep highlights only) | Mirrors ROADMAP phases; historical record |
| **plan/consult-redesign-spec.md** | Consult page rewrite: question-driven, path cards, service content, inline expansion | REFERENCE | KEEP (implementation spec) | Locked design; no overlap with other plans |
| **plan/event-rsvp-capacity-engine.md** | RSVP system, tiered capacity (80/20), magic links, waitlist, post-session archive | IN-PROGRESS | MERGE INTO ACTIVE_BRIEFS | Complements plan/event-system-v2.md (older, broader) |
| **plan/event-system-v2.md** | Event flow redesign: approval-based RSVP, flyer-first creation, story cards, journey system | IN-PROGRESS | MERGE INTO ACTIVE_BRIEFS | Overlaps plan/event-rsvp-capacity-engine.md; broader vision |
| **plan/learn-archive-redesign.md** | Learn section overhaul: visual abundance, horizontal carousels, glossary prominence | REFERENCE | KEEP (design spec) or MERGE INTO ACTIVE_BRIEFS | Overlaps VISION_AUDIT_4 (strategic vision); implementation-focused |
| **plan/magazine-editor-spec.md** | Admin article editor: D1 storage, Smart Paste, AI structuring, block rendering | IN-PROGRESS | KEEP (implementation spec) | Complements MAGAZINE_PLAN.md (user-facing); no contradiction |
| **plan/tea-compass-spec.md** | Compass complete spec: capture, tasting, sourcing, offline, image handling, build phases | IN-PROGRESS | KEEP (comprehensive reference) | Overlaps COMPASS_SOCIAL_PLAN.md (phases subset); broader scope |
| **plan/teajia-complete-strategy.md** | Website & content strategy (brand, audience, business model, revenue) | DEFERRED | ARCHIVE or DELETE (duplicates VISION.md era) | Overlaps VISION.md significantly; dated alternative |
| **plan/teajia-strategy-expansion.md** | Sessions, spaces, pricing, pipeline, guest strategy | DEFERRED | ARCHIVE or DELETE (duplicates VISION.md era) | Overlaps VISION.md + brief/* significantly; dated alternative |
| **plan/teajia-tasting-usage-guide.md** | Tasting taxonomy: 102 terms, 6 categories, product integration, data flow | REFERENCE | KEEP (data model spec) | Complements TASTING_JOURNAL_BRIEF.md (UX); no contradiction |
| **_audit/01_guest_member.md** | Audit part 1: guest & member role model, scopes, constraints | LIVING | KEEP (architecture reference) | Input to NETWORK_ROLLOUT_PLAN; no contradiction |
| **_audit/02_owner_master.md** | Audit part 2: owner & master roles, capabilities, pages needed | LIVING | KEEP (architecture reference) | Input to NETWORK_ROLLOUT_PLAN; no contradiction |
| **_audit/03_platform_crosscutting.md** | Audit part 3: platform-level concerns, shared tables, cross-store queries | LIVING | KEEP (architecture reference) | Input to NETWORK_ROLLOUT_PLAN; no contradiction |

---

## Subdirectory Contents

### docs/brief/
- **PERSONAS.md** — 10 personas with needs and gaps
- **OFFER_AND_STRATEGY.md** — offer per persona + strategic focus
- **DEVELOPMENT_PRIORITIES.md** — ranked feature backlog (30 items, effort estimates)
- **SPRINT_APRIL_2026.md** — build record and decisions (April 2026)

### docs/plan/
- **consult-redesign-spec.md** — Consult page redesign (question-driven, path cards)
- **event-rsvp-capacity-engine.md** — RSVP system spec (tiered capacity, magic links)
- **event-system-v2.md** — Event system redesign (approval flow, flyer-first, journey)
- **learn-archive-redesign.md** — Learn section overhaul (abundance, carousels)
- **magazine-editor-spec.md** — Admin article editor (D1, Smart Paste, AI structuring)
- **tea-compass-spec.md** — Compass complete spec (capture, tasting, sourcing, offline)
- **teajia-complete-strategy.md** — Website & content strategy (brand, audience, business model) [DEFERRED, ARCHIVE]
- **teajia-strategy-expansion.md** — Sessions, spaces, pricing (deferred, ARCHIVE]
- **teajia-tasting-usage-guide.md** — Tasting taxonomy (102 terms, data flow)

### docs/_audit/
- **01_guest_member.md** — Audit part 1: guest & member roles
- **02_owner_master.md** — Audit part 2: owner & master roles
- **03_platform_crosscutting.md** — Audit part 3: platform-level concerns
- **04_doc_inventory.md** — (This file) Complete docs audit, consolidation map

---

## Consolidation Merge Map

### STATE_OF_THE_SITE.md (new, consolidates all audits)
**Sources:**
- AUDIT.md (platform audit: public features, admin, data layer, gaps)
- FUNCTIONAL_AUDIT.md (complete functional teardown: user actions, navigation, filtering)
- ARCHITECTURE_AUDIT.md (section silos, cross-linking gaps, connective tissue)
- UI_UX_AUDIT.md (typography, navigation, design issues: 13+12 categories)
- DESIGN_SYSTEM_AUDIT.md (triple-config drift, 169 inconsistencies, foundation issues)
- WEBSITE_TEARDOWN.md (first impression audit, visual hierarchy, brand cohesion)
- VISION_AUDIT_0_INDEX.md (wrapper; deprecated)

**Merge logic:**
1. Create **Executive Summary** section: current state snapshot (what works, what doesn't)
2. Create **Features & Functional Inventory** section: merge AUDIT + FUNCTIONAL_AUDIT tables
3. Create **Design System & Visual Audit** section: merge DESIGN_SYSTEM_AUDIT + UI_UX_AUDIT + WEBSITE_TEARDOWN
4. Create **Architecture & Cross-Linking** section: merge ARCHITECTURE_AUDIT findings
5. Retain original file references in footers for traceability
6. Archive original 8 files after verification

### FLOWS.md (new, cross-linking and user journey guide)
**Sources:**
- VISION_AUDIT_1_OVERVIEW.md (3 missing layers, connective thesis)
- VISION_AUDIT_2_SHOP.md (discovery flows: Flavor Map, taste similarity, guided entry)
- VISION_AUDIT_3_COMPASS.md (Compass session templates, voice pipeline, practice dashboard)
- VISION_AUDIT_4_LEARNING.md (contextual surfacing, practice challenges, adaptive paths)
- VISION_AUDIT_5_EVENTS.md (event lifecycle: pre/during/post, anticipation, lasting connection)
- VISION_AUDIT_6_ADMIN.md (admin workflows: morning dashboard, fulfillment, notifications)

**Merge logic:**
1. **Section 1 — The Connective Thesis:** VISION_AUDIT_1 + ARCHITECTURE_AUDIT findings
2. **Section 2 — Buyer Journey (Shop → Compass → Learn → Events):** VAs 2–5, cross-links at each phase
3. **Section 3 — Admin Workflow Loop:** VA 6
4. **Section 4 — Technical Enablers:** VISION_AUDIT_7 (activity stream, relationships)
5. Creates **single, narratively coherent flow document** instead of 8 separate audit files

### ACTIVE_BRIEFS.md (new, consolidates in-progress work)
**Sources:**
- LAUNCH_CHECKLIST.md (trim to essential restore procedures only)
- TODO.md (current committed work + ready-to-build ideas)
- plan/event-system-v2.md (event redesign, approval flow)
- COMPASS_SOCIAL_PLAN.md (Compass phase 1: action bar removal, tab restructure)
- TASTING_JOURNAL_BRIEF.md (customer journal UX)
- brief/SPRINT_APRIL_2026.md (trim: keep highlights, move detailed build record to archive)

**Merge logic:**
1. **Section 1 — Next Sprint (Tier 1 + 2 from DEVELOPMENT_PRIORITIES)**
2. **Section 2 — Feature Specs (Event System, Compass, Tasting Journal)**
3. **Section 3 — Known Stubs & Restore Procedures** (from LAUNCH_CHECKLIST, minimal)
4. **Section 4 — Ideas for Review** (from TODO.md)
5. Archive separate files except plan/* which remain as implementation specs

### ARCHITECTURE.md (new, consolidates technical & structural decisions)
**Sources:**
- MULTI_STORE_PLAN.md (Phase 1A: account model, multi-tenancy, isolation)
- NETWORK_ROLLOUT_PLAN.md (Phase 1B+: profiles, listings, wholesale, bundles)
- VISION_AUDIT_7_TECHNICAL.md (activity stream, relationships, offline-first, service worker)
- _audit/01_guest_member.md (role model)
- _audit/02_owner_master.md (role capabilities)
- _audit/03_platform_crosscutting.md (cross-store concerns)

**Merge logic:**
1. **Section 1 — Tenancy & Account Model:** MULTI_STORE_PLAN + audit files
2. **Section 2 — Authorization & Roles:** NETWORK_ROLLOUT_PLAN + audit files (5-tier, 6-bundle)
3. **Section 3 — Data Layer & Relationships:** VISION_AUDIT_7 (activity stream, product graph)
4. **Section 4 — Technical Roadmap:** remaining VISION_AUDIT_7 items (offline, service worker, analytics)
5. Keep individual _audit/* files as reference (they're concise); these feed ARCHITECTURE.md

### SITE_MAP.md (new, generated from current state audit)
**Sources:**
- AUDIT.md + FUNCTIONAL_AUDIT.md (all pages, features, routes)
- LAUNCH_CHECKLIST.md (hidden sections, gating)
- plan/* (upcoming pages/features)

**Structure:**
1. **Public-Facing Navigation:** Home, Magazine, Learn, Shop, Consult, About, Spaces, Events
2. **Account Pages:** Orders, Samples, Tasting Journal, Settings
3. **Hidden / In Progress:** Community, For Your Space, Start Here
4. **Admin Pages:** Dashboard, Inventory, Orders, Events, Magazine, Members
5. **Future / Planned:** Network member accounts, wholesale orders, platforms features

---

## Three Messiest Overlap Clusters

### Cluster 1: The 8 Audit Shards (AUDIT through VISION_AUDIT_3)

**The Problem:** 
Same session (March 2026), same codebase, same problems viewed from 8 different angles. AUDIT.md and FUNCTIONAL_AUDIT.md are nearly identical. ARCHITECTURE_AUDIT.md, UI_UX_AUDIT.md, and DESIGN_SYSTEM_AUDIT.md overlap on the color/token issue (which file lists the 169 problems? All three do, slightly differently). WEBSITE_TEARDOWN.md repeats the "first impression" judgment. VISION_AUDIT_0–3 then layer strategic vision on top of the same facts.

**Cross-references within the cluster:**
- AUDIT.md #34 → VISION_AUDIT_2 (brewing guides)
- AUDIT.md #11 → VISION_AUDIT_6 (streak tracking)
- FUNCTIONAL_AUDIT.md → WEBSITE_TEARDOWN (visual hierarchy)
- UI_UX_AUDIT.md §1 → DESIGN_SYSTEM_AUDIT (font loading, color tokens)
- DESIGN_SYSTEM_AUDIT.md § 1.1–1.4 → TEAJIA_PALETTES.md (hardcoded colors, font conflicts, shadow scale, border radius)

**Resolution:**
Consolidate into **STATE_OF_THE_SITE.md** with 5 subsections:
1. Functional inventory (AUDIT + FUNCTIONAL_AUDIT tables merged)
2. Visual & design system issues (UI_UX_AUDIT + DESIGN_SYSTEM_AUDIT combined)
3. Architecture gaps (ARCHITECTURE_AUDIT)
4. First impression analysis (WEBSITE_TEARDOWN, brief section)
5. Strategic vision implications (VISION_AUDIT_0–3, summarized by layer)

Archive 8 original files after migration.

---

### Cluster 2: Superseded Briefs (MEMBERS_AND_ACCESS_BRIEF + PHASE_1B_PLAN)

**The Problem:**
Both marked "SUPERSEDED 2026-04-26" with explicit note: "merged into NETWORK_ROLLOUT_PLAN.md". But they remain in docs/ because:
- §6 (design direction) is referenced by NETWORK_UI_BRIEF.md
- Design conversation history is preserved
- Decision rationale is more legible in the original files

**What's redundant:**
- MEMBERS_AND_ACCESS_BRIEF.md §1–5 (feature summary, tier model, bundles, visibility) → all in NETWORK_ROLLOUT_PLAN.md "What this rollout delivers" + "Mental model"
- PHASE_1B_PLAN.md §2–5 (mental model, decisions, scope) → all in NETWORK_ROLLOUT_PLAN.md "Locked decisions" + "What this phase delivers"

**What's worth preserving:**
- MEMBERS_AND_ACCESS_BRIEF.md §6 (visual design language) — referenced by NETWORK_UI_BRIEF.md and NETWORK_ROLLOUT_PLAN.md
- PHASE_1B_PLAN.md design conversation (pre-merge thinking) — useful context for why decisions were made

**Resolution:**
1. Extract §6 from MEMBERS_AND_ACCESS_BRIEF.md into NETWORK_UI_BRIEF.md as "Design Language § Inherited from M&A Brief"
2. Move both files to **docs/_archive/** (new directory) with a README: "These briefs were merged into NETWORK_ROLLOUT_PLAN.md (2026-04-26). Preserved for design history and decision context."
3. Update NETWORK_ROLLOUT_PLAN.md to cite: "For design language, see NETWORK_UI_BRIEF.md §Shared Vocabulary. For Members & Access historical context, see _archive/MEMBERS_AND_ACCESS_BRIEF.md."

---

### Cluster 3: Deferred Strategy Documents (teajia-complete-strategy + teajia-strategy-expansion)

**The Problem:**
Two files from an earlier planning phase (likely pre-April 2026) that duplicate VISION.md's content:
- teajia-complete-strategy.md: Brand, Audience, Business Model, Revenue — all in VISION.md
- teajia-strategy-expansion.md: Sessions, Spaces, Pricing, Pipeline — same content as VISION.md's "Who Uses Teajia" + "The Paradox, Resolved"

Both are in **plan/**, suggesting they're specs. But they're not — they're strategy docs that predate VISION.md consolidation.

**Evidence of redundancy:**
- teajia-complete-strategy.md §"What This Rollout Delivers" matches VISION.md word-for-word
- teajia-strategy-expansion.md §"The Three Spaces" is covered in plan/teajia-strategy-expansion.md lines 10–50, which is narrative strategy, not implementation

**What's different / worth checking:**
- teajia-strategy-expansion.md §3 (Client Tiers: Casual, Studio, House, Founder) — might differ from PERSONAS.md
  - Checking: Casual Guest ≈ Curious Reader. Studio Owner ≈ Integrator. House Owner ≈ Tea House Founder. Founder = independent tier. **No new tiers; same people, named differently.**

**Resolution:**
1. **Confirm with Adrian:** Are these pre-VISION.md artifacts, or do they contain strategy not yet in VISION.md/PERSONAS.md?
2. If confirmed as duplicates: **Move to _archive/** with note "These were merged into VISION.md and brief/PERSONAS.md (April 2026)."
3. If they contain unique strategy: **Extract unique sections into VISION.md update**, then archive.

---

## Key Observations

### Dates & Sessions
- **March 2026:** AUDIT, FUNCTIONAL_AUDIT, ARCHITECTURE_AUDIT, UI_UX_AUDIT, DESIGN_SYSTEM_AUDIT, WEBSITE_TEARDOWN (6 files in one session)
- **March–April 2026:** VISION_AUDIT_0–7 (8 files as follow-up to above)
- **April 2026:** ROADMAP, MAGAZINE_PLAN, brief/*, SPRINT_APRIL_2026, NETWORK_ROLLOUT_PLAN, NETWORK_UI_BRIEF, COMPASS_SOCIAL_PLAN, TASTING_JOURNAL_BRIEF, plan/* (18 files, major sprint)
- **April 25–26, 2026:** ARTICLE_UNIFICATION_PLAN marked phases A–D shipped; MEMBERS_AND_ACCESS_BRIEF + PHASE_1B_PLAN superseded (2 files deprioritized)
- **April 27, 2026:** This audit

### Status by Coherence
- **Tight, non-redundant clusters:**
  - VISION.md + ROADMAP.md + brief/* (all synchronized)
  - MULTI_STORE_PLAN.md + NETWORK_ROLLOUT_PLAN.md (sequential phases, clear lineage)
  - plan/* (each a distinct feature spec; minimal overlap)
  - _audit/01–03 (layers of the same architecture; complementary, not redundant)

- **Loose, overlapping clusters:**
  - 8 audit shards (same time, same codebase, different lenses) ← **consolidate**
  - 2 superseded briefs (merged but preserved for design history) ← **archive with context**
  - 2 strategy documents (pre-VISION.md era, duplicative) ← **archive or extract unique content**
  - TEAJIA_PALETTES.md (subsumed by later audits; keep for font/color reference only)

### Recommended Immediate Actions

1. **Create STATE_OF_THE_SITE.md** (2–3 hours): consolidates 8 audit shards into 5 subsections with unified tables
2. **Create FLOWS.md** (2–3 hours): weaves VISION_AUDIT_1–7 into narrative journey doc (shop → compass → learn → events → admin)
3. **Create ACTIVE_BRIEFS.md** (1 hour): consolidates current sprint work (LAUNCH_CHECKLIST, TODO, in-progress plan/* summaries)
4. **Enhance ARCHITECTURE.md** (2 hours): merge MULTI_STORE_PLAN + NETWORK_ROLLOUT_PLAN + VISION_AUDIT_7 + _audit/* into cohesive technical reference
5. **Create _archive/ directory** (0.5 hours): move MEMBERS_AND_ACCESS_BRIEF, PHASE_1B_PLAN, teajia-complete-strategy, teajia-strategy-expansion with README
6. **Update INDEX.md** (1 hour): point to new consolidated files; mark archived files
7. **Delete or trim** TEAJIA_PALETTES.md (reference DESIGN_SYSTEM_AUDIT instead) and WEBSITE_TEARDOWN.md (subsumed)

**Total consolidation work:** ~9–10 hours of skilled writing (AI-assisted OK, but requires Adrian review).

---

## File Audit Statistics

- **Total markdown files:** 46
- **By directory:** 
  - docs/ (root): 31 files
  - docs/brief/: 4 files
  - docs/plan/: 9 files
  - docs/_audit/: 2 files (plus this one being written)
- **By status:**
  - LIVING: 13 files
  - SHIPPED: 2 files
  - IN-PROGRESS: 8 files
  - DEFERRED: 6 files
  - REDUNDANT: 12 files
  - REFERENCE: 5 files
- **Consolidation targets:**
  - Keep (no change): 13 files
  - Merge into new docs: 4 new files created (STATE_OF_THE_SITE, FLOWS, ACTIVE_BRIEFS, enhanced ARCHITECTURE)
  - Archive: 6 files (2 superseded briefs, 2 duplicate strategy docs, 2 audit shards subsumed)
  - Trim or delete: 2 files (TEAJIA_PALETTES, WEBSITE_TEARDOWN)

