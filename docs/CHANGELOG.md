# Teajia Changelog

> Shipped work, newest first. For what's next see ROADMAP.md. For active in-progress briefs see ACTIVE_BRIEFS.md.

## 2026-07

- 2026-07-12 — **Curate and purpose-based Inventory ingestion implementation complete and verified locally on the feature branch; not yet deployed.** Curate preserves its one-tap tea-first field sheet and saves every deliberate fragment, resumes drafts by account, separates sourcing decision from status, adds optional Journey/Visit context, and provides dimensional Library retrieval. The capture row is Tea / Teaware / Import. Pasted text and uploaded TXT, CSV, or JSON can be extracted into grouped review batches; images and PDFs retain their original evidence for manual review rather than implying OCR support. Import acceptance records Curate encounters without creating stock. Acquired quantities become reviewed receipt proposals, and possession is derived from accepted Inventory receipts—not from Curate decision or import acceptance. Physical Inventory independently classifies Working, Sample, or Personal purpose; readiness requires description, retail price, classification, and known stock; storefront publication remains explicit. Incoming is receipt-derived, stock changes use idempotent movements, and transfers require a valid destination holding with the same linked identity. Structured stock import reuses the movement primitives, while operational sample portions remain separate from physical Sample holdings. Additive migrations `099`–`107` include account/security boundaries and retry-safe import/receipt idempotency. Clean and legacy-through-`098` migration rehearsals, full automated verification, and both independent final reviews passed; Tasks 1–18 are complete. This entry records implementation status only and makes no push or production-rollout claim.

## 2026-06

- 2026-06-12 — **Sample capture minimum + permanent bag photo + library photo view.** Curate capture now commits with just a bag photo + vendor (name optional; auto-named "Vendor · date" when promoted to the library). Products gained a dedicated `bag_photo_url` slot (migration 085, backfilled from compass entries): set at promote from the capture photo, shown as a fourth "Bag" slot in the product image manager, replaceable but never removable, and untouched by product photo edits. The library browse gained a Photos layout toggle: a grid of bag shots with vendor + date captions and an inline per-entry note that saves on blur.
- 2026-06-06 — **MCP read tools + public shop assistant + AI discoverability** (PR #192). Voice/agent assistant gained read tools (`get_account_context`, `get_customer`, `list_invoices`, `get_invoice`, `sales_summary`) so it can report and look things up, not just mutate; new `sales:read` scope with write-implies-read so existing tokens keep working. Confirmation tickets now persist in D1 (`mcp_confirmation_tickets`) instead of per-isolate memory, fixing spurious "expired token" errors. New public, unauthenticated, read-only MCP at `/mcp/public` (`search_tea`, `get_tea`, `browse_catalog`, `prepare_order` → WhatsApp checkout link). OAuth: mobile consent passed via URL path (fixes Claude-mobile param drop, migration 082) + scope selection + real approver tier. AI discoverability: `public/llms.txt`, Organization/WebSite JSON-LD in `index.html`, Article JSON-LD on `ArticlePage`. Protocol bumped to `2025-06-18` with `structuredContent` + tool annotations.

## 2026-05

- 2026-05-10 — Relationship taxonomy tightened with owner-only private notes, contributor/contact links, and People audit suggestions.

## 2026-04

- 2026-04-27 — **Audit closed.** 36 of 37 findings shipped or verified; #36 (design system) phased into 4 stages in `DESIGN_SYSTEM_PHASING.md` for future pickup. Forward plan written in `POST_AUDIT_ROADMAP.md`; IA project scoped in `IA_REVIEW.md`; tradeoffs and revisit-if flags captured in `OPERATIONAL_NOTES.md`. State-of-the-site rewritten to reflect post-audit reality. Commits in this session: `1c57099`, `c653dde`, `39d730e`, `da98cd6`, `3433059`, `3d6507c`, `78d5f44`, `6961b34`.
- 2026-04-27 — PREVIEW_MODE machinery removed; /community route + page deleted (cut, not built) [git: 6961b34]
- 2026-04-27 — Auth re-verifies platform_role + membership from DB on every request; fail-closed on DB errors [git: 3d6507c]
- 2026-04-27 — Adoption queue + AccessView editor sheet shipped (#18 + #34) [git: 3433059]
- 2026-04-27 — Wave 2: bundle enforcement closure, audit-log columns, frontend wiring fixes, currency admin UI, multi-store tests [git: da98cd6]
- 2026-04-27 — Wave 1: bundle gates on events/venues/collections, silent-failure validation in cart + email handlers [git: 39d730e]
- 2026-04-27 — Bundle-aware StaffView + activity-log/stock-ledger auth tightening [git: c653dde]
- 2026-04-27 — Documentation consolidated: CHANGELOG.md, ACTIVE_BRIEFS.md, INDEX.md created; Layer 1/2 audit completed (240 flows mapped, 37 ranked findings, 18 redundant docs identified)
- 2026-04-27 — Mood and flavor filters on public storefront (Shop by Mood, Shop by Flavor) [git: 91de75a]
- 2026-04-27 — Platform-owner cross-account "acting as" with audit trail [git: f7df119]
- 2026-04-27 — Tasting taxonomy chip picker (mood/flavor) on tea profiles [git: ab2e762]
- 2026-04-27 — Article System unification plan finalized; Phases A–D shipped (legacy article reader deleted; DB article system operational)
- 2026-04-27 — Featured collections UI: editorial bands, public shop publishing, curator capabilities [git: 01cacb7]
- 2026-04-27 — Network system: orientation pages, destination consolidation, audit-identified gap closure [git: 29e8a30]
- 2026-04-25 — Learning section redesign spec finalized (visual abundance, carousel navigation, mobile-first)
- 2026-04-24 — Consult page redesign spec finalized (question-driven, path cards, immersive layout)
- 2026-04-24 — Event RSVP & Capacity engine spec completed (tiered capacity, magic links, waitlist)
- 2026-04-21 — Magazine editor spec finalized (D1 articles, Smart Paste, block editor)
- 2026-04-20 — Magazine UI locked: 4:5 format, gallery frame, push transitions, export-to-PNG
- 2026-04-18 — Event system v2 design locked (approval-based RSVP, flyer-first, story cards)
- 2026-04-15 — Network rollout plan finalized; Phase 1B architecture: profiles, listings, wholesale, cross-pollination
- 2026-04-12 — Compass social plan finalized; sharing, command center, tab restructure
- 2026-04-06 — Refactor: Learn section renamed to Craft across nav and copy [git: 902dba3]
- 2026-04-04 — Magazine editor shipped: admin article list, D1 block editor, Smart Paste system
- 2026-04-03 — Featured collections UI shipped; editorial bands on public storefront [git: 9880a67]
- 2026-04-01 — Gift sets created: 5 curated sets in Shop (Sampler, Journey, Chi, Starter, Entry)
- 2026-04-01 — Start Here page at `/start` — 6 entry paths for new visitors
- 2026-04-01 — Spaces page at `/spaces` — 3 Bali locations with WhatsApp inquiry
- 2026-04-01 — B2B inquiry page at `/for-your-space` — hotels, studios, retreat centers
- 2026-04-01 — Event post-session recap at `/event/:slug/recap` — teas served, purchase links, notes
- 2026-04-01 — Brewing QR card component shipped with WhatsApp share
- 2026-04-01 — Tasting journal view in AccountPanel — CustomerTasting history with sync indicator
- 2026-04-01 — Event gathering type label on public event pages

## 2026-03

- 2026-03-27 — Multi-store architecture Phase 1A shipped: accounts table, multi-tenancy, X-Teajia-Account header, RBAC role model, account members roster
- 2026-03-27 — Members & Access infrastructure shipped: tier model (Guest, Member, Staff, Manager, Owner), 6 capability bundles (Catalog, Stock, Publish, Gather, Sell, Members)
- 2026-03-27 — Network infrastructure: platform-tier endpoints, Tea Master invite flow, account access roster, bundle updates
- 2026-03-27 — 5 selected articles migrated to DB article system (Into the Wuyi Mountains, Laoshan Green, A Conversation with Master Lin, Tea in the Kitchen, Origin Story)
- 2026-03 — Platform audit completed: 240 flows mapped, 37 findings ranked (P0–P3), 18 redundant docs identified

## 2026-02 and earlier

Pre-audit history not fully reconstructed. Refer to git history for work before 2026-03.

---

**Maintenance:** Append new entries at top of relevant month section. Move shipped items out of ROADMAP.md when adding here.
