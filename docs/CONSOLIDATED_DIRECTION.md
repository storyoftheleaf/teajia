# Teajia: Consolidated Direction (July 2026)

> This document replaces 57 accumulated planning docs. It is the single directional list. Philosophy stays in `VISION.md`; ship history stays in `CHANGELOG.md`. Everything else folds into the nine tracks below, per the disposition table at the end.
>
> **Working layer:** each track has a build-queue doc in [`tracks/`](tracks/) with verified file references and done-when criteria. Those are the checklists you actually work from; this doc is the map above them.
>
> **Verification note (2026-07-11):** while authoring the track docs, three items listed as open below were found already shipped and were moved to "Already shipped" in their track doc: cross-link rendering (Track 9), the Compass draft-promotion failure fix (Track 1 / P4), and most of the China sign-in fallback (Track 4 / C6). The track docs are correct where they differ from the prose below.

---

## Executive read

**The platform described in VISION.md exists.** Multi-tenancy, the network rollout, the stock spine, the unified article engine, events v2, Curate, the tasting journal, 40+ MCP tools: all shipped. Nobody but Adrian has ever used it. Phase 0.6 ("onboard first trusted users") has been open since April while three more months of infrastructure landed. That is the drift.

**The call: stop building foundations, start onboarding humans.** This week, fix the two July-audit criticals (confirm-picks invoices overcharge up to 100x; tapping an article from the journal blanks the entire app). Then the cycle belongs to people and content: the Australia owner walking the launch checklist, trusted tea friends on Curate, and the editorial pass only Adrian can do (keeper templates, real articles, Barry's contributor profile). No new engineering tracks open until a second person is living on the platform. Everything not listed as open below is shipped, killed, or archived.

---

## Track 1 — Launch Integrity

*Make it true before it's public.*

The May friction sweep and April audit closed cleanly, but the July audit found what matters more: bugs a real user hits in their first week. An invoice that charges 100x. An article tap that blanks the app. A "reading history" that never recorded anything. Sign-in verification that silently never sends a code. None of this is polish; it is the difference between a platform and a demo. This track is the gate in front of every other track.

**Shipped:** All 24 FIX_QUEUE fixes (PR #172), all 17 RSVP friction items, all 37 April audit findings, design-system Phases A–D, June structural remediation (verify-code echo gated, CI lint gates), UI consistency rules 1/3/8/9 lint-enforced.

**Open, still valid (in order):**
1. **K1: confirm-picks invoice inflation.** `worker/src/index.ts:16204` stores lineTotal as `price_at_sale`; `OrdersView.tsx:847` multiplies by quantity again. Fix both, then repair existing corrupted invoices. Data-corrupting; nothing ships before this.
2. **R1: journal article tap blanks the app.** `App.tsx:428` sets `viewState='PAGE_READER'` but the overlay was removed (`App.tsx:1106`). Route to the live reader instead.
3. **R2–R4, R6: reading history + saved stories are dead surfaces, and live pages link to unpublished drafts** (Atlas → `/read/history`, Porcelain → `/read/earth-water-fire`). Wire them or remove them; no third option.
4. **Verification-code delivery (WhatsApp/email).** Until this ships, production sign-in verification and event verification are off by design. Blocks Track 2 (people).
5. **Per-order detail page.** Order history links to a page that does not exist.
6. **Curate integrity trio:** P3 localStorage not partitioned per account (account-switch bleeds captures across accounts), P4 silent promotion failure, P1 dead nav children under Sources/Collection.
7. **R5** owner edit pill missing on cold load; **R8** dead reader code sweep (ReadingStreak, Reader.tsx, SinglePageRenderer, ReadPage, 10+ orphans).
8. Final 3 `.pill-*` action buttons in PlatformAdminView → `<Button>`, then promote lint Rule 9 to blocking.

**Killed:** Nothing here is optional; this is the one track with no kills.

**Source docs collapsed here:** AUDIT_2026-07_READ_CURATE_CHINA.md (Read/Curate tracks), AUDIT_2026-05.md, FIX_QUEUE.md, FRICTION_REVIEW.md, VISUAL_REVIEW.md, RSVP_FRICTION_AUDIT.md, UI_CONSISTENCY.md, DESIGN_SYSTEM_PHASING.md.

---

## Track 2 — The First Operator & Trusted Users

*The network is built. Put someone in it.*

Every phase doc since April says "multi-account is next." It is not next; it shipped in March, three weeks before the roadmap that called it "Next" was written. The Launch Center, member presets, the Australia account, `au.teajia.com`, the stock spine, personal cellars, standalone shelves: all live. What has never happened is a second human. Every remaining item on the Australia checklist is a people step, not a code step. This track is the proof of the entire business model, and it is currently free.

**Shipped:** Multi-store Phase 1A, all 6 network rollout steps (profiles, listings, catalog browse, suggestions, wholesale schema, adoption queue), Launch Center with 6 staged audits, Australia account seeded, `/store/:slug` routing, stock spine steps 1–5 (owner-per-row, curation, master view, cellar, public shelf), role-adaptive Your Table (Reader/Launchpad/Staff), NoMembershipGate.

**Open, still valid (in order):**
1. **Run the Australia checklist end-to-end:** create the owner user, profile (logo, WhatsApp, tagline), opening stock CSV, invite staff, first event, verify storefront desktop + mobile, first WhatsApp order fulfilled, flip `public_enabled`. One sitting with Jesse; the playbook is written.
2. **Phase 0.6, open since April:** Curate access for trusted tea friends, events with real guests, collect feedback. This validates Curate before anything network-shaped matters.
3. **Stock spine verification follow-ups:** run `npm run test:mobile`, confirm migrations 092–094 applied to prod D1.
4. **Render the readiness first door.** `buildFirstDoorReadiness` is computed but never shown; new operators get no guided first step.
5. **Wholesale: finish or fold.** Big UI + schema, orphaned tables, loop never closed. If Australia sources through Adrian, finish the order loop that week; if not, delete it. Decide once.
6. When (not before) a second operator exists: trust-tier display, pricing-discipline warning, Tea Master storefront variant, mobile tests for `/admin/network/*`, bench tiles for network destinations.

**Killed:** Discovery fallback, network directory, guest portability, verification badges (Roadmap Phases 4–5). Correct instinct, wrong decade; premature until 2+ stores with 50+ teas. Not deleted from the vision, just off the list.

**Source docs collapsed here:** MULTI_STORE_PLAN.md, NETWORK_ROLLOUT_PLAN.md, NETWORK_UI_BRIEF.md, AUSTRALIA_LAUNCH_PLAYBOOK.md, your-table-completion-plan.md, ROADMAP.md (Phases 1–5).

---

## Track 3 — Read & the Editorial Engine

*The code stopped being the blocker in June. The content is.*

Article unification is done: one D1 article engine, Read as the live home, Magazine archived, edge SEO meta live, the editor with Smart Paste working. Adrian has interviews and imagery ready since April, waiting on one thing that has been "Stage 0, awaiting Adrian's keeper list" for three months: an editorial pass no agent can do. The direction is a content sprint framed as such, plus the contributor layer that makes the magazine a community offering rather than a solo blog.

**Shipped:** D1 articles + block editor + Smart Paste, article unification Phases A–D (legacy reader deleted), immersive scroll reader, 4:5 reader architecture per MAGAZINE_PLAN's locked decisions, edge meta rewriting for link previews, Article JSON-LD, contributor schema (migration 059) + public `/people/:slug` page rendering 8 of 15 sections, 5 pilot articles migrated.

**Open, still valid (in order):**
1. **Adrian's pass: pick 1–3 reference magazines, curate ~20 keeper templates**, then an agent polishes each mechanically and wires the editor dropdown. Oldest open item on the books; it gates the public face.
2. **Publish the interview archive.** Migrate real articles into D1. This is writing and layout, not engineering.
3. **Contributor editor, steps 3–5:** admin fields (beginnings/now/inspirations/closing/links), author picker replacing freetext `author_id`, pull-quote fields. Then **publish Barry** to validate the feature.
4. Contributor later waves (portrait, hands-on attribution, voice clip, hosting, seasonal calendar): only after Barry proves the shape.
5. Magazine editor AI layer ("Structure with AI" button, per-block rewrite): nice-to-have, build when article volume justifies it.
6. **Advise/Learn spec reconciliation.** Both redesign specs (path cards, carousels, Community Voices) were consciously simplified away in the shipped pages. Call it: the shipped simpler pages ARE the design. Archive both specs, delete orphaned `ServiceContent.tsx`, keep only the content debts (Advise portfolio images and real projects, brewing guide pages for the QR cards).

**Killed:** From VISION_AUDIT_4: adaptive learning paths, skill badges, practice challenges, audio layer, spaced repetition, UGC pipeline. All on the DO-NOT-BUILD list; the audit predates the vision doc that killed them. Salvaged from it: glossary tooltips (structure exists, small win) and Learn↔Shop links (Track 9).

**Source docs collapsed here:** MAGAZINE_PLAN.md, magazine-editor-spec.md, CONTRIBUTOR_PROFILES_PLAN.md, SEO_EDGE_META_PLAN.md, VISION_AUDIT_4_LEARNING.md, learn-archive-redesign.md, consult-redesign-spec.md, MAGAZINE_WRITING_SURFACE_SPEC.md (kept separately as an external-tool spec, build on demand).

---

## Track 4 — China Reachability

*The tool must work where the tea is.*

Adrian sources in mainland China. A sourcing tool that fails behind the GFW fails at its primary place of use. The July audit's China track is half-closed (same-origin media proxy, PDF fonts, retry logic shipped); the remaining blockers are third-party dependencies the site never needed: Unsplash images, hardcoded API origins, Google-only sign-in, wa.me-only checkout.

**Shipped:** C1 `media.teajia.co` same-origin image proxy, C3 PDF font fix, GFW retry logic, `api.teajia.com` domain.

**Open, still valid (in order):**
1. **C2: rehost ~30 Unsplash/picsum images** (photo essays, product thumbs, seed data) onto owned media.
2. **C4: kill hardcoded `https://api.teajia.com`** in BriefingPage/McpPage (also a CSP violation).
3. **C6: OTP or password sign-in fallback** for all five auth surfaces; Google OAuth is blocked there. Depends on Track 1's code delivery.
4. **C7: WeChat checkout fallback decision.** wa.me is blocked; decide between a WeChat contact path or an explicit email-first fallback for China visitors. The inquiry model survives either way.
5. **C5: MCP reachability.** Proxy `/mcp` + `/mcp/public` through the reachable origin, or explicitly accept them as unreachable from China and document it.
6. **Verify the worker→Groq voice leg from China**; save raw audio as fallback when Groq is unreachable.

**Source docs collapsed here:** AUDIT_2026-07_READ_CURATE_CHINA.md (China track).

---

## Track 5 — Curate & Personal Tea Memory

*One spine, two ends: Adrian's sourcing intelligence and the member's quiet record.*

The May pivot settled the identity question for good: Curate is the admin sourcing tool at `/admin/compass`; the Tasting Journal is the member's memory at `/account/journal`. The Discovery profile connects them. The one loop still open is the whole point of the human-curation model: members star their own notes, Adrian promotes the best onto product tastings with attribution. That loop replaces reviews, ratings, and aggregation forever. Underneath, two deferred cleanups from the pivot are now debt: the parallel `tea_compass_entries` table and ungated worker handlers.

**Shipped:** Curate capture through Phase 11 (photo/voice/parse/verdict/promotion, capture card redesigned this week), sample-minimum capture + permanent bag photos, tasting journal with the one-CustomerTasting-per-tea model, tasting events (join codes, guest auth, control room), Tea Discovery Phases 1–2 + evolution loop (observed palate from the journal), stock spine personal cellar, journal as the member surface.

**Open, still valid (in order):**
1. **The starred-notes loop:** Phase 2 per-section voice capture → Phase 2b customer starring → Phase 3 `/admin/community-impressions` promote/dismiss queue with attribution. Build it as one arc; Track 5 is authoritative and the earlier detailed notes are archived.
2. **Schema unification:** orphan-entry audit, migrate `tea_compass_entries` rows into `products` (`is_personal=1`, Draft), drop the parallel table. Removes a whole class of drift.
3. **Worker permission gate:** `requireBundle('catalog')` on all six compass handlers; today they only require account auth.
4. **Shared-tea acceptance writes to the wrong table** (`handleCompassAcceptShare` → compass, not journal); accepted shares never appear in the member's journal.
5. **Currency map unification:** ~9 duplicate symbol/label maps across Curate → one shared source.
6. **Journal brief alignment:** side-by-side note comparison on re-tasting, sort labels, empty-state link. Small, from TASTING_JOURNAL_BRIEF.
7. **"My Tea Life" personal timeline:** unify tastings, orders, favorites, events, reading into one quiet chronological archive (the vision's "memory" layer; also PA-REQ-004 and POST_AUDIT B2). A calm record, not a dashboard. This is the one genuinely new build in this track; sequence it after real users exist to have timelines.
8. Discovery deferred pair: drift visualization in Journey/Passport, per-article/per-product recommendation deep links.

**Killed:** COMPASS_SOCIAL_PLAN Phases 1A/1B/1D/2B/2C/2D/3A/3B/3C (member connections, QR table-share pages, taste-profile recommendation surfacing, feedback aggregation). The May pivot displaced the plan and the vision's no-social, no-aggregation principles bury it. The starred-notes loop above is the only survivor, deliberately reshaped as hand curation.

**Source docs collapsed here:** tea-compass-spec.md, COMPASS_SOCIAL_PLAN.md, compass-tasting-separation-followups.md, TASTING_JOURNAL_BRIEF.md, TASTING_EVENT_PLAN.md, TEA_DISCOVERY.md, and the archived docs/TODO Compass notes.

---

## Track 6 — Commerce in the Inquiry Model

*Not a checkout. A conversation with a paper trail.*

ORDER_SYSTEM_PLAN proposed a full customer-initiated order system; the vision and the shipped product both say no. WhatsApp checkout is the brand: every order is a relationship Adrian personally confirms. The direction is to deepen the invoice lifecycle around that conversation, so the numbers are right, the status is visible, and the customer's side of the story is complete. Most of it already exists; what remains is small and specific.

**Shipped:** Inquiry checkout (CART → INQUIRY → CONFIRM with reference + reassurance copy), invoice payment status (migration 073), order + sample history pages wired to the API, confirm-picks price scaling by amount, MCP invoice read/write tools, stock ledger + fulfillment path shared with the admin UI.

**Open, still valid (in order):**
1. **K1 fix** (owned by Track 1, listed here because it is the commerce trust floor).
2. **Per-order detail page** (also Track 1 item 5).
3. **Order confirmation copy pass:** the CONFIRM step works; the copy is still thin.
4. **Salvage decisions from ORDER_SYSTEM_PLAN, one sitting:** customer-visible status lifecycle (probably yes, it is the detail page), shipping-cost field on confirmation (maybe), per-account payment-method config and silent customer discounts (probably no at one store). Decide, then the plan archives clean.
5. **Invoice PDF/email delivery** (MCP Phase 2): stays deferred; download/share from admin covers today.

**Killed:** Model B customer-initiated checkout with quantity re-confirmation flow. Contradicts the vision's central commerce decision; superseded by the shipped inquiry system.

**Source docs collapsed here:** ORDER_SYSTEM_PLAN.md, FRICTION_REVIEW.md (C-P0 remainders), STRUCTURAL_AUDIT_2026-06-10.md (§5.2).

---

## Track 7 — Events & Gatherings

*The arc is built: invite, approve, gather, remember. Close the delivery gaps and the one loop that feeds the magazine.*

Events v2 shipped in full (approval flow, story cards, guest invites, journey, simple-mode creation), tasting events shipped in full (join codes, control room), and the RSVP friction audit closed all 17 items. What remains is that the system cannot yet reach out (codes and emails never send) and that the vision's single best content idea, event → recap → photo essay, still has no editor. The aspirational lifecycle features from the vision audits stay dead.

**Shipped:** Event System V2 end to end, simple-mode-by-default creation, gathering type + guest list visibility, tasting events + journal bridge, recap page at `/event/:slug/recap`, RSVP friction closure.

**Open, still valid (in order):**
1. **Code + email delivery** (shared with Track 1 item 4): verification codes, reminders, post-session summary emails. The system composes them; nothing sends.
2. **Post-session editor → photo essay** (POST_AUDIT B3, 2–3 days): the schema fields exist (`gallery_images`, `host_notes`, `energy`); build the composer. This is the editorial flywheel: event → essay → readership → attendance.
3. **Event map preview:** blocked on Adrian getting a Maps API key. Ten minutes of Adrian, then an agent finishes it.
4. **TicketCard with QR:** spec'd, unbuilt. Judge after the first real-guest events; likely not launch-blocking.

**Killed:** Event series with completion certificates, virtual events with shared timers, weather cards, live guided-tasting modes, attendee discussion threads (VISION_AUDIT_5). Phones stay in pockets; series gamification is Duolingo thinking.

**Source docs collapsed here:** event-system-v2.md, event-rsvp-capacity-engine.md, VISION_AUDIT_5_EVENTS.md, TASTING_EVENT_PLAN.md.

---

## Track 8 — Platform Hardening: Worker, MCP, Architecture

*Make it safe to hand to a second developer and a second store.*

One 18.9K-line worker file runs the whole business, 339 routes speak inconsistent error dialects, and the tenancy boundary that everything depends on has almost no tests. The June structural audit and the product-architecture packet are the same project seen twice; the packet's remaining phases were always hardening, not features, and they collapse into this track. The MCP layer is the standout of the last quarter (voice-operable store, public shop assistant); it needs one real-device verification and a WAF rule, then it is done for this era.

**Shipped:** Bundle enforcement closure + fail-closed auth (April), auth-boundaries test suite, SQL filter parameterization, account-scoped query keys + switch invalidation, contact-relationship taxonomy (migrations 069–070), product command routes by domain, 40+ MCP tools with scope tiering + durable confirmation tickets + public `/mcp/public` + OAuth with mobile-safe consent, `llms.txt` + JSON-LD, admin code-split Wave 1 (1.78 MB → 992 KB) with chunk-error recovery, CI-gated deploys with auto-applied migrations.

**Open, still valid (in order):**
1. **Tenancy-isolation test suite:** account A must not read account B's customers/events/invoices. Would have caught every June §1 finding; the precondition for Track 2 going public.
2. **Worker modularization:** split the monolith along the 7 identified seams (auth/products/invoices/customers/events/collections/samples). Do it before a second developer, not after.
3. **Error envelope standardization** to `{ error, code?, details? }` so the frontend stops pattern-matching strings.
4. **Code-split Wave 2** (~35 remaining static views, mechanical single PR) + Wave 3 idle prefetch of hot chunks.
5. **MCP closeout:** real-iPhone OAuth verification, Cloudflare WAF rate limit on `/mcp/public`.
6. **Authorization consistency debt:** customer routes split by relationship bundle (GET/PUT currently inconsistent), remove legacy `PUT /api/products/:id` fallback once command routes cover all fields, generated route-inventory script.
7. **Cleanup ladder, background pace:** ~25 orphaned tables (grep-verify, finish or drop), delete unused `tea-database` (13.5K lines), strictNullChecks forward-fix, timestamp format unification, distributed rate limiting, migration 017 duplicate resolution.
8. **Judged salvage from VISION_AUDIT_7 (written last week):** React Query staleTime config (yes, cheap), IndexedDB offline queue (yes when China trips resume), unified search endpoint (when a real user asks), image batch optimization + index audit (background).
9. **Infra polish from the May audit:** token-refresh retry of original request, suspended-account write block, `X-Teajia-Account` derived from JWT.

**Killed:** From VISION_AUDIT_7: `analytics_events` tracking table (vision: "Adrian packs every order, he knows what's selling"), `product_similarity` Jaccard cron and relationship-computed recommendations (hand-curation is the engine), tasting-data normalization framed as consolidation (the journal/compass split is intentional, see Track 5's real unification). From VISION_AUDIT_6: inventory health scores, vendor scorecards, sales-velocity dashboards (analytics theater at one store). Salvaged from it: the "Today" briefing card on the dashboard and the 6 quick wins list, individually judged, low priority.

**Source docs collapsed here:** STRUCTURAL_AUDIT_2026-06-10.md, VISION_AUDIT_6_ADMIN.md, VISION_AUDIT_7_TECHNICAL.md, ADMIN_CODE_SPLIT_PLAN.md, MCP_MOBILE_OAUTH_TODO.md, MCP_TOOLS_PORT_TODO.md, AUDIT_2026_05.md, product-architecture-initiative.md, product-architecture-prd.md, product-architecture-implementation.md, product-architecture-discussion-log.md, customer-contact-taxonomy.md (open auth items; taxonomy reference kept).

---

## Track 9 — Coherence & IA Finishing

*The rooms are built. Finish the hallways.*

The oldest structural criticism of Teajia is still half-true: six excellent sections that barely reference each other. The xref endpoints shipped in April; the UI that renders them mostly did not. This track is a finishing pass, not a rework: quiet cross-links, one clear answer to "where do my thoughts about a tea live," settled URL grammar, and the two homepage judgment calls only Adrian can make. The IA project's four-phase plan dissolves into this list.

**Shipped:** Public xref endpoints (`/api/public/xref/*/products`), Compass homelessness resolved (admin-only + journal redirect), orders/samples routes wired, bottom nav = sidebar parity (Read/Craft/Advise/Shop), sidebar editorial nav system, design tokens + lint enforcement ecosystem.

**Open, still valid (in order):**
1. **Render the cross-links:** "Teas mentioned in this piece" on articles, "explore these in the collection" on Learn modules, featured products on Advise projects. Endpoints exist; this is UI.
2. **One mental model for tea thoughts:** Journal (my tastings), Collection (my favorites), Cellar (what I own). Fix with naming, copy, and one connective view, not new tables.
3. **Homepage pair, Adrian judgment:** persistent explore-the-shop CTA above the fold + one-line value proposition. Constraint: the grounding lines' editorial voice is untouchable.
4. **URL grammar + findability:** `/account/saved` and `/account/journey` break the noun pattern; `/start` and `/for-your-space` are orphaned from nav. One renaming/linking pass (nav changes need explicit confirmation per house rules).
5. **Doc hygiene execution — shipped 2026-07-12:** INDEX, State, FLOWS, and SITE_MAP now route to current truth; competing TODOs and session artifacts are archived.
6. **Deferred until a second operator:** admin nav regrouped by product jobs (Sell/Source/Gather/Publish/Teach), admin tool taxonomy rebalancing, events' four-homes unification.

**Killed:** The IA review's full four-phase discovery project as a standalone initiative; its live findings are items 1–4 above and the rest resolved itself through shipping.

**Source docs collapsed here:** IA_REVIEW.md, POST_AUDIT_ROADMAP.md, FLOWS.md + SITE_MAP.md (kept as living references, corrected), product-architecture-phase-0-inventory.md + route-auth-inventory.md (kept as living references), brief/PERSONAS.md + brief/OFFER_AND_STRATEGY.md (kept as strategy references), brief/DEVELOPMENT_PRIORITIES.md, brief/SPRINT_APRIL_2026.md.

---

## Drift check against VISION.md

Three drifts accumulated across the 57 docs, now corrected:

1. **Building the network before anyone lives in it.** The plans kept generating infrastructure (directory, portability, badges, wholesale tiers) while the vision's actual next step, "onboard a few trusted people," sat unchecked since April. Corrected: Track 2 outranks every feature track.
2. **Re-adding computed and social features the vision explicitly killed.** Similarity engines, analytics pipelines, adaptive paths, member connections, and aggregation kept re-entering through audit docs written before or around the vision. Corrected: killed by name in Tracks 3, 5, 7, 8. The starred-notes promotion queue is the only community mechanism, because a human curates it.
3. **Specs outliving the decisions that replaced them.** ROADMAP marked Phase 1 "Next" three weeks after it shipped; ACTIVE_BRIEFS listed shipped work as active; AUDIT_2026-05 contradicted verified findings; the Consult/Learn redesign specs described pages that were deliberately built simpler. Corrected: this document plus the disposition below; the maintenance rule is that a plan doc that no longer matches main gets archived, not annotated.

---

## DOC DISPOSITION

One pass over `docs/`: KEEP stays where it is, MERGE means its live content is captured in the named track and the file moves to `_archive/` with a stamp, ARCHIVE means superseded/contradicted, SHIPPED means fully done (archive as history).

| Doc | Disposition | Note |
|---|---|---|
| ACTIVE_BRIEFS.md | ARCHIVE | Replace with pointer to this doc; stale since May |
| ADMIN_CODE_SPLIT_PLAN.md | MERGE → Track 8 | Waves 2–3 live there |
| AUDIT_2026-05.md | ARCHIVE | Contains verified-wrong claims; July audit supersedes |
| AUDIT_2026-07_READ_CURATE_CHINA.md | KEEP | Active work queue for Tracks 1 + 4; archive when findings close |
| AUDIT_2026_05.md | MERGE → Track 8 | Waves shipped; residual polish captured |
| AUSTRALIA_LAUNCH_PLAYBOOK.md | KEEP | The Track 2 checklist, still to run |
| COMPASS_SOCIAL_PLAN.md | ARCHIVE | Displaced by May pivot; survivor loop lives in Track 5 |
| CONTRIBUTOR_PROFILES_PLAN.md | KEEP | Active build spec (Track 3) |
| DESIGN_SYSTEM_PHASING.md | SHIPPED | Historical record |
| FIX_QUEUE.md | SHIPPED | All 24 fixes merged (PR #172) |
| FLOWS.md | KEEP | Living reference; needs correction pass (Track 9.5) |
| FRICTION_REVIEW.md | MERGE → Tracks 6 + 9 | 4 open Adrian-judgment items captured |
| IA_REVIEW.md | MERGE → Track 9 | Live findings are items 1–4 there |
| MAGAZINE_PLAN.md | KEEP | Locked design decisions; template-curation source of truth |
| MAGAZINE_WRITING_SURFACE_SPEC.md | KEEP | External-tool spec; build on demand, not a product roadmap item |
| MCP_MOBILE_OAUTH_TODO.md | MERGE → Track 8 | One iPhone verification task |
| MCP_TOOLS_PORT_TODO.md | SHIPPED | Self-marked DONE |
| MULTI_STORE_PLAN.md | KEEP | Tenancy + stock spine implementation reference |
| NETWORK_ROLLOUT_PLAN.md | SHIPPED | All 6 steps live; deliberate deferrals noted in Track 2 |
| NETWORK_UI_BRIEF.md | KEEP | Design spec for unbuilt surfaces 3/4/10/11 |
| ORDER_SYSTEM_PLAN.md | ARCHIVE | Contradicts WhatsApp-checkout vision; salvage list in Track 6.4 |
| POST_AUDIT_ROADMAP.md | MERGE → Tracks 5, 7, 9 | B1/B2/B3 captured; Body C stays killed-until-signal |
| ROADMAP.md | MERGE → this doc | Port Decision Log + What-NOT-to-Build into VISION.md appendix; phases superseded |
| RSVP_FRICTION_AUDIT.md | SHIPPED | All 17 closed |
| SEO_EDGE_META_PLAN.md | SHIPPED | Live since June 25 |
| SITE_MAP.md | KEEP | Living route map; correct stale orders/samples claims |
| STRUCTURAL_AUDIT_2026-06-10.md | KEEP | Active hardening checklist for Track 8 |
| TASTING_EVENT_PLAN.md | SHIPPED | Full feature on main since May 4 |
| TASTING_JOURNAL_BRIEF.md | MERGE → Track 5 | Small alignment items captured |
| TEA_DISCOVERY.md | KEEP | Live feature doc; two deferred items noted |
| TODO.md (docs/) | ARCHIVE | Valid Compass work is owned by Track 5; historical detail preserved under `_archive/session-artifacts-2026-07/` |
| UI_CONSISTENCY.md | KEEP | Enforced visual contract; 2 items to close |
| VISION_AUDIT_4_LEARNING.md | ARCHIVE | Mostly on the DO-NOT-BUILD list; salvage noted in Tracks 3 + 9 |
| VISION_AUDIT_5_EVENTS.md | ARCHIVE | Salvage (B3 loop) captured in Track 7 |
| VISION_AUDIT_6_ADMIN.md | ARCHIVE | Salvage (Today card, quick wins) captured in Track 8 |
| VISION_AUDIT_7_TECHNICAL.md | MERGE → Track 8 | Days old but partially contradicts vision; kills flagged |
| VISUAL_REVIEW.md | SHIPPED | Branch merged and deleted |
| brief/DEVELOPMENT_PRIORITIES.md | ARCHIVE | Items 1–14 shipped; the rest live in tracks |
| brief/OFFER_AND_STRATEGY.md | KEEP | Strategy reference alongside PERSONAS |
| brief/PERSONAS.md | KEEP | Still the audience ground truth |
| brief/SPRINT_APRIL_2026.md | SHIPPED | Loose ends already in root TODO |
| plan/compass-tasting-separation-followups.md | MERGE → Track 5 | Items 2–5 there; archive when schema unification ships |
| plan/consult-redesign-spec.md | ARCHIVE | Shipped page deliberately simpler; delete orphaned ServiceContent.tsx |
| plan/customer-contact-taxonomy.md | KEEP | Relationship-model reference; auth split open in Track 8 |
| plan/event-rsvp-capacity-engine.md | ARCHIVE | Superseded by event-system-v2 |
| plan/event-system-v2.md | KEEP | Canonical event spec; delivery + TicketCard open |
| plan/learn-archive-redesign.md | ARCHIVE | Carousels consciously dropped; revisit only on desire |
| plan/magazine-editor-spec.md | KEEP | AI layer + template dropdown still to build |
| plan/product-architecture-discussion-log.md | ARCHIVE | Reasoning preserved; open questions dispersed to tracks |
| plan/product-architecture-implementation.md | MERGE → Track 8 | Phases 4/6 remnants captured |
| plan/product-architecture-initiative.md | ARCHIVE | Philosophy captured; phases dispersed |
| plan/product-architecture-phase-0-inventory.md | KEEP | Live domain/state inventory |
| plan/product-architecture-prd.md | ARCHIVE | Requirements dispersed to Tracks 5/8/9 |
| plan/product-architecture-route-auth-inventory.md | KEEP | Maintained route/auth companion |
| plan/tea-compass-spec.md | ARCHIVE | Historical design reference; roadmap lives in TODO |
| plan/teajia-strategy-updated.md | ARCHIVE | Feb 2025, pre-D1 stack; VISION.md supersedes |
| plan/your-table-completion-plan.md | MERGE → Track 2 | Readiness UI item captured |

Living docs not in scope (untouched): VISION.md, ARCHITECTURE.md, CHANGELOG.md, STATE_OF_THE_SITE.md, INDEX.md, COLOR_RULES.md, DESIGN_SYSTEM.md, the operator guides (STORE_LAUNCH_PLAYBOOK, OPENING_STOCK_CSV_GUIDE, STORE_OPERATOR_DAILY_WORKFLOWS, MEMBERS_AND_ACCESS_GUIDE), OPERATIONAL_NOTES.md, root TODO.md.

---

## DO NEXT

The single ordered list across all tracks. Each line carries what happens if it is skipped.

| # | Do | Consequence |
|---|---|---|
| 1 | Fix K1 confirm-picks invoice inflation + repair corrupted invoices (Track 1) | Every confirm-picks invoice overcharges up to 100x; the money records of the business are wrong until this lands |
| 2 | Fix R1 journal-article blank screen + R6 draft links (Track 1) | The first trusted user who taps an article from their journal sees the app die; Read cannot be shown to anyone |
| 3 | Ship verification-code delivery, WhatsApp/email (Tracks 1/7) | Sign-in verification and event verification stay off in production; blocks onboarding real guests and China OTP fallback |
| 4 | Run the Australia launch checklist with the owner, end to end, flip public_enabled (Track 2) | The entire multi-tenant build stays theater; the business model remains unproven while the code rots |
| 5 | Onboard trusted Curate users + run events with real guests, collect feedback (Track 2) | Phase 0.6 enters its fourth month open; priorities keep being set by audits instead of users |
| 6 | China pass: rehost images (C2), fix hardcoded origins (C4), OTP fallback (C6) (Track 4) | Curate and the site fail on Adrian's own sourcing trips, the tool's primary place of use |
| 7 | Adrian's editorial pass: reference magazines → ~20 keeper templates → publish real articles + Barry's profile (Track 3) | The public face stays placeholder; this gates launch harder than any remaining code and only Adrian can do it |
| 8 | Build the starred-notes loop: per-section voice → member starring → admin promote queue (Track 5) | The human-curation engine that replaces reviews never activates; member tasting data stays a dead end |
| 9 | Tenancy-isolation test suite, then start worker modularization (Track 8) | A second store on an untested boundary invites cross-account leaks; the monolith stays too dangerous to hand to a second developer |
| 10 | Per-order detail page + confirmation copy pass (Tracks 1/6) | The customer's order story dead-ends at a missing page; the inquiry model looks unfinished exactly where trust is earned |

Everything below line 10 (post-session essay editor, cross-link rendering, code-split Wave 2, wholesale decision, coherence polish) sequences behind these without further discussion. When lines 1 through 7 are done, Teajia is not pre-launch anymore.
