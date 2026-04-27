# Information Architecture Review

> Kickoff scoping doc for the IA project. Frames where things currently live, what doesn't fit, and the proposed approach. **Not implementation.** A planning surface for future work.

**Created:** 2026-04-27
**Status:** Scoping only. Project not started.

---

## Why this project exists

The audit closed all 36 functional findings. Every flow works. But "every flow works" is not the same as "a new visitor can find what they need."

Right now, Teajia is six well-built tools sharing a navbar. The IA project is about turning those six tools into one coherent platform — by deciding **where things live, how they nest, what's named what, and how sections connect**.

This is design-shaped work, not bug-shaped work. It's slower, more strategic, and worth its own kickoff rather than tacking onto audit cleanup.

---

## Current taxonomy snapshot

**Top-level navigation (sidebar + bottom tabs):**
- Read (Magazine)
- Craft (Learn Hub)
- Advise (Consult)
- Shop
- Home

**Member-personal routes (`/account/*`):**
- `/account` — Your Table hub
- `/account/journal` — tasting journal
- `/account/collection` — personal tea collection
- `/account/journey` — sessions / seals / milestones
- `/account/orders` — purchase history (empty state only)
- `/account/samples` — sample requests (empty state only)
- `/account/saved` — saved articles
- `/account/history` — reading history
- `/account/settings` — profile + preferences

**Other public routes:** `/about`, `/events`, `/find-a-table`, `/store/:slug`, `/compass`, `/start`, `/for-your-space`, `/spaces`

**Admin (50+ tools across 6 groups):** Sell, Source, Gather, Publish, Teach, Network

---

## Observed friction (things that don't fit)

These are observations, not problems-with-fixes-attached. Each one is a question the IA project should answer.

### 1. Compass lives nowhere obvious

The Tea Compass is a major daily-use tool (27 files, 10K+ lines), yet `/compass` is reachable only via direct URL. It's not in the sidebar, it's not in a Member's Account Panel by default, it's tagged "source" in the admin tool registry. **Is it personal practice, sourcing, or both? Right now it's homeless.**

### 2. Three near-overlapping models for "thoughts about teas"

- **Tasting Journal** (`/account/journal`) — structured tasting notes
- **My Collection** (`/account/collection`) — favorites + personal tea inventory
- **Compass entries** — sourcing notes / preference profile

These overlap conceptually. A user logs a tasting → it's in the journal. They favorite the tea → it's in their collection. They take a Compass photo of the same tea → it's a third entry. **No unified "thinking about teas" view.**

### 3. Magazine and Shop are siloed

An article about Wuyi oolong doesn't link to the Wuyi oolong Teajia carries. A Learn module about gaiwans doesn't surface gaiwans for sale. A Consult portfolio project doesn't name the vessels in the photos. **The hallways between sections don't exist.** This is the "connective tissue" problem flagged in STATE_OF_THE_SITE.md.

### 4. Account Panel role boundaries are blurry

The four role views (Reader / Member / Operator / Staff) are well-built individually, but the *transitions* are unclear: when does a Member become an Operator? Is a Staff member with all six bundles equivalent to an Owner? Today the answer is "no" — there are owner-tier-only tools the Staff can never see. **Is that the right boundary, or should Staff with full bundles upgrade to a richer view?**

### 5. Events span four homes

Events appear in: public `/events`, admin `/admin/events`, member `/account/journey` (passport stamps), and `Account Panel "today" preview`. Each is a different mental model. **A single "events I care about" surface — across role views — would unify them.**

### 6. Marketing pages exist but aren't in main nav

`/start`, `/for-your-space`, `/spaces` are working B2B-leaning pages, but they're not in the sidebar. They're reachable from the homepage and from each other but feel orphaned. **Are they front-door pages or follow-up pages?**

### 7. The two empty-state Account routes

`/account/orders` and `/account/samples` exist but show only empty states (no backend wiring). They imply a feature that doesn't exist. **Build the feature, remove the route, or relabel the empty state.**

### 8. Admin tool taxonomy may be wrong

50+ tools across six groups (Sell / Source / Gather / Publish / Teach / Network) was a reasonable first cut, but in practice some groups have one entry and others have ten. Some tools could fit in two groups. **Walk the registry; rebalance.**

### 9. URL grammar is inconsistent

- `/account/journal` (noun)
- `/account/saved` (state adjective)
- `/account/history` (noun)
- `/account/samples` (noun)
- `/account/orders` (noun)
- `/account/settings` (noun)
- `/account/journey` (metaphor)

`saved` and `journey` break the noun pattern. Small thing, but it's the kind of grammar a careful visitor will notice.

### 10. The bottom tab bar and the sidebar render different mental models

Mobile bottom tabs: 5 items, the four sections + home.
Desktop sidebar: same four sections, but Compass + Cart + Spaces also appear in the utility footer.

**Are these the same nav rendered differently, or two different navs?** /CLAUDE.md says they should be "the same four sections rendered differently." In practice they've drifted.

---

## Proposed approach (when the project starts)

**This is a planning sketch, not a commitment.** The actual approach should be decided in a kickoff session.

### Phase 1 — Inventory + walkthrough (half-day)

Walk every route as four user types: a curious visitor, a tea-curious member, a Tea Master operator, the platform owner (Adrian). Note every moment of "wait, where is X?" or "I expected this to be under Y." This is qualitative; the deliverable is a friction log, not a fix list.

### Phase 2 — Taxonomy proposal (half-day)

Based on the friction log, propose:
- Top-level nav (does it stay 4 sections, or change?)
- Sub-section organization (does Compass go under Read, Craft, or Account?)
- Account routes (consolidation, renames, removals)
- Admin tool grouping (rebalance, rename, demote)
- URL grammar (one rule applied everywhere)

The deliverable is a *before-and-after* taxonomy diagram, not code.

### Phase 3 — Migration plan (half-day)

For each proposed change, decide: rename only? Redirect old URL? Move component? Update navigation only? The deliverable is a sequenced migration plan with effort estimates, ordered by blast-radius (rename first, structural moves last).

### Phase 4 — Implementation (multi-day, optional and incremental)

Ship the migration plan one chunk at a time, each as its own PR. Don't merge a big-bang IA change.

---

## What this project does NOT cover

- Visual design changes (those are `DESIGN_SYSTEM_PHASING.md`).
- New features (those are `POST_AUDIT_ROADMAP.md`, body C).
- Content rewrites (this is structure, not copy).
- Anything in /CLAUDE.md "DO NOT build" list.

The IA project is about **structure, naming, and findability**. Nothing else.

---

## Prerequisites

**Do `DESIGN_SYSTEM_PHASING.md` Phase A + B first.** Moving components around while tokens are still drifting is whack-a-mole. Once the build is one source of truth and tokens are honest, IA changes are surgical.

After that, IA can run on its own timeline. It is not blocked by anything else.

---

## Effort

Phases 1–3 (planning): ~1.5 days total, can be done in one focused week.
Phase 4 (implementation): variable, depends on the migration plan that comes out of Phase 3. Could be days; could be weeks.

The right cadence is **plan in one sitting, implement over many sittings.**
