# Doc Consolidation Plan

## Overview

Teajia's docs have grown to 46 files across 4 subdirectories, with significant overlap especially in audit shards (8 files from March 2026 auditing the same codebase), superseded briefs (2 files explicitly merged), and deferred strategy documents (2 duplicates). This plan consolidates redundant audit files into 4 new synthesis documents (STATE_OF_THE_SITE, FLOWS, ACTIVE_BRIEFS, ARCHITECTURE), archives superseded and duplicate files, and clarifies the target information architecture. Execution is mechanical: open source files, extract specific sections by anchor, paste into target files under labeled headings, then archive originals. Total scope: ~15 files consolidated, 6 files archived, 13 files kept as-is.

---

## Phase 1 — Build new target files (in this order)

### 1.1 Create CHANGELOG.md

**Purpose:** Single source for shipped work, dated and versioned.

**Skeleton:**
```markdown
# Teajia Changelog

## 2026-04
- 2026-04-27: Document consolidation plan created (Layer 1 audit complete)
- 2026-04-25: Article system unification (phases A–D shipped; legacy system removed)
- 2026-04-20: Magazine editor shipped; template system ready for April issue
- [other April items from ROADMAP SHIPPED section]

## 2026-03
- Multi-store architecture shipped (Phase 1A: accounts, roles, multi-tenancy)
- Platform audits completed (8 audit shards from March 2026 session)
```

**Sources:**
- ARTICLE_UNIFICATION_PLAN.md §"Shipped" (phases A–D, dates) → CHANGELOG entry "2026-04-25: Article system unification (phases A–D shipped)"
- ROADMAP.md §"Phase 0" (completed items with dates Adrian provides) → individual 2026-04 entries
- MULTI_STORE_PLAN.md §top (Phase 1A shipped date) → "2026-03: Multi-store architecture shipped"
- brief/SPRINT_APRIL_2026.md §"Build record" (what shipped, decisions made) → 2026-04 entries
- MAGAZINE_PLAN.md (completion date if shipped) → 2026-04 entry

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/CHANGELOG.md`
2. From ARTICLE_UNIFICATION_PLAN.md top, extract "2026-04-25: Phases A–D shipped" fact
3. From ROADMAP.md Phase 0.x (whichever are marked DONE), extract item + date, write as bullet under 2026-04
4. From MULTI_STORE_PLAN.md line 3, extract "Phase 1A shipped" statement, write "2026-03: Multi-store architecture shipped"
5. From brief/SPRINT_APRIL_2026.md "Build record" section, extract "what shipped" bullets, write as 2026-04 entries

---

### 1.2 Create ARCHITECTURE.md

**Purpose:** Single source for technical structure, roles, data model, and locked decisions. Merges MULTI_STORE_PLAN (Phase 1A decisions) + NETWORK_ROLLOUT_PLAN (Phase 1B model) + VISION_AUDIT_7 (activity stream, offline-first, relationships) + _audit/01–03 (role model, authorization, cross-store concerns).

**Skeleton:**
```markdown
# Teajia Architecture

## 1. Tenancy & Account Model

### Multi-Store Foundation (Phase 1A)
[From MULTI_STORE_PLAN.md §"The Decision" through §"Data Model"]

**The Decision:**
- Teajia is a network of independent tea houses, not a unified catalog
- Each store has its own shop URL, inventory, team, orders
- Chosen over unified catalog (franchise risk) and fully siloed (loses network benefit)

**Mental Model:**
- Account = a tea house / operator / location
- User can belong to multiple accounts with different roles per account
- Per-account: stock, orders, customers, events, vendors, costs, stock ledger, tea compass entries, activity logs
- Network-level: magazine, learn hub, exchange rates, tea_reviews cross-account table
- User-scoped within account: tea compass entries (separate compass books per store)

**How Visitors Experience It:**
[From MULTI_STORE_PLAN.md table "How Visitors Experience It"]

**Data Model:**
[From MULTI_STORE_PLAN.md §"Data Model" — copy tables, column additions, seeded accounts, roles table in full]

**Auth Flow:**
[From MULTI_STORE_PLAN.md §"Auth Flow" steps 1–7]

### Network Authorization (Phase 1B)
[From NETWORK_ROLLOUT_PLAN.md §"Mental model" — tea profile → listing → tasting journal]

**Tier Model (5 tiers + Guest):**
[From NETWORK_ROLLOUT_PLAN.md Step 0 table: Platform Owner, Platform Admin, Location Owner, Tea Master, Member]

**Bundle System (6 named bundles):**
[From NETWORK_ROLLOUT_PLAN.md Step 0 — Catalog, Stock, Publish, Gather, Sell, Members]

**Cross-Cutting Flows:**
- Edit suggestions (partners propose canonical changes; curator ratifies per-field)
- Wholesale orders (supplier ships stock to buyer; bilateral invoicing)
- Cross-pollination adoption (partner flags profile for network adoption; Adrian decides)

**Locked Decisions:**
[From NETWORK_ROLLOUT_PLAN.md §"Locked decisions" table — copy all 22 decisions]

## 2. Authorization & Roles (Audit Reference)

**Role Model (Guest → Member tier, per _audit/01_guest_member.md):**
[From _audit/01_guest_member.md — guest scopes, member capabilities]

**Owner & Master Roles (per _audit/02_owner_master.md):**
[From _audit/02_owner_master.md — owner capabilities, pages needed]

**Platform-Level Concerns (per _audit/03_platform_crosscutting.md):**
[From _audit/03_platform_crosscutting.md — shared tables, cross-store queries]

## 3. Data Layer & Product Relationships (Technical Vision)

### Activity Stream & Cross-Account Content
[From VISION_AUDIT_7_TECHNICAL.md §"Unified activity stream" — single customer-facing timeline across all sessions, all events, all purchases, all tasting notes]

### Product Relationships & Tea Identity
[From VISION_AUDIT_7_TECHNICAL.md §"Product relationships" — tea_key as canonical identity, cross-account review aggregation]

### Offline-First & Service Worker
[From VISION_AUDIT_7_TECHNICAL.md §"Offline-first pattern" — local compass cache, sync on reconnect]

## 4. Technical Roadmap (Deferred Work)

**Planned expansions:**
- Service Worker (offline compass, sync)
- Analytics aggregation (cross-store insights for Adrian)
- GraphQL federation (future if needed)

**See also:** ROADMAP.md Phase 1B+ for implementation sequence.

---

## Footer
**Sources:** MULTI_STORE_PLAN.md (Phase 1A locked), NETWORK_ROLLOUT_PLAN.md (Phase 1B model), VISION_AUDIT_7_TECHNICAL.md (technical vision), _audit/01–03 (architecture audit layers). Original files retained in _archive/ for traceability.
```

**Sources (with line/section anchors):**
- MULTI_STORE_PLAN.md §"The Decision" (line 7–14) → section 1.1 "The Decision"
- MULTI_STORE_PLAN.md §"Mental Model" (line 16–22) → section 1.1 "Mental Model"
- MULTI_STORE_PLAN.md table "How Visitors Experience It" (line 24–35) → section 1.1 "How Visitors Experience It"
- MULTI_STORE_PLAN.md §"Data Model" (line 37–49, entire subsection with all tables) → section 1.1 "Data Model"
- MULTI_STORE_PLAN.md §"Roles" table (line 51–58) → section 1.1 "Roles" (brief reference)
- MULTI_STORE_PLAN.md §"Auth Flow" (line 60–69) → section 1.1 "Auth Flow"
- NETWORK_ROLLOUT_PLAN.md §"Mental model" (line 25–42) → section 1.2 "Network Authorization — Mental model"
- NETWORK_ROLLOUT_PLAN.md Step 0 "Tier model" table (line 95–115, all 5 tiers + Guest) → section 1.2 "Tier Model"
- NETWORK_ROLLOUT_PLAN.md Step 0 "Bundle system" description (lines within Step 0) → section 1.2 "Bundle System"
- NETWORK_ROLLOUT_PLAN.md §"Locked decisions" (line 47–73, all 22 decision rows) → section 1.2 "Locked Decisions"
- _audit/01_guest_member.md (entire — role model, scopes, constraints) → section 2 "Role Model"
- _audit/02_owner_master.md (entire — owner & master capabilities) → section 2 "Owner & Master Roles"
- _audit/03_platform_crosscutting.md (entire — platform-level concerns, shared tables) → section 2 "Platform-Level Concerns"
- VISION_AUDIT_7_TECHNICAL.md §"Unified activity stream" → section 3 "Activity Stream"
- VISION_AUDIT_7_TECHNICAL.md §"Product relationships" → section 3 "Product Relationships"
- VISION_AUDIT_7_TECHNICAL.md §"Offline-first pattern" → section 3 "Offline-First"

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/ARCHITECTURE.md`
2. Copy skeleton above
3. Open MULTI_STORE_PLAN.md, extract §"The Decision" (lines 7–14), paste under "1.1 / The Decision"
4. Extract §"Mental Model" (lines 16–22), paste under "1.1 / Mental Model"
5. Extract table "How Visitors Experience It" (lines 24–35), paste under "1.1 / How Visitors Experience It"
6. Extract §"Data Model" (lines 37–49 including all table names), paste under "1.1 / Data Model"
7. Extract §"Auth Flow" (lines 60–69), paste under "1.1 / Auth Flow"
8. Open NETWORK_ROLLOUT_PLAN.md, extract §"Mental model" (lines 25–42), paste under "1.2 / Network Authorization"
9. Extract Step 0 tier model table (lines 95–115), paste under "1.2 / Tier Model"
10. Extract description of bundle system from Step 0, paste under "1.2 / Bundle System"
11. Extract §"Locked decisions" (all 22 rows), paste under "1.2 / Locked Decisions"
12. Open _audit/01_guest_member.md, copy entire content, paste under "2 / Role Model"
13. Open _audit/02_owner_master.md, copy entire content, paste under "2 / Owner & Master Roles"
14. Open _audit/03_platform_crosscutting.md, copy entire content, paste under "2 / Platform-Level Concerns"
15. Open VISION_AUDIT_7_TECHNICAL.md, extract §"Unified activity stream", paste under "3 / Activity Stream"
16. Extract §"Product relationships", paste under "3 / Product Relationships"
17. Extract §"Offline-first pattern", paste under "3 / Offline-First"
18. Save file

---

### 1.3 Create STATE_OF_THE_SITE.md

**Purpose:** Single comprehensive snapshot of current platform state (what works, what doesn't). Consolidates 8 audit shards from March 2026 into 5 cohesive sections.

**Skeleton:**
```markdown
# State of the Site — Audit (March 2026)

**Audit Date:** March 2026  
**Scope:** Comprehensive audit of public + admin surfaces, functional completeness, design system coherence, architecture gaps, visual first impression.

## 1. Executive Summary

[From WEBSITE_TEARDOWN.md §"First Impression" (5-second audit) + AUDIT.md §"Summary"]

Current state: Platform has solid feature breadth (Shop, Compass, Events, Magazine) but suffers from design system fragmentation (169 inconsistencies), poor connective tissue (7 architecture gaps), and typography/color drift (triple-config loading). Fixes are well-scoped (no new features needed; coherence work).

### What Works
[Summarize from AUDIT.md §"What Works"]

### What Doesn't
[Summarize from AUDIT.md §"Critical Gaps"]

## 2. Functional Inventory

### Public Features
[From AUDIT.md §"Public features" + FUNCTIONAL_AUDIT.md merged tables]

**Shop**
- Product listing + filtering
- Flavor Map + similarity engine
- Product detail + brewing guide lookup
- Guided entry flow
[etc. from merged AUDIT + FUNCTIONAL_AUDIT]

### Admin Features
[From AUDIT.md §"Admin" + FUNCTIONAL_AUDIT.md admin tables]

### Navigation & User Flows
[From FUNCTIONAL_AUDIT.md §"Navigation model"]

### Data Layer & Persistence
[From AUDIT.md §"Data layer"]

## 3. Design System & Visual Audit

### Typography Issues
[From UI_UX_AUDIT.md §"Typography" (13 categories)]

### Navigation & Layout Issues
[From UI_UX_AUDIT.md §"Navigation" (12 categories)]

### Color, Token & Foundation Issues
[From DESIGN_SYSTEM_AUDIT.md §"Triple-config drift" + DESIGN_SYSTEM_AUDIT.md "169 inconsistencies table"]

Cross-reference: TEAJIA_PALETTES.md (March 2026 overhaul plan, superseded by later fixes).

### Visual Hierarchy & Brand Cohesion
[From WEBSITE_TEARDOWN.md §"Visual hierarchy" + §"Brand cohesion analysis"]

## 4. Architecture & Connective Tissue

### Section Silos
[From ARCHITECTURE_AUDIT.md §"Section silos" — 7 gaps identified]

### Missing Connective Tissue
[From ARCHITECTURE_AUDIT.md §"Cross-linking gaps"]

### Data Relationships
[From ARCHITECTURE_AUDIT.md §"Data model gaps"]

## 5. Strategic Implications (Vision Audit)

### "Tea Practice OS" Thesis
[From VISION_AUDIT_1_OVERVIEW.md §"The Three Missing Layers" — timeline, knowledge graph, social]

### Audit Sessions Have Validated
[Summary from VISION_AUDIT_0_INDEX.md priority roadmap aligned with design system findings]

---

## Footer
**Original files:** AUDIT.md, FUNCTIONAL_AUDIT.md, ARCHITECTURE_AUDIT.md, UI_UX_AUDIT.md, DESIGN_SYSTEM_AUDIT.md, WEBSITE_TEARDOWN.md, VISION_AUDIT_0_INDEX.md. All archived after migration. Cross-references to specific audit findings via original filenames retained for traceability.
```

**Sources (with anchors):**
- WEBSITE_TEARDOWN.md §"First Impression" (lines ~15–40) → "Executive Summary / What Works + What Doesn't"
- AUDIT.md §"Public features" table + summary (entire) → "Functional Inventory / Public Features"
- FUNCTIONAL_AUDIT.md (entire functional teardown merged with AUDIT) → "Functional Inventory" (deduplicating)
- AUDIT.md §"Admin" section (entire) → "Functional Inventory / Admin Features"
- FUNCTIONAL_AUDIT.md §"Navigation model" → "Functional Inventory / Navigation & User Flows"
- AUDIT.md §"Data layer" → "Functional Inventory / Data Layer"
- UI_UX_AUDIT.md §"Typography" (13 categories: font loading, hierarchy, scale, etc.) → "Design System / Typography Issues"
- UI_UX_AUDIT.md §"Navigation" (12 categories: hierarchy, action labels, etc.) → "Design System / Navigation Issues"
- DESIGN_SYSTEM_AUDIT.md §"Triple-config drift" (entire) → "Design System / Color & Token Issues"
- DESIGN_SYSTEM_AUDIT.md "169 inconsistencies" table (entire) → "Design System / Color & Token Issues"
- WEBSITE_TEARDOWN.md §"Visual hierarchy" → "Design System / Visual Hierarchy"
- WEBSITE_TEARDOWN.md §"Brand cohesion" → "Design System / Brand Cohesion"
- ARCHITECTURE_AUDIT.md §"Section silos" (7 gaps) → "Architecture / Section Silos"
- ARCHITECTURE_AUDIT.md §"Cross-linking gaps" → "Architecture / Missing Connective Tissue"
- ARCHITECTURE_AUDIT.md §"Data model gaps" → "Architecture / Data Relationships"
- VISION_AUDIT_1_OVERVIEW.md §"The Three Missing Layers" → "Strategic Implications / Tea Practice OS Thesis"
- VISION_AUDIT_0_INDEX.md §"Priority roadmap" → "Strategic Implications / Audit Sessions Have Validated"

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/STATE_OF_THE_SITE.md`
2. Copy skeleton above
3. Open WEBSITE_TEARDOWN.md, extract §"First Impression", paste under "Executive Summary"
4. Open AUDIT.md, extract §"Summary" (what works, critical gaps), paste under "Executive Summary"
5. Open AUDIT.md, extract §"Public features" table, paste under "Functional Inventory / Public Features"
6. Open FUNCTIONAL_AUDIT.md, extract main features table, merge with AUDIT entries (deduplicating same content), paste under "Functional Inventory"
7. Open AUDIT.md, extract §"Admin" section, paste under "Functional Inventory / Admin Features"
8. Open FUNCTIONAL_AUDIT.md, extract navigation model description, paste under "Functional Inventory / Navigation & User Flows"
9. Open AUDIT.md, extract data layer section, paste under "Functional Inventory / Data Layer"
10. Open UI_UX_AUDIT.md, extract §"Typography" (13 categories), paste under "Design System / Typography Issues"
11. Extract §"Navigation" (12 categories), paste under "Design System / Navigation Issues"
12. Open DESIGN_SYSTEM_AUDIT.md, extract §"Triple-config drift", paste under "Design System / Color Issues"
13. Extract "169 inconsistencies" table, paste under same section
14. Open WEBSITE_TEARDOWN.md, extract §"Visual hierarchy", paste under "Design System / Visual Hierarchy"
15. Extract §"Brand cohesion", paste under "Design System / Brand Cohesion"
16. Open ARCHITECTURE_AUDIT.md, extract §"Section silos" (7 gaps), paste under "Architecture / Section Silos"
17. Extract §"Cross-linking gaps", paste under "Architecture / Missing Connective Tissue"
18. Extract §"Data model gaps", paste under "Architecture / Data Relationships"
19. Open VISION_AUDIT_1_OVERVIEW.md, extract §"The Three Missing Layers", paste under "Strategic Implications / Tea Practice OS Thesis"
20. Open VISION_AUDIT_0_INDEX.md, extract §"Priority roadmap", paste under "Strategic Implications"
21. Save file

---

### 1.4 Create ACTIVE_BRIEFS.md

**Purpose:** Index of in-progress feature work and quick reference for current sprint. Consolidates scattered in-progress specs and checklists.

**Skeleton:**
```markdown
# Active Briefs — In-Progress Features (April 2026)

Index of briefs currently being built or scoped. For shipped work, see CHANGELOG.md. For locked decisions & architecture, see ARCHITECTURE.md.

## 1. Critical Restore Procedures

**These are stubs that must remain functional until proper features ship.**

[From LAUNCH_CHECKLIST.md §"PREVIEW_MODE", §"Hidden sections" — only the restore procedure descriptions, not the full feature specs]

### Preview Mode Restore
[From LAUNCH_CHECKLIST.md §"PREVIEW_MODE" — enable/disable procedure only]

### Placeholder Sections (In Progress)
[From LAUNCH_CHECKLIST.md §"Hidden sections" — what's hidden, why, unblock conditions]

## 2. Feature Specs (Tier 1 + 2 from DEVELOPMENT_PRIORITIES)

### Event System (Event System v2)
[From plan/event-system-v2.md §"Overview" through §"Journey system"]

**Current status:** Event flow redesign (approval-based RSVP, flyer-first creation, story cards, journey system)

**See also:** plan/event-rsvp-capacity-engine.md for RSVP-specific capacity engine; brief/SPRINT_APRIL_2026.md build record.

### Compass Phase 1 (Social + Sourcing)
[From COMPASS_SOCIAL_PLAN.md §"Overview" through §"Action bar removal"]

**Current status:** Tab restructure, sharing, command center

**See also:** plan/tea-compass-spec.md for complete compass reference

### Tasting Journal
[From TASTING_JOURNAL_BRIEF.md §"Overview" through §"Entry detail UX"]

**Current status:** Customer-facing journal UX (entry detail, list, past tastings, quick actions)

**See also:** plan/teajia-tasting-usage-guide.md for data taxonomy

## 3. Known Stubs & Restore Conditions

[From LAUNCH_CHECKLIST.md — list of hidden sections with unblock dates/conditions]

## 4. Ideas for Review

[From TODO.md — committed work + ready-to-build ideas that don't have a brief yet]

---

## Footer
**Last updated:** 2026-04-27 (Layer 1 audit)  
**Sources:** LAUNCH_CHECKLIST.md (restore procedures), TODO.md (live todo), plan/* (implementation specs), COMPASS_SOCIAL_PLAN.md, TASTING_JOURNAL_BRIEF.md, brief/SPRINT_APRIL_2026.md. Implementation specs remain in plan/* for detailed reference.
```

**Sources (with anchors):**
- LAUNCH_CHECKLIST.md §"PREVIEW_MODE" (restore procedure only, lines ~10–25) → "Critical Restore Procedures / Preview Mode Restore"
- LAUNCH_CHECKLIST.md §"Hidden sections" (what's hidden + unblock conditions) → "Critical Restore Procedures / Placeholder Sections"
- plan/event-system-v2.md §"Overview" through §"Journey system" (entire spec outline) → "Feature Specs / Event System"
- plan/event-rsvp-capacity-engine.md (reference in "See also") → cross-link
- brief/SPRINT_APRIL_2026.md §"Build record" (event system notes) → cross-link
- COMPASS_SOCIAL_PLAN.md §"Overview" through main sections → "Feature Specs / Compass Phase 1"
- plan/tea-compass-spec.md (reference) → cross-link
- TASTING_JOURNAL_BRIEF.md §"Overview" through §"Entry detail UX" → "Feature Specs / Tasting Journal"
- plan/teajia-tasting-usage-guide.md (reference) → cross-link
- TODO.md (entire — committed work + ideas) → "Ideas for Review"

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/ACTIVE_BRIEFS.md`
2. Copy skeleton above
3. Open LAUNCH_CHECKLIST.md, extract §"PREVIEW_MODE" (restore procedure only), paste under "Critical Restore Procedures / Preview Mode Restore"
4. Extract §"Hidden sections", paste under "Critical Restore Procedures / Placeholder Sections"
5. Open plan/event-system-v2.md, extract §"Overview" + main section headings (don't copy entire content — just structure/outline), paste under "Feature Specs / Event System"
6. Open COMPASS_SOCIAL_PLAN.md, extract §"Overview" + main sections, paste under "Feature Specs / Compass Phase 1"
7. Open TASTING_JOURNAL_BRIEF.md, extract §"Overview" + main UX sections, paste under "Feature Specs / Tasting Journal"
8. Open TODO.md, copy entire content, paste under "Ideas for Review"
9. Save file

---

### 1.5 Create FLOWS.md

**Purpose:** End-to-end user journeys per feature tier, bridging feature specs with user experience.

**Skeleton:**
```markdown
# User Flows & Connective Journeys

End-to-end journeys through major feature clusters (Shop → Compass → Learn → Events → Admin). Each flow highlights entry points, decision branches, and cross-feature connections.

## 1. The Connective Thesis ("Tea Practice OS")

**Core insight:** Teajia isn't a single app — it's scaffolding for three overlapping moments:
- **Before:** source, prepare, invite
- **During:** (app stays in pocket; humans connect)
- **After:** capture, reflect, connect to what was loved

[From VISION_AUDIT_1_OVERVIEW.md §"The Three Missing Layers"]

**Three layers need building:**
1. Timeline (sequence of sessions, tastings, purchases)
2. Knowledge graph (what I know about teas; relationships between them)
3. Social (who I know; who shares my tastes)

---

## 2. Buyer Journey: Shop → Compass → Learn → Events

### Shop Discovery Flow (Flavor Map + Guided Entry)
[From VISION_AUDIT_2_SHOP.md §"Discovery flows"]

- Entry points: Home, Magazine (discover via article), direct share
- Flavor Map (taste similarity engine) as primary discovery
- Taste-based entry (guest unfamiliar with tea → guided flow)
- Product page as teacher (brewing guide, tasting notes from network reviews)

### Compass Sourcing Flow (Field Intelligence → Purchase Bridge)
[From VISION_AUDIT_3_COMPASS.md §"Compass + sourcing"]

- Compass session capture (tasting, sourcing notes, photos)
- Sourcing pipeline (field → inventory → shop listing)
- Voice pipeline (Compass voice memo → transcribed notes)
- Practice dashboard (session history, tasting trends)

### Learn Hub Flow (Contextual Surfacing + Adaptive Paths)
[From VISION_AUDIT_4_LEARNING.md §"Contextual surfacing"]

- Magazine as entry (article → related articles → glossary)
- Practice challenges (personalized, based on compass history)
- Adaptive paths (what to learn next based on tasted teas)
- Living magazine (updated recipes, new discoveries)

### Events Flow (Session Lifecycle: Pre/During/Post)
[From VISION_AUDIT_5_EVENTS.md §"Event lifecycle"]

- Pre-session: anticipation building (why this session, guest list, tea menu)
- During: (app in pocket; host uses Compass for notes)
- Post-session: archive (recap page, guest tasting notes, purchase bridge)
- Lasting connection (email, next event invitation, tea discovery)

---

## 3. Admin Workflow Loop

[From VISION_AUDIT_6_ADMIN.md §"Admin morning dashboard" through §"Receipt pipeline"]

### Morning Dashboard & Notifications
- Session recap (last night's event, attendee engagement)
- Order summary (pending, ready to ship, invoiced)
- Inventory alerts (low stock, near expiry)

### One-Click Fulfillment & Receipt
- Order picking (list all pending, mobile-friendly)
- Receiving (stock in, cost basis recorded)
- Receipt generation & email

### CRM & Guest Follow-up
- Attendee notes (who came, what they tried, who they connected with)
- Follow-up prompts (next event, product restock)

---

## 4. Technical Enablers

### Unified Activity Stream
[From VISION_AUDIT_7_TECHNICAL.md §"Unified activity stream"]

Single customer-facing timeline across:
- Sessions attended
- Events hosted
- Teas tasted (Compass + Journal)
- Purchases made
- Network discoveries (new teas, new friends)

### Product Relationships & Tea Identity
[From VISION_AUDIT_7_TECHNICAL.md §"Product relationships"]

- Tea profiles as canonical identity (across stores)
- Cross-store review aggregation (what does the network know about this tea?)
- Lineage tracking (who sources this? who curates it? who's selling it today?)

### Offline-First Infrastructure
[From VISION_AUDIT_7_TECHNICAL.md §"Offline-first pattern"]

- Compass continues working on airplane / in field (no WiFi)
- Service Worker caches session captures
- Sync on reconnect (upload to network, merge with backend state)

---

## Footer
**Sources:** VISION_AUDIT_1–7 (audit-phase end-to-end flows). These flows synthesize strategic vision with platform capabilities. For architectural decisions, see ARCHITECTURE.md. For feature specs, see ACTIVE_BRIEFS.md and plan/*.
```

**Sources (with anchors):**
- VISION_AUDIT_1_OVERVIEW.md §"The Three Missing Layers" (entire) → section 1 "The Connective Thesis"
- VISION_AUDIT_2_SHOP.md §"Discovery flows" (Flavor Map, guided entry, product page as teacher) → section 2 "Shop Discovery Flow"
- VISION_AUDIT_3_COMPASS.md §"Compass + sourcing" → section 2 "Compass Sourcing Flow"
- VISION_AUDIT_3_COMPASS.md §"Voice pipeline" → section 2 "Compass Sourcing Flow"
- VISION_AUDIT_3_COMPASS.md §"Practice dashboard" → section 2 "Compass Sourcing Flow"
- VISION_AUDIT_4_LEARNING.md §"Contextual surfacing" (entire) → section 2 "Learn Hub Flow"
- VISION_AUDIT_5_EVENTS.md §"Event lifecycle" (pre/during/post) → section 2 "Events Flow"
- VISION_AUDIT_6_ADMIN.md §"Admin morning dashboard" through §"Receipt pipeline" → section 3 "Admin Workflow Loop"
- VISION_AUDIT_7_TECHNICAL.md §"Unified activity stream" → section 4 "Unified Activity Stream"
- VISION_AUDIT_7_TECHNICAL.md §"Product relationships" → section 4 "Product Relationships"
- VISION_AUDIT_7_TECHNICAL.md §"Offline-first pattern" → section 4 "Offline-First Infrastructure"

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/FLOWS.md`
2. Copy skeleton above
3. Open VISION_AUDIT_1_OVERVIEW.md, extract §"The Three Missing Layers", paste under section 1 "The Connective Thesis"
4. Open VISION_AUDIT_2_SHOP.md, extract §"Discovery flows" (Flavor Map, guided entry, product page), paste under section 2 "Shop Discovery Flow"
5. Open VISION_AUDIT_3_COMPASS.md, extract sourcing, voice, and dashboard sections, paste under section 2 "Compass Sourcing Flow"
6. Open VISION_AUDIT_4_LEARNING.md, extract contextual surfacing + adaptive paths sections, paste under section 2 "Learn Hub Flow"
7. Open VISION_AUDIT_5_EVENTS.md, extract event lifecycle (pre/during/post), paste under section 2 "Events Flow"
8. Open VISION_AUDIT_6_ADMIN.md, extract admin dashboard, fulfillment, and CRM sections, paste under section 3 "Admin Workflow Loop"
9. Open VISION_AUDIT_7_TECHNICAL.md, extract "Unified activity stream" section, paste under section 4
10. Extract "Product relationships" section, paste under section 4
11. Extract "Offline-first pattern" section, paste under section 4
12. Save file

---

### 1.6 Create SITE_MAP.md

**Purpose:** Hierarchical map of every route, every page, every action by user tier.

**Skeleton:**
```markdown
# Site Map — Routes & Actions by Tier

**Generated from:** AUDIT.md + FUNCTIONAL_AUDIT.md (current state) + LAUNCH_CHECKLIST.md (hidden sections) + plan/* (planned features)

**Scope:** All public-facing routes, account pages, admin pages, hidden/in-progress features.

---

## Public-Facing Routes (Guest + Member)

### Home (`/`)
- Magazine feed (hero article, recent pieces)
- Network directory strip (featured stores)
- Search global (teas, articles, events, guides)
- Newsletter signup

### Magazine (`/magazine`)
- Article list (filter by category, tag, author)
- Article detail (`/article/:slug`) — 4:5 paginated reader
- Related articles sidebar
- Glossary (tap terms in articles)

### Learn Hub (`/learn`)
- Browse guides (tea types, brewing, tasting language)
- Glossary (searchable)
- Practice challenges (if logged in)
- Adaptive recommendations (if logged in)

### Shop (`/shop`, `/store/:storeSlug`)
- Product listing (with Flavor Map for discovery)
- Flavor Map interface (taste-based navigation)
- Guided entry flow (for new tea drinkers)
- Product detail (brewing guide, reviews, price-per-gram, stock status)
- [Shopping cart + inquiry flow — see Order flow below]

### Events (`/events`)
- Event listing (filter by date, type, location)
- Event detail (date, seat count, guest list, tea menu if public)
- RSVP flow (attendee capture)

### Consult (`/consult`)
- Question-driven form
- Path cards (recommended services)
- Service content (consulting offerings)

### About (`/about`)
- Adrian's story
- Vision (product philosophy)
- Sourcing ethics
- Contact

### Find a Table (`/find-a-table`)
- Network store grid (all public stores)
- Store detail (hours, address, contact)
- Map view (if available)

---

## Account Pages (Member tier + Owner tier)

### Auth Flow
- Login page (`/auth/login`)
- Password reset flow
- Signup (with invite code or public registration)

### Orders (`/account/orders`)
- Order list (status, date, total)
- Order detail (items, payment, fulfillment status)
- Track shipment (if applicable)

### Tasting Journal (`/account/journal`)
- Journal list (past tastings)
- Journal entry detail (tea, notes, date, location)
- Add new entry
- Filter / search by tea

### Samples (`/account/samples`)
[If samples feature is public; otherwise hidden until Phase X]

### Settings (`/account/settings`)
- Profile (name, email, preferences)
- Password change
- Notification preferences
- Delete account

---

## Admin Pages (Owner + Manager tier)

[Generated from FUNCTIONAL_AUDIT.md §"Admin features" — create subsections for each admin section]

### Admin Dashboard (`/admin`)
- Quick stats (revenue, orders, events)
- Recent orders
- Inventory alerts

### Inventory (`/admin/inventory`)
- Product list (by category, stock level)
- Product detail (edit metadata, pricing, photos, brew guide)
- Stock movements (ledger)
- Reorder workflow

### Orders (`/admin/orders`)
- Order list (status: pending, ready, shipped)
- Order detail (fulfill, invoice, track)

### Events (`/admin/events`)
- Event list (upcoming, past)
- Event detail (create/edit, attendee list, tea menu, post-session archive)
- Create new event

### Customers (`/admin/customers` or CRM tab)
- Customer list (lifetime value, orders, events attended)
- Customer detail (notes, interactions, segments)

### Team (`/admin/team` or Members & Access)
[From NETWORK_ROLLOUT_PLAN.md — Members & Access destination `/admin/access`]
- Member list (by role, account)
- Add member / invite
- Role management

### Magazine Editor (`/admin/magazine`)
[From plan/magazine-editor-spec.md]
- Article list (draft, published, scheduled)
- Article editor (D1 storage, Smart Paste, AI structuring, block rendering)

### Network & Wholesale (`/admin/network`)
[From NETWORK_ROLLOUT_PLAN.md — Phase 1B destination `/admin/network`]
- Tea profiles (canonical, cross-store)
- Listings (per-account copies of profiles)
- Edit suggestions (pending, approved)
- Wholesale orders (as supplier, as buyer)
- Cross-pollination queue

---

## Hidden / In-Progress Routes

[From LAUNCH_CHECKLIST.md — features hidden until ready]

### Community (`/community`)
- Status: Hidden until Phase X
- Plan: Member directory, shared tastings, discovery

### For Your Space (`/for-your-space`)
- Status: Hidden until Phase X
- Plan: Tea house operator resources

### Start Here (`/start-here`)
- Status: Hidden (or placeholder)
- Plan: New member onboarding flow

---

## Tier Visibility Matrix

|  | Guest | Member | Owner | Master | Platform Admin | Adrian |
|---|---|---|---|---|---|---|
| Home | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Magazine | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Learn | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Shop | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /account/journal | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| /account/orders | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| /admin | – | – | ✓ | ✓ | ✓ | ✓ |
| /admin/team | – | – | ✓ | ✓ | ✓ | ✓ |
| /admin/network | – | – | ✓ | ✓ | ✓ | ✓ |

---

## Footer
**Last updated:** 2026-04-27 (Layer 1 audit)  
**Sources:** AUDIT.md, FUNCTIONAL_AUDIT.md (current state), LAUNCH_CHECKLIST.md (hidden sections), NETWORK_ROLLOUT_PLAN.md (Phase 1B routes), plan/* (upcoming features).
```

**Sources (with anchors):**
- AUDIT.md §"Public features" + routes (all public pages) → "Public-Facing Routes"
- FUNCTIONAL_AUDIT.md §"Navigation model" (all routes) → "Public-Facing Routes"
- AUDIT.md §"Admin" + FUNCTIONAL_AUDIT.md §"Admin features" → "Admin Pages"
- LAUNCH_CHECKLIST.md §"Hidden sections" (Community, For Your Space, Start Here) → "Hidden / In-Progress Routes"
- NETWORK_ROLLOUT_PLAN.md §Step 0 "Two destinations" (line 71) → `/admin/access` reference
- NETWORK_ROLLOUT_PLAN.md §Step 1+ (catalog, wholesale, adoption flows) → `/admin/network` reference
- plan/magazine-editor-spec.md (title, scope) → `/admin/magazine` reference

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/SITE_MAP.md`
2. Copy skeleton above
3. Open AUDIT.md, extract all public routes/pages, list under "Public-Facing Routes" (map each subsection — Home, Magazine, Learn, Shop, Events, Consult, About, Find a Table)
4. Open FUNCTIONAL_AUDIT.md, cross-check routes match (add any missing)
5. Open AUDIT.md, extract all admin pages, list under "Admin Pages"
6. Open LAUNCH_CHECKLIST.md, extract "Hidden sections" list, paste under "Hidden / In-Progress Routes"
7. Build "Tier Visibility Matrix" using NETWORK_ROLLOUT_PLAN.md tier model (Platform Owner, Platform Admin, Location Owner, Tea Master, Member, Guest) and visibility logic from ARCHITECTURE.md roles table
8. Save file

---

### 1.7 Rewrite INDEX.md

**Purpose:** Navigation hub for docs readers. Clarify what each major doc is for.

**Content (rewrite, don't merge):**
```markdown
# Teajia Documentation — Index

Start here for orientation. Documentation is organized by purpose, not by type.

---

## For Everyone

### VISION.md
**What:** What Teajia is, who uses it, why it exists.  
**Read if:** You're new to the platform or want to understand the core philosophy.  
**Length:** ~15 min

### ROADMAP.md
**What:** What's being built next, organized by phase. Current blockers and dependencies.  
**Read if:** You want to know what's coming, or why a feature isn't done yet.  
**Length:** ~20 min

### FLOWS.md
**What:** End-to-end user journeys (Shop → Compass → Learn → Events → Admin). Connects features to experiences.  
**Read if:** You're designing new features or want to understand how features relate to each other.  
**Length:** ~25 min

---

## For Product / Design

### STATE_OF_THE_SITE.md
**What:** Snapshot of current platform (March 2026 audit). What works, what doesn't, design system gaps, architecture issues.  
**Read if:** You're prioritizing work, designing fixes, or understanding why something feels broken.  
**Length:** ~45 min

### ACTIVE_BRIEFS.md
**What:** Index of in-progress feature specs and critical restore procedures.  
**Read if:** You're implementing a feature or need to unblock someone waiting on a decision.  
**Length:** ~15 min

### SITE_MAP.md
**What:** Every route, every page, every action, organized by tier and section. Quick reference for "does this page exist?"  
**Read if:** You're adding a link, designing navigation, or building a feature that touches multiple sections.  
**Length:** ~10 min (skimmable)

### COLOR_RULES.md
**What:** Design token system, safe colors, theme rules. Updated design contract.  
**Read if:** You're writing CSS or adding a new color to the design system.  
**Length:** ~20 min

### LAUNCH_CHECKLIST.md
**What:** PREVIEW_MODE gates, hidden sections, what's stubbed, restore procedures.  
**Read if:** You need to hide a feature, stub a page, or understand why something doesn't work in production.  
**Length:** ~10 min (task-specific)

---

## For Engineering

### ARCHITECTURE.md
**What:** Technical decisions (multi-tenancy, auth, roles, bundles, data model). Locked decisions from Phase 1A–B.  
**Read if:** You're implementing any feature that touches accounts, authorization, or cross-store concerns.  
**Length:** ~40 min

### CHANGELOG.md
**What:** What shipped, by date.  
**Read if:** You want to know when something went live, or what was included in a release.  
**Length:** ~5 min (skimmable)

---

## For Strategic Planning / Leadership

### VISION.md
**What:** What Teajia is. Read this first.

### ROADMAP.md
**What:** What's next, organized by phase.

### NETWORK_ROLLOUT_PLAN.md
**What:** Phase 1B in detail: profiles, listings, wholesale, cross-pollination. Locked decisions.  
**Location:** docs/NETWORK_ROLLOUT_PLAN.md (living doc; not consolidated)  
**Length:** ~60 min

### MULTI_STORE_PLAN.md
**What:** Phase 1A (shipped): accounts, roles, multi-tenancy. Reference for how the platform was restructured.  
**Location:** docs/MULTI_STORE_PLAN.md (living doc; not consolidated)  
**Length:** ~40 min

---

## Implementation Specs (In Active Use)

Each of these is a standalone spec for a feature currently being built. Not consolidated; read directly.

- **plan/event-system-v2.md** — Event flow redesign (approval-based RSVP, flyer-first)
- **plan/magazine-editor-spec.md** — Admin article editor (D1, Smart Paste, AI structuring)
- **plan/tea-compass-spec.md** — Compass complete spec (capture, tasting, sourcing, offline)
- **plan/consult-redesign-spec.md** — Consult page redesign (question-driven, path cards)
- **plan/learn-archive-redesign.md** — Learn section overhaul (visual abundance, carousels)
- **plan/teajia-tasting-usage-guide.md** — Tasting taxonomy & data model (102 terms)
- **plan/event-rsvp-capacity-engine.md** — RSVP system (tiered capacity, magic links, waitlist)

---

## Living Reference Docs (Not Consolidated)

- **PERSONAS.md** (docs/brief/) — 10 audience personas and their needs
- **OFFER_AND_STRATEGY.md** (docs/brief/) — What Teajia offers each persona; strategic focus
- **DEVELOPMENT_PRIORITIES.md** (docs/brief/) — Ranked feature backlog (30 items, effort estimates)
- **NETWORK_UI_BRIEF.md** — Design language for network surfaces (catalog, listings, members, wholesale)
- **MAGAZINE_PLAN.md** — Magazine UI spec: 4:5 format, page transitions, grid layout
- **ORDER_SYSTEM_PLAN.md** — Order inquiry flow, payment methods, fulfillment (locked spec)
- **TODO.md** — Living todo: committed work, ideas, loose ends

---

## Archived Docs (Superseded)

For reference only. Original work is now in consolidated docs above.

- **docs/_archive/MEMBERS_AND_ACCESS_BRIEF.md** — Merged into NETWORK_ROLLOUT_PLAN.md (2026-04-26)
- **docs/_archive/PHASE_1B_PLAN.md** — Merged into NETWORK_ROLLOUT_PLAN.md (2026-04-26)
- **docs/_archive/ARTICLE_UNIFICATION_PLAN.md** — Shipped (phases A–D); content moved to CHANGELOG.md
- **docs/_archive/[audit shards]** — AUDIT.md, FUNCTIONAL_AUDIT.md, ARCHITECTURE_AUDIT.md, UI_UX_AUDIT.md, DESIGN_SYSTEM_AUDIT.md, WEBSITE_TEARDOWN.md, VISION_AUDIT_0–3 — Consolidated into STATE_OF_THE_SITE.md and FLOWS.md

---

## How to Use This Index

1. **Find what you need:** Look at the section header that matches your role (Everyone, Product, Engineering, Leadership)
2. **Read the blurb:** Each doc has a one-sentence "what" and a "read if" condition
3. **Follow the length:** Use the time estimate to pick the right doc (don't read a 45-min doc when you need a 5-min answer)
4. **Jump to another doc:** Every doc has a footer with sources and related reading

---

**Last updated:** 2026-04-27  
**Next audit:** Target Phase 1B completion (estimated 2026-05-31) for a follow-up consolidation documenting Phase 1B decisions and shipping milestones.
```

**Execution steps:**
1. Rewrite `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/INDEX.md` entirely with the content above
2. Save file

---

### 1.8 Rewrite VISION.md (tight version)

**Current version is good — keep as-is for now.** Do not modify. It's already at the right length (~60 lines) and clarity. INDEX.md now points to it as the entry point.

**Execution step:** Skip. No changes needed.

---

### 1.9 Rewrite ROADMAP.md (trim shipped items)

**Current version is living and good — trim only stale content.** Move "Phase 0" items marked DONE to CHANGELOG.md (new Phase 0 entry).

**Execution steps:**
1. Open `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/ROADMAP.md`
2. Scan Phase 0 sections (0.1–0.6) for any items explicitly marked as "DONE" or with a ship date
3. Move those items to CHANGELOG.md entry "2026-04: [shipped item]"
4. In ROADMAP.md, delete the checkboxes and replace with "SHIPPED" status note on those sections
5. Save file

---

### 1.10 Prune LAUNCH_CHECKLIST.md

**Current version is good — trim only the detailed feature specs.** Keep restore procedures and gating conditions.

**Execution steps:**
1. Open `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/LAUNCH_CHECKLIST.md`
2. Scan all sections; identify "restore procedure" vs. "feature spec" content
3. Keep restore procedures (PREVIEW_MODE enable/disable, hidden sections list, unblock conditions)
4. Delete detailed feature specs or feature design (point to ACTIVE_BRIEFS.md instead)
5. Save file

---

## Phase 2 — Archive superseded files

Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/_archive/` directory (if it doesn't exist).

For each file below, move to `_archive/` and prepend a one-line stamp at the very top (before the existing # heading):

**Template stamp:**
```
> SUPERSEDED 2026-04-27 by [target docs]. See [reason].
```

**Files to archive:**

1. **MEMBERS_AND_ACCESS_BRIEF.md**
   - Stamp: `> SUPERSEDED 2026-04-26 by docs/NETWORK_ROLLOUT_PLAN.md and docs/ARCHITECTURE.md. Tier model, bundles, and access design fully merged.`
   - Move to: `docs/_archive/MEMBERS_AND_ACCESS_BRIEF.md`

2. **PHASE_1B_PLAN.md**
   - Stamp: `> SUPERSEDED 2026-04-26 by docs/NETWORK_ROLLOUT_PLAN.md. Profiles, listings, wholesale, and cross-pollination work are now in the primary Phase 1B plan.`
   - Move to: `docs/_archive/PHASE_1B_PLAN.md`

3. **ARTICLE_UNIFICATION_PLAN.md**
   - Stamp: `> SHIPPED 2026-04-25. Phases A–D complete; legacy article system removed. See docs/CHANGELOG.md for shipped entry.`
   - Move to: `docs/_archive/ARTICLE_UNIFICATION_PLAN.md`

4. **AUDIT.md**
   - Stamp: `> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md. Platform audit (March 2026) consolidated into unified state snapshot.`
   - Move to: `docs/_archive/AUDIT.md`

5. **FUNCTIONAL_AUDIT.md**
   - Stamp: `> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md. Functional teardown (March 2026) consolidated into unified audit.`
   - Move to: `docs/_archive/FUNCTIONAL_AUDIT.md`

6. **ARCHITECTURE_AUDIT.md**
   - Stamp: `> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md and docs/ARCHITECTURE.md. Silos and cross-linking gaps are in STATE_OF_THE_SITE; technical decisions in ARCHITECTURE.md.`
   - Move to: `docs/_archive/ARCHITECTURE_AUDIT.md`

7. **UI_UX_AUDIT.md**
   - Stamp: `> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md. Typography and navigation issues consolidated into unified design audit.`
   - Move to: `docs/_archive/UI_UX_AUDIT.md`

8. **DESIGN_SYSTEM_AUDIT.md**
   - Stamp: `> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md. Triple-config drift and 169 inconsistencies detail is in unified design audit; fixes tracked in ROADMAP.md Phase 0.3.`
   - Move to: `docs/_archive/DESIGN_SYSTEM_AUDIT.md`

9. **WEBSITE_TEARDOWN.md**
   - Stamp: `> SUPERSEDED 2026-04-27 by docs/STATE_OF_THE_SITE.md. First impression audit (visual hierarchy, brand cohesion) consolidated into unified state snapshot.`
   - Move to: `docs/_archive/WEBSITE_TEARDOWN.md`

10. **VISION_AUDIT_0_INDEX.md**
    - Stamp: `> SUPERSEDED 2026-04-27 by docs/ROADMAP.md and docs/FLOWS.md. Vision audit index and priority roadmap are superseded by ROADMAP; strategic flows consolidated into FLOWS.md.`
    - Move to: `docs/_archive/VISION_AUDIT_0_INDEX.md`

11. **VISION_AUDIT_1_OVERVIEW.md**
    - Stamp: `> CONSOLIDATED 2026-04-27 into docs/FLOWS.md §1. Core "Tea Practice OS" thesis and three missing layers (timeline, knowledge graph, social) preserved in FLOWS.md.`
    - Move to: `docs/_archive/VISION_AUDIT_1_OVERVIEW.md`

12. **VISION_AUDIT_2_SHOP.md**
    - Stamp: `> CONSOLIDATED 2026-04-27 into docs/FLOWS.md §2. Shop discovery flows (Flavor Map, guided entry, product page) now in unified buyer journey.`
    - Move to: `docs/_archive/VISION_AUDIT_2_SHOP.md`

13. **VISION_AUDIT_3_COMPASS.md**
    - Stamp: `> CONSOLIDATED 2026-04-27 into docs/FLOWS.md §2. Compass sourcing patterns and vision now in unified buyer journey.`
    - Move to: `docs/_archive/VISION_AUDIT_3_COMPASS.md`

14. **teajia-complete-strategy.md** (in plan/)
    - Stamp: `> ARCHIVED 2026-04-27. Pre-VISION.md era strategy doc. Content now in docs/VISION.md and docs/brief/PERSONAS.md.`
    - Move to: `docs/_archive/teajia-complete-strategy.md`

15. **teajia-strategy-expansion.md** (in plan/)
    - Stamp: `> ARCHIVED 2026-04-27. Pre-VISION.md era strategy doc. Content now in docs/VISION.md and docs/brief/PERSONAS.md.`
    - Move to: `docs/_archive/teajia-strategy-expansion.md`

**Execution steps:**
1. Create `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/_archive/` directory
2. For each file above: move file to `_archive/`, open it, add stamp line at the very top (before existing `#` heading), save
3. Verify all 15 files are in `_archive/`

---

## Phase 3 — Delete (only if truly worthless)

**Files to delete or trim:**

1. **TEAJIA_PALETTES.md**
   - **Status:** STALE (superseded by later audits). Reference DESIGN_SYSTEM_AUDIT.md instead.
   - **Action:** Delete OR trim to ~10 lines: keep only the final "approved tokens" list, reference DESIGN_SYSTEM_AUDIT + COLOR_RULES for context
   - **Recommendation:** DELETE (it's subsumed by DESIGN_SYSTEM_AUDIT and COLOR_RULES)

2. **VISION_AUDIT_4_LEARNING.md, VISION_AUDIT_5_EVENTS.md, VISION_AUDIT_6_ADMIN.md, VISION_AUDIT_7_TECHNICAL.md**
   - **Status:** DEFERRED (content is preserved in FLOWS.md and ARCHITECTURE.md; not consolidated into STATE_OF_THE_SITE because they're forward-looking strategy, not current-state audit)
   - **Action:** KEEP in docs/ as reference (they're short, focused, and used for future planning)

**Execution steps:**
1. Delete `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/docs/TEAJIA_PALETTES.md`
2. Keep VISION_AUDIT_4–7 in docs/ (do not archive; they're deferred planning docs, not redundant with current state)

---

## Phase 4 — Update references

### In root CLAUDE.md:
1. Open `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/CLAUDE.md`
2. Find any reference to docs/AUDIT.md or docs/ARCHITECTURE_AUDIT.md or any consolidated doc
3. Update references to point to new consolidated docs:
   - `docs/AUDIT.md` → `docs/STATE_OF_THE_SITE.md`
   - `docs/ARCHITECTURE_AUDIT.md` → `docs/ARCHITECTURE.md`
   - `docs/VISION_AUDIT_*.md` → `docs/FLOWS.md`
   - `docs/LAUNCH_CHECKLIST.md` → `docs/ACTIVE_BRIEFS.md` (for in-progress specs) or keep if it's about restore procedures
4. Add a link to `docs/INDEX.md` at the top ("Start with the docs index")
5. Save file

### In src/CLAUDE.md (if it exists):
1. Check if `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia/src/CLAUDE.md` exists
2. If yes, repeat above: update consolidated doc references
3. Save file

### Grep for broken doc links in codebase:
1. Run: `grep -r "docs/AUDIT.md\|docs/ARCHITECTURE_AUDIT\|docs/VISION_AUDIT" /Users/adrianrasmussen/Documents/Files/2\ Areas/Coding/teajia/ --include="*.md" --include="*.ts" --include="*.tsx" 2>/dev/null | head -20`
2. For any matches outside docs/, update the reference to point to new consolidated doc
3. Note any matches; if many, this indicates docs that are heavily cross-linked and may need special handling

---

## Phase 5 — Verification checklist

- [ ] CHANGELOG.md created and has entries for shipped work (ARTICLE_UNIFICATION, MULTI_STORE, any Phase 0 items Adrian marks DONE)
- [ ] ARCHITECTURE.md created and contains full sections 1–4 with all tables, flow diagrams, locked decisions from MULTI_STORE_PLAN + NETWORK_ROLLOUT_PLAN + VISION_AUDIT_7 + _audit/01–03
- [ ] STATE_OF_THE_SITE.md created and has all 5 sections (Executive Summary, Functional Inventory, Design System, Architecture, Strategic Implications) with no information from AUDIT, FUNCTIONAL_AUDIT, or other 8 audit shards missing
- [ ] FLOWS.md created with all 4 sections (Thesis, Buyer Journey 4-stage, Admin, Technical Enablers) linking all VISION_AUDIT_1–7 content
- [ ] ACTIVE_BRIEFS.md created with in-progress specs (Event System, Compass Phase 1, Tasting Journal) and TODO items
- [ ] SITE_MAP.md created with all routes, pages, visibility matrix
- [ ] INDEX.md rewritten as navigation hub (not merged docs)
- [ ] ROADMAP.md trimmed (shipped Phase 0 items moved to CHANGELOG or marked "SHIPPED")
- [ ] LAUNCH_CHECKLIST.md pruned (detailed feature specs removed or pointed to ACTIVE_BRIEFS)
- [ ] docs/_archive/ directory created
- [ ] All 15 superseded/archived files moved to _archive/ with supersede stamps
- [ ] TEAJIA_PALETTES.md deleted
- [ ] VISION_AUDIT_4–7 kept in docs/ (not archived)
- [ ] Root CLAUDE.md updated with references to new docs (docs/INDEX.md as entry point, consolidated doc links)
- [ ] No broken doc links in codebase; grep for "docs/AUDIT.md" etc. returns only archived files or _archive/ references

---

## Order of Execution (Layer 3)

1. Create CHANGELOG.md (shipped items reference)
2. Create ARCHITECTURE.md (foundational for other files)
3. Create STATE_OF_THE_SITE.md (consolidates 8 audits)
4. Create FLOWS.md (consolidates VISION_AUDIT_1–7)
5. Create ACTIVE_BRIEFS.md (consolidates in-progress work)
6. Create SITE_MAP.md (generated from audits + plans)
7. Rewrite INDEX.md (navigation hub)
8. Rewrite ROADMAP.md (trim shipped)
9. Prune LAUNCH_CHECKLIST.md (keep restore only)
10. Create docs/_archive/ directory
11. Archive 15 files (move + add stamps)
12. Delete TEAJIA_PALETTES.md
13. Update root CLAUDE.md
14. Check for broken links via grep
15. Run verification checklist

---

## Key Decisions Locked for Layer 3

1. **Deduplicate by content section, not by entire file.** If AUDIT.md and FUNCTIONAL_AUDIT.md have overlapping tables, merge the tables (drop duplicates), don't include both.
2. **Preserve original file footers in consolidated docs** for traceability (e.g., "Sources: MULTI_STORE_PLAN.md, NETWORK_ROLLOUT_PLAN.md, _audit/01–03").
3. **Don't delete _audit/01–03** — they're concise architecture reference docs; they feed ARCHITECTURE.md but stand alone.
4. **Keep VISION_AUDIT_4–7** in docs/ (not archived) because they're deferred planning vision, not current-state audit.
5. **Keep plan/* implementation specs untouched** — they're detailed references used by builders; only summarize them in ACTIVE_BRIEFS.
6. **Keep brief/* persona and strategy docs untouched** — they're living reference docs for planning and hiring.
7. **INDEX.md is a rewrite, not a merge** — it's a navigation tool with links and blurbs, not a compilation of other docs.

